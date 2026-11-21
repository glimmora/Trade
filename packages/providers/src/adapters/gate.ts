import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, Ticker, TickHandler } from '../types';
import { RestClient, TickRouter, WsClient, intervalFor, requireProviderSymbol } from './base';
import type { Candle, Timeframe } from '@trade/core';
import { z } from 'zod';

/**
 * Gate.io public API v4 (no key required).
 * Docs: api.gateio.ws/api/v4/spot/candlesticks — interval:
 * 10s, 1m, 5m, 15m, 30m, 1h, 2h, 4h, 8h, 1d, 7d, 30d.
 * So 3m, 6h, 12h, 1W and 1M are NOT natively available (7d/30d are
 * approximate calendar buckets, not 1W/1M candles — not substituted).
 * Rows are newest-first: [timestampSec, volume, close, high, low, open, ...].
 * Volume is base-asset volume. WS: api.gateio.ws/ws/v4/.
 */

export const GATE_REST = 'https://api.gateio.ws';
export const GATE_WS = 'wss://api.gateio.ws/ws/v4/';

const INTERVALS: Record<Timeframe, string | undefined> = {
  '1m': '1m', '3m': undefined, '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': undefined, '12h': undefined,
  '1D': '1d', '1W': undefined, '1M': undefined,
};

const gateRowSchema = z.tuple([
  z.string(), z.string(), z.string(), z.string(), z.string(), z.string(),
]).rest(z.string());

export function parseGateCandles(raw: unknown, timeframe: Timeframe, serverNowMs: number): Candle[] {
  if (!Array.isArray(raw)) throw new Error('Gate.io candles: expected an array');
  const rows = [...(raw as unknown[])].reverse().map((row) => {
    const parsed = gateRowSchema.safeParse(row);
    if (!parsed.success) throw new Error('Gate.io candles: malformed row');
    const [ts, volume, close, high, low, open] = parsed.data;
    return {
      timeMs: Number(ts) * 1000,
      open: Number(open), high: Number(high), low: Number(low),
      close: Number(close), volume: Number(volume),
    };
  });
  return normalizeCandles(rows, timeframe, serverNowMs).candles;
}

export class GateAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'gate' as const;
  readonly displayName = 'Gate.io';
  readonly capabilities = {
    timeframes: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1D'] as Timeframe[],
    hasWs: true, historyDepth: 1000, needsKey: false, delayed: false,
  } as const;
  readonly supportedSymbols = ['BTC/USDT', 'XAUT/USDT', 'PAXG/USDT'] as const;
  private readonly router = new TickRouter();
  private ws: WsClient | undefined;
  private readonly baseUrl: string;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? GATE_REST;
  }

  private wsClient(): WsClient {
    if (this.ws === undefined) {
      const parseTopic = (topic: string): { interval: string; symbol: string } => {
        const [, interval = '', symbol = ''] = topic.split(':');
        return { interval, symbol };
      };
      const payload = (event: string, topic: string): Record<string, unknown> => {
        const { interval, symbol } = parseTopic(topic);
        return { time: Math.floor(Date.now() / 1000), channel: 'spot.candlesticks', event, payload: [interval, symbol] };
      };
      this.ws = new WsClient(GATE_WS, (data) => { this.onWsMessage(data); }, {
        subscribePayload: (topic) => payload('subscribe', topic),
        unsubscribePayload: (topic) => payload('unsubscribe', topic),
      });
    }
    return this.ws;
  }

  private onWsMessage(data: unknown): void {
    const msg = data as { method?: string; params?: [string, { t: number; o: string; h: string; l: string; c: string; v: string; n: string }[]] };
    if (msg.method !== 'update' || msg.params === undefined) return;
    const [channel, rows] = msg.params;
    if (channel !== 'spot.candlesticks' || rows.length === 0) return;
    const row = rows[0];
    if (row === undefined) return;
    // Gate.io identifies each candle with n = "<interval>_<pair>", e.g. "1m_BTC_USDT".
    const [interval, ...symbolParts] = row.n.split('_');
    const providerSymbol = symbolParts.join('_');
    if (interval === undefined || providerSymbol === '') return;
    const symbol = this.supportedSymbols.find(
      (s) => providerSymbolFor(s, 'gate')?.providerSymbol === providerSymbol,
    );
    if (symbol === undefined) return;
    const timeframe = (Object.keys(INTERVALS) as Timeframe[]).find((tf) => INTERVALS[tf] === interval);
    if (timeframe === undefined) return;
    const candle: Candle = {
      time: row.t,
      open: Number(row.o), high: Number(row.h), low: Number(row.l),
      close: Number(row.c), volume: Number(row.v),
    };
    this.router.dispatch(symbol, timeframe, candle, true, 'gate', Date.now());
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(request.symbol, 'gate'), request.symbol, 'Gate.io');
    const interval = intervalFor(INTERVALS, request.timeframe, 'Gate.io');
    const params = new URLSearchParams({
      currency_pair: providerSymbol, interval,
      limit: String(Math.min(request.limit ?? 100, 1000)),
    });
    if (request.from !== undefined) params.set('from', String(request.from));
    if (request.to !== undefined) params.set('to', String(request.to));
    const raw = await this.fetchJson<unknown>(`${this.baseUrl}/api/v4/spot/candlesticks?${params}`);
    return parseGateCandles(raw, request.timeframe, Date.now());
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface ProviderAdapter mengharuskan return Promise
  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'gate'), symbol, 'Gate.io');
    const interval = intervalFor(INTERVALS, timeframe, 'Gate.io');
    this.router.set(symbol, timeframe, onTick);
    this.wsClient().subscribe(`spot.candlesticks:${interval}:${providerSymbol}`);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface ProviderAdapter mengharuskan return Promise
  async unsubscribe(symbol: string, timeframe: Timeframe): Promise<void> {
    const providerSymbol = providerSymbolFor(symbol, 'gate')?.providerSymbol;
    if (providerSymbol === undefined) return;
    this.router.delete(symbol, timeframe);
    this.ws?.unsubscribe(`spot.candlesticks:${INTERVALS[timeframe] ?? ''}:${providerSymbol}`);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'gate'), symbol, 'Gate.io');
    const data = await this.fetchJson<{ currency_pair: string; last: string; base_volume: string }>(
      `${this.baseUrl}/api/v4/spot/tickers?currency_pair=${providerSymbol}`,
    );
    return {
      provider: 'gate', symbol, providerSymbol,
      price: Number(data.last), volume24h: Number(data.base_volume),
      timestampMs: Date.now(),
    };
  }

  async getServerTime(): Promise<number> {
    const data = await this.fetchJson<{ server_time: number }>(
      `${this.baseUrl}/api/v4/time`,
    );
    return data.server_time * 1000;
  }
}
