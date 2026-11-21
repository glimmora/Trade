/**
 * Pure chart geometry: hit-testing, handles, magnet snapping, and the
 * derived lines for Fibonacci / Gann / pitchfork / regression / VWAP
 * tools. No DOM, no chart library.
 *
 * All hit tests work in pixel space through a caller-supplied
 * `ChartScale`, so this module stays independent of any rendering
 * engine. Drawings themselves are stored in time/price anchor space
 * (see types.ts) and converted only at the boundary.
 */
import type { AnchorPoint, DrawingObject, DrawingType } from './types.js';

export interface PixelPoint {
  x: number;
  y: number;
}

/**
 * Minimal chart scale supplied by the rendering layer. It converts
 * between anchor space (UTC seconds / price) and screen pixels.
 */
export interface ChartScale {
  timeToX(time: number): number;
  priceToY(price: number): number;
  xToTime(x: number): number;
  yToPrice(y: number): number;
}

/** Structurally identical to the core `Candle` type; defined locally so
 * this package has no runtime dependency on another workspace package. */
export interface CandleLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const DEFAULT_HIT_TOLERANCE_PX = 6;

/* ------------------------------------------------------------------ */
/* Basic vector helpers                                                */
/* ------------------------------------------------------------------ */

export function distance(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Shortest distance from a point to a line segment. */
export function pointToSegmentDistance(
  p: PixelPoint,
  a: PixelPoint,
  b: PixelPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return distance(p, a);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Shortest distance from a point to the infinite line through a, b. */
export function pointToLineDistance(p: PixelPoint, a: PixelPoint, b: PixelPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    return distance(p, a);
  }
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

/** Whether `p` lies on segment a–b (within tolerance). */
export function isPointNearSegment(
  p: PixelPoint,
  a: PixelPoint,
  b: PixelPoint,
  tolerancePx = DEFAULT_HIT_TOLERANCE_PX,
): boolean {
  return pointToSegmentDistance(p, a, b) <= tolerancePx;
}

/** Whether `p` lies on the infinite line through a, b (within tolerance). */
export function isPointNearLine(
  p: PixelPoint,
  a: PixelPoint,
  b: PixelPoint,
  tolerancePx = DEFAULT_HIT_TOLERANCE_PX,
): boolean {
  return pointToLineDistance(p, a, b) <= tolerancePx;
}

/**
 * Whether `p` lies on the ray starting at `a` and passing through `b`
 * (within tolerance, and not behind the origin).
 */
export function isPointNearRay(
  p: PixelPoint,
  a: PixelPoint,
  b: PixelPoint,
  tolerancePx = DEFAULT_HIT_TOLERANCE_PX,
): boolean {
  if (!isPointNearLine(p, a, b, tolerancePx)) {
    return false;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dot = (p.x - a.x) * dx + (p.y - a.y) * dy;
  return dot >= -tolerancePx * Math.hypot(dx, dy);
}

function orientation(a: PixelPoint, b: PixelPoint, c: PixelPoint): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (value === 0) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: PixelPoint, b: PixelPoint, c: PixelPoint): boolean {
  return (
    b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) &&
    b.y >= Math.min(a.y, c.y)
  );
}

/** Whether segments p1–p2 and p3–p4 intersect (including touching). */
export function segmentsIntersect(
  p1: PixelPoint,
  p2: PixelPoint,
  p3: PixelPoint,
  p4: PixelPoint,
): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;
  return false;
}

/** Intersection of the infinite lines through p1–p2 and p3–p4, or null
 * when the lines are (near-)parallel. */
export function lineIntersection(
  p1: PixelPoint,
  p2: PixelPoint,
  p3: PixelPoint,
  p4: PixelPoint,
): PixelPoint | null {
  const denom =
    (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 1e-12) {
    return null;
  }
  const x =
    ((p1.x * p2.y - p1.y * p2.x) * (p3.x - p4.x) -
      (p1.x - p2.x) * (p3.x * p4.y - p3.y * p4.x)) /
    denom;
  const y =
    ((p1.x * p2.y - p1.y * p2.x) * (p3.y - p4.y) -
      (p1.y - p2.y) * (p3.x * p4.y - p3.y * p4.x)) /
    denom;
  return { x, y };
}

/* ------------------------------------------------------------------ */
/* Anchor <-> pixel conversion                                         */
/* ------------------------------------------------------------------ */

export function anchorToPixel(anchor: AnchorPoint, scale: ChartScale): PixelPoint {
  return { x: scale.timeToX(anchor.time), y: scale.priceToY(anchor.price) };
}

export function pixelToAnchor(pixel: PixelPoint, scale: ChartScale): AnchorPoint {
  return { time: Math.round(scale.xToTime(pixel.x)), price: scale.yToPrice(pixel.y) };
}

export function anchorsToPixels(
  points: readonly AnchorPoint[],
  scale: ChartScale,
): PixelPoint[] {
  return points.map((p) => anchorToPixel(p, scale));
}

/* ------------------------------------------------------------------ */
/* Bounds                                                              */
/* ------------------------------------------------------------------ */

export interface AnchorBounds {
  minTime: number;
  maxTime: number;
  minPrice: number;
  maxPrice: number;
}

export function getAnchorBounds(points: readonly AnchorPoint[]): AnchorBounds | null {
  if (points.length === 0) {
    return null;
  }
  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    minTime = Math.min(minTime, p.time);
    maxTime = Math.max(maxTime, p.time);
    minPrice = Math.min(minPrice, p.price);
    maxPrice = Math.max(maxPrice, p.price);
  }
  return { minTime, maxTime, minPrice, maxPrice };
}

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getPixelBounds(obj: DrawingObject, scale: ChartScale): PixelBounds | null {
  const pixels = anchorsToPixels(obj.points, scale);
  if (pixels.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of pixels) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Centroid of the anchors, in anchor space. */
export function anchorCentroid(points: readonly AnchorPoint[]): AnchorPoint | null {
  if (points.length === 0) {
    return null;
  }
  let time = 0;
  let price = 0;
  for (const p of points) {
    time += p.time;
    price += p.price;
  }
  return { time: time / points.length, price: price / points.length };
}

/* ------------------------------------------------------------------ */
/* Magnet mode: snap to OHLC                                           */
/* ------------------------------------------------------------------ */

export type OhlcField = 'open' | 'high' | 'low' | 'close';

/** Binary search for the candle nearest to `time` (candles sorted by time). */
export function findNearestCandle(
  candles: readonly CandleLike[],
  time: number,
): CandleLike | null {
  if (candles.length === 0) {
    return null;
  }
  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midCandle = candles[mid];
    if (midCandle === undefined) {
      return null;
    }
    if (midCandle.time < time) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const candidate = candles[lo];
  if (candidate === undefined) {
    return null;
  }
  const prev = lo > 0 ? candles[lo - 1] : undefined;
  if (prev !== undefined && Math.abs(prev.time - time) < Math.abs(candidate.time - time)) {
    return prev;
  }
  return candidate;
}

export interface SnapResult {
  point: AnchorPoint;
  snapped: boolean;
  /** Which OHLC field the price snapped to, or null when not snapped. */
  snappedTo: OhlcField | null;
  /** Open time of the candle snapped to, or null when not snapped. */
  candleTime: number | null;
}

/**
 * Snap a time/price point to the nearest candle: time snaps to the
 * candle open time and price snaps to the nearest of open/high/low/
 * close. When `magnet` is false (or there are no candles) the point is
 * returned unchanged. `maxTimeDistanceSeconds` optionally limits how
 * far in time a candle may be to qualify.
 */
export function snapToOHLC(
  point: AnchorPoint,
  candles: readonly CandleLike[],
  options?: { magnet?: boolean; maxTimeDistanceSeconds?: number },
): SnapResult {
  const unchanged: SnapResult = { point, snapped: false, snappedTo: null, candleTime: null };
  if (options?.magnet === false || candles.length === 0) {
    return unchanged;
  }
  const candle = findNearestCandle(candles, point.time);
  if (candle === null) {
    return unchanged;
  }
  if (
    options?.maxTimeDistanceSeconds !== undefined &&
    Math.abs(candle.time - point.time) > options.maxTimeDistanceSeconds
  ) {
    return unchanged;
  }
  const fields: readonly OhlcField[] = ['open', 'high', 'low', 'close'];
  let bestField: OhlcField = 'close';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const field of fields) {
    const d = Math.abs(candle[field] - point.price);
    if (d < bestDistance) {
      bestDistance = d;
      bestField = field;
    }
  }
  return {
    point: { time: candle.time, price: candle[bestField] },
    snapped: true,
    snappedTo: bestField,
    candleTime: candle.time,
  };
}

/* ------------------------------------------------------------------ */
/* Derived lines: Fibonacci, Gann, pitchfork, regression, VWAP         */
/* ------------------------------------------------------------------ */

export interface FibLevel {
  ratio: number;
  price: number;
}

export const FIB_RETRACEMENT_RATIOS: readonly number[] = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1,
] as const;

export const FIB_EXTENSION_RATIOS: readonly number[] = [
  1, 1.272, 1.618, 2.618, 4.236,
] as const;

/**
 * Fibonacci levels between a swing start and end price. Retracement
 * ratios run 0–1 between the anchors; extension ratios run beyond the
 * end anchor (price = start + ratio × (end − start)).
 */
export function fibonacciLevels(
  startPrice: number,
  endPrice: number,
  kind: 'retracement' | 'extension',
): FibLevel[] {
  const ratios = kind === 'retracement' ? FIB_RETRACEMENT_RATIOS : FIB_EXTENSION_RATIOS;
  return ratios.map((ratio) => ({
    ratio,
    price: startPrice + ratio * (endPrice - startPrice),
  }));
}

/** Gann fan slopes, as (time-scale, price-scale) pairs off the base vector. */
export const GANN_FAN_SCALES: readonly (readonly [number, number])[] = [
  [1, 1],
  [2, 1],
  [1, 2],
  [4, 1],
  [1, 4],
  [8, 1],
  [1, 8],
] as const;

/**
 * Gann fan lines in pixel space: from the origin anchor, one ray per
 * scale pair, extended 3× the anchor distance so the fan covers the
 * visible chart. Returns segments [origin, end] per fan line.
 */
export function gannFanSegments(
  origin: PixelPoint,
  through: PixelPoint,
): Array<readonly [PixelPoint, PixelPoint]> {
  const vx = through.x - origin.x;
  const vy = through.y - origin.y;
  return GANN_FAN_SCALES.map(([sx, sy]) => {
    const end: PixelPoint = {
      x: origin.x + vx * sx * 3,
      y: origin.y + vy * sy * 3,
    };
    return [origin, end] as const;
  });
}

/** Fibonacci fan lines: from the origin through each retracement level
 * at the far anchor's x, extended 3× to the right. */
export function fibFanSegments(
  origin: PixelPoint,
  far: PixelPoint,
): Array<readonly [PixelPoint, PixelPoint, number]> {
  return FIB_RETRACEMENT_RATIOS.map((ratio) => {
    const levelPoint: PixelPoint = {
      x: far.x,
      y: origin.y + ratio * (far.y - origin.y),
    };
    const dx = levelPoint.x - origin.x;
    const dy = levelPoint.y - origin.y;
    const end: PixelPoint = { x: origin.x + dx * 3, y: origin.y + dy * 3 };
    return [origin, end, ratio] as const;
  });
}

export interface PitchforkLines {
  /** Median line: handle → midpoint of the two outer anchors. */
  median: readonly [PixelPoint, PixelPoint];
  /** Parallel through the first outer anchor. */
  upper: readonly [PixelPoint, PixelPoint];
  /** Parallel through the second outer anchor. */
  lower: readonly [PixelPoint, PixelPoint];
}

/**
 * Andrews pitchfork lines in pixel space. The median runs from the
 * handle to the midpoint of the outer anchors; the parallels run
 * through each outer anchor in the median's direction, extended 2×.
 */
export function pitchforkLines(
  handle: PixelPoint,
  outer1: PixelPoint,
  outer2: PixelPoint,
): PitchforkLines {
  const mid: PixelPoint = {
    x: (outer1.x + outer2.x) / 2,
    y: (outer1.y + outer2.y) / 2,
  };
  const dx = mid.x - handle.x;
  const dy = mid.y - handle.y;
  const medianEnd: PixelPoint = { x: mid.x + dx, y: mid.y + dy };
  const extend = (from: PixelPoint): PixelPoint => ({ x: from.x + dx * 2, y: from.y + dy * 2 });
  return {
    median: [handle, medianEnd],
    upper: [outer1, extend(outer1)],
    lower: [outer2, extend(outer2)],
  };
}

/** Parallel channel lines: base line plus the parallel through the offset point. */
export function parallelChannelLines(
  baseStart: PixelPoint,
  baseEnd: PixelPoint,
  offset: PixelPoint,
): { base: readonly [PixelPoint, PixelPoint]; offset: readonly [PixelPoint, PixelPoint] } {
  const dx = baseEnd.x - baseStart.x;
  const dy = baseEnd.y - baseStart.y;
  const offsetEnd: PixelPoint = { x: offset.x + dx, y: offset.y + dy };
  return { base: [baseStart, baseEnd], offset: [offset, offsetEnd] };
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  /** Coefficient of determination, 0–1 (1 = perfect linear fit). */
  rSquared: number;
}

/** Least-squares linear regression of y on x. Returns null for < 2 points.
 * Computed in mean-centred form so it stays accurate for large x values
 * such as epoch timestamps. */
export function linearRegression(points: readonly PixelPoint[]): RegressionResult | null {
  if (points.length < 2) {
    return null;
  }
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let sxx = 0;
  let sxy = 0;
  let ssTot = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    ssTot += dy * dy;
  }
  if (sxx === 0) {
    return null;
  }
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  let ssRes = 0;
  for (const p of points) {
    const residual = p.y - (slope * p.x + intercept);
    ssRes += residual * residual;
  }
  const rSquared = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  return { slope, intercept, rSquared };
}

/**
 * Regression trend endpoints from candle closes between two times
 * (inclusive). Returns the fitted line's endpoints in pixel space, or
 * null when fewer than two candles fall in the range.
 */
export function regressionTrendFromCandles(
  candles: readonly CandleLike[],
  fromTime: number,
  toTime: number,
  scale: ChartScale,
): { start: PixelPoint; end: PixelPoint; rSquared: number } | null {
  const inRange = candles.filter((c) => c.time >= fromTime && c.time <= toTime);
  if (inRange.length < 2) {
    return null;
  }
  const pts = inRange.map((c) => ({ x: c.time, y: c.close }));
  const reg = linearRegression(pts);
  if (reg === null) {
    return null;
  }
  const startPrice = reg.slope * fromTime + reg.intercept;
  const endPrice = reg.slope * toTime + reg.intercept;
  return {
    start: { x: scale.timeToX(fromTime), y: scale.priceToY(startPrice) },
    end: { x: scale.timeToX(toTime), y: scale.priceToY(endPrice) },
    rSquared: reg.rSquared,
  };
}

export interface VwapPoint {
  time: number;
  value: number;
}

/**
 * Session-anchored VWAP from an anchor time: cumulative
 * Σ(typical price × volume) / Σ(volume), typical = (high + low + close) / 3.
 * Candles before the anchor are ignored; candles with zero cumulative
 * volume are skipped.
 */
export function anchoredVwap(
  candles: readonly CandleLike[],
  anchorTime: number,
): VwapPoint[] {
  let cumPv = 0;
  let cumVol = 0;
  const out: VwapPoint[] = [];
  for (const c of candles) {
    if (c.time < anchorTime) {
      continue;
    }
    const typical = (c.high + c.low + c.close) / 3;
    cumPv += typical * c.volume;
    cumVol += c.volume;
    if (cumVol === 0) {
      continue;
    }
    out.push({ time: c.time, value: cumPv / cumVol });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Hit testing                                                         */
/* ------------------------------------------------------------------ */

function firstPoint(obj: DrawingObject): AnchorPoint | null {
  return obj.points[0] ?? null;
}

function firstTwoPoints(obj: DrawingObject): [AnchorPoint, AnchorPoint] | null {
  const a = obj.points[0];
  const b = obj.points[1];
  return a !== undefined && b !== undefined ? [a, b] : null;
}

/** Estimated label box around an anchor, in pixels. */
function labelBox(obj: DrawingObject, scale: ChartScale): PixelBounds {
  const anchor = firstPoint(obj);
  const fontSize = obj.style.fontSize ?? 13;
  const text = obj.label ?? obj.type;
  const width = Math.max(24, text.length * fontSize * 0.6 + 12);
  const height = fontSize * 1.8;
  if (anchor === null) {
    return { x: 0, y: 0, width, height };
  }
  const p = anchorToPixel(anchor, scale);
  return { x: p.x, y: p.y - height / 2, width, height };
}

function hitLabel(obj: DrawingObject, pixel: PixelPoint, scale: ChartScale): boolean {
  const box = labelBox(obj, scale);
  return (
    pixel.x >= box.x - DEFAULT_HIT_TOLERANCE_PX &&
    pixel.x <= box.x + box.width + DEFAULT_HIT_TOLERANCE_PX &&
    pixel.y >= box.y - DEFAULT_HIT_TOLERANCE_PX &&
    pixel.y <= box.y + box.height + DEFAULT_HIT_TOLERANCE_PX
  );
}

function hitPolyline(
  pixels: readonly PixelPoint[],
  pixel: PixelPoint,
  tolerancePx: number,
): boolean {
  for (let i = 0; i + 1 < pixels.length; i += 1) {
    const a = pixels[i];
    const b = pixels[i + 1];
    if (a !== undefined && b !== undefined && isPointNearSegment(pixel, a, b, tolerancePx)) {
      return true;
    }
  }
  return false;
}

function hitRectPixels(
  a: PixelPoint,
  b: PixelPoint,
  pixel: PixelPoint,
  tolerancePx: number,
  filled: boolean,
): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  if (filled) {
    return (
      pixel.x >= minX - tolerancePx &&
      pixel.x <= maxX + tolerancePx &&
      pixel.y >= minY - tolerancePx &&
      pixel.y <= maxY + tolerancePx
    );
  }
  // Unfilled: only the border counts, from either side of the edge.
  const topLeft: PixelPoint = { x: minX, y: minY };
  const topRight: PixelPoint = { x: maxX, y: minY };
  const bottomRight: PixelPoint = { x: maxX, y: maxY };
  const bottomLeft: PixelPoint = { x: minX, y: maxY };
  return (
    pointToSegmentDistance(pixel, topLeft, topRight) <= tolerancePx ||
    pointToSegmentDistance(pixel, topRight, bottomRight) <= tolerancePx ||
    pointToSegmentDistance(pixel, bottomRight, bottomLeft) <= tolerancePx ||
    pointToSegmentDistance(pixel, bottomLeft, topLeft) <= tolerancePx
  );
}

function hitEllipsePixels(
  a: PixelPoint,
  b: PixelPoint,
  pixel: PixelPoint,
  tolerancePx: number,
  filled: boolean,
): boolean {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  if (rx === 0 || ry === 0) {
    return false;
  }
  const norm = ((pixel.x - cx) / rx) ** 2 + ((pixel.y - cy) / ry) ** 2;
  if (filled) {
    return norm <= 1 + tolerancePx / Math.min(rx, ry);
  }
  // Unfilled: near the perimeter only.
  return Math.abs(norm - 1) <= (2 * tolerancePx) / Math.min(rx, ry);
}

function hitFibLevels(
  obj: DrawingObject,
  pixel: PixelPoint,
  scale: ChartScale,
  tolerancePx: number,
): boolean {
  const pair = firstTwoPoints(obj);
  if (pair === null) {
    return false;
  }
  const [p0, p1] = pair;
  const kind = obj.type === 'fib-extension' ? 'extension' : 'retracement';
  const levels = fibonacciLevels(p0.price, p1.price, kind);
  const x0 = scale.timeToX(p0.time);
  const x1 = scale.timeToX(p1.time);
  for (const level of levels) {
    const y = scale.priceToY(level.price);
    if (isPointNearSegment(pixel, { x: x0, y }, { x: x1, y }, tolerancePx)) {
      return true;
    }
  }
  // The swing line itself is also hittable.
  return isPointNearSegment(
    pixel,
    anchorToPixel(p0, scale),
    anchorToPixel(p1, scale),
    tolerancePx,
  );
}

/**
 * Hit-test one drawing at a pixel location. Hidden or locked drawings
 * never hit (the UI must not select them). `candles` is only needed
 * for anchored-VWAP and regression-trend tools; omit it otherwise.
 */
export function hitTestDrawing(
  obj: DrawingObject,
  pixel: PixelPoint,
  scale: ChartScale,
  options?: { tolerancePx?: number; candles?: readonly CandleLike[] },
): boolean {
  if (obj.hidden || obj.locked) {
    return false;
  }
  const tolerancePx = options?.tolerancePx ?? DEFAULT_HIT_TOLERANCE_PX;
  const pixels = anchorsToPixels(obj.points, scale);
  const type: DrawingType = obj.type;

  switch (type) {
    case 'trend-line':
    case 'arrow':
    case 'measure':
    case 'fib-channel': {
      const pair = firstTwoPoints(obj);
      if (pair === null) return false;
      const [a, b] = [pixels[0], pixels[1]];
      return (
        a !== undefined &&
        b !== undefined &&
        isPointNearSegment(pixel, a, b, tolerancePx)
      );
    }
    case 'ray': {
      const a = pixels[0];
      const b = pixels[1];
      return (
        a !== undefined && b !== undefined && isPointNearRay(pixel, a, b, tolerancePx)
      );
    }
    case 'extended-line': {
      const a = pixels[0];
      const b = pixels[1];
      return (
        a !== undefined && b !== undefined && isPointNearLine(pixel, a, b, tolerancePx)
      );
    }
    case 'horizontal-line': {
      const anchor = firstPoint(obj);
      if (anchor === null) return false;
      return Math.abs(pixel.y - scale.priceToY(anchor.price)) <= tolerancePx;
    }
    case 'horizontal-ray': {
      const anchor = firstPoint(obj);
      if (anchor === null) return false;
      const p = pixels[0];
      if (p === undefined) return false;
      return (
        Math.abs(pixel.y - p.y) <= tolerancePx && pixel.x >= p.x - tolerancePx
      );
    }
    case 'vertical-line': {
      const anchor = firstPoint(obj);
      if (anchor === null) return false;
      return Math.abs(pixel.x - scale.timeToX(anchor.time)) <= tolerancePx;
    }
    case 'parallel-channel': {
      const a = pixels[0];
      const b = pixels[1];
      const c = pixels[2];
      if (a === undefined || b === undefined || c === undefined) return false;
      const lines = parallelChannelLines(a, b, c);
      return (
        isPointNearSegment(pixel, lines.base[0], lines.base[1], tolerancePx) ||
        isPointNearSegment(pixel, lines.offset[0], lines.offset[1], tolerancePx)
      );
    }
    case 'rectangle':
    case 'gann-box':
    case 'price-range':
    case 'date-price-range': {
      const a = pixels[0];
      const b = pixels[1];
      if (a === undefined || b === undefined) return false;
      return hitRectPixels(a, b, pixel, tolerancePx, obj.style.fill !== undefined);
    }
    case 'ellipse': {
      const a = pixels[0];
      const b = pixels[1];
      if (a === undefined || b === undefined) return false;
      return hitEllipsePixels(a, b, pixel, tolerancePx, obj.style.fill !== undefined);
    }
    case 'triangle': {
      return hitPolyline([...pixels, pixels[0]].filter((p): p is PixelPoint => p !== undefined), pixel, tolerancePx) ||
        pointInPolygon(pixel, pixels);
    }
    case 'polyline':
    case 'brush': {
      return hitPolyline(pixels, pixel, tolerancePx);
    }
    case 'text-label':
    case 'price-label':
    case 'callout':
    case 'flag': {
      return hitLabel(obj, pixel, scale);
    }
    case 'date-range': {
      const pair = firstTwoPoints(obj);
      if (pair === null) return false;
      const x0 = scale.timeToX(pair[0].time);
      const x1 = scale.timeToX(pair[1].time);
      return (
        pixel.x >= Math.min(x0, x1) - tolerancePx &&
        pixel.x <= Math.max(x0, x1) + tolerancePx
      );
    }
    case 'fib-retracement':
    case 'fib-extension': {
      return hitFibLevels(obj, pixel, scale, tolerancePx);
    }
    case 'fib-timezones': {
      const pair = firstTwoPoints(obj);
      if (pair === null) return false;
      const span = pair[1].time - pair[0].time;
      if (span === 0) return false;
      for (const ratio of FIB_RETRACEMENT_RATIOS) {
        const t = pair[0].time + span * ratio;
        if (Math.abs(pixel.x - scale.timeToX(t)) <= tolerancePx) {
          return true;
        }
      }
      return false;
    }
    case 'fib-fan': {
      const a = pixels[0];
      const b = pixels[1];
      if (a === undefined || b === undefined) return false;
      return fibFanSegments(a, b).some(([from, to]) =>
        isPointNearSegment(pixel, from, to, tolerancePx),
      );
    }
    case 'fib-arcs': {
      const a = pixels[0];
      const b = pixels[1];
      if (a === undefined || b === undefined) return false;
      const radius = distance(a, b);
      return FIB_RETRACEMENT_RATIOS.some((ratio) => {
        const r = radius * ratio;
        return Math.abs(distance(pixel, a) - r) <= tolerancePx;
      });
    }
    case 'gann-fan': {
      const a = pixels[0];
      const b = pixels[1];
      if (a === undefined || b === undefined) return false;
      return gannFanSegments(a, b).some(([from, to]) =>
        isPointNearSegment(pixel, from, to, tolerancePx),
      );
    }
    case 'pitchfork': {
      const a = pixels[0];
      const b = pixels[1];
      const c = pixels[2];
      if (a === undefined || b === undefined || c === undefined) return false;
      const lines = pitchforkLines(a, b, c);
      return (
        isPointNearSegment(pixel, lines.median[0], lines.median[1], tolerancePx) ||
        isPointNearSegment(pixel, lines.upper[0], lines.upper[1], tolerancePx) ||
        isPointNearSegment(pixel, lines.lower[0], lines.lower[1], tolerancePx)
      );
    }
    case 'regression-trend': {
      const candles = options?.candles;
      const pair = firstTwoPoints(obj);
      if (pair === null) return false;
      if (candles !== undefined) {
        const trend = regressionTrendFromCandles(
          candles,
          pair[0].time,
          pair[1].time,
          scale,
        );
        if (trend !== null) {
          return isPointNearSegment(pixel, trend.start, trend.end, tolerancePx);
        }
      }
      const a = pixels[0];
      const b = pixels[1];
      return (
        a !== undefined && b !== undefined && isPointNearSegment(pixel, a, b, tolerancePx)
      );
    }
    case 'long-position':
    case 'short-position': {
      const a = pixels[0];
      const b = pixels[1];
      const c = pixels[2];
      if (a === undefined || b === undefined || c === undefined) return false;
      const all = [a, b, c];
      const minX = Math.min(...all.map((p) => p.x));
      const maxX = Math.max(...all.map((p) => p.x));
      const minY = Math.min(...all.map((p) => p.y));
      const maxY = Math.max(...all.map((p) => p.y));
      return (
        pixel.x >= minX - tolerancePx &&
        pixel.x <= maxX + tolerancePx &&
        pixel.y >= minY - tolerancePx &&
        pixel.y <= maxY + tolerancePx
      );
    }
    case 'anchored-vwap': {
      const candles = options?.candles;
      const anchor = firstPoint(obj);
      if (anchor === null || candles === undefined) return false;
      const vwap = anchoredVwap(candles, anchor.time);
      const line = vwap.map((v) => ({
        x: scale.timeToX(v.time),
        y: scale.priceToY(v.value),
      }));
      return hitPolyline(line, pixel, tolerancePx);
    }
    default: {
      // Exhaustiveness guard: unknown future tools fall back to polyline.
      return hitPolyline(pixels, pixel, tolerancePx);
    }
  }
}

/** Ray-casting point-in-polygon test (used for filled triangles). */
export function pointInPolygon(pixel: PixelPoint, polygon: readonly PixelPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    const crosses =
      a.y > pixel.y !== b.y > pixel.y &&
      pixel.x < ((b.x - a.x) * (pixel.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Topmost drawing at a pixel location (highest z-index wins), or null.
 * Objects are expected pre-sorted or not; this scans in z-order.
 */
export function hitTestTopmost(
  objects: readonly DrawingObject[],
  pixel: PixelPoint,
  scale: ChartScale,
  options?: { tolerancePx?: number; candles?: readonly CandleLike[] },
): DrawingObject | null {
  let best: DrawingObject | null = null;
  for (const obj of objects) {
    if (best !== null && obj.zIndex <= best.zIndex) {
      continue;
    }
    if (hitTestDrawing(obj, pixel, scale, options)) {
      best = obj;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Handles: move / resize / rotate                                     */
/* ------------------------------------------------------------------ */

export type HandleKind = 'anchor' | 'move' | 'rotate';

export interface Handle {
  id: string;
  kind: HandleKind;
  /** Index into `points` for anchor handles; -1 for move/rotate. */
  anchorIndex: number;
  pixel: PixelPoint;
}

/**
 * Handles for a drawing: one per anchor (resize), one move handle at
 * the centroid, and one rotate handle 40 px above the centroid.
 * Hidden drawings expose no handles.
 */
export function getHandles(obj: DrawingObject, scale: ChartScale): Handle[] {
  if (obj.hidden) {
    return [];
  }
  const handles: Handle[] = obj.points.map((anchor, index) => ({
    id: `${obj.id}:anchor:${index}`,
    kind: 'anchor',
    anchorIndex: index,
    pixel: anchorToPixel(anchor, scale),
  }));
  const centroid = anchorCentroid(obj.points);
  if (centroid !== null) {
    const centrePx = anchorToPixel(centroid, scale);
    handles.push({
      id: `${obj.id}:move`,
      kind: 'move',
      anchorIndex: -1,
      pixel: centrePx,
    });
    handles.push({
      id: `${obj.id}:rotate`,
      kind: 'rotate',
      anchorIndex: -1,
      pixel: { x: centrePx.x, y: centrePx.y - 40 },
    });
  }
  return handles;
}

/** Return a copy of the drawing with all anchors shifted by a delta. */
export function moveDrawing(
  obj: DrawingObject,
  dTimeSeconds: number,
  dPrice: number,
): DrawingObject {
  return {
    ...obj,
    points: obj.points.map((p) => ({ time: p.time + dTimeSeconds, price: p.price + dPrice })),
    updatedAt: Date.now(),
  };
}

/** Return a copy moved by a pixel delta, converted through the scale. */
export function moveDrawingByPixels(
  obj: DrawingObject,
  scale: ChartScale,
  dx: number,
  dy: number,
): DrawingObject {
  const centroid = anchorCentroid(obj.points);
  if (centroid === null) {
    return obj;
  }
  const before = anchorToPixel(centroid, scale);
  const after: PixelPoint = { x: before.x + dx, y: before.y + dy };
  const newCentroid = pixelToAnchor(after, scale);
  return moveDrawing(obj, newCentroid.time - centroid.time, newCentroid.price - centroid.price);
}

/**
 * Return a copy with one anchor replaced (resize). Out-of-range anchor
 * indexes return the drawing unchanged.
 */
export function resizeDrawing(
  obj: DrawingObject,
  anchorIndex: number,
  newAnchor: AnchorPoint,
): DrawingObject {
  if (anchorIndex < 0 || anchorIndex >= obj.points.length) {
    return obj;
  }
  return {
    ...obj,
    points: obj.points.map((p, i) => (i === anchorIndex ? { ...newAnchor } : p)),
    updatedAt: Date.now(),
  };
}

/**
 * Return a copy rotated by `angleRadians` (clockwise in screen space)
 * around the anchor centroid. Rotation is done in pixel space via the
 * scale and converted back, so time/price units never mix.
 */
export function rotateDrawing(
  obj: DrawingObject,
  scale: ChartScale,
  angleRadians: number,
): DrawingObject {
  const centroid = anchorCentroid(obj.points);
  if (centroid === null) {
    return obj;
  }
  const centrePx = anchorToPixel(centroid, scale);
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  const points = obj.points.map((anchor) => {
    const p = anchorToPixel(anchor, scale);
    const dx = p.x - centrePx.x;
    const dy = p.y - centrePx.y;
    const rotated: PixelPoint = {
      x: centrePx.x + dx * cos - dy * sin,
      y: centrePx.y + dx * sin + dy * cos,
    };
    return pixelToAnchor(rotated, scale);
  });
  return { ...obj, points, updatedAt: Date.now() };
}
