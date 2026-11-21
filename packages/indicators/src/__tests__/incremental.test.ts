import { describe, expect, it } from 'vitest';
import type { Candle } from '../types.js';
import {
  atrUpdate,
  bollingerUpdate,
  createAtrState,
  createBollingerState,
  createVwapState,
  vwapUpdate,
} from '../incremental.js';
import { detectBreakRetest } from '../structure.js';

function candle(o: number, h: number, l: number, c: number, v = 100, time = 0): Candle {
  return { time, open: o, high: h, low: l, close: c, volume: v };
}

describe('incremental atr / bollinger / vwap', () => {
  it('atrUpdate converges to the constant range', () => {
    const state = createAtrState(3);
    let last: number | undefined;
    for (let i = 0; i < 5; i++) {
      last = atrUpdate(state, candle(10, 12, 10, 11, 100, i));
    }
    expect(last).toBeCloseTo(2, 10);
  });
  it('bollingerUpdate returns bands once the window is full', () => {
    const state = createBollingerState(3, 2);
    expect(bollingerUpdate(state, 10).basis).toBeUndefined();
    expect(bollingerUpdate(state, 11).basis).toBeUndefined();
    const out = bollingerUpdate(state, 12);
    expect(out.basis).toBeCloseTo(11, 10);
    expect(out.upper).toBeCloseTo(11 + 2 * 0.8164965809, 6);
    expect(out.lower).toBeCloseTo(11 - 2 * 0.8164965809, 6);
  });
  it('vwapUpdate resets on a new UTC day', () => {
    const state = createVwapState();
    expect(vwapUpdate(state, candle(10, 10, 10, 10, 100, 1_700_000_000))).toBeCloseTo(10, 10);
    expect(vwapUpdate(state, candle(20, 20, 20, 20, 100, 1_700_000_000 + 86_400))).toBeCloseTo(20, 10);
  });
});

describe('detectBreakRetest (full, zone-driven)', () => {
  it('returns an array and is deterministic on a zigzag series', () => {
    const closes = [90, 95, 100, 95, 90, 95, 100, 95, 90, 95, 105, 100, 102, 101, 103];
    const candles = closes.map((c, i) => candle(c - 0.5, c + 2, c - 2, c, 100, i * 60));
    const out = detectBreakRetest(candles, {
      tolerancePct: 0.5,
      lookback: 100,
      minRetestWait: 1,
      maxRetestWindow: 20,
      minRiskReward: 2,
      requireConfirmation: false,
      entryMode: 'retest',
    });
    expect(Array.isArray(out)).toBe(true);
    expect(detectBreakRetest(candles, {
      tolerancePct: 0.5,
      lookback: 100,
      minRetestWait: 1,
      maxRetestWindow: 20,
      minRiskReward: 2,
      requireConfirmation: false,
      entryMode: 'retest',
    })).toEqual(out);
    for (const s of out) {
      expect(s.riskReward1).toBe(2);
      expect(s.entry).toBeDefined();
      expect(s.stop).toBeDefined();
    }
  });
});
