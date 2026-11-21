import type { Candle } from './types.js';
import { ema, sma } from './movingAverages.js';
import { stdDev, trueRange, wilderSmooth } from './utils.js';

function undefinedSeries(length: number): (number | undefined)[] {
  return new Array<number | undefined>(length).fill(undefined);
}

/** Population standard-deviation series (windowed). */
export function standardDeviation(values: readonly number[], period: number): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  if (period <= 0) return out;
  for (let i = period - 1; i < values.length; i++) {
    out[i] = stdDev(values.slice(i - period + 1, i + 1));
  }
  return out;
}

export interface BollingerResult {
  upper: (number | undefined)[];
  basis: (number | undefined)[];
  lower: (number | undefined)[];
}

/** Bollinger Bands: SMA +/- `multiplier` * population StdDev. */
export function bollingerBands(
  values: readonly number[],
  period = 20,
  multiplier = 2,
): BollingerResult {
  const basis = sma(values, period);
  const upper = undefinedSeries(values.length);
  const lower = undefinedSeries(values.length);
  for (let i = 0; i < values.length; i++) {
    const b = basis[i];
    if (b === undefined || i < period - 1) continue;
    const sd = stdDev(values.slice(i - period + 1, i + 1));
    upper[i] = b + multiplier * sd;
    lower[i] = b - multiplier * sd;
  }
  return { upper, basis, lower };
}

export interface KeltnerResult {
  upper: (number | undefined)[];
  basis: (number | undefined)[];
  lower: (number | undefined)[];
}

/** Keltner Channel: EMA basis +/- `multiplier` * ATR. */
export function keltnerChannel(
  candles: readonly Candle[],
  period = 20,
  multiplier = 2,
  atrPeriod = 10,
): KeltnerResult {
  const closes = candles.map((c) => c.close);
  const basis = ema(closes, period);
  const atrSeries = atr(candles, atrPeriod);
  const upper = undefinedSeries(candles.length);
  const lower = undefinedSeries(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const b = basis[i];
    const a = atrSeries[i];
    if (b === undefined || a === undefined) continue;
    upper[i] = b + multiplier * a;
    lower[i] = b - multiplier * a;
  }
  return { upper, basis, lower };
}

export interface DonchianResult {
  upper: (number | undefined)[];
  basis: (number | undefined)[];
  lower: (number | undefined)[];
}

/** Donchian Channel: highest high / lowest low over `period`. */
export function donchianChannel(candles: readonly Candle[], period = 20): DonchianResult {
  const upper = undefinedSeries(candles.length);
  const lower = undefinedSeries(candles.length);
  const basis = undefinedSeries(candles.length);
  for (let i = period - 1; i < candles.length; i++) {
    let hi = Number.NEGATIVE_INFINITY;
    let lo = Number.POSITIVE_INFINITY;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j];
      if (c === undefined) continue;
      hi = Math.max(hi, c.high);
      lo = Math.min(lo, c.low);
    }
    upper[i] = hi;
    lower[i] = lo;
    basis[i] = (hi + lo) / 2;
  }
  return { upper, basis, lower };
}

/** Average True Range (Wilder smoothing). */
export function atr(candles: readonly Candle[], period = 14): (number | undefined)[] {
  const tr = candles.map((_, i) => trueRange(candles, i));
  return wilderSmooth(tr, period);
}

export interface SupertrendResult {
  value: (number | undefined)[];
  /** 1 = uptrend, -1 = downtrend, 0 = not enough data. */
  trend: number[];
}

/** Supertrend (ATR bands with trend flips). */
export function supertrend(
  candles: readonly Candle[],
  period = 10,
  multiplier = 3,
): SupertrendResult {
  const value = undefinedSeries(candles.length);
  const trend: number[] = new Array<number>(candles.length).fill(0);
  const atrSeries = atr(candles, period);
  let prevUpper = 0;
  let prevLower = 0;
  let prevTrend = 1;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const a = atrSeries[i];
    if (c === undefined || a === undefined) continue;
    const hl2 = (c.high + c.low) / 2;
    const upper = hl2 + multiplier * a;
    const lower = hl2 - multiplier * a;
    const finalUpper = i === 0 || upper < prevUpper || (candles[i - 1] !== undefined && (candles[i - 1]?.close ?? 0) > prevUpper) ? upper : prevUpper;
    const finalLower = i === 0 || lower > prevLower || (candles[i - 1] !== undefined && (candles[i - 1]?.close ?? 0) < prevLower) ? lower : prevLower;
    let t = prevTrend;
    if (prevTrend === 1 && c.close < finalLower) t = -1;
    else if (prevTrend === -1 && c.close > finalUpper) t = 1;
    const v = t === 1 ? finalLower : finalUpper;
    value[i] = v;
    trend[i] = t;
    prevUpper = finalUpper;
    prevLower = finalLower;
    prevTrend = t;
  }
  return { value, trend };
}

export interface ParabolicSarResult {
  value: (number | undefined)[];
  /** 1 = rising (SAR below price), -1 = falling. */
  trend: number[];
}

/** Parabolic SAR (AF step 0.02, max 0.20). */
export function parabolicSar(
  candles: readonly Candle[],
  step = 0.02,
  maxAf = 0.2,
): ParabolicSarResult {
  const value = undefinedSeries(candles.length);
  const trend: number[] = new Array<number>(candles.length).fill(0);
  if (candles.length < 2) return { value, trend };
  let rising = true;
  let sar = candles[0]?.low ?? 0;
  let ep = candles[0]?.high ?? 0;
  let af = step;
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    if (c === undefined || prev === undefined) continue;
    if (rising) {
      sar = sar + af * (ep - sar);
      const prevLow = candles[i - 1]?.low ?? sar;
      const prevLow2 = i >= 2 ? (candles[i - 2]?.low ?? prevLow) : prevLow;
      sar = Math.min(sar, prevLow, prevLow2);
      if (c.low < sar) {
        rising = false;
        sar = ep;
        value[i] = sar;
        trend[i] = -1;
        ep = c.low;
        af = step;
        continue;
      }
      if (c.high > ep) {
        ep = c.high;
        af = Math.min(maxAf, af + step);
      }
    } else {
      sar = sar + af * (ep - sar);
      const prevHigh = candles[i - 1]?.high ?? sar;
      const prevHigh2 = i >= 2 ? (candles[i - 2]?.high ?? prevHigh) : prevHigh;
      sar = Math.max(sar, prevHigh, prevHigh2);
      if (c.high > sar) {
        rising = true;
        sar = ep;
        value[i] = sar;
        trend[i] = 1;
        ep = c.high;
        af = step;
        continue;
      }
      if (c.low < ep) {
        ep = c.low;
        af = Math.min(maxAf, af + step);
      }
    }
    value[i] = sar;
    trend[i] = rising ? 1 : -1;
  }
  return { value, trend };
}

export interface IchimokuResult {
  conversion: (number | undefined)[];
  base: (number | undefined)[];
  spanA: (number | undefined)[];
  spanB: (number | undefined)[];
  lagging: (number | undefined)[];
}

/** Ichimoku Cloud. Spans are displaced forward by `displacement` bars. */
export function ichimoku(
  candles: readonly Candle[],
  conversionPeriod = 9,
  basePeriod = 26,
  spanBPeriod = 52,
  displacement = 26,
): IchimokuResult {
  const n = candles.length;
  const conversion = undefinedSeries(n);
  const base = undefinedSeries(n);
  const spanA = undefinedSeries(n);
  const spanB = undefinedSeries(n);
  const lagging = undefinedSeries(n);
  const mid = (i: number, period: number): number | undefined => {
    if (i < period - 1) return undefined;
    let hi = Number.NEGATIVE_INFINITY;
    let lo = Number.POSITIVE_INFINITY;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j];
      if (c === undefined) return undefined;
      hi = Math.max(hi, c.high);
      lo = Math.min(lo, c.low);
    }
    return (hi + lo) / 2;
  };
  for (let i = 0; i < n; i++) {
    conversion[i] = mid(i, conversionPeriod);
    base[i] = mid(i, basePeriod);
    const b = mid(i, spanBPeriod);
    const conv = conversion[i];
    const bas = base[i];
    if (conv !== undefined && bas !== undefined && i + displacement < n) {
      spanA[i + displacement] = (conv + bas) / 2;
    }
    if (b !== undefined && i + displacement < n) spanB[i + displacement] = b;
    const close = candles[i]?.close;
    if (close !== undefined && i - displacement >= 0) lagging[i - displacement] = close;
  }
  return { conversion, base, spanA, spanB, lagging };
}

export type VwapAnchor = 'day' | 'week' | 'session';

/** Session-anchored VWAP: resets at each UTC day (or week) boundary. */
export function vwap(candles: readonly Candle[], anchor: VwapAnchor = 'day'): (number | undefined)[] {
  const out = undefinedSeries(candles.length);
  let cumPv = 0;
  let cumVol = 0;
  let anchorKey = '';
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c === undefined) continue;
    const d = new Date(c.time * 1000);
    const key =
      anchor === 'week'
        ? `${String(d.getUTCFullYear())}-W${String(Math.floor(d.getUTCDate() / 7))}`
        : anchor === 'session'
          ? `${String(d.getUTCFullYear())}-${String(d.getUTCMonth())}-${String(d.getUTCDate())}-${String(Math.floor(d.getUTCHours() / 8))}`
          : `${String(d.getUTCFullYear())}-${String(d.getUTCMonth())}-${String(d.getUTCDate())}`;
    if (key !== anchorKey) {
      anchorKey = key;
      cumPv = 0;
      cumVol = 0;
    }
    const typical = (c.high + c.low + c.close) / 3;
    cumPv += typical * c.volume;
    cumVol += c.volume;
    out[i] = cumVol === 0 ? typical : cumPv / cumVol;
  }
  return out;
}

export type PivotType = 'classic' | 'fibonacci' | 'camarilla';

export interface PivotPoints {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

/** Pivot points from one prior period's high / low / close. */
export function pivotPoints(high: number, low: number, close: number, type: PivotType = 'classic'): PivotPoints {
  const pivot = (high + low + close) / 3;
  const range = high - low;
  if (type === 'fibonacci') {
    return {
      pivot,
      r1: pivot + 0.382 * range,
      r2: pivot + 0.618 * range,
      r3: pivot + 1 * range,
      s1: pivot - 0.382 * range,
      s2: pivot - 0.618 * range,
      s3: pivot - 1 * range,
    };
  }
  if (type === 'camarilla') {
    return {
      pivot,
      r1: close + (range * 1.1) / 12,
      r2: close + (range * 1.1) / 6,
      r3: close + (range * 1.1) / 4,
      s1: close - (range * 1.1) / 12,
      s2: close - (range * 1.1) / 6,
      s3: close - (range * 1.1) / 4,
    };
  }
  return {
    pivot,
    r1: 2 * pivot - low,
    r2: pivot + range,
    r3: pivot + 2 * range,
    s1: 2 * pivot - high,
    s2: pivot - range,
    s3: pivot - 2 * range,
  };
}
