import { describe, expect, it } from 'vitest';
import {
  anchoredVwap,
  anchorToPixel,
  DEFAULT_HIT_TOLERANCE_PX,
  fibFanSegments,
  fibonacciLevels,
  findNearestCandle,
  gannFanSegments,
  getHandles,
  hitTestDrawing,
  hitTestTopmost,
  lineIntersection,
  linearRegression,
  moveDrawing,
  pitchforkLines,
  pointToSegmentDistance,
  regressionTrendFromCandles,
  resizeDrawing,
  rotateDrawing,
  segmentsIntersect,
  snapToOHLC,
} from '../geometry.js';
import type { CandleLike, ChartScale } from '../geometry.js';
import { createDrawingObject } from '../types.js';

const T0 = 1_700_000_000;

/** 1 px per minute in time, 1 px per price unit (inverted y). */
const scale: ChartScale = {
  timeToX: (t) => (t - T0) / 60,
  priceToY: (p) => 1000 - p,
  xToTime: (x) => T0 + x * 60,
  yToPrice: (y) => 1000 - y,
};

function candles(): CandleLike[] {
  return [0, 1, 2].map((i) => ({
    time: T0 + i * 60,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 102 + i,
    volume: 10,
  }));
}

describe('pointToSegmentDistance', () => {
  it('measures perpendicular distance', () => {
    expect(pointToSegmentDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });

  it('clamps to the nearest endpoint outside the segment', () => {
    expect(pointToSegmentDistance({ x: 12, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(2);
  });

  it('handles a degenerate segment', () => {
    expect(pointToSegmentDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('segment intersection', () => {
  it('detects crossing segments', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true);
  });

  it('rejects parallel non-touching segments', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBe(false);
  });

  it('computes the line intersection', () => {
    expect(
      lineIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toEqual({ x: 5, y: 5 });
    expect(
      lineIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBeNull();
  });
});

describe('hitTestDrawing', () => {
  it('hits a trend line on the line and misses far away', () => {
    const line = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'trend-line',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 110 },
      ],
    });
    expect(hitTestDrawing(line, { x: 5, y: 895 }, scale)).toBe(true);
    expect(hitTestDrawing(line, { x: 5, y: 700 }, scale)).toBe(false);
  });

  it('hits a horizontal line by price only, across all x', () => {
    const line = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'horizontal-line',
      points: [{ time: T0, price: 100 }],
    });
    expect(hitTestDrawing(line, { x: 999, y: 900 }, scale)).toBe(true);
    expect(hitTestDrawing(line, { x: 0, y: 850 }, scale)).toBe(false);
  });

  it('hits a vertical line by time only', () => {
    const line = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'vertical-line',
      points: [{ time: T0 + 60, price: 100 }],
    });
    expect(hitTestDrawing(line, { x: 1, y: 100 }, scale)).toBe(true);
    expect(hitTestDrawing(line, { x: 50, y: 100 }, scale)).toBe(false);
  });

  it('never hits hidden or locked drawings', () => {
    const line = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'trend-line',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 110 },
      ],
    });
    expect(hitTestDrawing({ ...line, hidden: true }, { x: 5, y: 895 }, scale)).toBe(false);
    expect(hitTestDrawing({ ...line, locked: true }, { x: 5, y: 895 }, scale)).toBe(false);
  });

  it('hits inside a filled rectangle, and only the border when unfilled', () => {
    const filled = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'rectangle',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 3600, price: 200 },
      ],
    });
    expect(hitTestDrawing(filled, { x: 30, y: 850 }, scale)).toBe(true);
    expect(hitTestDrawing(filled, { x: 500, y: 850 }, scale)).toBe(false);
    // Rebuild without the fill key to respect the exact-optional contract.
    const { fill: _ignored, ...styleNoFill } = filled.style;
    void _ignored;
    const unfilledObj = { ...filled, style: styleNoFill };
    expect(hitTestDrawing(unfilledObj, { x: 30, y: 850 }, scale)).toBe(false);
    expect(hitTestDrawing(unfilledObj, { x: 30, y: 900 }, scale)).toBe(true);
  });

  it('hits inside a filled ellipse and misses outside it', () => {
    const ellipse = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'ellipse',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 110 },
      ],
    });
    expect(hitTestDrawing(ellipse, { x: 5, y: 895 }, scale)).toBe(true);
    expect(hitTestDrawing(ellipse, { x: 20, y: 895 }, scale)).toBe(false);
  });

  it('hits inside a triangle', () => {
    const triangle = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'triangle',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 100 },
        { time: T0 + 300, price: 120 },
      ],
    });
    expect(hitTestDrawing(triangle, { x: 5, y: 895 }, scale)).toBe(true);
    expect(hitTestDrawing(triangle, { x: 5, y: 700 }, scale)).toBe(false);
  });

  it('hits a ray only in front of its origin', () => {
    const ray = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'ray',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 60, price: 100 },
      ],
    });
    expect(hitTestDrawing(ray, { x: 50, y: 900 }, scale)).toBe(true);
    expect(hitTestDrawing(ray, { x: -50, y: 900 }, scale)).toBe(false);
  });

  it('hits Fibonacci levels and the swing line', () => {
    const fib = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'fib-retracement',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 200 },
      ],
    });
    // 0.5 level: price 150 -> y 850, across x 0..10.
    expect(hitTestDrawing(fib, { x: 5, y: 850 }, scale)).toBe(true);
    expect(hitTestDrawing(fib, { x: 5, y: 700 }, scale)).toBe(false);
  });

  it('hits a Fibonacci fan line', () => {
    const fan = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'fib-fan',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 110 },
      ],
    });
    expect(hitTestDrawing(fan, { x: 5, y: 897.5 }, scale)).toBe(true);
  });

  it('hits a pitchfork median line', () => {
    const fork = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'pitchfork',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 110 },
        { time: T0 + 600, price: 90 },
      ],
    });
    // Median is horizontal at price 100 (y 900) from x 0 to x 20.
    expect(hitTestDrawing(fork, { x: 15, y: 900 }, scale)).toBe(true);
    expect(hitTestDrawing(fork, { x: 15, y: 850 }, scale)).toBe(false);
  });

  it('hits a parallel channel on either line', () => {
    const channel = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'parallel-channel',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 100 },
        { time: T0, price: 110 },
      ],
    });
    expect(hitTestDrawing(channel, { x: 5, y: 900 }, scale)).toBe(true);
    expect(hitTestDrawing(channel, { x: 5, y: 890 }, scale)).toBe(true);
    expect(hitTestDrawing(channel, { x: 5, y: 850 }, scale)).toBe(false);
  });

  it('hits a text label near its anchor', () => {
    const label = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'text-label',
      points: [{ time: T0, price: 100 }],
      label: 'Note',
    });
    expect(hitTestDrawing(label, { x: 5, y: 900 }, scale)).toBe(true);
    expect(hitTestDrawing(label, { x: 200, y: 900 }, scale)).toBe(false);
  });

  it('hits the anchored VWAP line from candles', () => {
    const vwap = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'anchored-vwap',
      points: [{ time: T0, price: 100 }],
    });
    const data = candles();
    expect(hitTestDrawing(vwap, { x: 0.5, y: 897.5 }, scale, { candles: data })).toBe(true);
    expect(hitTestDrawing(vwap, { x: 0.5, y: 700 }, scale, { candles: data })).toBe(false);
  });

  it('hits a regression trend fitted from candle closes', () => {
    const reg = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'regression-trend',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 120, price: 102 },
      ],
    });
    const data = candles();
    expect(hitTestDrawing(reg, { x: 1, y: 899 }, scale, { candles: data })).toBe(true);
  });

  it('hitTestTopmost returns the highest z-index hit', () => {
    const low = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'horizontal-line',
      points: [{ time: T0, price: 100 }],
      zIndex: 1,
    });
    const high = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'horizontal-line',
      points: [{ time: T0, price: 100 }],
      zIndex: 5,
    });
    expect(hitTestTopmost([low, high], { x: 0, y: 900 }, scale)?.id).toBe(high.id);
    expect(hitTestTopmost([low], { x: 0, y: 100 }, scale)).toBeNull();
  });

  it('exposes the default tolerance constant', () => {
    expect(DEFAULT_HIT_TOLERANCE_PX).toBe(6);
  });
});

describe('magnet snap (snapToOHLC)', () => {
  it('snaps time to the nearest candle and price to the nearest OHLC value', () => {
    const result = snapToOHLC({ time: T0 + 37, price: 103.2 }, candles());
    expect(result.snapped).toBe(true);
    expect(result.candleTime).toBe(T0 + 60);
    expect(result.snappedTo).toBe('close');
    expect(result.point).toEqual({ time: T0 + 60, price: 103 });
  });

  it('returns the point unchanged when magnet is off or there are no candles', () => {
    const point = { time: T0 + 37, price: 103.2 };
    expect(snapToOHLC(point, candles(), { magnet: false }).snapped).toBe(false);
    expect(snapToOHLC(point, []).snapped).toBe(false);
  });

  it('finds the nearest candle by binary search', () => {
    expect(findNearestCandle(candles(), T0 + 59)?.time).toBe(T0 + 60);
    expect(findNearestCandle([], T0)).toBeNull();
  });
});

describe('derived lines', () => {
  it('computes retracement and extension levels', () => {
    const ret = fibonacciLevels(100, 200, 'retracement');
    expect(ret.find((l) => l.ratio === 0.618)?.price).toBeCloseTo(161.8, 5);
    const ext = fibonacciLevels(100, 200, 'extension');
    expect(ext.find((l) => l.ratio === 1.618)?.price).toBeCloseTo(261.8, 5);
  });

  it('builds seven Gann fan segments', () => {
    expect(gannFanSegments({ x: 0, y: 0 }, { x: 10, y: 10 })).toHaveLength(7);
  });

  it('builds one fan segment per retracement ratio', () => {
    expect(fibFanSegments({ x: 0, y: 0 }, { x: 10, y: 10 })).toHaveLength(7);
  });

  it('computes pitchfork median and parallels', () => {
    const lines = pitchforkLines({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: -10 });
    expect(lines.median).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
  });

  it('fits a perfect linear regression', () => {
    const reg = linearRegression([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(reg?.slope).toBe(2);
    expect(reg?.intercept).toBe(0);
    expect(reg?.rSquared).toBeCloseTo(1, 5);
    expect(linearRegression([{ x: 0, y: 0 }])).toBeNull();
  });

  it('computes anchored VWAP cumulatively', () => {
    const vwap = anchoredVwap(candles(), T0);
    expect(vwap).toHaveLength(3);
    // Typical prices: (105+95+102)/3 ≈ 100.667, then (106+96+103)/3 ≈ 101.667.
    expect(vwap[0]?.value).toBeCloseTo(100.6667, 4);
    expect(vwap[1]?.value).toBeCloseTo(101.1667, 4);
    expect(anchoredVwap(candles(), T0 + 10_000)).toEqual([]);
  });

  it('fits a regression trend from candle closes', () => {
    const trend = regressionTrendFromCandles(candles(), T0, T0 + 120, scale);
    expect(trend).not.toBeNull();
    expect(trend?.rSquared).toBeCloseTo(1, 5);
    expect(regressionTrendFromCandles(candles(), T0 + 10_000, T0 + 10_060, scale)).toBeNull();
  });
});

describe('handles and transforms', () => {
  it('returns anchor, move and rotate handles', () => {
    const line = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'trend-line',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 110 },
      ],
    });
    const handles = getHandles(line, scale);
    expect(handles).toHaveLength(4);
    expect(handles.map((h) => h.kind)).toEqual(['anchor', 'anchor', 'move', 'rotate']);
  });

  it('moves a drawing by a time/price delta', () => {
    const line = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'trend-line',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 110 },
      ],
    });
    const moved = moveDrawing(line, 60, 5);
    expect(moved.points).toEqual([
      { time: T0 + 60, price: 105 },
      { time: T0 + 660, price: 115 },
    ]);
    expect(line.points[0]).toEqual({ time: T0, price: 100 });
  });

  it('resizes by replacing one anchor and ignores bad indexes', () => {
    const line = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'trend-line',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 110 },
      ],
    });
    const resized = resizeDrawing(line, 1, { time: T0 + 300, price: 120 });
    expect(resized.points[1]).toEqual({ time: T0 + 300, price: 120 });
    expect(resizeDrawing(line, 9, { time: T0, price: 0 })).toBe(line);
  });

  it('rotates 90 degrees around the centroid in pixel space', () => {
    const line = createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'trend-line',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 110 },
      ],
    });
    const rotated = rotateDrawing(line, scale, Math.PI / 2);
    // Centroid pixel (5, 895); the (10, -10) segment vector rotates to
    // (10, 10), so the endpoints become (0, 890) and (10, 900).
    const pixels = rotated.points.map((p) => anchorToPixel(p, scale));
    expect(pixels[0]?.x).toBeCloseTo(0, 5);
    expect(pixels[1]?.x).toBeCloseTo(10, 5);
    expect(pixels[0]?.y).toBeCloseTo(890, 5);
    expect(pixels[1]?.y).toBeCloseTo(900, 5);
  });
});
