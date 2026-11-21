import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, Ticker, TickHandler } from '../types';
import { RestClient, intervalFor, requireProviderSymbol } from './base';
import type { Timeframe } from '@trade/core';
import { z } from 'zod';

/**
 * Yahoo Finance chart endpoint (query1.finance.yahoo.com/v8/finance/chart).
 * Free, no key — but it blocks most browser origins with CORS, so the
 * app should reach it through the proxy worker (transport: 'proxy').
 * GC=F is a gold FUTURES contract — a proxy for spot gold, never spot.
 * BTC-USD is a BTC reference. Intervals are native only: 1m, 5m, 15m,
 * 30m, 1h, 1d, 1wk, 1mo. 1m data is limited to ~7 days of history.
 * No WebSocket. Volume is reported in contracts/shares as returned.
 */

export const YAHOO_REST = 'https://query1.finance.yahoo.com';

const INTERVALS: Record<Timeframe, string | undefined> = {
  '1m': '1m', '3m': undefined, '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': undefined, '4h': undefined, '6h': undefined, '12h': undefined,
  '1D': '1d', '1W': '1wk', '1M': '1mo',
};

const RANGE_FOR: Record<Timeframe, string> = {
  '1m': '7d', '3m': '60d', '5m': '60d', '15m': '60d', '30m': '60d',
  '1h': '730d', '2h': '730d', '4h': '730d', '6h': '730d', '12h': '730d',
  '1D': 'max', '1W': 'max', '1M': 'max',
};

const yahooResponseSchema = z.object({
  chart: z.object({
    result: z.array(z.object({
      timestamp: z.array(z.number()),
      indicators: z.object({
        quote: z.array(z.object({
          open: z.array(z.number().nullable()),
          high: z.array(z.number().nullable()),
          low: z.array(z.number().nullable()),
          close: z.array(z.number().nullable()),
          volume: z.array(z.number().nullable()),
        })),
      }),
    })).nullable(),
    error: z.unknown().nullable(),
  }),
});

export function parseYahooChart(raw: unknown, timeframe: Timeframe, serverNowMs: number): ReturnType<typeof normalizeCandles>['candles'] {
  const parsed = yahooResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Yahoo chart: malformed response');
  const result = parsed.data.chart.result?.[0];
  if (result === undefined) throw new Error('Yahoo chart: empty result');
  const quote = result.indicators.quote[0];
  if (quote === undefined) throw new Error('Yahoo chart: no quote data');
  const rows: Array<{ timeMs: number; open: number; high: number; low: number; close: number; volume: number }> = [];
  result.timestamp.forEach((ts, i) => {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    if (open === null || open === undefined || high === null || high === undefined ||
        low === null || low === undefined || close === null || close === undefined) {
      return; // Skip null bars (market closed / missing data).
    }
    rows.push({
      timeMs: ts * 1000,
      open, high, low, close,
      volume: quote.volume[i] ?? 0,
    });
  });
  return normalizeCandles(rows, timeframe, serverNowMs).candles;
}

export class YahooAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'yahoo' as const;
  readonly displayName = 'Yahoo Finance';
  readonly capabilities = {
    timeframes: ['1m', '5m', '15m', '30m', '1h', '1D', '1W', '1M'] as Timeframe[],
    hasWs: false, historyDepth: 1000, needsKey: false, delayed: true,
  } as const;
  readonly supportedSymbols = ['XAU/USD', 'BTC/USDT'] as const;
  private readonly baseUrl: string;
  private readonly proxyUrl: string | undefined;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? YAHOO_REST;
    this.proxyUrl = options.proxyUrl;
  }

  private url(path: string): string {
    // Yahoo blocks browser CORS; route through the proxy worker when configured.
    if (this.proxyUrl !== undefined) {
      return `${this.proxyUrl}?url=${encodeURIComponent(`${this.baseUrl}${path}`)}`;
    }
    return `${this.baseUrl}${path}`;
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(request.symbol, 'yahoo'), request.symbol, 'Yahoo Finance');
    const interval = intervalFor(INTERVALS, request.timeframe, 'Yahoo Finance');
    const params = new URLSearchParams({ interval, range: RANGE_FOR[request.timeframe] });
    if (request.from !== undefined) params.set('period1', String(request.from));
    if (request.to !== undefined) params.set('period2', String(request.to));
    const raw = await this.fetchJson<unknown>(
      this.url(`/v8/finance/chart/${encodeURIComponent(providerSymbol)}?${params}`),
    );
    return parseYahooChart(raw, request.timeframe, Date.now());
  }

  async subscribe(): Promise<void> {
    throw new Error('Yahoo Finance has no WebSocket stream; use REST polling.');
  }

  async unsubscribe(): Promise<void> {
    // No-op: no live stream exists.
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'yahoo'), symbol, 'Yahoo Finance');
    const raw = await this.fetchJson<unknown>(
      this.url(`/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=1d&range=5d`),
    );
    const parsed = yahooResponseSchema.safeParse(raw);
    const result = parsed.success ? parsed.data.chart.result?.[0] : undefined;
    const quote = result?.indicators.quote[0];
    const closes = quote?.close.filter((c): c is number => c !== null && c !== undefined) ?? [];
    const last = closes[closes.length - 1];
    if (last === undefined) throw new Error('Yahoo ticker: no close price');
    return {
      provider: 'yahoo', symbol, providerSymbol,
      price: last, timestampMs: Date.now(),
    };
  }

  async getServerTime(): Promise<number> {
    return Date.now();
  }
}
