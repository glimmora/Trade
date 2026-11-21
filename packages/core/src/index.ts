import { z } from 'zod';

/** A single OHLCV candle. `time` is the candle open time, in UTC seconds. */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Supported chart timeframes. */
export type Timeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '12h'
  | '1D'
  | '1W'
  | '1M';

export const TIMEFRAMES: readonly Timeframe[] = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '12h',
  '1D',
  '1W',
  '1M',
] as const;

/** Provider identifiers (free public market-data providers). */
export type ProviderId =
  | 'binance'
  | 'bybit'
  | 'okx'
  | 'kraken'
  | 'coinbase'
  | 'gate'
  | 'twelvedata'
  | 'yahoo'
  | 'stooq';

export const PROVIDER_IDS: readonly ProviderId[] = [
  'binance',
  'bybit',
  'okx',
  'kraken',
  'coinbase',
  'gate',
  'twelvedata',
  'yahoo',
  'stooq',
] as const;

/** A tradeable symbol. Adding a symbol is a config-only change. */
export interface SymbolInfo {
  /** Display symbol, e.g. "BTC/USDT". */
  id: string;
  /** Human label, e.g. "Bitcoin / Tether". */
  label: string;
  /** Instrument kind: spot crypto, tokenized gold, or spot gold. */
  kind: 'crypto' | 'tokenized-gold' | 'spot-gold';
  /** Price tick size / decimal precision for display. */
  precision: number;
  /** Provider-specific symbols, keyed by provider id. */
  providerSymbols: Partial<Record<ProviderId, string>>;
}

export const SYMBOLS: readonly SymbolInfo[] = [
  {
    id: 'BTC/USDT',
    label: 'Bitcoin / Tether',
    kind: 'crypto',
    precision: 2,
    providerSymbols: {
      binance: 'BTCUSDT',
      bybit: 'BTCUSDT',
      okx: 'BTC-USDT',
      kraken: 'XBT/USDT',
      coinbase: 'BTC-USD',
      gate: 'BTC_USDT',
    },
  },
  {
    id: 'XAU/USD',
    label: 'Spot Gold / US Dollar',
    kind: 'spot-gold',
    precision: 2,
    providerSymbols: {
      twelvedata: 'XAU/USD',
      yahoo: 'GC=F',
      stooq: 'xauusd',
    },
  },
  {
    id: 'XAUT/USDT',
    label: 'Tokenized Gold / Tether',
    kind: 'tokenized-gold',
    precision: 2,
    providerSymbols: {
      binance: 'XAUTUSDT',
      bybit: 'XAUTUSDT',
      okx: 'XAUT-USDT',
      kraken: 'XAUT/USD',
      gate: 'XAUT_USDT',
    },
  },
] as const;

/** Duration of one timeframe step, in milliseconds. */
export function timeframeMs(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1m':
      return 60_000;
    case '3m':
      return 3 * 60_000;
    case '5m':
      return 5 * 60_000;
    case '15m':
      return 15 * 60_000;
    case '30m':
      return 30 * 60_000;
    case '1h':
      return 3_600_000;
    case '2h':
      return 2 * 3_600_000;
    case '4h':
      return 4 * 3_600_000;
    case '6h':
      return 6 * 3_600_000;
    case '12h':
      return 12 * 3_600_000;
    case '1D':
      return 86_400_000;
    case '1W':
      return 7 * 86_400_000;
    case '1M':
      // Calendar month: handled by alignCandleOpenTime via UTC month math.
      return 30 * 86_400_000;
  }
}

/**
 * Align a timestamp (UTC milliseconds) down to the open time of its
 * candle for the given timeframe. Returns UTC seconds.
 * Monthly candles align to the first day of the UTC month.
 */
export function alignCandleOpenTime(timeMs: number, timeframe: Timeframe): number {
  if (timeframe === '1M') {
    const date = new Date(timeMs);
    return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000);
  }
  const stepMs = timeframeMs(timeframe);
  return Math.floor(Math.floor(timeMs / stepMs) * stepMs / 1000);
}

/** Zod schema for a normalized candle (contract for provider adapters). */
export const candleSchema = z.object({
  time: z.number().int().nonnegative(),
  open: z.number().finite(),
  high: z.number().finite(),
  low: z.number().finite(),
  close: z.number().finite(),
  volume: z.number().finite().nonnegative(),
});

export const candlesSchema = z.array(candleSchema);

/** Validate an unknown payload as normalized candles. */
export function parseCandles(value: unknown): Candle[] {
  return candlesSchema.parse(value);
}

/** De-duplicate candles by open time, keeping the last occurrence. */
export function dedupeCandles(candles: readonly Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const candle of candles) {
    byTime.set(candle.time, candle);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Format a price with the symbol's precision. */
export function formatPrice(price: number, precision: number): string {
  return price.toFixed(precision);
}
