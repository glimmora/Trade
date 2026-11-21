import { alignCandleOpenTime } from '@trade/core';
import type { ProviderAdapter, ProviderClientOptions, Ticker, TickHandler } from '../types';
import { RestClient, TickRouter, UnsupportedError } from './base';
import type { Candle, Timeframe } from '@trade/core';
import { z } from 'zod';

/**
 * TradingView scanner quote endpoint (scanner.tradingview.com/symbol),
 * no key required. Serves a live QUOTE SNAPSHOT only — close/bid/ask
 * and day OHLC — there is no candle endpoint, so getCandles() always
 * throws UnsupportedError and the hook's fallback moves on honestly.
 * Never invent candles from snapshots.
 *
 * Only the symbol mappings verified live are wired:
 *   XAU/USD  -> OANDA:XAUUSD    (spot gold quote)
 *   BTC/USDT -> BINANCE:BTCUSDT  (BTC quote)
 * (TVC:GOLD and FX:EURUSD were also verified as reachable scanner
 * symbols, but they map to no app symbol and are deliberately not
 * wired — the table stays small and explicit.)
 *
 * Price is `close`, falling back to the mid of bid/ask when close is
 * absent. `change` is the scanner's day change, reported as
 * change24hPct. Live ticks are POLLING, not streaming: subscribe()
 * re-fetches the snapshot every 5 s.
 */

export const TRADINGVIEW_SCANNER = 'https://scanner.tradingview.com';

/** Poll interval for live ticks (ms). */
export const TRADINGVIEW_POLL_MS = 5_000;

/** App symbol -> TradingView scanner symbol. Only verified mappings. */
const TV_SYMBOLS: Record<string, string> = {
  'XAU/USD': 'OANDA:XAUUSD',
  'BTC/USDT': 'BINANCE:BTCUSDT',
};

const tradingViewSymbolSchema = z.object({
  close: z.number().optional(),
  bid: z.number().optional(),
  ask: z.number().optional(),
  open: z.number().optional(),
  high: z.number().optional(),
  low: z.number().optional(),
  volume: z.number().optional(),
  change: z.number().optional(),
});

export type TradingViewSymbolQuote = z.infer<typeof tradingViewSymbolSchema>;

export function parseTradingViewSymbol(raw: unknown): TradingViewSymbolQuote {
  const parsed = tradingViewSymbolSchema.safeParse(raw);
  if (!parsed.success) throw new Error('TradingView Scanner: malformed response');
  return parsed.data;
}

function tvSymbolFor(symbol: string): string {
  const tvSymbol = TV_SYMBOLS[symbol];
  if (tvSymbol === undefined) {
    throw new UnsupportedError(`TradingView Scanner does not support ${symbol}`);
  }
  return tvSymbol;
}

export class TradingViewScannerAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'tradingview' as const;
  readonly displayName = 'TradingView Scanner';
  readonly capabilities = {
    timeframes: [] as Timeframe[],
    hasWs: false, historyDepth: 0, needsKey: false, delayed: false,
  } as const;
  readonly supportedSymbols = ['XAU/USD', 'BTC/USDT'] as const;
  private readonly router = new TickRouter();
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly buckets = new Map<string, Candle>();
  private readonly baseUrl: string;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? TRADINGVIEW_SCANNER;
  }

  async getCandles(): Promise<Candle[]> {
    // Snapshot only: the scanner has no candle endpoint. Throwing
    // UnsupportedError (never an empty or invented series) lets the
    // hook's fallback move on to a provider that serves candles.
    throw new UnsupportedError(
      'TradingView Scanner serves quote snapshots only — it has no candles.',
    );
  }

  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    tvSymbolFor(symbol); // Fail fast on an unmapped symbol.
    const key = TickRouter.key(symbol, timeframe);
    this.router.set(symbol, timeframe, onTick);
    if (this.timers.has(key)) return;
    // Polling, NOT websocket streaming: the forming candle is rebuilt
    // from a snapshot poll every 5 s.
    const timer = setInterval(() => {
      void this.pollTick(symbol, timeframe);
    }, TRADINGVIEW_POLL_MS);
    this.timers.set(key, timer);
  }

  async unsubscribe(symbol: string, timeframe: Timeframe): Promise<void> {
    const key = TickRouter.key(symbol, timeframe);
    const timer = this.timers.get(key);
    if (timer !== undefined) {
      clearInterval(timer);
      this.timers.delete(key);
    }
    this.buckets.delete(key);
    this.router.delete(symbol, timeframe);
  }

  /** One snapshot poll: update the forming-candle bucket, dispatch, never throw. */
  private async pollTick(symbol: string, timeframe: Timeframe): Promise<void> {
    try {
      const ticker = await this.getTicker(symbol);
      const nowMs = Date.now();
      const openTime = alignCandleOpenTime(nowMs, timeframe);
      const key = TickRouter.key(symbol, timeframe);
      const existing = this.buckets.get(key);
      const bucket: Candle = existing !== undefined && existing.time === openTime
        ? {
          ...existing,
          high: Math.max(existing.high, ticker.price),
          low: Math.min(existing.low, ticker.price),
          close: ticker.price,
        }
        : { time: openTime, open: ticker.price, high: ticker.price, low: ticker.price, close: ticker.price, volume: 0 };
      this.buckets.set(key, bucket);
      this.router.dispatch(symbol, timeframe, { ...bucket }, true, 'tradingview', nowMs);
    } catch {
      // Poll failed (network, rate limit) — skip this tick; the next
      // poll retries. Never let the interval throw.
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const tvSymbol = tvSymbolFor(symbol);
    const params = new URLSearchParams({
      symbol: tvSymbol,
      fields: 'close,bid,ask,open,high,low,volume,change',
    });
    const quote = parseTradingViewSymbol(
      await this.fetchJson<unknown>(`${this.baseUrl}/symbol?${params}`),
    );
    let price = quote.close;
    if (price === undefined && quote.bid !== undefined && quote.ask !== undefined) {
      price = (quote.bid + quote.ask) / 2;
    }
    if (price === undefined) {
      throw new Error(`TradingView Scanner: no price for ${tvSymbol}`);
    }
    const ticker: Ticker = {
      provider: 'tradingview', symbol, providerSymbol: tvSymbol,
      price, timestampMs: Date.now(),
    };
    if (quote.change !== undefined) {
      ticker.change24hPct = quote.change;
    }
    return ticker;
  }

  async getServerTime(): Promise<number> {
    // The scanner has no time endpoint; use local time, same as Yahoo/OANDA.
    return Date.now();
  }
}
