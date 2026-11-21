import { describe, expect, it } from 'vitest';
import {
  crossCheckPrices,
  feedStatus,
  lastUpdateAge,
  median,
  thresholdForKind,
} from '../crosscheck';

describe('thresholdForKind', () => {
  it('uses 0.3% for crypto and 0.15% for gold', () => {
    expect(thresholdForKind('crypto')).toBe(0.003);
    expect(thresholdForKind('gold')).toBe(0.0015);
  });
});

describe('median', () => {
  it('returns the middle value (odd) and the mean of the middle two (even)', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('crossCheckPrices', () => {
  it('returns no warning when providers agree within the threshold', () => {
    const result = crossCheckPrices('BTC/USDT', 'crypto', [
      { provider: 'binance', symbol: 'BTC/USDT', price: 96500, timestampMs: 1000 },
      { provider: 'bybit', symbol: 'BTC/USDT', price: 96600, timestampMs: 1000 },
    ]);
    expect(result.warning).toBeUndefined();
    expect(result.maxDeviationPct).toBeLessThan(0.003);
  });

  it('warns with both values when a gold provider deviates beyond 0.15%', () => {
    const result = crossCheckPrices('XAUT/USDT', 'gold', [
      { provider: 'binance', symbol: 'XAUT/USDT', price: 4128, timestampMs: 1000 },
      { provider: 'bybit', symbol: 'XAUT/USDT', price: 4128, timestampMs: 1000 },
      { provider: 'kraken', symbol: 'XAUT/USDT', price: 4200, timestampMs: 1000 },
    ]);
    expect(result.warning).toBeDefined();
    expect(result.warning?.outliers).toHaveLength(1);
    expect(result.warning?.outliers[0]?.provider).toBe('kraken');
    expect(result.warning?.message).toContain('4200.00');
    expect(result.warning?.message).toContain('4128.00');
  });

  it('handles a single sample with no warning', () => {
    const result = crossCheckPrices('XAU/USD', 'gold', [
      { provider: 'twelvedata', symbol: 'XAU/USD', price: 4128, timestampMs: 1000 },
    ]);
    expect(result.warning).toBeUndefined();
    expect(result.referencePrice).toBe(4128);
  });

  it('ignores non-finite or non-positive prices', () => {
    const result = crossCheckPrices('BTC/USDT', 'crypto', [
      { provider: 'binance', symbol: 'BTC/USDT', price: 96500, timestampMs: 1000 },
      { provider: 'bybit', symbol: 'BTC/USDT', price: 0, timestampMs: 1000 },
    ]);
    expect(result.deviations).toHaveLength(1);
  });
});

describe('feedStatus / lastUpdateAge', () => {
  const now = 1_000_000;
  it('classifies live, delayed and offline by age', () => {
    expect(feedStatus(now - 1000, now)).toBe('live');
    expect(feedStatus(now - 30_000, now)).toBe('delayed');
    expect(feedStatus(now - 120_000, now)).toBe('offline');
    expect(feedStatus(undefined, now)).toBe('offline');
    expect(feedStatus(now - 1000, now, true)).toBe('delayed');
  });
  it('formats update age', () => {
    expect(lastUpdateAge(undefined, now)).toBe('never');
    expect(lastUpdateAge(now - 1000, now)).toBe('just now');
    expect(lastUpdateAge(now - 30_000, now)).toBe('30s ago');
    expect(lastUpdateAge(now - 120_000, now)).toBe('2m ago');
  });
});
