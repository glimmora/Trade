import type {
  BreakRetestSetup,
  Candle,
  CandlestickPattern,
  Channel,
  Divergence,
  FibonacciLevel,
  StructureEvent,
  StructureLabel,
  SwingPivot,
  TrendState,
  Zone,
} from './types.js';
import { macd, rsi } from './oscillators.js';
import { withinTolerance } from './utils.js';

export interface SwingSettings {
  left: number;
  right: number;
}

/** Swing pivots: a high (low) higher (lower) than `left` bars before and `right` after. */
export function findSwingPivots(
  candles: readonly Candle[],
  left = 2,
  right = 2,
): SwingPivot[] {
  const out: SwingPivot[] = [];
  for (let i = left; i < candles.length - right; i++) {
    const c = candles[i];
    if (c === undefined) continue;
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      const other = candles[j];
      if (other === undefined) continue;
      if (other.high >= c.high) isHigh = false;
      if (other.low <= c.low) isLow = false;
    }
    if (isHigh) out.push({ index: i, time: c.time, price: c.high, kind: 'high' });
    if (isLow) out.push({ index: i, time: c.time, price: c.low, kind: 'low' });
  }
  return out;
}

function pivotsOfSeries(values: readonly (number | undefined)[], left = 2, right = 2): { index: number; value: number; kind: 'high' | 'low' }[] {
  const out: { index: number; value: number; kind: 'high' | 'low' }[] = [];
  for (let i = left; i < values.length - right; i++) {
    const v = values[i];
    if (v === undefined) continue;
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      const o = values[j];
      if (o === undefined) continue;
      if (o >= v) isHigh = false;
      if (o <= v) isLow = false;
    }
    if (isHigh) out.push({ index: i, value: v, kind: 'high' });
    if (isLow) out.push({ index: i, value: v, kind: 'low' });
  }
  return out;
}

export interface SupportResistanceSettings {
  pivotLeft: number;
  pivotRight: number;
  /** Cluster tolerance, percent of price. */
  tolerancePct: number;
  minTouches: number;
}

export const DEFAULT_SR_SETTINGS: SupportResistanceSettings = {
  pivotLeft: 2,
  pivotRight: 2,
  tolerancePct: 0.25,
  minTouches: 2,
};

/**
 * Support / resistance auto-detection.
 * Swing pivots are clustered into zones (not thin lines). A zone is
 * invalidated when a candle body closes through it; a wick touch keeps
 * it valid. Strength grows with touch count and breakout confirmation.
 */
export function detectSupportResistance(
  candles: readonly Candle[],
  settings: SupportResistanceSettings = DEFAULT_SR_SETTINGS,
): Zone[] {
  const pivots = findSwingPivots(candles, settings.pivotLeft, settings.pivotRight);
  if (pivots.length === 0) return [];
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const clusters: SwingPivot[][] = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    const lastPivot = last?.[last.length - 1];
    if (last !== undefined && lastPivot !== undefined && withinTolerance(p.price, lastPivot.price, settings.tolerancePct)) {
      last.push(p);
    } else {
      clusters.push([p]);
    }
  }
  const zones: Zone[] = [];
  for (const cluster of clusters) {
    if (cluster.length < settings.minTouches) continue;
    const prices = cluster.map((p) => p.price);
    const top = Math.max(...prices);
    const bottom = Math.min(...prices);
    const mid = (top + bottom) / 2;
    const highs = cluster.filter((p) => p.kind === 'high').length;
    const lows = cluster.length - highs;
    const type: Zone['type'] = highs >= lows ? 'resistance' : 'support';
    const firstIndex = Math.min(...cluster.map((p) => p.index));
    const lastIndex = Math.max(...cluster.map((p) => p.index));
    const firstTime = candles[firstIndex]?.time ?? 0;
    let invalidated = false;
    let breakoutConfirmed = false;
    for (let i = lastIndex + 1; i < candles.length; i++) {
      const c = candles[i];
      if (c === undefined) continue;
      if (type === 'support' && c.close < bottom) invalidated = true;
      if (type === 'resistance' && c.close > top) invalidated = true;
      if (type === 'support' && c.close < bottom) breakoutConfirmed = true;
      if (type === 'resistance' && c.close > top) breakoutConfirmed = true;
      if (invalidated) break;
    }
    // Breakout confirmation also counts when price moved away after forming:
    // a close beyond the zone at any point after the first pivot.
    if (!breakoutConfirmed) {
      for (let i = firstIndex + 1; i < candles.length; i++) {
        const c = candles[i];
        if (c === undefined) continue;
        if (type === 'support' && c.close < bottom) breakoutConfirmed = true;
        if (type === 'resistance' && c.close > top) breakoutConfirmed = true;
      }
    }
    const strength = Math.min(
      1,
      cluster.length / 5 * 0.6 + (breakoutConfirmed ? 0.25 : 0) + (invalidated ? -0.3 : 0.15),
    );
    zones.push({
      type,
      top,
      bottom,
      mid,
      index: firstIndex,
      time: firstTime,
      touches: cluster.length,
      strength: Math.max(0, strength),
      invalidated,
      breakoutConfirmed,
    });
  }
  return zones.sort((a, b) => a.index - b.index);
}

export interface MarketStructureResult {
  labels: StructureLabel[];
  trend: TrendState;
  events: StructureEvent[];
}

/** Market structure: HH/HL/LH/LL labels, trend state, BOS / CHoCH / SBR / RBS events. */
export function detectMarketStructure(
  candles: readonly Candle[],
  left = 2,
  right = 2,
): MarketStructureResult {
  const pivots = findSwingPivots(candles, left, right);
  const labels: StructureLabel[] = [];
  const events: StructureEvent[] = [];
  let lastHigh: SwingPivot | undefined;
  let lastLow: SwingPivot | undefined;
  let lastBrokenHigh: number | undefined;
  let lastBrokenLow: number | undefined;
  for (const p of pivots) {
    if (p.kind === 'high') {
      const label: StructureLabel['label'] = lastHigh === undefined || p.price > lastHigh.price ? 'HH' : 'LH';
      labels.push({ index: p.index, time: p.time, price: p.price, label });
      lastHigh = p;
    } else {
      const label: StructureLabel['label'] = lastLow === undefined || p.price > lastLow.price ? 'HL' : 'LL';
      labels.push({ index: p.index, time: p.time, price: p.price, label });
      lastLow = p;
    }
  }
  labels.sort((a, b) => a.index - b.index);
  // Trend from the last two labels of each kind.
  const highs = labels.filter((l) => l.label === 'HH' || l.label === 'LH');
  const lows = labels.filter((l) => l.label === 'HL' || l.label === 'LL');
  const lastHighLabel = highs[highs.length - 1];
  const lastLowLabel = lows[lows.length - 1];
  let trend: TrendState = 'sideways';
  if (lastHighLabel?.label === 'HH' && lastLowLabel?.label === 'HL') trend = 'uptrend';
  else if (lastHighLabel?.label === 'LH' && lastLowLabel?.label === 'LL') trend = 'downtrend';

  // BOS / CHoCH: a close through the most recent swing high/low.
  let swingHigh: number | undefined;
  let swingLow: number | undefined;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c === undefined) continue;
    const pivotHigh = pivots.find((p) => p.index === i && p.kind === 'high');
    const pivotLow = pivots.find((p) => p.index === i && p.kind === 'low');
    if (pivotHigh !== undefined) swingHigh = pivotHigh.price;
    if (pivotLow !== undefined) swingLow = pivotLow.price;
    if (swingHigh !== undefined && c.close > swingHigh && lastBrokenHigh !== swingHigh) {
      lastBrokenHigh = swingHigh;
      const kind = trend === 'downtrend' ? 'CHoCH' : 'BOS';
      events.push({ index: i, time: c.time, price: c.close, kind, direction: 'bullish' });
      if (kind === 'CHoCH') trend = 'uptrend';
    }
    if (swingLow !== undefined && c.close < swingLow && lastBrokenLow !== swingLow) {
      lastBrokenLow = swingLow;
      const kind = trend === 'uptrend' ? 'CHoCH' : 'BOS';
      events.push({ index: i, time: c.time, price: c.close, kind, direction: 'bearish' });
      if (kind === 'CHoCH') trend = 'downtrend';
    }
  }
  // Role flips (SBR / RBS) are the structure events where a broken level
  // is retested: reuse BOS events as the flip trigger point.
  const flips: StructureEvent[] = events
    .filter((e) => e.kind === 'BOS')
    .map((e) => ({
      ...e,
      kind: e.direction === 'bullish' ? 'RBS' : 'SBR',
    }));
  return { labels, trend, events: [...events, ...flips] };
}

export interface Trendline {
  type: 'support' | 'resistance';
  slope: number;
  intercept: number;
  startIndex: number;
  endIndex: number;
  touches: number;
}

function lineThrough(p1: SwingPivot, p2: SwingPivot): { slope: number; intercept: number } {
  const slope = p2.index === p1.index ? 0 : (p2.price - p1.price) / (p2.index - p1.index);
  return { slope, intercept: p1.price - slope * p1.index };
}

/** Trendline auto-detect: line through first/last swing of each kind, touch-counted. */
export function detectTrendlines(
  candles: readonly Candle[],
  tolerancePct = 0.25,
  left = 2,
  right = 2,
): Trendline[] {
  const pivots = findSwingPivots(candles, left, right);
  const out: Trendline[] = [];
  for (const kind of ['high', 'low'] as const) {
    const pts = pivots.filter((p) => p.kind === kind);
    if (pts.length < 2) continue;
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first === undefined || last === undefined || first.index === last.index) continue;
    const { slope, intercept } = lineThrough(first, last);
    let touches = 0;
    for (const p of pts) {
      const onLine = slope * p.index + intercept;
      if (withinTolerance(p.price, onLine, tolerancePct)) touches++;
    }
    if (touches < 2) continue;
    out.push({
      type: kind === 'high' ? 'resistance' : 'support',
      slope,
      intercept,
      startIndex: first.index,
      endIndex: last.index,
      touches,
    });
  }
  return out;
}

/**
 * Parallel-channel auto-detect. Requires a three-point zigzag (the two
 * trendlines plus at least one confirming swing); rails must be near
 * parallel within `parallelTolerancePct` of slope magnitude.
 */
export function detectChannels(
  candles: readonly Candle[],
  tolerancePct = 0.25,
  parallelTolerancePct = 50,
  left = 2,
  right = 2,
): Channel[] {
  const lines = detectTrendlines(candles, tolerancePct, left, right);
  const upper = lines.find((l) => l.type === 'resistance');
  const lower = lines.find((l) => l.type === 'support');
  if (upper === undefined || lower === undefined) return [];
  const slopeDiff = Math.abs(upper.slope - lower.slope);
  const scale = Math.max(Math.abs(upper.slope), Math.abs(lower.slope), 1e-9);
  if (slopeDiff / scale > parallelTolerancePct / 100 && slopeDiff > 1e-9) {
    // Slopes differ too much to be a parallel channel — still return the
    // pair only if both rails have 3+ touches (a widening channel).
    if (upper.touches < 3 || lower.touches < 3) return [];
  }
  const pivots = findSwingPivots(candles, left, right);
  if (pivots.length < 3) return [];
  const midSlope = (upper.slope + lower.slope) / 2;
  const midIntercept = (upper.intercept + lower.intercept) / 2;
  return [
    {
      upperSlope: upper.slope,
      upperIntercept: upper.intercept,
      lowerSlope: lower.slope,
      lowerIntercept: lower.intercept,
      midSlope,
      midIntercept,
      startIndex: Math.min(upper.startIndex, lower.startIndex),
      endIndex: Math.max(upper.endIndex, lower.endIndex),
      touches: upper.touches + lower.touches,
    },
  ];
}

export const FIB_RETRACEMENT_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;
export const FIB_EXTENSION_RATIOS = [1.272, 1.618, 2.618] as const;

/** Fibonacci retracement + extension levels between a swing high and low. */
export function fibonacciLevels(high: number, low: number): FibonacciLevel[] {
  const range = high - low;
  const out: FibonacciLevel[] = [];
  for (const r of FIB_RETRACEMENT_RATIOS) {
    out.push({ ratio: r, price: high - r * range, label: `${(r * 100).toFixed(1)}%` });
  }
  for (const r of FIB_EXTENSION_RATIOS) {
    out.push({ ratio: r, price: high - r * range, label: `${(r * 100).toFixed(1)}% ext` });
  }
  return out;
}

/** Auto Fibonacci: swing high/low over the lookback, direction from the last close. */
export function fibonacciAuto(candles: readonly Candle[], lookback = 50): FibonacciLevel[] {
  const slice = candles.slice(Math.max(0, candles.length - lookback));
  if (slice.length === 0) return [];
  let high = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  for (const c of slice) {
    high = Math.max(high, c.high);
    low = Math.min(low, c.low);
  }
  return fibonacciLevels(high, low);
}

function body(c: Candle): number {
  return Math.abs(c.close - c.open);
}
function candleRange(c: Candle): number {
  return c.high - c.low;
}
function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close);
}
function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low;
}
function isBullish(c: Candle): boolean {
  return c.close > c.open;
}
function isBearish(c: Candle): boolean {
  return c.close < c.open;
}

/** Candlestick pattern recognition. Returns one entry per pattern found. */
export function detectCandlestickPatterns(candles: readonly Candle[]): CandlestickPattern[] {
  const out: CandlestickPattern[] = [];
  const push = (index: number, type: string, direction: CandlestickPattern['direction'], confidence: number): void => {
    const c = candles[index];
    if (c === undefined) return;
    out.push({ index, time: c.time, type, direction, confidence });
  };
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c === undefined) continue;
    const range = candleRange(c);
    if (range === 0) continue;
    const b = body(c);
    // Doji
    if (b <= range * 0.1) push(i, 'doji', 'neutral', 0.9);
    // Pin bar / hammer (long lower wick) and shooting star (long upper wick)
    if (lowerWick(c) >= 2 * Math.max(b, range * 0.05) && upperWick(c) <= b * 0.6 + range * 0.05) {
      push(i, isBullish(c) ? 'hammer' : 'pin-bar', 'bullish', 0.8);
    }
    if (upperWick(c) >= 2 * Math.max(b, range * 0.05) && lowerWick(c) <= b * 0.6 + range * 0.05) {
      push(i, 'shooting-star', 'bearish', 0.8);
    }
    if (i === 0) continue;
    const prev = candles[i - 1];
    if (prev === undefined) continue;
    // Engulfing
    if (isBullish(c) && isBearish(prev) && c.open <= prev.close && c.close >= prev.open) {
      push(i, 'bullish-engulfing', 'bullish', 0.85);
    }
    if (isBearish(c) && isBullish(prev) && c.open >= prev.close && c.close <= prev.open) {
      push(i, 'bearish-engulfing', 'bearish', 0.85);
    }
    // Inside bar / harami
    if (c.high < prev.high && c.low > prev.low) push(i, 'inside-bar', 'neutral', 0.7);
    if (isBullish(c) && isBearish(prev) && c.open > prev.close && c.close < prev.open) {
      push(i, 'bullish-harami', 'bullish', 0.6);
    }
    if (isBearish(c) && isBullish(prev) && c.open < prev.close && c.close > prev.open) {
      push(i, 'bearish-harami', 'bearish', 0.6);
    }
    if (i < 2) continue;
    const first = candles[i - 2];
    if (first === undefined) continue;
    // Morning / evening star
    const mid = candles[i - 1];
    if (mid !== undefined && isBearish(first) && body(mid) <= candleRange(mid) * 0.5 && isBullish(c) && c.close > first.open - body(first) / 2) {
      push(i, 'morning-star', 'bullish', 0.75);
    }
    if (mid !== undefined && isBullish(first) && body(mid) <= candleRange(mid) * 0.5 && isBearish(c) && c.close < first.open + body(first) / 2) {
      push(i, 'evening-star', 'bearish', 0.75);
    }
    // Three white soldiers / three black crows
    const second = candles[i - 1];
    if (second !== undefined && isBullish(first) && isBullish(second) && isBullish(c) && c.close > second.close && second.close > first.close) {
      push(i, 'three-white-soldiers', 'bullish', 0.7);
    }
    if (second !== undefined && isBearish(first) && isBearish(second) && isBearish(c) && c.close < second.close && second.close < first.close) {
      push(i, 'three-black-crows', 'bearish', 0.7);
    }
  }
  // Double top / double bottom and head & shoulders from swing pivots.
  const pivots = findSwingPivots(candles, 2, 2);
  const highs = pivots.filter((p) => p.kind === 'high');
  for (let k = 1; k < highs.length; k++) {
    const a = highs[k - 1];
    const b = highs[k];
    if (a !== undefined && b !== undefined && withinTolerance(a.price, b.price, 0.5)) {
      push(b.index, 'double-top', 'bearish', 0.7);
    }
  }
  const lows = pivots.filter((p) => p.kind === 'low');
  for (let k = 1; k < lows.length; k++) {
    const a = lows[k - 1];
    const b = lows[k];
    if (a !== undefined && b !== undefined && withinTolerance(a.price, b.price, 0.5)) {
      push(b.index, 'double-bottom', 'bullish', 0.7);
    }
  }
  for (let k = 2; k < highs.length; k++) {
    const a = highs[k - 2];
    const midH = highs[k - 1];
    const c = highs[k];
    if (a !== undefined && midH !== undefined && c !== undefined && midH.price > a.price && midH.price > c.price && withinTolerance(a.price, c.price, 1)) {
      push(c.index, 'head-and-shoulders', 'bearish', 0.65);
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

export interface SupplyDemandSettings {
  /** Require a later retest before the zone counts as valid. */
  retestRequired: boolean;
}

/**
 * Supply / demand zones from the 3-candle sequence:
 * demand = bullish, bearish, bullish (middle candle is the zone);
 * supply = bearish, bullish, bearish.
 */
export function detectSupplyDemand(
  candles: readonly Candle[],
  settings: SupplyDemandSettings = { retestRequired: false },
): Zone[] {
  const zones: Zone[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const a = candles[i - 1];
    const midC = candles[i];
    const b = candles[i + 1];
    if (a === undefined || midC === undefined || b === undefined) continue;
    let type: Zone['type'] | undefined;
    if (isBullish(a) && isBearish(midC) && isBullish(b)) type = 'demand';
    else if (isBearish(a) && isBullish(midC) && isBearish(b)) type = 'supply';
    if (type === undefined) continue;
    let retested = false;
    for (let j = i + 2; j < candles.length; j++) {
      const c = candles[j];
      if (c === undefined) continue;
      if (type === 'demand' && c.low <= midC.high && c.low >= midC.low) retested = true;
      if (type === 'supply' && c.high >= midC.low && c.high <= midC.high) retested = true;
      if (retested) break;
    }
    if (settings.retestRequired && !retested) continue;
    zones.push({
      type,
      top: midC.high,
      bottom: midC.low,
      mid: (midC.high + midC.low) / 2,
      index: i,
      time: midC.time,
      touches: retested ? 2 : 1,
      strength: retested ? 0.75 : 0.5,
      invalidated: false,
      breakoutConfirmed: retested,
    });
  }
  return zones;
}

/** Order-block style zones: last opposite-colour candle before an impulsive move. */
export function detectOrderBlocks(candles: readonly Candle[], minMovePct = 0.5): Zone[] {
  const zones: Zone[] = [];
  for (let i = 0; i < candles.length - 2; i++) {
    const c = candles[i];
    const next = candles[i + 1];
    const next2 = candles[i + 2];
    if (c === undefined || next === undefined || next2 === undefined) continue;
    const moveUp = ((next2.close - c.close) / (c.close || 1)) * 100;
    const moveDown = ((c.close - next2.close) / (c.close || 1)) * 100;
    if (isBearish(c) && moveUp >= minMovePct && isBullish(next) && isBullish(next2)) {
      zones.push({ type: 'order-block', top: c.high, bottom: c.low, mid: (c.high + c.low) / 2, index: i, time: c.time, touches: 1, strength: 0.6, invalidated: false, breakoutConfirmed: true });
    }
    if (isBullish(c) && moveDown >= minMovePct && isBearish(next) && isBearish(next2)) {
      zones.push({ type: 'order-block', top: c.high, bottom: c.low, mid: (c.high + c.low) / 2, index: i, time: c.time, touches: 1, strength: 0.6, invalidated: false, breakoutConfirmed: true });
    }
  }
  return zones;
}

/** Fair-value gaps / imbalance zones: gap between candle i-1 and i+1. */
export function detectFairValueGaps(candles: readonly Candle[], minGapPct = 0): Zone[] {
  const zones: Zone[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const next = candles[i + 1];
    const cur = candles[i];
    if (prev === undefined || next === undefined || cur === undefined) continue;
    if (next.low > prev.high) {
      const gapPct = ((next.low - prev.high) / (prev.high || 1)) * 100;
      if (gapPct < minGapPct) continue;
      zones.push({ type: 'fair-value-gap', top: next.low, bottom: prev.high, mid: (next.low + prev.high) / 2, index: i, time: cur.time, touches: 1, strength: 0.6, invalidated: false, breakoutConfirmed: false });
    }
    if (next.high < prev.low) {
      const gapPct = ((prev.low - next.high) / (prev.low || 1)) * 100;
      if (gapPct < minGapPct) continue;
      zones.push({ type: 'fair-value-gap', top: prev.low, bottom: next.high, mid: (prev.low + next.high) / 2, index: i, time: cur.time, touches: 1, strength: 0.6, invalidated: false, breakoutConfirmed: false });
    }
  }
  return zones;
}

export interface BreakRetestSettings {
  tolerancePct: number;
  lookback: number;
  /** Minimum bars between breakout and retest. */
  minRetestWait: number;
  /** Maximum bars after breakout for a valid retest. */
  maxRetestWindow: number;
  minRiskReward: number;
  requireConfirmation: boolean;
  entryMode: 'rejection' | 'breakout' | 'retest';
}

export const DEFAULT_BREAK_RETEST_SETTINGS: BreakRetestSettings = {
  tolerancePct: 0.25,
  lookback: 100,
  minRetestWait: 1,
  maxRetestWindow: 20,
  minRiskReward: 2,
  requireConfirmation: true,
  entryMode: 'retest',
};

/** Break & retest detector for one explicit zone. */
export function detectBreakRetestForZone(
  candles: readonly Candle[],
  zone: Zone,
  settings: BreakRetestSettings = DEFAULT_BREAK_RETEST_SETTINGS,
): BreakRetestSetup | undefined {
  // A resistance / supply zone broken upward becomes support (long on the
  // retest); a support / demand zone broken downward becomes resistance
  // (short on the retest). This is the role-flip rule.
  const direction: 'long' | 'short' =
    zone.type === 'resistance' || zone.type === 'supply' ? 'long' : 'short';
  const start = Math.max(0, zone.index);
  // Find the breakout candle: a body close outside the zone after formation.
  let breakoutIndex = -1;
  for (let i = start + 1; i < candles.length; i++) {
    const c = candles[i];
    if (c === undefined) continue;
    if (direction === 'long' && c.close > zone.top) {
      breakoutIndex = i;
      break;
    }
    if (direction === 'short' && c.close < zone.bottom) {
      breakoutIndex = i;
      break;
    }
  }
  if (breakoutIndex < 0) return undefined;
  const patterns = detectCandlestickPatterns(candles);
  const width = Math.max(zone.top - zone.bottom, 1e-9);
  const entry = zone.mid;
  const stop = direction === 'long' ? zone.bottom - width * 0.25 : zone.top + width * 0.25;
  const risk = Math.abs(entry - stop);
  const target1 = direction === 'long' ? entry + settings.minRiskReward * risk : entry - settings.minRiskReward * risk;
  const target2 = direction === 'long' ? entry + (settings.minRiskReward + 1) * risk : entry - (settings.minRiskReward + 1) * risk;
  const base: Omit<BreakRetestSetup, 'status' | 'retestIndex' | 'confirmationIndex'> = {
    direction,
    entryMode: settings.entryMode,
    breakoutIndex,
    zone,
    entry,
    stop,
    target1,
    target2,
    riskReward1: settings.minRiskReward,
    riskReward2: settings.minRiskReward + 1,
  };
  if (settings.entryMode === 'breakout') {
    return { ...base, retestIndex: undefined, confirmationIndex: breakoutIndex, status: 'confirmed' };
  }
  // Retest search.
  const from = breakoutIndex + settings.minRetestWait;
  const to = Math.min(candles.length - 1, breakoutIndex + settings.maxRetestWindow);
  let retestIndex: number | undefined;
  let falseBreakout = false;
  for (let i = from; i <= to; i++) {
    const c = candles[i];
    if (c === undefined) continue;
    const entered = direction === 'long' ? c.low <= zone.top : c.high >= zone.bottom;
    if (entered) {
      retestIndex = i;
      break;
    }
    // A close back inside the zone without a retest touch = false breakout.
    if (direction === 'long' && c.close < zone.top) falseBreakout = true;
    if (direction === 'short' && c.close > zone.bottom) falseBreakout = true;
  }
  if (retestIndex === undefined) {
    return { ...base, retestIndex: undefined, confirmationIndex: undefined, status: falseBreakout ? 'false-breakout' : 'awaiting-retest' };
  }
  if (!settings.requireConfirmation) {
    return { ...base, retestIndex, confirmationIndex: retestIndex, status: 'confirmed' };
  }
  // Confirmation candle at / after the retest, in the trade direction.
  let confirmationIndex: number | undefined;
  for (let i = retestIndex; i <= Math.min(candles.length - 1, retestIndex + 3); i++) {
    const found = patterns.find(
      (p) =>
        p.index === i &&
        ((direction === 'long' && p.direction === 'bullish') || (direction === 'short' && p.direction === 'bearish')),
    );
    if (found !== undefined) {
      confirmationIndex = i;
      break;
    }
  }
  if (confirmationIndex === undefined) {
    return { ...base, retestIndex, confirmationIndex: undefined, status: 'awaiting-confirmation' };
  }
  return { ...base, retestIndex, confirmationIndex, status: 'confirmed' };
}

/** Break & retest detector over all auto-detected support/resistance zones. */
export function detectBreakRetest(
  candles: readonly Candle[],
  settings: BreakRetestSettings = DEFAULT_BREAK_RETEST_SETTINGS,
): BreakRetestSetup[] {
  const slice = candles.slice(Math.max(0, candles.length - settings.lookback));
  const zones = detectSupportResistance(slice, {
    pivotLeft: 2,
    pivotRight: 2,
    tolerancePct: settings.tolerancePct,
    minTouches: 2,
  });
  const out: BreakRetestSetup[] = [];
  for (const zone of zones) {
    // Map the zone index (relative to the slice) back to the full series.
    const offset = candles.length - slice.length;
    const fullZone: Zone = { ...zone, index: zone.index + offset };
    const setup = detectBreakRetestForZone(candles, fullZone, settings);
    if (setup !== undefined) out.push(setup);
  }
  return out;
}

/** Divergence detector (RSI or MACD, regular + hidden). Standard app feature. */
export function detectDivergence(
  candles: readonly Candle[],
  oscillator: 'rsi' | 'macd' = 'rsi',
  period = 14,
): Divergence[] {
  const closes = candles.map((c) => c.close);
  const oscSeries: (number | undefined)[] =
    oscillator === 'rsi' ? rsi(closes, period) : macd(closes).macd;
  const pricePivots = pivotsOfSeries(closes.map((v) => v), 2, 2);
  const oscPivots = pivotsOfSeries(oscSeries, 2, 2);
  const out: Divergence[] = [];
  const priceHighs = pricePivots.filter((p) => p.kind === 'high');
  const oscHighs = oscPivots.filter((p) => p.kind === 'high');
  const priceLows = pricePivots.filter((p) => p.kind === 'low');
  const oscLows = oscPivots.filter((p) => p.kind === 'low');
  // Regular bearish: price higher high, oscillator lower high.
  for (let k = 1; k < priceHighs.length; k++) {
    const p1 = priceHighs[k - 1];
    const p2 = priceHighs[k];
    if (p1 === undefined || p2 === undefined || p2.value <= p1.value) continue;
    const o1 = oscHighs.filter((o) => o.index <= p1.index).pop();
    const o2 = oscHighs.filter((o) => o.index > p1.index && o.index <= p2.index + 2).pop();
    if (o1 !== undefined && o2 !== undefined && o2.value < o1.value) {
      const c = candles[p2.index];
      if (c !== undefined) {
        out.push({ index: p2.index, time: c.time, oscillator, kind: 'regular-bearish', priceSwing: [p1.value, p2.value], oscillatorSwing: [o1.value, o2.value] });
      }
    }
  }
  // Regular bullish: price lower low, oscillator higher low.
  for (let k = 1; k < priceLows.length; k++) {
    const p1 = priceLows[k - 1];
    const p2 = priceLows[k];
    if (p1 === undefined || p2 === undefined || p2.value >= p1.value) continue;
    const o1 = oscLows.filter((o) => o.index <= p1.index).pop();
    const o2 = oscLows.filter((o) => o.index > p1.index && o.index <= p2.index + 2).pop();
    if (o1 !== undefined && o2 !== undefined && o2.value > o1.value) {
      const c = candles[p2.index];
      if (c !== undefined) {
        out.push({ index: p2.index, time: c.time, oscillator, kind: 'regular-bullish', priceSwing: [p1.value, p2.value], oscillatorSwing: [o1.value, o2.value] });
      }
    }
  }
  // Hidden bullish: price higher low, oscillator lower low.
  for (let k = 1; k < priceLows.length; k++) {
    const p1 = priceLows[k - 1];
    const p2 = priceLows[k];
    if (p1 === undefined || p2 === undefined || p2.value <= p1.value) continue;
    const o1 = oscLows.filter((o) => o.index <= p1.index).pop();
    const o2 = oscLows.filter((o) => o.index > p1.index && o.index <= p2.index + 2).pop();
    if (o1 !== undefined && o2 !== undefined && o2.value < o1.value) {
      const c = candles[p2.index];
      if (c !== undefined) {
        out.push({ index: p2.index, time: c.time, oscillator, kind: 'hidden-bullish', priceSwing: [p1.value, p2.value], oscillatorSwing: [o1.value, o2.value] });
      }
    }
  }
  // Hidden bearish: price lower high, oscillator higher high.
  for (let k = 1; k < priceHighs.length; k++) {
    const p1 = priceHighs[k - 1];
    const p2 = priceHighs[k];
    if (p1 === undefined || p2 === undefined || p2.value >= p1.value) continue;
    const o1 = oscHighs.filter((o) => o.index <= p1.index).pop();
    const o2 = oscHighs.filter((o) => o.index > p1.index && o.index <= p2.index + 2).pop();
    if (o1 !== undefined && o2 !== undefined && o2.value > o1.value) {
      const c = candles[p2.index];
      if (c !== undefined) {
        out.push({ index: p2.index, time: c.time, oscillator, kind: 'hidden-bearish', priceSwing: [p1.value, p2.value], oscillatorSwing: [o1.value, o2.value] });
      }
    }
  }
  return out.sort((a, b) => a.index - b.index);
}
