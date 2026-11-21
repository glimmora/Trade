import type { Candle, ProviderId, Timeframe } from '@trade/core';

/**
 * Provider adapter interface.
 *
 * Every adapter normalizes to the same contract: UTC-second candle open
 * times, OHLCV numbers, ascending order, de-duplicated. Adapters must
 * never mix providers inside one series — one series, one provider.
 */
export interface ProviderCapabilities {
  /** Timeframes this provider can serve natively (no resampling). */
  timeframes: readonly Timeframe[];
  /** True when a live WebSocket stream is implemented. */
  hasWs: boolean;
  /** Approximate maximum history depth, in candles, per request series. */
  historyDepth: number;
  /** True when the provider needs a user-supplied key at runtime. */
  needsKey: boolean;
  /** True when history is delayed rather than live (e.g. daily CSV). */
  delayed: boolean;
}

export interface Ticker {
  provider: ProviderId;
  /** App-level symbol id, e.g. "BTC/USDT". */
  symbol: string;
  /** Provider-native symbol, e.g. "BTCUSDT". */
  providerSymbol: string;
  price: number;
  /** 24h change in percent, when the provider reports it. */
  change24hPct?: number;
  /** 24h volume in base-asset units, when reported. */
  volume24h?: number;
  /** Server timestamp of the quote, UTC milliseconds. */
  timestampMs: number;
}

/** One live tick: the current (possibly still forming) candle. */
export interface LiveTick {
  provider: ProviderId;
  symbol: string;
  candle: Candle;
  /** True while the candle is still forming; false once closed. */
  isForming: boolean;
  /** Server timestamp of the tick, UTC milliseconds. */
  timestampMs: number;
}

export type TickHandler = (tick: LiveTick) => void;

export interface CandleRequest {
  /** App-level symbol id, e.g. "BTC/USDT". */
  symbol: string;
  timeframe: Timeframe;
  /** Inclusive lower bound, UTC seconds. Omit for "most recent N". */
  from?: number;
  /** Inclusive upper bound, UTC seconds. Omit for "most recent N". */
  to?: number;
  /** Maximum candles to return (provider limits apply). */
  limit?: number;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;
  /** App-level symbol ids this adapter can serve. */
  readonly supportedSymbols: readonly string[];
  getCandles(request: CandleRequest): Promise<Candle[]>;
  subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void>;
  unsubscribe(symbol: string, timeframe: Timeframe): Promise<void>;
  getTicker(symbol: string): Promise<Ticker>;
  getServerTime(): Promise<number>;
}

/** Runtime credentials supplied by the user in Settings (localStorage only). */
export interface ProviderRuntimeKeys {
  /** Twelve Data key, supplied by the user at runtime. Never committed. */
  twelvedata?: string;
  /** OANDA personal access token, supplied by the user at runtime. Never committed. */
  oanda?: string;
  /** OANDA account ID, supplied by the user at runtime. Optional; blank means auto-discovered from the account list. Never committed. */
  oandaAccountId?: string;
}

/** How a provider is reached: direct from the browser, or via the proxy worker. */
export type Transport = 'direct' | 'proxy';

export interface ProviderClientOptions {
  /** Base URL override (used by tests and by the proxy transport). */
  baseUrl?: string;
  /** Proxy worker origin, e.g. "https://trade-proxy.example.workers.dev". */
  proxyUrl?: string;
  transport?: Transport;
  keys?: ProviderRuntimeKeys;
  /** Injectable fetch, for tests. Defaults to global fetch. */
  fetchFn?: typeof fetch;
  /** Injectable clock, for tests. Defaults to Date.now. */
  nowFn?: () => number;
}

/** Error thrown when a provider rate-limits the client (HTTP 429). */
export class RateLimitError extends Error {
  readonly retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'RateLimitError';
    if (retryAfterMs !== undefined) {
      this.retryAfterMs = retryAfterMs;
    }
  }
}

/** Error thrown when a provider does not support a symbol/timeframe. */
export class UnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedError';
  }
}
