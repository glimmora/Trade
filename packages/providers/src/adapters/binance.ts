import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, Ticker, TickHandler } from '../types';
import { RestClient, TickRouter, WsClient, intervalFor, requireProviderSymbol } from './base';
import type { Candle, Timeframe } from '@trade/core';
import { z } from 'zod';

/**
 * Binance public spot API (no key required).
 * Docs: api.binance.com/api/v3 — klines, ticker/price, time.
 * Volume is base-asset volume. Intervals: all app timeframes.
 * WS: stream.binance.com:9443 — `<symbol>@kline_<interval>`.
 *
 * Geo-restriction fallback: api.binance.com returns HTTP 451 from
 * restricted locations. REST reads (klines, ticker, server time) retry
 * once against data-api.binance.vision, which serves the same endpoints
 * and response shapes keyless. The WebSocket host is NOT retried — no
 * fallback WS host was verified, so none is assumed here.
 */

export const BINANCE_REST = 'https://api.binance.com';
export const BINANCE_VISION_REST = 'https://data-api.binance.vision';
export const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

const INTERVALS = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '12h': '12h',
  '1D': '1d', '1W': '1w', '1M': '1M',
} as const satisfies Record<Timeframe, string>;

/** Raw Binance kline: [openTime, open, high, low, close, volume, closeTime, ...] */
export const binanceKlineSchema = z.tuple([
  z.number(), z.string(), z.string(), z.string(), z.string(), z.string(),
  z.number(), z.string(), z.number(), z.string(), z.string(), z.string(),
]).rest(z.unknown());

export type BinanceKline = z.infer<typeof binanceKlineSchema>;

/** True when a response signals a geo-restriction (HTTP 451). */
function isGeoRestricted(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('HTTP 451')
    || error.message.toLowerCase().includes('restricted location');
}

export function parseBinanceKlines(raw: unknown, timeframe: Timeframe, serverNowMs: number): Candle[] {
  if (!Array.isArray(raw)) throw new Error('Binance klines: expected an array');
  const rows = raw.map((row) => {
    const parsed = binanceKlineSchema.safeParse(row);
    if (!parsed.success) throw new Error('Binance klines: malformed row');
    const [openTime, open, high, low, close, volume] = parsed.data;
    return {
      timeMs: openTime,
      open: Number(open), high: Number(high), low: Number(low),
      close: Number(close), volume: Number(volume),
    };
  });
  return normalizeCandles(rows, timeframe, serverNowMs).candles;
}

export class BinanceAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'binance' as const;
  readonly displayName = 'Binance';
  readonly capabilities = {
    timeframes: Object.keys(INTERVALS) as Timeframe[],
    hasWs: true, historyDepth: 1000, needsKey: false, delayed: false,
  } as const;
  readonly supportedSymbols = ['BTC/USDT', 'XAUT/USDT', 'PAXG/USDT'] as const;
  private readonly router = new TickRouter();
  private ws: WsClient | undefined;
  private readonly baseUrl: string;
  /**
   * True only when the caller did not override the REST host (tests and the
   * proxy transport set baseUrl explicitly, and must keep that host).
   */
  private readonly allowVisionFallback: boolean;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? BINANCE_REST;
    this.allowVisionFallback = options.baseUrl === undefined;
  }

  /**
   * REST read with a one-time geo-restriction fallback: when the primary
   * host answers HTTP 451, retry the same path once against
   * data-api.binance.vision. Any other failure, or a failed retry, throws
   * the original error — never synthesized data. WebSocket streaming does
   * not use this: no fallback WS host was verified.
   */
  private async fetchJsonWithVisionFallback<T>(path: string): Promise<T> {
    try {
      return await this.fetchJson<T>(`${this.baseUrl}${path}`);
    } catch (error) {
      if (!this.allowVisionFallback || !isGeoRestricted(error)) throw error;
      try {
        return await this.fetchJson<T>(`${BINANCE_VISION_REST}${path}`);
      } catch {
        throw error;
      }
    }
  }

  private wsClient(): WsClient {
    if (this.ws === undefined) {
      this.ws = new WsClient(BINANCE_WS, (data) => this.onWsMessage(data), {
        subscribePayload: (topic) => ({ method: 'SUBSCRIBE', params: [topic], id: 1 }),
        unsubscribePayload: (topic) => ({ method: 'UNSUBSCRIBE', params: [topic], id: 1 }),
      });
    }
    return this.ws;
  }

  private onWsMessage(data: unknown): void {
    const msg = data as { e?: string; s?: string; k?: { t: number; o: string; h: string; l: string; c: string; v: string; x: boolean; i: string } };
    if (msg.e !== 'kline' || msg.k === undefined || msg.s === undefined) return;
    const k = msg.k;
    const symbol = this.supportedSymbols.find(
      (s) => providerSymbolFor(s, 'binance')?.providerSymbol === msg.s,
    );
    if (symbol === undefined) return;
    const timeframe = (Object.keys(INTERVALS) as Timeframe[]).find(
      (tf) => INTERVALS[tf] === k.i,
    );
    if (timeframe === undefined) return;
    const candle: Candle = {
      time: Math.floor(k.t / 1000),
      open: Number(k.o), high: Number(k.h), low: Number(k.l),
      close: Number(k.c), volume: Number(k.v),
    };
    this.router.dispatch(symbol, timeframe, candle, !k.x, 'binance', Date.now());
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const symbol = requireProviderSymbol(providerSymbolFor(request.symbol, 'binance'), request.symbol, 'Binance');
    const interval = intervalFor(INTERVALS, request.timeframe, 'Binance');
    const params = new URLSearchParams({
      symbol, interval, limit: String(Math.min(request.limit ?? 500, 1000)),
    });
    if (request.from !== undefined) params.set('startTime', String(request.from * 1000));
    if (request.to !== undefined) params.set('endTime', String(request.to * 1000));
    const raw = await this.fetchJsonWithVisionFallback<unknown>(`/api/v3/klines?${params}`);
    return parseBinanceKlines(raw, request.timeframe, await this.getServerTime());
  }

  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'binance'), symbol, 'Binance');
    const interval = intervalFor(INTERVALS, timeframe, 'Binance');
    this.router.set(symbol, timeframe, onTick);
    this.wsClient().subscribe(`${providerSymbol.toLowerCase()}@kline_${interval}`);
  }

  async unsubscribe(symbol: string, timeframe: Timeframe): Promise<void> {
    const providerSymbol = providerSymbolFor(symbol, 'binance')?.providerSymbol;
    if (providerSymbol === undefined) return;
    const interval = INTERVALS[timeframe];
    this.router.delete(symbol, timeframe);
    this.ws?.unsubscribe(`${providerSymbol.toLowerCase()}@kline_${interval}`);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'binance'), symbol, 'Binance');
    const data = await this.fetchJsonWithVisionFallback<{ symbol: string; price: string }>(
      `/api/v3/ticker/price?symbol=${providerSymbol}`,
    );
    return {
      provider: 'binance', symbol, providerSymbol,
      price: Number(data.price), timestampMs: Date.now(),
    };
  }

  async getServerTime(): Promise<number> {
    // Same host as klines/ticker, so the same geo-restriction fallback
    // applies — getCandles depends on this and must not fail when the
    // klines themselves were served by the fallback host.
    const data = await this.fetchJsonWithVisionFallback<{ serverTime: number }>('/api/v3/time');
    return data.serverTime;
  }
}
