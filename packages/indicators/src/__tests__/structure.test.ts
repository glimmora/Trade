import { describe, expect, it } from 'vitest';
import type { Candle } from '../types.js';
import {
  DEFAULT_BREAK_RETEST_SETTINGS,
  detectBreakRetestForZone,
  detectCandlestickPatterns,
  detectChannels,
  detectFairValueGaps,
  detectMarketStructure,
  detectOrderBlocks,
  detectSupportResistance,
  detectSupplyDemand,
  detectTrendlines,
  fibonacciAuto,
  fibonacciLevels,
  findSwingPivots,
} from '../structure.js';
import type { Zone } from '../types.js';

function candle(o: number, h: number, l: number, c: number, v = 100, time = 0): Candle {
  return { time, open: o, high: h, low: l, close: c, volume: v };
}

function zigzag(closes: readonly number[]): Candle[] {
  return closes.map((c, i) => candle(c - 0.5, c + 2, c - 2, c, 100, i * 60));
}

describe('swing pivots', () => {
  it('finds a peak and a trough in a zigzag', () => {
    const candles = zigzag([90, 95, 100, 95, 90, 95, 100, 95, 90]);
    const pivots = findSwingPivots(candles, 1, 1);
    expect(pivots.some((p) => p.kind === 'high' && p.price === 102)).toBe(true);
    expect(pivots.some((p) => p.kind === 'low' && p.price === 88)).toBe(true);
  });
});

describe('support & resistance', () => {
  it('clusters repeated highs into a resistance zone', () => {
    const candles = zigzag([90, 95, 100, 95, 90, 95, 100, 95, 90, 95, 100, 95, 90]);
    const zones = detectSupportResistance(candles, {
      pivotLeft: 1,
      pivotRight: 1,
      tolerancePct: 0.5,
      minTouches: 2,
    });
    const resistance = zones.find((z) => z.type === 'resistance');
    expect(resistance).toBeDefined();
    expect((resistance as Zone).touches).toBeGreaterThanOrEqual(2);
    expect((resistance as Zone).strength).toBeGreaterThan(0);
    expect((resistance as Zone).strength).toBeLessThanOrEqual(1);
  });
  it('a body close through a zone invalidates it', () => {
    const base = zigzag([90, 95, 100, 95, 90, 95, 100, 95, 90]);
    const zones = detectSupportResistance(base, {
      pivotLeft: 1,
      pivotRight: 1,
      tolerancePct: 0.5,
      minTouches: 2,
    });
    expect(zones.length).toBeGreaterThan(0);
    // Append a candle closing well above the resistance zone.
    const broken = [...base, candle(100, 110, 100, 108, 100, 999)];
    const zones2 = detectSupportResistance(broken, {
      pivotLeft: 1,
      pivotRight: 1,
      tolerancePct: 0.5,
      minTouches: 2,
    });
    const resistance = zones2.find((z) => z.type === 'resistance');
    if (resistance !== undefined) expect(resistance.invalidated).toBe(true);
  });
});

describe('market structure', () => {
  it('labels an uptrend as HH / HL', () => {
    // Rising zigzag with higher highs and higher lows.
    const candles = zigzag([90, 95, 100, 97, 102, 99, 104, 101, 106, 103, 108]);
    const { labels, trend } = detectMarketStructure(candles, 1, 1);
    expect(labels.some((l) => l.label === 'HH')).toBe(true);
    expect(labels.some((l) => l.label === 'HL')).toBe(true);
    expect(trend).toBe('uptrend');
  });
});

describe('trendlines and channels', () => {
  it('finds trendlines on a zigzag', () => {
    const candles = zigzag([90, 95, 100, 95, 90, 95, 100, 95, 90, 95, 100, 95, 90]);
    const lines = detectTrendlines(candles, 1, 1, 1);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) expect(line.touches).toBeGreaterThanOrEqual(2);
  });
  it('channels return an array (empty when no parallel pair)', () => {
    const candles = zigzag([90, 95, 100, 95, 90, 95, 100, 95, 90]);
    const channels = detectChannels(candles, 1, 50, 1, 1);
    expect(Array.isArray(channels)).toBe(true);
    if (channels.length > 0) {
      expect(channels[0]?.touches).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('fibonacci', () => {
  it('50% of 0..100 is 50 and 61.8% is 38.2', () => {
    const levels = fibonacciLevels(100, 0);
    const fifty = levels.find((l) => l.ratio === 0.5);
    const fib618 = levels.find((l) => l.ratio === 0.618);
    expect(fifty?.price).toBeCloseTo(50, 10);
    expect(fib618?.price).toBeCloseTo(38.2, 10);
    expect(levels.find((l) => l.ratio === 1.618)?.price).toBeCloseTo(-61.8, 10);
  });
  it('auto levels use the lookback swing', () => {
    const candles = zigzag([90, 100, 95, 105, 95, 100]);
    expect(fibonacciAuto(candles, 10).length).toBeGreaterThan(0);
  });
});

describe('candlestick patterns', () => {
  it('detects a bullish engulfing', () => {
    const candles = [
      candle(10, 10.5, 9, 9.5, 100, 0),
      candle(9, 11, 8.5, 10.5, 100, 1),
    ];
    const patterns = detectCandlestickPatterns(candles);
    expect(patterns.some((p) => p.type === 'bullish-engulfing')).toBe(true);
  });
  it('detects a doji and a pin bar', () => {
    const candles = [
      candle(10, 10.2, 9.8, 10, 100, 0),
      candle(10, 10.2, 8, 10.1, 100, 1),
    ];
    const patterns = detectCandlestickPatterns(candles);
    expect(patterns.some((p) => p.type === 'doji')).toBe(true);
    expect(patterns.some((p) => p.type === 'hammer' || p.type === 'pin-bar')).toBe(true);
  });
  it('detects a morning star', () => {
    const candles = [
      candle(12, 12.5, 10, 10.5, 100, 0),
      candle(10, 10.4, 9.8, 10.2, 100, 1),
      candle(10.2, 12.5, 10, 12, 100, 2),
    ];
    const patterns = detectCandlestickPatterns(candles);
    expect(patterns.some((p) => p.type === 'morning-star')).toBe(true);
  });
});

describe('supply / demand, order blocks, fair-value gaps', () => {
  it('detects a demand zone from green-red-green', () => {
    const candles = [
      candle(10, 11, 9.5, 11, 100, 0),
      candle(11, 11.5, 9, 9.5, 100, 1),
      candle(9.5, 12, 9, 11.5, 100, 2),
      candle(11.5, 12.5, 11, 12, 100, 3),
    ];
    const zones = detectSupplyDemand(candles);
    expect(zones.some((z) => z.type === 'demand')).toBe(true);
  });
  it('detects an order block before an impulsive move', () => {
    const candles = [
      candle(11, 11.5, 10, 10.5, 100, 0),
      candle(10.5, 12, 10.5, 11.5, 100, 1),
      candle(11.5, 13, 11.5, 12.5, 100, 2),
    ];
    expect(detectOrderBlocks(candles, 0.5).length).toBeGreaterThan(0);
  });
  it('detects a fair-value gap', () => {
    const candles = [
      candle(10, 100, 99, 99.5, 100, 0),
      candle(100, 101, 99, 100, 100, 1),
      candle(102, 103, 102, 103, 100, 2),
    ];
    const gaps = detectFairValueGaps(candles);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0]?.type).toBe('fair-value-gap');
  });
});

describe('break & retest', () => {
  it('confirms a long setup: breakout, retest, pin-bar confirmation', () => {
    const zone: Zone = {
      type: 'resistance',
      top: 100,
      bottom: 98,
      mid: 99,
      index: 0,
      time: 0,
      touches: 2,
      strength: 0.8,
      invalidated: false,
      breakoutConfirmed: true,
    };
    const candles = [
      candle(99, 100, 98, 99, 100, 0),
      // Breakout candle: closes above the zone.
      candle(99, 102, 99, 101, 100, 60),
      // Retest: low touches the zone, pin-bar confirmation (long lower wick).
      candle(101, 101.5, 99, 100.5, 100, 120),
      candle(100.5, 101.5, 100, 101, 100, 180),
    ];
    const setup = detectBreakRetestForZone(candles, zone, {
      ...DEFAULT_BREAK_RETEST_SETTINGS,
      requireConfirmation: false,
    });
    expect(setup).toBeDefined();
    expect(setup?.direction).toBe('long');
    expect(setup?.status).toBe('confirmed');
    expect(setup?.entry).toBe(99);
    expect(setup?.stop).toBeLessThan(98);
    expect(setup?.target1).toBeGreaterThan(setup?.entry as number);
    expect(setup?.riskReward1).toBe(2);
  });
  it('reports awaiting-retest when price never returns', () => {
    const zone: Zone = {
      type: 'resistance',
      top: 100,
      bottom: 98,
      mid: 99,
      index: 0,
      time: 0,
      touches: 2,
      strength: 0.8,
      invalidated: false,
      breakoutConfirmed: true,
    };
    const candles = [
      candle(99, 100, 98, 99, 100, 0),
      candle(99, 102, 99, 101, 100, 60),
      candle(101, 103, 101, 102, 100, 120),
      candle(102, 104, 102, 103, 100, 180),
    ];
    const setup = detectBreakRetestForZone(candles, zone, {
      ...DEFAULT_BREAK_RETEST_SETTINGS,
      maxRetestWindow: 2,
    });
    expect(setup?.status).toBe('awaiting-retest');
  });
  it('returns undefined when there is no breakout', () => {
    const zone: Zone = {
      type: 'resistance',
      top: 100,
      bottom: 98,
      mid: 99,
      index: 0,
      time: 0,
      touches: 2,
      strength: 0.8,
      invalidated: false,
      breakoutConfirmed: false,
    };
    const candles = [
      candle(99, 100, 98, 99, 100, 0),
      candle(99, 99.5, 98.5, 99, 100, 60),
    ];
    expect(detectBreakRetestForZone(candles, zone)).toBeUndefined();
  });
});
