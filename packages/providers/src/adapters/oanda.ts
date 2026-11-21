import { alignCandleOpenTime, TIMEFRAMES } from '@trade/core';
import type { Candle, Timeframe } from '@trade/core';
import { z } from 'zod';
import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, ProviderRuntimeKeys, Ticker, TickHandler } from '../types';
import { UnsupportedError } from '../types';
import { RestClient, TickRouter, intervalFor, requireKeys, requireProviderSymbol } from './base';
import type { IntervalMap } from './base';

/**
 * OANDA v20 REST API (practice environment by default).
 * Auth: `Authorization: Bearer <personal access token>` on every request.
 * The token is user-supplied, entered in Settings and read from
 * localStorage at runtime only. It is NEVER stored in this package,
 * never logged, and never committed.
 * Docs: developer.oanda.com/rest-live-v20/ — instruments candles,
 * accounts pricing, accounts list.
 *
 * Instrument name XAU_USD is EXPECTED but NOT confirmed in the docs —
 * it is verified at runtime against the account instruments endpoint
 * before any candles are fetched, and the adapter refuses to serve
 * the symbol when the account does not list it.
 * Candles use price=M (midpoint OHLC). Volume is the tick count
 * reported by OANDA, not traded volume. Rate limit 120 req/s (429).
 * Live ticks are 3 s pricing polls, NOT websocket streaming.
 */

export const OANDA_PRACTICE_REST = 'https://api-fxpractice.oanda.com/v3';
export const OANDA_LIVE_REST = 'https://api-fxtrade.oanda.com/v3';

/**
 * OANDA has no M3 granularity (documented: M1, M2, M4, M5, M10, M15, M30),
 * so the 3m app timeframe is unsupported here and stays undefined.
 */
const INTERVALS: IntervalMap = {
  '1m': 'M1', '3m': undefined, '5m': 'M5', '15m': 'M15', '30m': 'M30',
  '1h': 'H1', '2h': 'H2', '4h': 'H4', '6h': 'H6', '12h': 'H12',
  '1D': 'D', '1W': 'W', '1M': 'M',
};

const oandaCandlesResponseSchema = z.object({
  instrument: z.string(),
  granularity: z.string(),
  candles: z.array(z.object({
    complete: z.boolean(),
    volume: z.number(),
    time: z.string(),
    mid: z.object({
      o: z.string(), h: z.string(), l: z.string(), c: z.string(),
    }).optional(),
  })),
});

const oandaAccountsResponseSchema = z.object({
  accounts: z.array(z.object({
    id: z.string(),
  }).passthrough()),
});

const oandaInstrumentsResponseSchema = z.object({
  instruments: z.array(z.object({
    name: z.string(),
  }).passthrough()),
});

const oandaPricingResponseSchema = z.object({
  prices: z.array(z.object({
    instrument: z.string(),
    bids: z.array(z.object({ price: z.string() }).passthrough()),
    asks: z.array(z.object({ price: z.string() }).passthrough()),
    time: z.string(),
  }).passthrough()),
});

export function parseOandaCandles(raw: unknown, timeframe: Timeframe, serverNowMs: number): Candle[] {
  const parsed = oandaCandlesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('OANDA candles: malformed response');
  }
  const rows: Array<{ timeMs: number; open: number; high: number; low: number; close: number; volume: number }> = [];
  for (const candle of parsed.data.candles) {
    if (candle.mid === undefined) continue;
    const timeMs = Date.parse(candle.time);
    if (!Number.isFinite(timeMs)) continue;
    rows.push({
      timeMs,
      open: Number(candle.mid.o), high: Number(candle.mid.h),
      low: Number(candle.mid.l), close: Number(candle.mid.c),
      volume: candle.volume,
    });
  }
  return normalizeCandles(rows, timeframe, serverNowMs).candles;
}

export class OandaAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'oanda' as const;
  readonly displayName = 'OANDA (Practice)';
  readonly capabilities = {
    // All app timeframes except 3m (no M3 granularity on OANDA).
    timeframes: TIMEFRAMES.filter((tf) => INTERVALS[tf] !== undefined),
    hasWs: false, historyDepth: 5000, needsKey: true, delayed: false,
  } as const;
  readonly supportedSymbols = ['XAU/USD'] as const;
  private readonly router = new TickRouter();
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly buckets = new Map<string, Candle>();
  private readonly baseUrl: string;
  private readonly keys: ProviderRuntimeKeys | undefined;
  private accountIdPromise: Promise<string> | undefined;
  private verifiedInstrument: Promise<void> | undefined;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? OANDA_PRACTICE_REST;
    this.keys = options.keys;
  }

  private token(): string {
    return requireKeys(this.keys, 'oanda');
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.token()}` };
  }

  /**
   * Resolve the account ID: the user-supplied one when set, otherwise the
   * first account on the token, fetched once and cached per adapter instance.
   */
  async accountId(): Promise<string> {
    const configured = this.keys?.oandaAccountId?.trim();
    if (configured !== undefined && configured !== '') return configured;
    if (this.accountIdPromise === undefined) {
      this.accountIdPromise = (async () => {
        const data = await this.fetchJson<unknown>(
          `${this.baseUrl}/accounts`,
          { headers: this.authHeaders() },
        );
        const parsed = oandaAccountsResponseSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error('OANDA accounts: malformed response');
        }
        const first = parsed.data.accounts[0];
        if (first === undefined) {
          throw new UnsupportedError('OANDA: no account found for this token');
        }
        return first.id;
      })();
    }
    return this.accountIdPromise;
  }

  /** Verify once per adapter instance that the account serves XAU_USD. */
  private verifyInstrument(): Promise<void> {
    if (this.verifiedInstrument === undefined) {
      this.verifiedInstrument = this.checkInstrument().catch((error: unknown) => {
        // A failed check is not a completed verification — allow a retry
        // on the next call instead of poisoning the adapter.
        this.verifiedInstrument = undefined;
        throw error;
      });
    }
    return this.verifiedInstrument;
  }

  private async checkInstrument(): Promise<void> {
    const accountId = await this.accountId();
    const data = await this.fetchJson<unknown>(
      `${this.baseUrl}/accounts/${encodeURIComponent(accountId)}/instruments?instruments=XAU_USD`,
      { headers: this.authHeaders() },
    );
    const parsed = oandaInstrumentsResponseSchema.safeParse(data);
    if (!parsed.success || parsed.data.instruments.length === 0) {
      throw new UnsupportedError('OANDA account does not serve XAU_USD');
    }
  }

  /** Mid price from the pricing endpoint: (best bid + best ask) / 2. */
  private async fetchMidPrice(providerSymbol: string): Promise<{ price: number; timestampMs: number }> {
    const accountId = await this.accountId();
    const raw = await this.fetchJson<unknown>(
      `${this.baseUrl}/accounts/${encodeURIComponent(accountId)}/pricing?instruments=${encodeURIComponent(providerSymbol)}`,
      { headers: this.authHeaders() },
    );
    const parsed = oandaPricingResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('OANDA pricing: malformed response');
    }
    const entry = parsed.data.prices[0];
    if (entry === undefined) {
      throw new UnsupportedError('OANDA pricing returned no price for XAU_USD');
    }
    const bid = entry.bids[0];
    const ask = entry.asks[0];
    if (bid === undefined || ask === undefined) {
      throw new UnsupportedError('OANDA pricing returned no bid/ask for XAU_USD');
    }
    const price = (Number(bid.price) + Number(ask.price)) / 2;
    return { price, timestampMs: Date.parse(entry.time) };
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(request.symbol, 'oanda'), request.symbol, 'OANDA');
    const granularity = intervalFor(INTERVALS, request.timeframe, 'OANDA');
    await this.verifyInstrument();
    const params = new URLSearchParams({
      price: 'M',
      granularity,
      count: String(Math.min(request.limit ?? 500, 5000)),
    });
    if (request.from !== undefined) {
      params.set('from', new Date(request.from * 1000).toISOString());
    }
    if (request.to !== undefined) {
      params.set('to', new Date(request.to * 1000).toISOString());
    }
    const raw = await this.fetchJson<unknown>(
      `${this.baseUrl}/instruments/${encodeURIComponent(providerSymbol)}/candles?${params}`,
      { headers: this.authHeaders() },
    );
    // OANDA has no time endpoint; use local time as the server-time
    // reference for forming-vs-closed, same as the Twelve Data adapter.
    return parseOandaCandles(raw, request.timeframe, Date.now());
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'oanda'), symbol, 'OANDA');
    const { price, timestampMs } = await this.fetchMidPrice(providerSymbol);
    return {
      provider: 'oanda', symbol, providerSymbol,
      price, timestampMs,
    };
  }

  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'oanda'), symbol, 'OANDA');
    intervalFor(INTERVALS, timeframe, 'OANDA');
    this.token(); // Fail fast when no user token is configured.
    const key = TickRouter.key(symbol, timeframe);
    this.router.set(symbol, timeframe, onTick);
    if (this.timers.has(key)) return;
    // Polling, NOT websocket streaming: the forming candle is rebuilt
    // from a pricing poll every 3 s.
    const timer = setInterval(() => {
      void this.pollTick(symbol, timeframe, providerSymbol);
    }, 3000);
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

  /** One pricing poll: update the forming-candle bucket, dispatch, never throw. */
  private async pollTick(symbol: string, timeframe: Timeframe, providerSymbol: string): Promise<void> {
    try {
      const { price } = await this.fetchMidPrice(providerSymbol);
      const nowMs = Date.now();
      const openTime = alignCandleOpenTime(nowMs, timeframe);
      const key = TickRouter.key(symbol, timeframe);
      const existing = this.buckets.get(key);
      const bucket: Candle = existing !== undefined && existing.time === openTime
        ? {
          ...existing,
          high: Math.max(existing.high, price),
          low: Math.min(existing.low, price),
          close: price,
        }
        : { time: openTime, open: price, high: price, low: price, close: price, volume: 0 };
      this.buckets.set(key, bucket);
      this.router.dispatch(symbol, timeframe, { ...bucket }, true, 'oanda', nowMs);
    } catch {
      // Poll failed (network, rate limit, auth) — skip this tick; the
      // next poll retries. Never let the interval throw.
    }
  }

  async getServerTime(): Promise<number> {
    // OANDA has no dedicated time endpoint; use local time. Documented fallback.
    return Date.now();
  }
}
