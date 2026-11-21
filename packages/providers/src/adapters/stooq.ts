import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, Ticker } from '../types';
import { RestClient, requireProviderSymbol } from './base';
import type { Candle, Timeframe } from '@trade/core';

/**
 * Stooq CSV (stooq.com/q/d/l/) — free, no key, DAILY data only.
 * Delayed fallback for spot gold (xauusd) and BTC (btcusd).
 * CSV columns: Date,Open,High,Low,Close,Volume. Volume is often 0.
 * No intraday, no WebSocket, no server time. History is daily bars;
 * the only supported timeframe is 1D. Never present as live.
 */

export const STOOQ_BASE = 'https://stooq.com';

export function parseStooqCsv(csv: string, serverNowMs: number): ReturnType<typeof normalizeCandles>['candles'] {
  const lines = csv.trim().split('\n');
  const rows: Array<{ timeMs: number; open: number; high: number; low: number; close: number; volume: number }> = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    if (parts.length < 5) continue;
    const [date, open, high, low, close, volume] = parts;
    if (date === undefined || open === undefined || high === undefined ||
        low === undefined || close === undefined) continue;
    const timeMs = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(timeMs)) continue;
    rows.push({
      timeMs,
      open: Number(open), high: Number(high), low: Number(low),
      close: Number(close), volume: Number(volume ?? '0'),
    });
  }
  return normalizeCandles(rows, '1D', serverNowMs).candles;
}

export class StooqAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'stooq' as const;
  readonly displayName = 'Stooq';
  readonly capabilities = {
    timeframes: ['1D'] as Timeframe[],
    hasWs: false, historyDepth: 10000, needsKey: false, delayed: true,
  } as const;
  readonly supportedSymbols = ['XAU/USD'] as const;
  private readonly baseUrl: string;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? STOOQ_BASE;
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    if (request.timeframe !== '1D') {
      throw new Error('Stooq serves daily (1D) data only.');
    }
    const providerSymbol = requireProviderSymbol(providerSymbolFor(request.symbol, 'stooq'), request.symbol, 'Stooq');
    const csv = await this.fetchText(
      `${this.baseUrl}/q/d/l/?s=${encodeURIComponent(providerSymbol)}&i=d`,
    );
    const candles = parseStooqCsv(csv, Date.now());
    return request.limit !== undefined ? candles.slice(-request.limit) : candles;
  }

  async subscribe(): Promise<void> {
    throw new Error('Stooq has no live stream; daily CSV only.');
  }

  async unsubscribe(): Promise<void> {
    // No-op: no live stream exists.
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const candles = await this.getCandles({ symbol, timeframe: '1D', limit: 1 });
    const last = candles[candles.length - 1];
    if (last === undefined) throw new Error('Stooq ticker: no data');
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'stooq'), symbol, 'Stooq');
    return {
      provider: 'stooq', symbol, providerSymbol,
      price: last.close, timestampMs: last.time * 1000,
    };
  }

  async getServerTime(): Promise<number> {
    return Date.now();
  }
}
