import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, Ticker, TickHandler } from '../types';
import { RestClient, TickRouter, WsClient, intervalFor, requireProviderSymbol } from './base';
import type { Candle, Timeframe } from '@trade/core';
import { z } from 'zod';

/**
 * Kraken public API (no key required).
 * Docs: api.kraken.com/0/public/OHLC — interval is MINUTES and only
 * 1, 5, 15, 30, 60, 240, 1440, 10080, 21600 are supported. That means
 * 3m, 2h, 6h, 12h and 1M are NOT available from Kraken and are excluded
 * from its capabilities (see registry PROVIDER_TIMEFRAMES).
 * Volume is base-asset volume. WS v2: wss://ws.kraken.com/v2, channel ohlc.
 */

export const KRAKEN_REST = 'https://api.kraken.com';
export const KRAKEN_WS = 'wss://ws.kraken.com/v2';

const INTERVALS: Record<Timeframe, string | undefined> = {
  '1m': '1', '3m': undefined, '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': undefined, '4h': '240', '6h': undefined, '12h': undefined,
  '1D': '1440', '1W': '10080', '1M': undefined,
};

const krakenOhlcSchema = z.object({
  error: z.array(z.string()),
  result: z.record(z.array(z.tuple([z.number(), z.string(), z.string(), z.string(), z.string(), z.string(), z.string(), z.number()]))),
});

export function parseKrakenOhlc(raw: unknown, pairKey: string, timeframe: Timeframe, serverNowMs: number): Candle[] {
  const parsed = krakenOhlcSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Kraken OHLC: malformed response');
  if (parsed.data.error.length > 0) {
    throw new Error(`Kraken error: ${parsed.data.error.join('; ')}`);
  }
  const rows = parsed.data.result[pairKey];
  if (rows === undefined) throw new Error(`Kraken OHLC: no data for ${pairKey}`);
  const mapped = rows.map(([time, open, high, low, close, , volume]) => ({
    timeMs: time * 1000,
    open: Number(open), high: Number(high), low: Number(low),
    close: Number(close), volume: Number(volume),
  }));
  return normalizeCandles(mapped, timeframe, serverNowMs).candles;
}

export class KrakenAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'kraken' as const;
  readonly displayName = 'Kraken';
  readonly capabilities = {
    timeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'] as Timeframe[],
    hasWs: true, historyDepth: 720, needsKey: false, delayed: false,
  } as const;
  readonly supportedSymbols = ['BTC/USDT', 'XAUT/USDT', 'PAXG/USDT'] as const;
  private readonly router = new TickRouter();
  private ws: WsClient | undefined;
  private readonly baseUrl: string;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? KRAKEN_REST;
  }

  private wsClient(): WsClient {
    if (this.ws === undefined) {
      const parseTopic = (topic: string): { interval: number; symbol: string } => {
        const [, interval = '60', symbol = ''] = topic.split(':');
        return { interval: Number(interval), symbol };
      };
      this.ws = new WsClient(KRAKEN_WS, (data) => this.onWsMessage(data), {
        subscribePayload: (topic) => {
          const { interval, symbol } = parseTopic(topic);
          return { method: 'subscribe', params: { channel: 'ohlc', symbol: [symbol], interval, snapshot: true } };
        },
        unsubscribePayload: (topic) => {
          const { interval, symbol } = parseTopic(topic);
          return { method: 'unsubscribe', params: { channel: 'ohlc', symbol: [symbol], interval } };
        },
      });
    }
    return this.ws;
  }

  private onWsMessage(data: unknown): void {
    const msg = data as { channel?: string; type?: string; data?: Array<{ symbol: string; interval: number; open: number; high: number; low: number; close: number; volume: number; timestamp: string }> };
    if (msg.channel !== 'ohlc' || msg.type !== 'update' || msg.data === undefined) return;
    const row = msg.data[0];
    if (row === undefined) return;
    const symbol = this.supportedSymbols.find(
      (s) => providerSymbolFor(s, 'kraken')?.providerSymbol === row.symbol,
    );
    if (symbol === undefined) return;
    const timeframe = (Object.keys(INTERVALS) as Timeframe[]).find(
      (tf) => INTERVALS[tf] === String(row.interval),
    );
    if (timeframe === undefined) return;
    const candle: Candle = {
      time: Math.floor(Date.parse(row.timestamp) / 1000),
      open: row.open, high: row.high, low: row.low,
      close: row.close, volume: row.volume,
    };
    // Kraken WS sends an update per tick; the candle is forming until
    // the next interval boundary, which the chart layer derives from time.
    this.router.dispatch(symbol, timeframe, candle, true, 'kraken', Date.now());
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(request.symbol, 'kraken'), request.symbol, 'Kraken');
    const interval = intervalFor(INTERVALS, request.timeframe, 'Kraken');
    const params = new URLSearchParams({ pair: providerSymbol, interval });
    if (request.from !== undefined) params.set('since', String(request.from));
    const raw = await this.fetchJson<unknown>(`${this.baseUrl}/0/public/OHLC?${params}`);
    // Kraken returns data under the pair key as echoed by the API
    // (e.g. "XXBTZUSD"); resolve it from the response keys.
    const parsed = krakenOhlcSchema.safeParse(raw);
    if (!parsed.success) throw new Error('Kraken OHLC: malformed response');
    const pairKey = Object.keys(parsed.data.result).find((k) => k !== 'last');
    if (pairKey === undefined) throw new Error('Kraken OHLC: no pair data');
    return parseKrakenOhlc(raw, pairKey, request.timeframe, await this.getServerTime());
  }

  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'kraken'), symbol, 'Kraken');
    intervalFor(INTERVALS, timeframe, 'Kraken');
    this.router.set(symbol, timeframe, onTick);
    this.wsClient().subscribe(`ohlc:${INTERVALS[timeframe]}:${providerSymbol}`);
  }

  async unsubscribe(symbol: string, timeframe: Timeframe): Promise<void> {
    const providerSymbol = providerSymbolFor(symbol, 'kraken')?.providerSymbol;
    if (providerSymbol === undefined) return;
    this.router.delete(symbol, timeframe);
    this.ws?.unsubscribe(`ohlc:${INTERVALS[timeframe]}:${providerSymbol}`);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'kraken'), symbol, 'Kraken');
    const data = await this.fetchJson<{ result: Record<string, { c: [string, string]; v: [string, string] }> }>(
      `${this.baseUrl}/0/public/Ticker?pair=${encodeURIComponent(providerSymbol)}`,
    );
    const first = Object.values(data.result)[0];
    if (first === undefined) throw new Error('Kraken ticker: empty result');
    return {
      provider: 'kraken', symbol, providerSymbol,
      price: Number(first.c[0]), volume24h: Number(first.v[1]),
      timestampMs: Date.now(),
    };
  }

  async getServerTime(): Promise<number> {
    const data = await this.fetchJson<{ result: { unixtime: number } }>(
      `${this.baseUrl}/0/public/Time`,
    );
    return data.result.unixtime * 1000;
  }
}
