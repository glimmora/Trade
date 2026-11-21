import { describe, expect, it } from 'vitest';
import type { Candle } from '../types.js';
import {
  dema,
  ema,
  envelope,
  hma,
  maRibbon,
  sma,
  smaCandles,
  tema,
  vwma,
  wma,
} from '../movingAverages.js';
import { createEmaState, createSmaState, emaUpdate, smaUpdate } from '../incremental.js';

function candle(close: number, time = 0): Candle {
  return { time, open: close, high: close + 1, low: close - 1, close, volume: 100 };
}

describe('sma', () => {
  it('computes hand-checked values for [10..15], period 3', () => {
    expect(sma([10, 11, 12, 13, 14, 15], 3)).toEqual([
      undefined,
      undefined,
      11,
      12,
      13,
      14,
    ]);
  });
  it('returns undefined for period 0 and short series', () => {
    expect(sma([1, 2], 5)).toEqual([undefined, undefined]);
    expect(sma([1, 2, 3], 0)).toEqual([undefined, undefined, undefined]);
  });
});

describe('ema', () => {
  it('seeds with SMA and uses k=2/(n+1)', () => {
    // Seed SMA(10,11,12)=11, k=0.5: 13*0.5+11*0.5=12, then 13, then 14.
    expect(ema([10, 11, 12, 13, 14, 15], 3)).toEqual([
      undefined,
      undefined,
      11,
      12,
      13,
      14,
    ]);
  });
});

describe('wma / vwma', () => {
  it('weights the newest bar heaviest', () => {
    const v = wma([10, 11, 12], 3)[2];
    expect(v).toBeCloseTo((10 * 1 + 11 * 2 + 12 * 3) / 6, 10);
  });
  it('equals SMA when volumes are equal', () => {
    expect(vwma([10, 11, 12], [100, 100, 100], 3)[2]).toBeCloseTo(11, 10);
    expect(vwma([10, 20], [100, 300], 2)[1]).toBeCloseTo(17.5, 10);
  });
});

describe('hma / dema / tema', () => {
  const values = Array.from({ length: 30 }, (_, i) => 100 + i);
  it('hma is defined after the warm-up and tracks the trend', () => {
    const out = hma(values, 10);
    expect(out.length).toBe(30);
    const last = out[29];
    expect(last).toBeDefined();
    expect(last as number).toBeGreaterThan(120);
  });
  it('dema and tema are defined and finite', () => {
    for (const fn of [dema, tema]) {
      const out = fn(values, 10);
      const last = out[29];
      expect(last).toBeDefined();
      expect(Number.isFinite(last as number)).toBe(true);
    }
  });
});

describe('ribbon and envelope', () => {
  it('ribbon returns one series per period', () => {
    const values = Array.from({ length: 60 }, (_, i) => 100 + i);
    const ribbon = maRibbon(values, [5, 21]);
    expect(Object.keys(ribbon).sort()).toEqual(['21', '5']);
    expect(ribbon[5]?.length).toBe(60);
  });
  it('envelope is SMA +/- percent', () => {
    const { upper, basis, lower } = envelope([10, 11, 12, 13], 3, 10);
    expect(basis[2]).toBeCloseTo(11, 10);
    expect(upper[2]).toBeCloseTo(12.1, 10);
    expect(lower[2]).toBeCloseTo(9.9, 10);
  });
  it('smaCandles reads the close source', () => {
    const candles = [10, 11, 12].map((c, i) => candle(c, i));
    expect(smaCandles(candles, { period: 3, source: 'close' })[2]).toBe(11);
  });
});

describe('incremental updates', () => {
  it('emaUpdate matches batch EMA on the seed window', () => {
    const state = createEmaState(3);
    expect(emaUpdate(state, 10)).toBeUndefined();
    expect(emaUpdate(state, 11)).toBeUndefined();
    expect(emaUpdate(state, 12)).toBeCloseTo(11, 10);
    expect(emaUpdate(state, 13)).toBeCloseTo(12, 10);
  });
  it('smaUpdate returns the rolling mean once full', () => {
    const state = createSmaState(3);
    expect(smaUpdate(state, 10)).toBeUndefined();
    expect(smaUpdate(state, 11)).toBeUndefined();
    expect(smaUpdate(state, 12)).toBeCloseTo(11, 10);
    expect(smaUpdate(state, 13)).toBeCloseTo(12, 10);
  });
});
