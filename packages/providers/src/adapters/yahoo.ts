import { alignCandleOpenTime } from '@trade/core';
import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, Ticker, TickHandler } from '../types';
import { UnsupportedError } from '../types';
import { RestClient, TickRouter, intervalFor, requireProviderSymbol } from './base';
import type { Candle, Timeframe } from '@trade/core';
import { z } from 'zod';

/**
 * Yahoo Finance chart data for COMEX gold futures (GC=F), reached through
 * the same-origin Vercel serverless function at /api/yahoo (see apps/web/api/yahoo.ts).
 * Free, no key — but Yahoo blocks browser origins with CORS, so the
 * browser must never call query1.finance.yahoo.com directly.
 *
 * GC=F is a gold FUTURES contract — a proxy for spot gold, never spot.
 * The provider label must always carry the futures qualifier.
 *
 * Native intervals only: 1m, 5m, 15m, 30m, 1h, 1d, 1wk, 1mo.
 * Unsupported app timeframes (3m, 2h, 4h, 6h, 12h) throw
 * UnsupportedError so the UI disables them instead of silently
 * substituting another interval. 1m data is limited to ~5 days of history.
 * No WebSocket: live ticks are POLLING — getTicker every ~5s, building
 * the forming candle from the polled price. Volume on polled ticks is 0
 * (Yahoo reports only a daily volume in the quote meta).
 */

export const YAHOO_PROXY_DEFAULT = '/api/yahoo';

/** The only symbol this adapter serves: the proxy allow-lists GC=F only. */
const YAHOO_GOLD_SYMBOL = 'GC=F';

const INTERVALS: Record<Timeframe, string | undefined> = {
  '1m': '1m', '3m': undefined, '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': undefined, '4h': undefined, '6h': undefined, '12h': undefined,
  '1D': '1d', '1W': '1wk', '1M': '1mo',
};

/** Range per timeframe; every value must be in the proxy's range allow-list. */
const RANGE_FOR: Partial<Record<Timeframe, string>> = {
  '1m': '5d',
  '5m': '1mo',
  '15m': '1mo',
  '30m': '1mo',
  '1h': '2y',
  '1D': 'max',
  '1W': 'max',
  '1M': 'max',
};

const POLL_INTERVAL_MS = 5_000;

const yahooResponseSchema = z.object({
  chart: z.object({
    result: z.array(z.object({
      timestamp: z.array(z.number()),
      meta: z.object({
        regularMarketPrice: z.number().nullable().optional(),
        regularMarketChangePercent: z.number().nullable().optional(),
        regularMarketVolume: z.number().nullable().optional(),
        regularMarketTime: z.number().nullable().optional(),
      }).optional(),
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
  const rows: { timeMs: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
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
  readonly displayName = 'Yahoo Finance (Gold futures GC=F)';
  readonly capabilities = {
    timeframes: ['1m', '5m', '15m', '30m', '1h', '1D', '1W', '1M'] as Timeframe[],
    hasWs: false, historyDepth: 1000, needsKey: false, delayed: false,
  } as const;
  readonly supportedSymbols = ['XAU/USD'] as const;
  private readonly baseUrl: string;
  private readonly router = new TickRouter();
  private readonly pollTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly formingCandles = new Map<string, Candle>();

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    // Same-origin Vercel function by default; override via options.baseUrl for tests.
    this.baseUrl = options.baseUrl ?? YAHOO_PROXY_DEFAULT;
  }

  private chartUrl(providerSymbol: string, interval: string, range: string, from?: number, to?: number): string {
    const params = new URLSearchParams({
      symbol: providerSymbol, interval, range,
    });
    if (from !== undefined) params.set('period1', String(from));
    if (to !== undefined) params.set('period2', String(to));
    return `${this.baseUrl}?${params.toString()}`;
  }

  /** Resolve the app symbol to GC=F; anything else is unsupported by this proxy path. */
  private goldSymbol(symbol: string): string {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'yahoo'), symbol, 'Yahoo Finance');
    if (providerSymbol !== YAHOO_GOLD_SYMBOL) {
      throw new UnsupportedError(
        `Yahoo Finance (Gold futures) serves XAU/USD (GC=F) only; ${symbol} is not available on this path`,
      );
    }
    return providerSymbol;
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const providerSymbol = this.goldSymbol(request.symbol);
    const interval = intervalFor(INTERVALS, request.timeframe, 'Yahoo Finance');
    const range = RANGE_FOR[request.timeframe];
    if (range === undefined) {
      throw new UnsupportedError(`Yahoo Finance does not support timeframe ${request.timeframe}`);
    }
    const raw = await this.fetchJson<unknown>(
      this.chartUrl(providerSymbol, interval, range, request.from, request.to),
    );
    const candles = parseYahooChart(raw, request.timeframe, Date.now());
    if (candles.length === 0) throw new Error('Yahoo chart: empty result');
    return candles;
  }

  /**
   * Live ticks via POLLING (no Yahoo WebSocket exists): getTicker every
   * ~5s and fold the polled price into the forming candle for the current
   * timeframe bucket. A new bucket opens at the previous candle's close.
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- interface ProviderAdapter mengharuskan return Promise
  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    this.goldSymbol(symbol);
    intervalFor(INTERVALS, timeframe, 'Yahoo Finance');
    const key = TickRouter.key(symbol, timeframe);
    this.router.set(symbol, timeframe, onTick);
    if (this.pollTimers.has(key)) return;
    const poll = (): void => {
      void this.pollTick(symbol, timeframe).catch(() => undefined);
    };
    poll();
    this.pollTimers.set(key, setInterval(poll, POLL_INTERVAL_MS));
  }

  private async pollTick(symbol: string, timeframe: Timeframe): Promise<void> {
    const key = TickRouter.key(symbol, timeframe);
    if (!this.pollTimers.has(key)) return;
    const ticker = await this.getTicker(symbol);
    const nowMs = this.nowMs;
    const openTime = alignCandleOpenTime(nowMs, timeframe);
    const price = ticker.price;
    const previous = this.formingCandles.get(key);
    let candle: Candle;
    if (previous?.time === openTime) {
      candle = {
        time: openTime,
        open: previous.open,
        high: Math.max(previous.high, price),
        low: Math.min(previous.low, price),
        close: price,
        volume: 0,
      };
    } else {
      const open = previous?.close ?? price;
      candle = {
        time: openTime,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
        volume: 0,
      };
    }
    this.formingCandles.set(key, candle);
    this.router.dispatch(symbol, timeframe, candle, true, 'yahoo', nowMs);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface ProviderAdapter mengharuskan return Promise
  async unsubscribe(symbol: string, timeframe: Timeframe): Promise<void> {
    const key = TickRouter.key(symbol, timeframe);
    this.router.delete(symbol, timeframe);
    const timer = this.pollTimers.get(key);
    if (timer !== undefined) {
      clearInterval(timer);
      this.pollTimers.delete(key);
    }
    this.formingCandles.delete(key);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const providerSymbol = this.goldSymbol(symbol);
    // Intraday 1m request (5s proxy cache) so polled prices stay fresh.
    const raw = await this.fetchJson<unknown>(
      this.chartUrl(providerSymbol, '1m', '1d'),
    );
    const parsed = yahooResponseSchema.safeParse(raw);
    if (!parsed.success) throw new Error('Yahoo ticker: malformed response');
    const result = parsed.data.chart.result?.[0];
    if (result === undefined) throw new Error('Yahoo ticker: empty result');
    const meta = result.meta;
    const metaPrice = meta?.regularMarketPrice;
    let price: number | undefined;
    if (metaPrice !== null && metaPrice !== undefined) {
      price = metaPrice;
    } else {
      const quote = result.indicators.quote[0];
      const closes = quote?.close.filter((c): c is number => c !== null) ?? [];
      price = closes[closes.length - 1];
    }
    if (price === undefined) throw new Error('Yahoo ticker: no price');
    const ticker: Ticker = {
      provider: 'yahoo', symbol, providerSymbol,
      price, timestampMs: Date.now(),
    };
    const changePct = meta?.regularMarketChangePercent;
    if (changePct !== null && changePct !== undefined) {
      ticker.change24hPct = changePct;
    }
    const volume = meta?.regularMarketVolume;
    if (volume !== null && volume !== undefined) {
      ticker.volume24h = volume;
    }
    return ticker;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface ProviderAdapter mengharuskan return Promise
  async getServerTime(): Promise<number> {
    return Date.now();
  }
}
