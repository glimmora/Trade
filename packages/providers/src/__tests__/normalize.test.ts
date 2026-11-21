import { describe, expect, it } from 'vitest';
import {
  applyServerOffset,
  detectGaps,
  isClosedCandle,
  isFormingCandle,
  mergeLiveTick,
  normalizeCandles,
  roundToTick,
  serverTimeOffset,
  toUtcSeconds,
} from '../normalize';

const SERVER_NOW_MS = 1763732400 * 1000; // after the 03:00 UTC 1h candle closes

function rows() {
  return [
    { timeMs: 1763728800000, open: 96590.3, high: 96700, low: 96580, close: 96650, volume: 11.111 },
    { timeMs: 1763721600000, open: 96412.5, high: 96500, low: 96380.1, close: 96480, volume: 12.345 },
    // Duplicate of the first row (different volume — last wins via dedupe).
    { timeMs: 1763728800000, open: 96590.3, high: 96700, low: 96580, close: 96650, volume: 99 },
    // Invalid rows: zero price, high < low, non-finite.
    { timeMs: 1763732400000, open: 0, high: 0, low: 0, close: 0, volume: 0 },
    { timeMs: 1763736000000, open: 100, high: 90, low: 110, close: 105, volume: 1 },
    { timeMs: 1763739600000, open: Number.NaN, high: 100, low: 90, close: 95, volume: 1 },
  ];
}

describe('normalizeCandles', () => {
  it('sorts ascending, de-duplicates by open time, drops invalid rows', () => {
    const result = normalizeCandles(rows(), '1h', SERVER_NOW_MS);
    expect(result.droppedRows).toBe(3);
    expect(result.candles.map((c) => c.time)).toEqual([1763721600, 1763728800]);
    expect(result.candles[1]?.volume).toBe(99);
    expect(result.hasFormingCandle).toBe(false);
  });

  it('repairs high/low to enclose open and close instead of dropping the row', () => {
    const result = normalizeCandles(
      [{ timeMs: 1763721600000, open: 100, high: 101, low: 99, close: 102, volume: 1 }],
      '1h',
      SERVER_NOW_MS,
    );
    expect(result.candles[0]?.high).toBe(102);
    expect(result.candles[0]?.low).toBe(99);
  });

  it('marks the newest candle forming when its close is still ahead', () => {
    const result = normalizeCandles(
      [{ timeMs: 1763728800000, open: 100, high: 101, low: 99, close: 100.5, volume: 1 }],
      '1h',
      1763730000 * 1000,
    );
    expect(result.hasFormingCandle).toBe(true);
  });

  it('aligns timestamps down to the timeframe grid', () => {
    const result = normalizeCandles(
      [{ timeMs: 1763728800123, open: 100, high: 101, low: 99, close: 100.5, volume: 1 }],
      '1h',
      SERVER_NOW_MS,
    );
    expect(result.candles[0]?.time).toBe(1763728800);
  });
});

describe('detectGaps', () => {
  it('reports missing bars between candles', () => {
    const candles = [
      { time: 1763721600, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { time: 1763728800, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { time: 1763739600, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ];
    const gaps = detectGaps(candles, '1h');
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toEqual({ from: 1763728800, to: 1763739600, missingBars: 2 });
  });

  it('returns no gaps for a contiguous series', () => {
    const candles = [
      { time: 1763721600, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { time: 1763725200, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ];
    expect(detectGaps(candles, '1h')).toEqual([]);
  });
});

describe('mergeLiveTick', () => {
  const series = [
    { time: 1763721600, open: 100, high: 101, low: 99, close: 100, volume: 1 },
    { time: 1763725200, open: 100, high: 101, low: 99, close: 100, volume: 1 },
  ];
  it('replaces the forming candle with the same open time', () => {
    const merged = mergeLiveTick(series, { time: 1763725200, open: 100, high: 102, low: 99, close: 101, volume: 2 }, '1h');
    expect(merged).toHaveLength(2);
    expect(merged[1]?.high).toBe(102);
  });
  it('appends a newer candle and drops an older tick', () => {
    expect(mergeLiveTick(series, { time: 1763728800, open: 1, high: 1, low: 1, close: 1, volume: 1 }, '1h')).toHaveLength(3);
    expect(mergeLiveTick(series, { time: 1763721600, open: 1, high: 1, low: 1, close: 1, volume: 1 }, '1h')).toHaveLength(2);
  });
});

describe('time helpers', () => {
  it('converts ms to UTC seconds and rounds to tick size', () => {
    expect(toUtcSeconds(1763728800123)).toBe(1763728800);
    expect(roundToTick(4128.456, 0.01)).toBeCloseTo(4128.46, 2);
  });
  it('computes and applies the server-time offset', () => {
    expect(serverTimeOffset(1000, 950)).toBe(50);
    expect(applyServerOffset(1000, 50)).toBe(1050);
  });
  it('distinguishes forming from closed candles', () => {
    const candle = { time: 1763728800, open: 1, high: 1, low: 1, close: 1, volume: 1 };
    expect(isFormingCandle(candle, '1h', 1763730000 * 1000)).toBe(true);
    expect(isClosedCandle(candle, '1h', 1763732400 * 1000)).toBe(true);
  });
});
