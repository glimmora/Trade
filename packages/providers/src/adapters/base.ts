import { parseRetryAfter, retryWithBackoff } from '../cache';
import { RateLimitError, UnsupportedError } from '../types';
import type {
  ProviderClientOptions,
  ProviderRuntimeKeys,
  TickHandler,
} from '../types';
import type { Candle, Timeframe } from '@trade/core';

/**
 * Shared REST + WebSocket plumbing for adapters.
 * - fetchJson: retries 429/5xx with backoff, honours Retry-After.
 * - WsClient: single WebSocket per adapter, exponential-backoff reconnect,
 *   subscribe/unsubscribe by topic, JSON message dispatch.
 * Adapters never throw raw fetch errors for unsupported symbols — they
 * throw UnsupportedError so the UI can hide/disable that provider.
 */

export interface FetchJsonOptions {
  headers?: Record<string, string>;
}

export class RestClient {
  private readonly fetchFn: typeof fetch;
  private readonly nowFn: () => number;

  constructor(options: ProviderClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.nowFn = options.nowFn ?? Date.now;
  }

  protected get nowMs(): number {
    return this.nowFn();
  }

  async fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
    return retryWithBackoff(async () => {
      let response: Response;
      try {
        response = await this.fetchFn(url, { headers: options.headers });
      } catch (error) {
        throw new Error(`Network error fetching ${new URL(url).hostname}: ${(error as Error).message}`);
      }
      if (response.status === 429) {
        const retryAfter = parseRetryAfter(
          response.headers.get('Retry-After'),
          this.nowMs,
        );
        throw new RateLimitError(`Rate limited by ${new URL(url).hostname}`, retryAfter);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
      }
      return (await response.json()) as T;
    });
  }

  async fetchText(url: string, options: FetchJsonOptions = {}): Promise<string> {
    return retryWithBackoff(async () => {
      const response = await this.fetchFn(url, { headers: options.headers });
      if (response.status === 429) {
        const retryAfter = parseRetryAfter(
          response.headers.get('Retry-After'),
          this.nowMs,
        );
        throw new RateLimitError(`Rate limited by ${new URL(url).hostname}`, retryAfter);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
      }
      return response.text();
    });
  }
}

export function requireProviderSymbol(
  entry: { providerSymbol: string } | undefined,
  symbol: string,
  provider: string,
): string {
  if (entry === undefined) {
    throw new UnsupportedError(`${provider} does not support ${symbol}`);
  }
  return entry.providerSymbol;
}

export function requireKeys(keys: ProviderRuntimeKeys | undefined, name: string): string {
  const key = name === 'twelvedata' ? keys?.twelvedata : undefined;
  if (key === undefined || key === '') {
    throw new UnsupportedError(
      'A user-supplied key is required for this provider. Enter it in Settings — it is stored only in localStorage, never in code.',
    );
  }
  return key;
}

/** Map the app timeframe to a provider-native interval string. */
export type IntervalMap = Record<Timeframe, string | undefined>;

export function intervalFor(
  map: IntervalMap,
  timeframe: Timeframe,
  provider: string,
): string {
  const interval = map[timeframe];
  if (interval === undefined) {
    throw new UnsupportedError(`${provider} does not support timeframe ${timeframe}`);
  }
  return interval;
}

/** Minimal WebSocket client with reconnect + topic routing. Browser-only. */
export interface WsClientOptions {
  /** Build the subscribe payload for a topic. Defaults to { op: 'subscribe', args: [topic] }. */
  subscribePayload?: (topic: string) => unknown;
  /** Build the unsubscribe payload for a topic. Defaults to { op: 'unsubscribe', args: [topic] }. */
  unsubscribePayload?: (topic: string) => unknown;
  /** Called on every (re)connect, before topics are replayed (e.g. to re-auth). */
  onOpen?: () => void;
}

export class WsClient {
  private readonly url: string;
  private readonly onMessage: (data: unknown) => void;
  private readonly options: WsClientOptions;
  private socket: WebSocket | undefined;
  private reconnectAttempts = 0;
  private closed = false;
  private readonly topics = new Set<string>();

  constructor(url: string, onMessage: (data: unknown) => void, options: WsClientOptions = {}) {
    this.url = url;
    this.onMessage = onMessage;
    this.options = options;
  }

  connect(): void {
    if (typeof WebSocket === 'undefined') {
      throw new UnsupportedError('WebSocket is not available in this environment');
    }
    this.closed = false;
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.options.onOpen?.();
      for (const topic of this.topics) {
        this.sendSubscribe(topic);
      }
    });
    socket.addEventListener('message', (event) => {
      try {
        this.onMessage(JSON.parse(String(event.data)) as unknown);
      } catch {
        // Ignore malformed frames; the next tick replaces them.
      }
    });
    socket.addEventListener('close', () => {
      if (this.closed) return;
      this.reconnectAttempts += 1;
      const delay = Math.min(30_000, 500 * 2 ** this.reconnectAttempts);
      setTimeout(() => {
        if (!this.closed) this.connect();
      }, delay);
    });
  }

  protected sendSubscribe(topic: string): void {
    const payload = this.options.subscribePayload?.(topic) ?? { op: 'subscribe', args: [topic] };
    this.sendRaw(JSON.stringify(payload));
  }

  protected sendUnsubscribe(topic: string): void {
    const payload = this.options.unsubscribePayload?.(topic) ?? { op: 'unsubscribe', args: [topic] };
    this.sendRaw(JSON.stringify(payload));
  }

  sendRaw(payload: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(payload);
    }
  }

  subscribe(topic: string): void {
    const first = !this.topics.has(topic);
    this.topics.add(topic);
    if (first && this.socket?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(topic);
    }
    if (this.socket === undefined) this.connect();
  }

  unsubscribe(topic: string): void {
    this.topics.delete(topic);
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe(topic);
    }
  }

  close(): void {
    this.closed = true;
    this.socket?.close();
    this.socket = undefined;
  }

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

/** Per-symbol/timeframe handler table shared by WS adapters. */
export class TickRouter {
  private readonly handlers = new Map<string, TickHandler>();

  static key(symbol: string, timeframe: Timeframe): string {
    return `${symbol}|${timeframe}`;
  }

  set(symbol: string, timeframe: Timeframe, handler: TickHandler): void {
    this.handlers.set(TickRouter.key(symbol, timeframe), handler);
  }

  delete(symbol: string, timeframe: Timeframe): void {
    this.handlers.delete(TickRouter.key(symbol, timeframe));
  }

  dispatch(symbol: string, timeframe: Timeframe, candle: Candle, isForming: boolean, provider: import('@trade/core').ProviderId, timestampMs: number): void {
    const handler = this.handlers.get(TickRouter.key(symbol, timeframe));
    handler?.({ provider, symbol, candle, isForming, timestampMs });
  }

  get size(): number {
    return this.handlers.size;
  }
}
