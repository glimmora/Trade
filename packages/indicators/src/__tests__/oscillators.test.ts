import { describe, expect, it } from 'vitest';
import type { Candle } from '../types.js';
import {
  accumulationDistribution,
  adx,
  awesomeOscillator,
  cci,
  chaikinMoneyFlow,
  macd,
  mfi,
  momentum,
  obv,
  roc,
  rsi,
  stochRsi,
  stochastic,
  volumeWithMa,
  williamsR,
} from '../oscillators.js';
import { createMacdState, createRsiState, macdUpdate, rsiUpdate } from '../incremental.js';

function candle(o: number, h: number, l: number, c: number, v = 100, time = 0): Candle {
  return { time, open: o, high: h, low: l, close: c, volume: v };
}

function closesToCandles(closes: readonly number[]): Candle[] {
  return closes.map((c, i) => candle(c - 0.5, c + 1, c - 1, c, 100, i * 60));
}

describe('rsi', () => {
  it('is 100 on a pure up-move and 0 on a pure down-move', () => {
    const up = Array.from({ length: 20 }, (_, i) => 100 + i);
    const down = Array.from({ length: 20 }, (_, i) => 120 - i);
    expect(rsi(up, 14)[19]).toBe(100);
    expect(rsi(down, 14)[19]).toBe(0);
  });
  it('is 50 on a flat series', () => {
    const flat = new Array(20).fill(100);
    expect(rsi(flat, 14)[19]).toBe(50);
  });
  it('stays in 0..100 on a mixed series', () => {
    const mixed = [100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105, 107, 106, 108, 107, 109, 108, 110, 109, 111];
    for (const v of rsi(mixed, 14)) {
      if (v !== undefined) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('stochastic / stoch rsi', () => {
  it('stochastic %K is hand-checked at the window high', () => {
    const candles = closesToCandles([90, 92, 94, 96, 98, 100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90]);
    const { k } = stochastic(candles, 5, 1, 1);
    // Window i=1..5: high 101, low 91, close 100 => (100-91)/(101-91)*100 = 90.
    expect(k[5]).toBeCloseTo(90, 6);
  });
  it('stochastic and stoch-rsi stay in 0..100', () => {
    const candles = closesToCandles(Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 5 + i * 0.2));
    const { k, d } = stochastic(candles, 14, 3, 3);
    for (const v of [...k, ...d]) {
      if (v !== undefined) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
    const sr = stochRsi(candles.map((c) => c.close), 14, 14, 3, 3);
    for (const v of [...sr.k, ...sr.d]) {
      if (v !== undefined) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('macd', () => {
  it('is zero on a flat series', () => {
    const flat = new Array(40).fill(100);
    const { macd: m, histogram } = macd(flat, 12, 26, 9);
    expect(m[39]).toBeCloseTo(0, 10);
    expect(histogram[39]).toBeCloseTo(0, 10);
  });
  it('is positive on a sustained up-move', () => {
    const up = Array.from({ length: 40 }, (_, i) => 100 + i);
    const { macd: m } = macd(up, 12, 26, 9);
    expect((m[39] as number) > 0).toBe(true);
  });
});

describe('cci / williams-r / roc / momentum', () => {
  it('cci is undefined on a flat series (zero mean deviation)', () => {
    const candles = Array.from({ length: 25 }, (_, i) => candle(10, 10, 10, 10, 100, i));
    expect(cci(candles, 20)[24]).toBeUndefined();
  });
  it('williams %R is 0 at the high and -100 at the low', () => {
    const candles = [
      candle(10, 12, 10, 12, 100, 0),
      candle(12, 12, 8, 8, 100, 1),
    ];
    // Window of 2: high 12, low 8. Close 8 => -100.
    expect(williamsR(candles, 2)[1]).toBeCloseTo(-100, 10);
    const candles2 = [
      candle(10, 12, 10, 10, 100, 0),
      candle(10, 12, 8, 12, 100, 1),
    ];
    expect(williamsR(candles2, 2)[1]).toBeCloseTo(0, 10);
  });
  it('roc and momentum are hand-checked', () => {
    expect(roc([100, 110, 121], 1)[1]).toBeCloseTo(10, 10);
    expect(roc([100, 110, 121], 1)[2]).toBeCloseTo(10, 10);
    expect(momentum([100, 110, 121], 2)[2]).toBe(21);
  });
});

describe('mfi / adx', () => {
  it('mfi stays in 0..100', () => {
    const candles = closesToCandles(Array.from({ length: 30 }, (_, i) => 100 + ((i * 7) % 11) - 5));
    for (const v of mfi(candles, 14)) {
      if (v !== undefined) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
  it('adx +DI exceeds -DI in an uptrend', () => {
    const candles = Array.from({ length: 40 }, (_, i) => {
      const close = 100 + i;
      return candle(close - 0.5, close + 1, close - 1, close, 100, i);
    });
    const { adx: a, plusDi, minusDi } = adx(candles, 14);
    expect(a[39]).toBeDefined();
    expect((plusDi[39] as number) > (minusDi[39] as number)).toBe(true);
  });
});

describe('volume indicators', () => {
  it('obv adds volume on up closes and subtracts on down closes', () => {
    const candles = [
      candle(10, 11, 9, 11, 100, 0),
      candle(11, 12, 10, 10, 50, 1),
      candle(10, 11, 9, 12, 200, 2),
    ];
    expect(obv(candles)).toEqual([0, -50, 150]);
  });
  it('volume MA is the SMA of volume', () => {
    const candles = [100, 200, 300].map((v, i) => candle(10, 11, 9, 10, v, i));
    const { volume, ma } = volumeWithMa(candles, 3);
    expect(volume).toEqual([100, 200, 300]);
    expect(ma[2]).toBe(200);
  });
  it('accumulation/distribution rises when closes are near highs', () => {
    const candles = [
      candle(10, 12, 10, 12, 100, 0),
      candle(12, 14, 12, 14, 100, 1),
    ];
    const ad = accumulationDistribution(candles);
    expect(ad[1]).toBeGreaterThan(ad[0] as number);
  });
  it('awesome oscillator is defined after 34 bars', () => {
    const candles = closesToCandles(Array.from({ length: 40 }, (_, i) => 100 + i * 0.5));
    const ao = awesomeOscillator(candles);
    expect(ao[33]).toBeDefined();
    expect(ao[32]).toBeUndefined();
  });
  it('chaikin money flow stays in -1..1', () => {
    const candles = closesToCandles(Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 3));
    for (const v of chaikinMoneyFlow(candles, 20)) {
      if (v !== undefined) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('incremental rsi / macd', () => {
  it('rsiUpdate reaches 100 on a sustained up-move', () => {
    const state = createRsiState(14);
    let last: number | undefined;
    for (let i = 0; i < 20; i++) last = rsiUpdate(state, 100 + i);
    expect(last).toBe(100);
  });
  it('macdUpdate matches the flat-series zero', () => {
    const state = createMacdState(12, 26, 9);
    let last = { macd: undefined as number | undefined, signal: undefined as number | undefined, histogram: undefined as number | undefined };
    for (let i = 0; i < 40; i++) last = macdUpdate(state, 100);
    expect(last.macd).toBeCloseTo(0, 10);
  });
});
