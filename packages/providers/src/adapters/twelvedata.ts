import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, ProviderRuntimeKeys, Ticker, TickHandler } from '../types';
import { RestClient, TickRouter, WsClient, intervalFor, requireKeys, requireProviderSymbol } from './base';
import type { Candle, Timeframe } from '@trade/core';
import { z } from 'zod';

/**
 * Twelve Data public API — the ONLY provider here serving true SPOT GOLD
 * (XAU/USD). Requires a free user-supplied key, entered in Settings and
 * read from localStorage at runtime only. The key is NEVER stored in this
 * package, never logged, and never committed.
 * Docs: api.twelvedata.com/time_series — interval:
 * 1min, 5min, 15min, 30min, 1h, 2h, 4h, 1day, 1week, 1month.
 * Volume is often 0/absent for spot FX feeds — documented, not faked.
 * WS: ws.twelvedata.com/v1/quotes/price (key required).
 */

export const TWELVEDATA_REST = 'https://api.twelvedata.com';
export const TWELVEDATA_WS = 'wss://ws.twelvedata.com/v1/quotes/price';

const INTERVALS: Record<Timeframe, string | undefined> = {
  '1m': '1min', '3m': undefined, '5m': '5min', '15m': '15min', '30m': '30min',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': undefined, '12h': undefined,
  '1D': '1day', '1W': '1week', '1M': '1month',
};

const twelveDataResponseSchema = z.object({
  meta: z.object({ symbol: z.string(), interval: z.string() }).passthrough(),
  values: z.array(z.object({
    datetime: z.string(),
    open: z.string(), high: z.string(), low: z.string(), close: z.string(),
    volume: z.string().optional(),
  })),
  status: z.string(),
});

export function parseTwelveDataCandles(raw: unknown, timeframe: Timeframe, serverNowMs: number): Candle[] {
  const parsed = twelveDataResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.status !== 'ok') {
    throw new Error('Twelve Data: malformed response');
  }
  const rows = [...parsed.data.values].reverse().map((v) => ({
    timeMs: Date.parse(v.datetime.replace(' ', 'T') + 'Z'),
    open: Number(v.open), high: Number(v.high), low: Number(v.low),
    close: Number(v.close), volume: Number(v.volume ?? '0'),
  }));
  return normalizeCandles(rows, timeframe, serverNowMs).candles;
}

export class TwelveDataAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'twelvedata' as const;
  readonly displayName = 'Twelve Data';
  readonly capabilities = {
    timeframes: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1D', '1W', '1M'] as Timeframe[],
    hasWs: true, historyDepth: 5000, needsKey: true, delayed: false,
  } as const;
  readonly supportedSymbols = ['XAU/USD'] as const;
  private readonly router = new TickRouter();
  private ws: WsClient | undefined;
  private readonly baseUrl: string;
  private readonly keys: ProviderRuntimeKeys | undefined;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? TWELVEDATA_REST;
    this.keys = options.keys;
  }

  private apiKey(): string {
    return requireKeys(this.keys, 'twelvedata');
  }

  private wsClient(): WsClient {
    if (this.ws === undefined) {
      const symbolOf = (topic: string): string => topic.split(':')[1] ?? '';
      this.ws = new WsClient(TWELVEDATA_WS, (data) => { this.onWsMessage(data); }, {
        // Auth must precede subscription on every (re)connect.
        onOpen: () => {
          this.ws?.sendRaw(JSON.stringify({ action: 'auth', params: { apikey: this.apiKey() } }));
        },
        subscribePayload: (topic) => ({ action: 'subscribe', params: { symbols: symbolOf(topic) } }),
        unsubscribePayload: (topic) => ({ action: 'unsubscribe', params: { symbols: symbolOf(topic) } }),
      });
    }
    return this.ws;
  }

  private onWsMessage(data: unknown): void {
    const msg = data as { event?: string; symbol?: string; price?: number; timestamp?: number };
    if (msg.event !== 'price' || msg.symbol === undefined || msg.price === undefined) return;
    const symbol = this.supportedSymbols.find(
      (s) => providerSymbolFor(s, 'twelvedata')?.providerSymbol === msg.symbol,
    );
    if (symbol === undefined) return;
    const price = msg.price;
    const nowMs = (msg.timestamp ?? Math.floor(Date.now() / 1000)) * 1000;
    const candle: Candle = {
      time: Math.floor(nowMs / 60_000) * 60,
      open: price, high: price, low: price, close: price, volume: 0,
    };
    this.router.dispatch(symbol, '1m', candle, true, 'twelvedata', nowMs);
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(request.symbol, 'twelvedata'), request.symbol, 'Twelve Data');
    const interval = intervalFor(INTERVALS, request.timeframe, 'Twelve Data');
    const params = new URLSearchParams({
      symbol: providerSymbol, interval,
      outputsize: String(Math.min(request.limit ?? 500, 5000)),
      apikey: this.apiKey(),
      format: 'JSON',
    });
    if (request.from !== undefined) {
      params.set('start_date', new Date(request.from * 1000).toISOString());
    }
    if (request.to !== undefined) {
      params.set('end_date', new Date(request.to * 1000).toISOString());
    }
    const raw = await this.fetchJson<unknown>(`${this.baseUrl}/time_series?${params}`);
    return parseTwelveDataCandles(raw, request.timeframe, Date.now());
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface ProviderAdapter mengharuskan return Promise
  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'twelvedata'), symbol, 'Twelve Data');
    intervalFor(INTERVALS, timeframe, 'Twelve Data');
    this.apiKey(); // Fail fast when no user key is configured.
    this.router.set(symbol, timeframe, onTick);
    this.wsClient().subscribe(`price:${providerSymbol}`);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface ProviderAdapter mengharuskan return Promise
  async unsubscribe(symbol: string, timeframe: Timeframe): Promise<void> {
    const providerSymbol = providerSymbolFor(symbol, 'twelvedata')?.providerSymbol;
    if (providerSymbol === undefined) return;
    this.router.delete(symbol, timeframe);
    this.ws?.unsubscribe(`price:${providerSymbol}`);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'twelvedata'), symbol, 'Twelve Data');
    const data = await this.fetchJson<{ price: string; timestamp: number }>(
      `${this.baseUrl}/price?symbol=${encodeURIComponent(providerSymbol)}&apikey=${this.apiKey()}`,
    );
    return {
      provider: 'twelvedata', symbol, providerSymbol,
      price: Number(data.price), timestampMs: data.timestamp * 1000,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface ProviderAdapter mengharuskan return Promise
  async getServerTime(): Promise<number> {
    // Twelve Data has no dedicated time endpoint; use local time corrected
    // by the quote timestamp on the next ticker call. Documented fallback.
    return Date.now();
  }
}
