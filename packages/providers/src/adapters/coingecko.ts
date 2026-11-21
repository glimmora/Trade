import { alignCandleOpenTime } from '@trade/core';
import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, Ticker, TickHandler } from '../types';
import { RestClient, TickRouter, requireProviderSymbol } from './base';
import type { Candle, Timeframe } from '@trade/core';
import { z } from 'zod';

/**
 * CoinGecko public API (api.coingecko.com/api/v3), no key required.
 * Serves TOKENIZED GOLD only: PAXG/USDT (coin id pax-gold) and
 * XAUT/USDT (coin id tether-gold). These are tokenized gold, NEVER
 * spot gold (XAU/USD) — the two instruments are never substituted.
 *
 * OHLC granularity is AUTOMATIC and coarse — the endpoint takes only a
 * `days` window, never a candle size: days=1 returns 30-minute candles,
 * days=2-30 returns 4-hour candles. The app timeframe is therefore
 * mapped to the smallest window that covers it, and the candles
 * returned are at the provider's granularity, not the requested one:
 *   1m/3m/5m/15m/30m -> days=1,  30m candles
 *   1h/2h/4h/6h/12h  -> days=7,  4h candles
 *   1D/1W/1M         -> days=30, 4h candles
 * History is short (at most ~180 candles at days=30) and the OHLC
 * endpoint reports no volume (0) and takes no from/to window — a
 * requested window is applied locally after the fetch.
 *
 * Live ticks are POLLING, not streaming: subscribe() re-fetches the
 * simple-price ticker every 30 s. CoinGecko rate-limits aggressively
 * (HTTP 429); the shared REST client backs off and surfaces
 * RateLimitError, and a failed poll is skipped, never retried inline,
 * so the poller never hammers the API.
 */

export const COINGECKO_REST = 'https://api.coingecko.com/api/v3';

/** Poll interval for live ticks (ms). Deliberately slow: free-tier 429s. */
export const COINGECKO_POLL_MS = 30_000;

const GRANULARITY = {
  '1m': { days: 1, granularity: '30m' },
  '3m': { days: 1, granularity: '30m' },
  '5m': { days: 1, granularity: '30m' },
  '15m': { days: 1, granularity: '30m' },
  '30m': { days: 1, granularity: '30m' },
  '1h': { days: 7, granularity: '4h' },
  '2h': { days: 7, granularity: '4h' },
  '4h': { days: 7, granularity: '4h' },
  '6h': { days: 7, granularity: '4h' },
  '12h': { days: 7, granularity: '4h' },
  '1D': { days: 30, granularity: '4h' },
  '1W': { days: 30, granularity: '4h' },
  '1M': { days: 30, granularity: '4h' },
} as const satisfies Record<Timeframe, { days: number; granularity: Timeframe }>;

/** Raw CoinGecko OHLC row: [timestampMs, open, high, low, close]. No volume. */
const coingeckoOhlcRowSchema = z.tuple([
  z.number(), z.number(), z.number(), z.number(), z.number(),
]).rest(z.unknown());

const coingeckoOhlcSchema = z.array(coingeckoOhlcRowSchema);

const coingeckoSimplePriceSchema = z.record(
  z.string(),
  z.object({ usd: z.number(), usd_24h_change: z.number().optional() }),
);

export function parseCoinGeckoOhlc(
  raw: unknown,
  granularity: Timeframe,
  serverNowMs: number,
): Candle[] {
  const parsed = coingeckoOhlcSchema.safeParse(raw);
  if (!parsed.success) throw new Error('CoinGecko OHLC: malformed response');
  const rows = parsed.data.map(([timeMs, open, high, low, close]) => ({
    timeMs, open, high, low, close, volume: 0,
  }));
  // Normalize against the provider's real granularity, NOT the requested
  // timeframe: aligning 4h candles to a 1W/1M grid would collapse them
  // onto a single open time and de-duplication would drop the series.
  return normalizeCandles(rows, granularity, serverNowMs).candles;
}

export class CoinGeckoAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'coingecko' as const;
  readonly displayName = 'CoinGecko';
  readonly capabilities = {
    timeframes: Object.keys(GRANULARITY) as Timeframe[],
    hasWs: false, historyDepth: 180, needsKey: false, delayed: false,
  } as const;
  readonly supportedSymbols = ['PAXG/USDT', 'XAUT/USDT'] as const;
  private readonly router = new TickRouter();
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly buckets = new Map<string, Candle>();
  private readonly baseUrl: string;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? COINGECKO_REST;
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const coinId = requireProviderSymbol(providerSymbolFor(request.symbol, 'coingecko'), request.symbol, 'CoinGecko');
    const { days, granularity } = GRANULARITY[request.timeframe];
    const params = new URLSearchParams({
      vs_currency: 'usd',
      days: String(days),
    });
    const raw = await this.fetchJson<unknown>(
      `${this.baseUrl}/coins/${encodeURIComponent(coinId)}/ohlc?${params}`,
    );
    let candles = parseCoinGeckoOhlc(raw, granularity, await this.getServerTime());
    // The OHLC endpoint takes no from/to window: filter locally.
    if (request.from !== undefined) {
      candles = candles.filter((candle) => candle.time >= request.from);
    }
    if (request.to !== undefined) {
      candles = candles.filter((candle) => candle.time <= request.to);
    }
    if (request.limit !== undefined) {
      candles = candles.slice(-request.limit);
    }
    return candles;
  }

  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    requireProviderSymbol(providerSymbolFor(symbol, 'coingecko'), symbol, 'CoinGecko');
    const key = TickRouter.key(symbol, timeframe);
    this.router.set(symbol, timeframe, onTick);
    if (this.timers.has(key)) return;
    // Polling, NOT websocket streaming: the forming candle is rebuilt
    // from a simple-price poll every 30 s (free-tier friendly).
    const timer = setInterval(() => {
      void this.pollTick(symbol, timeframe);
    }, COINGECKO_POLL_MS);
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

  /** One ticker poll: update the forming-candle bucket, dispatch, never throw. */
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
      this.router.dispatch(symbol, timeframe, { ...bucket }, true, 'coingecko', nowMs);
    } catch {
      // Poll failed (network, rate limit) — skip this tick; the next
      // poll retries. Never let the interval throw.
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const coinId = requireProviderSymbol(providerSymbolFor(symbol, 'coingecko'), symbol, 'CoinGecko');
    const params = new URLSearchParams({
      ids: coinId,
      vs_currencies: 'usd',
      include_24hr_change: 'true',
    });
    const raw = await this.fetchJson<unknown>(
      `${this.baseUrl}/simple/price?${params}`,
    );
    const parsed = coingeckoSimplePriceSchema.safeParse(raw);
    if (!parsed.success) throw new Error('CoinGecko ticker: malformed response');
    const entry = parsed.data[coinId];
    if (entry === undefined) throw new Error(`CoinGecko ticker: no price for ${coinId}`);
    const ticker: Ticker = {
      provider: 'coingecko', symbol, providerSymbol: coinId,
      price: entry.usd, timestampMs: Date.now(),
    };
    if (entry.usd_24h_change !== undefined) {
      ticker.change24hPct = entry.usd_24h_change;
    }
    return ticker;
  }

  async getServerTime(): Promise<number> {
    // CoinGecko has no time endpoint; use local time, same as Yahoo/OANDA.
    return Date.now();
  }
}
