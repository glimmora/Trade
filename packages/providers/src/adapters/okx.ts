import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, Ticker, TickHandler } from '../types';
import { RestClient, TickRouter, WsClient, intervalFor, requireProviderSymbol } from './base';
import type { Candle, Timeframe } from '@trade/core';
import { z } from 'zod';

/**
 * OKX public API v5 (no key required).
 * Docs: www.okx.com/api/v5/market/candles — bar: 1m..1M.
 * Response rows are newest-first: [ts, open, high, low, close, volume, ...].
 * Volume is base-asset volume. WS: ws.okx.com:8443/ws/v5/public.
 */

export const OKX_REST = 'https://www.okx.com';
export const OKX_WS = 'wss://ws.okx.com:8443/ws/v5/public';

const INTERVALS = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1H', '2h': '2H', '4h': '4H', '6h': '6H', '12h': '12H',
  '1D': '1D', '1W': '1W', '1M': '1M',
} as const satisfies Record<Timeframe, string>;

const okxResponseSchema = z.object({
  code: z.string(),
  data: z.array(z.tuple([z.string(), z.string(), z.string(), z.string(), z.string(), z.string()]).rest(z.string())),
});

export function parseOkxCandles(raw: unknown, timeframe: Timeframe, serverNowMs: number): Candle[] {
  const parsed = okxResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.code !== '0') {
    throw new Error('OKX candles: malformed response');
  }
  const rows = [...parsed.data.data].reverse().map(([ts, open, high, low, close, volume]) => ({
    timeMs: Number(ts),
    open: Number(open), high: Number(high), low: Number(low),
    close: Number(close), volume: Number(volume),
  }));
  return normalizeCandles(rows, timeframe, serverNowMs).candles;
}

export class OkxAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'okx' as const;
  readonly displayName = 'OKX';
  readonly capabilities = {
    timeframes: Object.keys(INTERVALS) as Timeframe[],
    hasWs: true, historyDepth: 300, needsKey: false, delayed: false,
  } as const;
  readonly supportedSymbols = ['BTC/USDT', 'XAUT/USDT', 'PAXG/USDT'] as const;
  private readonly router = new TickRouter();
  private ws: WsClient | undefined;
  private readonly baseUrl: string;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? OKX_REST;
  }

  private wsClient(): WsClient {
    if (this.ws === undefined) {
      const parseTopic = (topic: string): { bar: string; instId: string } => {
        const [, bar = '', instId = ''] = topic.split(':');
        return { bar, instId };
      };
      this.ws = new WsClient(OKX_WS, (data) => this.onWsMessage(data), {
        subscribePayload: (topic) => {
          const { bar, instId } = parseTopic(topic);
          return { op: 'subscribe', args: [{ channel: 'candle', bar, instId }] };
        },
        unsubscribePayload: (topic) => {
          const { bar, instId } = parseTopic(topic);
          return { op: 'unsubscribe', args: [{ channel: 'candle', bar, instId }] };
        },
      });
    }
    return this.ws;
  }

  private onWsMessage(data: unknown): void {
    const msg = data as { arg?: { channel?: string; instId?: string; bar?: string }; data?: Array<[string, string, string, string, string, string, string, string, string]> };
    if (msg.arg?.channel !== 'candle' || msg.data === undefined || msg.data.length === 0) return;
    const row = msg.data[0];
    const instId = msg.arg.instId;
    const bar = msg.arg.bar;
    if (row === undefined || instId === undefined || bar === undefined) return;
    const symbol = this.supportedSymbols.find(
      (s) => providerSymbolFor(s, 'okx')?.providerSymbol === instId,
    );
    if (symbol === undefined) return;
    const timeframe = (Object.keys(INTERVALS) as Timeframe[]).find((tf) => INTERVALS[tf] === bar);
    if (timeframe === undefined) return;
    const [ts, open, high, low, close, volume, , , confirm] = row;
    const candle: Candle = {
      time: Math.floor(Number(ts) / 1000),
      open: Number(open), high: Number(high), low: Number(low),
      close: Number(close), volume: Number(volume),
    };
    this.router.dispatch(symbol, timeframe, candle, confirm !== '1', 'okx', Date.now());
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(request.symbol, 'okx'), request.symbol, 'OKX');
    const interval = intervalFor(INTERVALS, request.timeframe, 'OKX');
    const params = new URLSearchParams({
      instId: providerSymbol, bar: interval,
      limit: String(Math.min(request.limit ?? 100, 300)),
    });
    if (request.from !== undefined) params.set('after', String(request.from * 1000));
    if (request.to !== undefined) params.set('before', String(request.to * 1000));
    const raw = await this.fetchJson<unknown>(`${this.baseUrl}/api/v5/market/candles?${params}`);
    return parseOkxCandles(raw, request.timeframe, await this.getServerTime());
  }

  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'okx'), symbol, 'OKX');
    const interval = intervalFor(INTERVALS, timeframe, 'OKX');
    this.router.set(symbol, timeframe, onTick);
    this.wsClient().subscribe(`candle:${interval}:${providerSymbol}`);
  }

  async unsubscribe(symbol: string, timeframe: Timeframe): Promise<void> {
    const providerSymbol = providerSymbolFor(symbol, 'okx')?.providerSymbol;
    if (providerSymbol === undefined) return;
    this.router.delete(symbol, timeframe);
    this.ws?.unsubscribe(`candle:${INTERVALS[timeframe]}:${providerSymbol}`);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'okx'), symbol, 'OKX');
    const data = await this.fetchJson<{
      code: string;
      data: Array<{ instId: string; last: string; vol24h: string; ts: string }>;
    }>(`${this.baseUrl}/api/v5/market/ticker?instId=${providerSymbol}`);
    const first = data.data[0];
    if (first === undefined) throw new Error('OKX ticker: empty result');
    return {
      provider: 'okx', symbol, providerSymbol,
      price: Number(first.last), volume24h: Number(first.vol24h),
      timestampMs: Number(first.ts),
    };
  }

  async getServerTime(): Promise<number> {
    const data = await this.fetchJson<{ data: Array<{ ts: string }> }>(
      `${this.baseUrl}/api/v5/public/time`,
    );
    const first = data.data[0];
    if (first === undefined) throw new Error('OKX time: empty result');
    return Number(first.ts);
  }
}
