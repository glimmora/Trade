import { RateLimitError } from './types';

/**
 * Resilience helpers: in-memory TTL cache, request coalescing (one
 * in-flight request per key), and exponential backoff for HTTP 429 / 5xx.
 * No persistence here — the app layer may add IndexedDB caching on top.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAtMs: number;
}

export class MemoryCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs = 30_000) {
    this.ttlMs = ttlMs;
  }

  get(key: string, nowMs = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAtMs <= nowMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, nowMs = Date.now()): void {
    this.store.set(key, { value, expiresAtMs: nowMs + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

/**
 * Coalescing fetcher: concurrent callers with the same key share one
 * underlying promise, and the result is cached for `ttlMs`.
 */
export class CoalescingCache<T> {
  private readonly cache: MemoryCache<T>;
  private readonly inflight = new Map<string, Promise<T>>();

  constructor(ttlMs = 30_000) {
    this.cache = new MemoryCache<T>(ttlMs);
  }

  async getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const pending = this.inflight.get(key);
    if (pending !== undefined) return pending;
    const promise = fetcher()
      .then((value) => {
        this.cache.set(key, value);
        this.inflight.delete(key);
        return value;
      })
      .catch((error: unknown) => {
        this.inflight.delete(key);
        throw error;
      });
    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }
}

/** Parse a Retry-After value (seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(value: string | null, nowMs = Date.now()): number | undefined {
  if (value === null || value === '') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - nowMs);
  return undefined;
}

/** Exponential backoff with jitter. Attempt is 0-based. */
export function backoffDelayMs(attempt: number, baseMs = 500, maxMs = 30_000): number {
  const delay = baseMs * 2 ** attempt;
  const jitter = Math.random() * baseMs;
  return Math.min(maxMs, delay + jitter);
}

export interface RetryOptions {
  maxAttempts?: number;
  baseMs?: number;
  maxMs?: number;
  /** Injectable sleep, for tests. Defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Run `fn`, retrying on RateLimitError / HTTP 5xx with exponential backoff.
 * Honours the Retry-After hint carried by RateLimitError when present.
 * Other errors are rethrown immediately.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRateLimit = error instanceof RateLimitError;
      const isServerError =
        error instanceof Error && /HTTP 5\d\d/.test(error.message);
      if (!isRateLimit && !isServerError) throw error;
      if (attempt === maxAttempts - 1) throw error;
      const hinted =
        error instanceof RateLimitError ? error.retryAfterMs : undefined;
      const delay = hinted ?? backoffDelayMs(attempt, options.baseMs, options.maxMs);
      await sleep(delay);
    }
  }
  throw lastError;
}
