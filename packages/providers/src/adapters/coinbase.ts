import { normalizeCandles } from '../normalize';
import { providerSymbolFor } from '../registry';
import type { CandleRequest, ProviderAdapter, ProviderClientOptions, Ticker, TickHandler } from '../types';
import { RestClient, TickRouter, WsClient, intervalFor, requireProviderSymbol } from './base';
import type { Candle, Timeframe } from '@trade/core';

/**
 * Coinbase Exchange public API (no key required).
 * Docs: api.exchange.coinbase.com — /products/{id}/candles?granularity=
 * Granularity is SECONDS and only 60, 300, 900, 3600, 21600, 86400 are
 * supported: 1m, 5m, 15m, 1h, 6h, 1D. All other timeframes are excluded
 * from its capabilities. Rows are [time, low, high, open, close, volume]
 * (note the order) and newest-first.
 * Priced in USD (BTC-USD), not USDT — a BTC reference, labelled as such.
 * Volume is base-asset volume. WS: ws-feed.exchange.coinbase.com.
 */

export const COINBASE_REST = 'https://api.exchange.coinbase.com';
export const COINBASE_WS = 'wss://ws-feed.exchange.coinbase.com';

const STRING_INTERVALS: Record<Timeframe, string | undefined> = {
  '1m': '60', '3m': undefined, '5m': '300', '15m': '900', '30m': undefined,
  '1h': '3600', '2h': undefined, '4h': undefined, '6h': '21600', '12h': undefined,
  '1D': '86400', '1W': undefined, '1M': undefined,
};

export type CoinbaseCandleRow = [number, number, number, number, number, number];

/** Coinbase rows: [timeSec, low, high, open, close, volume], newest-first. */
export function parseCoinbaseCandles(
  raw: unknown,
  timeframe: Timeframe,
  serverNowMs: number,
): Candle[] {
  if (!Array.isArray(raw)) throw new Error('Coinbase candles: expected an array');
  const rows = [...raw].reverse().map((row) => {
    const r = row as CoinbaseCandleRow;
    const [time, low, high, open, close, volume] = r;
    return {
      timeMs: time * 1000,
      open: Number(open), high: Number(high), low: Number(low),
      close: Number(close), volume: Number(volume),
    };
  });
  return normalizeCandles(rows, timeframe, serverNowMs).candles;
}

export class CoinbaseAdapter extends RestClient implements ProviderAdapter {
  readonly id = 'coinbase' as const;
  readonly displayName = 'Coinbase Exchange';
  readonly capabilities = {
    timeframes: ['1m', '5m', '15m', '1h', '6h', '1D'] as Timeframe[],
    hasWs: true, historyDepth: 300, needsKey: false, delayed: false,
  } as const;
  readonly supportedSymbols = ['BTC/USDT'] as const;
  private readonly router = new TickRouter();
  private ws: WsClient | undefined;
  private readonly baseUrl: string;

  constructor(options: ProviderClientOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? COINBASE_REST;
  }

  private wsClient(): WsClient {
    if (this.ws === undefined) {
      const productId = (topic: string): string => topic.split(':')[1] ?? '';
      this.ws = new WsClient(COINBASE_WS, (data) => this.onWsMessage(data), {
        subscribePayload: (topic) => ({
          type: 'subscribe', product_ids: [productId(topic)], channels: ['ticker'],
        }),
        unsubscribePayload: (topic) => ({
          type: 'unsubscribe', product_ids: [productId(topic)], channels: ['ticker'],
        }),
      });
    }
    return this.ws;
  }

  private onWsMessage(data: unknown): void {
    const msg = data as { type?: string; product_id?: string; price?: string; time?: string };
    if (msg.type !== 'ticker' || msg.product_id === undefined || msg.price === undefined) return;
    const symbol = this.supportedSymbols.find(
      (s) => providerSymbolFor(s, 'coinbase')?.providerSymbol === msg.product_id,
    );
    if (symbol === undefined) return;
    // Ticker ticks carry no candle; the chart layer merges them into the
    // forming 1m candle. Dispatch to every timeframe the app subscribed to
    // is the app layer's job — here we emit the 1m forming candle only
    // when a 1m handler exists, via a synthetic candle at the minute grid.
    const price = Number(msg.price);
    const nowMs = msg.time !== undefined ? Date.parse(msg.time) : Date.now();
    const candle: Candle = {
      time: Math.floor(nowMs / 60_000) * 60,
      open: price, high: price, low: price, close: price, volume: 0,
    };
    this.router.dispatch(symbol, '1m', candle, true, 'coinbase', nowMs);
  }

  async getCandles(request: CandleRequest): Promise<Candle[]> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(request.symbol, 'coinbase'), request.symbol, 'Coinbase');
    const granularity = intervalFor(STRING_INTERVALS, request.timeframe, 'Coinbase');
    const params = new URLSearchParams({ granularity });
    if (request.from !== undefined) {
      params.set('start', new Date(request.from * 1000).toISOString());
    }
    if (request.to !== undefined) {
      params.set('end', new Date(request.to * 1000).toISOString());
    }
    const raw = await this.fetchJson<unknown>(
      `${this.baseUrl}/products/${providerSymbol}/candles?${params}`,
    );
    return parseCoinbaseCandles(raw, request.timeframe, Date.now());
  }

  async subscribe(symbol: string, timeframe: Timeframe, onTick: TickHandler): Promise<void> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'coinbase'), symbol, 'Coinbase');
    intervalFor(STRING_INTERVALS, timeframe, 'Coinbase');
    this.router.set(symbol, timeframe, onTick);
    this.wsClient().subscribe(`ticker:${providerSymbol}`);
  }

  async unsubscribe(symbol: string, timeframe: Timeframe): Promise<void> {
    const providerSymbol = providerSymbolFor(symbol, 'coinbase')?.providerSymbol;
    if (providerSymbol === undefined) return;
    this.router.delete(symbol, timeframe);
    this.ws?.unsubscribe(`ticker:${providerSymbol}`);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const providerSymbol = requireProviderSymbol(providerSymbolFor(symbol, 'coinbase'), symbol, 'Coinbase');
    const data = await this.fetchJson<{ price: string; volume: string; time: string }>(
      `${this.baseUrl}/products/${providerSymbol}/ticker`,
    );
    return {
      provider: 'coinbase', symbol, providerSymbol,
      price: Number(data.price), volume24h: Number(data.volume),
      timestampMs: Date.parse(data.time),
    };
  }

  async getServerTime(): Promise<number> {
    const data = await this.fetchJson<{ iso: string; epoch: number }>(
      `${this.baseUrl}/time`,
    );
    return data.epoch * 1000;
  }
}
