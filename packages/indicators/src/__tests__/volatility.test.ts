import { describe, expect, it } from 'vitest';
import type { Candle } from '../types.js';
import {
  atr,
  bollingerBands,
  donchianChannel,
  ichimoku,
  keltnerChannel,
  parabolicSar,
  pivotPoints,
  standardDeviation,
  supertrend,
  vwap,
} from '../volatility.js';

function candle(o: number, h: number, l: number, c: number, v = 100, time = 0): Candle {
  return { time, open: o, high: h, low: l, close: c, volume: v };
}

function rising(n: number, start = 100): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = start + i;
    return candle(close - 0.5, close + 1, close - 1, close, 100, i * 60);
  });
}

describe('bollinger bands', () => {
  it('is flat on a flat series', () => {
    const { upper, basis, lower } = bollingerBands([10, 10, 10, 10], 3, 2);
    expect(basis[3]).toBe(10);
    expect(upper[3]).toBe(10);
    expect(lower[3]).toBe(10);
  });
  it('hand-check: [10,11,12] period 3, sd=0.8165, upper=12.633', () => {
    const { upper, basis, lower } = bollingerBands([10, 11, 12, 13, 14], 3, 2);
    expect(basis[2]).toBeCloseTo(11, 10);
    expect(upper[2]).toBeCloseTo(11 + 2 * 0.8164965809, 6);
    expect(lower[2]).toBeCloseTo(11 - 2 * 0.8164965809, 6);
  });
});

describe('standard deviation', () => {
  it('matches the population StdDev of [10,11,12]', () => {
    expect(standardDeviation([10, 11, 12], 3)[2]).toBeCloseTo(0.8164965809, 6);
  });
});

describe('keltner / donchian', () => {
  it('keltner bands bracket the basis', () => {
    const { upper, basis, lower } = keltnerChannel(rising(30), 20, 2, 10);
    const i = 29;
    expect(basis[i]).toBeDefined();
    expect((upper[i] ?? Number.NaN) > (basis[i] ?? Number.NaN)).toBe(true);
    expect((lower[i] ?? Number.NaN) < (basis[i] ?? Number.NaN)).toBe(true);
  });
  it('donchian upper is the highest high of the window', () => {
    const candles = rising(10);
    const { upper, lower } = donchianChannel(candles, 5);
    expect(upper[9]).toBe(110);
    expect(lower[9]).toBe(104);
  });
});

describe('atr', () => {
  it('equals the range on a constant-range series', () => {
    const candles = Array.from({ length: 20 }, (_, i) => candle(10, 12, 10, 11, 100, i));
    // TR is 2 on the first bar, then max(2, |12-11|, |10-11|)=2 thereafter.
    expect(atr(candles, 14)[19]).toBeCloseTo(2, 10);
  });
});

describe('supertrend / parabolic sar', () => {
  it('supertrend trends up on a rising series', () => {
    const { trend, value } = supertrend(rising(40), 10, 3);
    expect(trend[39]).toBe(1);
    expect(value[39]).toBeDefined();
  });
  it('parabolic sar sits below price in an uptrend', () => {
    const { trend, value } = parabolicSar(rising(30));
    expect(trend[29]).toBe(1);
    expect((value[29] ?? Number.NaN) < 129).toBe(true);
  });
});

describe('ichimoku', () => {
  it('conversion is defined at bar 8 and base at bar 25', () => {
    const { conversion, base, spanA, spanB } = ichimoku(rising(90));
    expect(conversion[8]).toBeDefined();
    expect(conversion[7]).toBeUndefined();
    expect(base[25]).toBeDefined();
    expect(spanA[59]).toBeDefined();
    expect(spanB[77]).toBeDefined();
    expect(spanB[59]).toBeUndefined();
  });
});

describe('vwap', () => {
  it('equals the typical price when price and volume are constant', () => {
    const candles = Array.from({ length: 5 }, (_, i) =>
      candle(10, 10, 10, 10, 100, 1_700_000_000 + i * 60),
    );
    const out = vwap(candles, 'day');
    expect(out[4]).toBeCloseTo(10, 10);
  });
  it('resets on a new UTC day', () => {
    const day1 = candle(10, 10, 10, 10, 100, 1_700_000_000);
    const day2 = candle(20, 20, 20, 20, 100, 1_700_000_000 + 86_400);
    const out = vwap([day1, day2], 'day');
    expect(out[1]).toBeCloseTo(20, 10);
  });
});

describe('pivot points', () => {
  it('classic pivots are hand-checked for H=12, L=10, C=11', () => {
    const p = pivotPoints(12, 10, 11, 'classic');
    expect(p.pivot).toBe(11);
    expect(p.r1).toBe(12);
    expect(p.s1).toBe(10);
    expect(p.r2).toBe(13);
    expect(p.s2).toBe(9);
  });
  it('fibonacci and camarilla pivots bracket the pivot', () => {
    const f = pivotPoints(12, 10, 11, 'fibonacci');
    expect(f.r1).toBeGreaterThan(f.pivot);
    expect(f.s1).toBeLessThan(f.pivot);
    const c = pivotPoints(12, 10, 11, 'camarilla');
    expect(c.r1).toBeGreaterThan(11);
    expect(c.s1).toBeLessThan(11);
  });
});
