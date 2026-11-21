import type { Candle, Source } from './types.js';

/** Read a price source value from one candle. */
export function sourceValue(candle: Candle, source: Source): number {
  switch (source) {
    case 'open':
      return candle.open;
    case 'high':
      return candle.high;
    case 'low':
      return candle.low;
    case 'close':
      return candle.close;
    case 'hl2':
      return (candle.high + candle.low) / 2;
    case 'hlc3':
      return (candle.high + candle.low + candle.close) / 3;
    case 'ohlc4':
      return (candle.open + candle.high + candle.low + candle.close) / 4;
  }
}

/** Extract a source series from candles. */
export function sourceSeries(candles: readonly Candle[], source: Source): number[] {
  return candles.map((c) => sourceValue(c, source));
}

export function closes(candles: readonly Candle[]): number[] {
  return candles.map((c) => c.close);
}

export function typicalPrices(candles: readonly Candle[]): number[] {
  return candles.map((c) => (c.high + c.low + c.close) / 3);
}

export function medianPrices(candles: readonly Candle[]): number[] {
  return candles.map((c) => (c.high + c.low) / 2);
}

/** Safe indexed read under `noUncheckedIndexedAccess`. */
export function at<T>(values: readonly T[], index: number): T | undefined {
  return values[index];
}

/** Population standard deviation of a window (divide by N). */
export function stdDev(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
  return Math.sqrt(variance);
}

/** Mean absolute deviation from the mean (used by CCI). */
export function meanDeviation(values: readonly number[], mean: number): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + Math.abs(b - mean), 0) / values.length;
}

export function highest(values: readonly number[]): number {
  return values.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
}

export function lowest(values: readonly number[]): number {
  return values.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
}

/** Rolling sum helper: returns undefined until the window is full. */
export function rollingSum(values: readonly number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(values.length).fill(undefined);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === undefined) continue;
    sum += v;
    if (i >= period) {
      const leaving = values[i - period];
      if (leaving !== undefined) sum -= leaving;
    }
    if (i >= period - 1) out[i] = sum;
  }
  return out;
}

/** True range of candle `i` (needs the previous close). */
export function trueRange(candles: readonly Candle[], i: number): number {
  const c = candles[i];
  if (c === undefined) return 0;
  if (i === 0) return c.high - c.low;
  const prev = candles[i - 1];
  if (prev === undefined) return c.high - c.low;
  return Math.max(
    c.high - c.low,
    Math.abs(c.high - prev.close),
    Math.abs(c.low - prev.close),
  );
}

/** Wilder's smoothing (used by RSI / ATR / ADX): first value is a plain mean. */
export function wilderSmooth(values: readonly number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(values.length).fill(undefined);
  if (values.length < period || period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    const v = values[i];
    if (v !== undefined) sum += v;
  }
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    const prev = out[i - 1];
    const v = values[i];
    if (prev === undefined || v === undefined) continue;
    out[i] = prev - prev / period + v / period;
  }
  return out;
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True when two prices are within `tolerancePct` percent of each other. */
export function withinTolerance(a: number, b: number, tolerancePct: number): boolean {
  if (b === 0) return a === 0;
  return Math.abs(a - b) / Math.abs(b) <= tolerancePct / 100;
}
