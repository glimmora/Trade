import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, Ticker, TickHandler } from '../types';
import { RestClient, TickRouter, WsClient, intervalFor, requireProviderSymbol } from './base';
import type { Candle, Timeframe } from '@trade/core';
import { z } from 'zod';

/**
 * Bybit public API v5 (no key required).
 * Docs: api.bybit.com/v5/market/kline — category spot | linear.
 * Interval is minutes, or D/W/M. Volume is base-asset volume.
 * XAUUSDT linear (perpetual) is a LIVE PROXY for spot gold, not spot —
 * see registry note. XAUTUSDT spot is tokenized gold.
 * WS: stream.bybit.com/v5/public/spot and /v5/public/linear.
 */

export const BYBIT_REST = 'https://api.bybit.com';
export const BYBIT_WS_SPOT = 'wss://stream.bybit.com/v5/public/spot';
export const BYBIT_WS_LINEAR = 'wss://stream.bybit.com/v5/public/linear';

const INTERVALS = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720',
  '1D': 'D', '1W': 'W', '1M': 'M',
} as const satisfies Record<Timeframe, string>;

const bybitKlineSchema = z.object({
  retCode: z.number(),
  retMsg: z.string(),
  result: z.object({
    symbol: z.string(),
    category: z.string(),
    list: z.array(z.tuple([z.string(), z.string(), z.string(), z.string(), z.string(), z.string(), z.string()])),
  }),
});

/** Bybit returns newest-first; parse + reverse into ascending order. */
export function parseBybitKlines(raw: unknown, timeframe: Timeframe, serverNowMs: number): Candle[] {
  const parsed = bybitKlineSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Bybit kline: malformed response');
  const rows = [...parsed.data.result.list].reverse().map(([startTime, open, high, low, close, volume]) => ({
    timeMs: Number(startTime),
    open: Number(open), high: Number(high), low: Number(low),
    close: Number(close), volume: Number(volume),
  }));
  return normalizeCandles(rows, timeframe, serverNowMs).candles;
}

function categoryFor(symbol: string): 'spot' | 'linear' {
  // XAU/USD via Bybit is served by the XAUUSDT perpetual (linear).
  return symbol === 'XAU/USD' ? 'linear' : 'spot';
}

export class BybitAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'bybit' as const;
  readonly displayName = 'Bybit';
  readonly capabilities = {
    timeframes: Object.keys(INTERVALS) as Timeframe[],
    hasWs: true, historyDepth: 1000, needsKey: false, delayed: false,
  } as const;
  readonly supportedSymbols = ['BTC/USDT', 'XAUT/USDT', 'PAXG/USDT', 'XAU/USD'] as const;
  private readonly router = new TickRouter();
  private readonly sockets = new Map<string, WsClient>();
  private readonly baseUrl: string;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? BYBIT_REST;
  }

  private wsClient(category: 'spot' | 'linear'): WsClient {
    const existing = this.sockets.get(category);
    if (existing !== undefined) return existing;
    const client = new WsClient(
      category === 'linear' ? BYBIT_WS_LINEAR : BYBIT_WS_SPOT,
      (data) => { this.onWsMessage(data); },
    );
    this.sockets.set(category, client);
    return client;
  }

  private onWsMessage(data: unknown): void {
    const msg = data as { topic?: string; data?: { start: number; open: string; high: string; low: string; close: string; volume: string; confirm: boolean }[] };
    if (msg.topic === undefined || msg.data === undefined || msg.data.length === 0) return;
    // topic: "kline.60.BTCUSDT"
    const parts = msg.topic.split('.');
    const providerSymbol = parts[2];
    const interval = parts[1];
    if (providerSymbol === undefined || interval === undefined) return;
    const entry = msg.data[0];
    if (entry === undefined) return;
    const symbol = this.supportedSymbols.find(
      (s) => providerSymbolFor(s, 'bybit')?.providerSymbol === providerSymbol,
    );
    if (symbol === undefined) return;
    const timeframe = (Object.keys(INTERVALS) as Timeframe[]).find(
      (tf) => INTERVALS[tf] === interval,
    );
    if (timeframe === undefined) return;
    const candle: Candle = {
      time: Math.floor(entry.start / 1000),
      open: Number(entry.open), high: Number(entry.high), low: Number(entry.low),
      close: Number(entry.close), volume: Number(entry.volume),
    };
    this.router.dispatch(symbol, timeframe, candle, !entry.confirm, 'bybit', Date.now());
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(request.symbol, 'bybit'), request.symbol, 'Bybit');
    const interval = intervalFor(INTERVALS, request.timeframe, 'Bybit');
    const params = new URLSearchParams({
      category: categoryFor(request.symbol),
      symbol: providerSymbol, interval,
      limit: String(Math.min(request.limit ?? 200, 1000)),
    });
    if (request.from !== undefined) params.set('start', String(request.from * 1000));
    if (request.to !== undefined) params.set('end', String(request.to * 1000));
    const raw = await this.fetchJson<unknown>(`${this.baseUrl}/v5/market/kline?${params}`);
    return parseBybitKlines(raw, request.timeframe, await this.getServerTime());
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface ProviderAdapter mengharuskan return Promise
  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'bybit'), symbol, 'Bybit');
    const interval = intervalFor(INTERVALS, timeframe, 'Bybit');
    this.router.set(symbol, timeframe, onTick);
    const client = this.wsClient(categoryFor(symbol));
    // Default payload { op: 'subscribe', args: [topic] } is Bybit's format;
    // the topic is replayed automatically on reconnect.
    client.subscribe(`kline.${interval}.${providerSymbol}`);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface ProviderAdapter mengharuskan return Promise
  async unsubscribe(symbol: string, timeframe: Timeframe): Promise<void> {
    const providerSymbol = providerSymbolFor(symbol, 'bybit')?.providerSymbol;
    if (providerSymbol === undefined) return;
    this.router.delete(symbol, timeframe);
    const client = this.sockets.get(categoryFor(symbol));
    client?.unsubscribe(`kline.${INTERVALS[timeframe]}.${providerSymbol}`);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'bybit'), symbol, 'Bybit');
    const data = await this.fetchJson<{
      result: { list: { symbol: string; lastPrice: string; price24hPcnt: string; volume24h: string }[] };
    }>(
      `${this.baseUrl}/v5/market/tickers?category=${categoryFor(symbol)}&symbol=${providerSymbol}`,
    );
    const first = data.result.list[0];
    if (first === undefined) throw new Error('Bybit ticker: empty result');
    return {
      provider: 'bybit', symbol, providerSymbol,
      price: Number(first.lastPrice),
      change24hPct: Number(first.price24hPcnt) * 100,
      volume24h: Number(first.volume24h),
      timestampMs: Date.now(),
    };
  }

  async getServerTime(): Promise<number> {
    const data = await this.fetchJson<{ result: { timeSecond: string } }>(
      `${this.baseUrl}/v5/market/time`,
    );
    return Number(data.result.timeSecond) * 1000;
  }
}
