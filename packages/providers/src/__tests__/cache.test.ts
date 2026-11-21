import { describe, expect, it, vi } from 'vitest';
import { CoalescingCache, MemoryCache, backoffDelayMs, parseRetryAfter, retryWithBackoff } from '../cache';
import { RateLimitError } from '../types';

describe('MemoryCache', () => {
  it('returns values until TTL expiry, then misses', () => {
    const cache = new MemoryCache<string>(1000);
    cache.set('k', 'v', 1000);
    expect(cache.get('k', 1500)).toBe('v');
    expect(cache.get('k', 2000)).toBeUndefined();
    expect(cache.size).toBe(0);
  });
  it('supports delete and clear', () => {
    const cache = new MemoryCache<number>();
    cache.set('a', 1);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe('CoalescingCache', () => {
  it('coalesces concurrent fetches into one underlying call', async () => {
    const cache = new CoalescingCache<string>(60_000);
    const fetcher = vi.fn(async () => 'result');
    const [a, b] = await Promise.all([
      cache.getOrFetch('k', fetcher),
      cache.getOrFetch('k', fetcher),
    ]);
    expect(a).toBe('result');
    expect(b).toBe('result');
    expect(fetcher).toHaveBeenCalledTimes(1);
    // Second call is served from cache.
    await cache.getOrFetch('k', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries the fetcher after a failure', async () => {
    const cache = new CoalescingCache<string>(60_000);
    const fetcher = vi.fn(async () => 'ok');
    fetcher.mockRejectedValueOnce(new Error('boom'));
    await expect(cache.getOrFetch('k', fetcher)).rejects.toThrow('boom');
    await expect(cache.getOrFetch('k', fetcher)).resolves.toBe('ok');
  });
});

describe('parseRetryAfter', () => {
  it('parses seconds and HTTP dates, returns undefined for junk', () => {
    expect(parseRetryAfter('120', 1000)).toBe(120_000);
    expect(parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT', Date.parse('Wed, 21 Oct 2015 07:27:00 GMT'))).toBe(60_000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('junk')).toBeUndefined();
  });
});

describe('backoffDelayMs', () => {
  it('grows exponentially and is capped', () => {
    expect(backoffDelayMs(0, 500, 30_000)).toBeGreaterThanOrEqual(500);
    expect(backoffDelayMs(10, 500, 30_000)).toBeLessThanOrEqual(30_000);
  });
});

describe('retryWithBackoff', () => {
  it('retries a rate limit and then succeeds, honouring Retry-After', async () => {
    const sleep = vi.fn(async () => undefined);
    const fn = vi.fn(async () => 'done');
    fn.mockRejectedValueOnce(new RateLimitError('slow down', 2500));
    const result = await retryWithBackoff(fn, { sleep });
    expect(result).toBe('done');
    expect(sleep).toHaveBeenCalledWith(2500);
  });

  it('gives up after max attempts and rethrows non-retryable errors immediately', async () => {
    const fn = vi.fn(async () => 'x');
    fn.mockRejectedValue(new RateLimitError('slow down'));
    await expect(retryWithBackoff(fn, { maxAttempts: 2, sleep: async () => undefined })).rejects.toBeInstanceOf(RateLimitError);
    expect(fn).toHaveBeenCalledTimes(2);

    const bad = vi.fn(async () => 'x');
    bad.mockRejectedValue(new Error('not retryable'));
    await expect(retryWithBackoff(bad, { sleep: async () => undefined })).rejects.toThrow('not retryable');
    expect(bad).toHaveBeenCalledTimes(1);
  });
});
