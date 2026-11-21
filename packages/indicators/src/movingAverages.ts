import type { Candle, Source } from './types.js';
import { sourceSeries } from './utils.js';

export interface MovingAverageSettings {
  period: number;
  source: Source;
}

export const DEFAULT_MA_SETTINGS: MovingAverageSettings = { period: 50, source: 'close' };

function undefinedSeries(length: number): (number | undefined)[] {
  return new Array<number | undefined>(length).fill(undefined);
}

/** Simple moving average. `undefined` until the window is full. */
export function sma(values: readonly number[], period: number): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === undefined) continue;
    sum += v;
    if (i >= period) {
      const leaving = values[i - period];
      if (leaving !== undefined) sum -= leaving;
    }
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average, seeded with the SMA of the first window. */
export function ema(values: readonly number[], period: number): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  const seed = sma(values, period);
  const seedValue = seed[period - 1];
  if (seedValue === undefined) return out;
  out[period - 1] = seedValue;
  for (let i = period; i < values.length; i++) {
    const prev = out[i - 1];
    const v = values[i];
    if (prev === undefined || v === undefined) continue;
    out[i] = v * k + prev * (1 - k);
  }
  return out;
}

/** Weighted moving average (weights 1..period, newest heaviest). */
export function wma(values: readonly number[], period: number): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  if (period <= 0) return out;
  const weightSum = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let weighted = 0;
    let ok = true;
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j];
      if (v === undefined) {
        ok = false;
        break;
      }
      weighted += v * (j + 1);
    }
    if (ok) out[i] = weighted / weightSum;
  }
  return out;
}

/** Volume-weighted moving average. */
export function vwma(
  values: readonly number[],
  volumes: readonly number[],
  period: number,
): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  if (period <= 0) return out;
  for (let i = period - 1; i < values.length; i++) {
    let pv = 0;
    let vv = 0;
    let ok = true;
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j];
      const vol = volumes[i - period + 1 + j];
      if (v === undefined || vol === undefined) {
        ok = false;
        break;
      }
      pv += v * vol;
      vv += vol;
    }
    if (ok && vv !== 0) out[i] = pv / vv;
  }
  return out;
}

/** Hull moving average: WMA(2*WMA(n/2) - WMA(n), sqrt(n)). */
export function hma(values: readonly number[], period: number): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  if (period <= 0) return out;
  const half = Math.max(1, Math.floor(period / 2));
  const sqrtPeriod = Math.max(1, Math.floor(Math.sqrt(period)));
  const wmaHalf = wma(values, half);
  const wmaFull = wma(values, period);
  const diff: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const a = wmaHalf[i];
    const b = wmaFull[i];
    diff.push(a !== undefined && b !== undefined ? 2 * a - b : Number.NaN);
  }
  // WMA over the diff series, skipping NaN entries by treating them as
  // missing: recompute only where the full window is numeric.
  const raw = wma(diff.filter((d) => !Number.isNaN(d)), sqrtPeriod);
  // Map back: diff is defined from index period-1 onward.
  const offset = period - 1;
  for (let k = 0; k < raw.length; k++) {
    const v = raw[k];
    if (v !== undefined) out[offset + k] = v;
  }
  return out;
}

function emaOfDefined(values: readonly (number | undefined)[], period: number): (number | undefined)[] {
  // EMA over a series that may start with undefined: compact the defined
  // tail, run ema(), then map back to original indices.
  const firstDefined = values.findIndex((v) => v !== undefined);
  if (firstDefined < 0) return undefinedSeries(values.length);
  const compact = values.slice(firstDefined).map((v) => (v ?? Number.NaN));
  // Replace interior undefined with the last defined value (EMA holds).
  let last = compact[0] ?? 0;
  const filled = compact.map((v) => {
    if (Number.isNaN(v)) return last;
    last = v;
    return v;
  });
  const result = ema(filled, period);
  const out = undefinedSeries(values.length);
  for (let k = 0; k < result.length; k++) {
    const v = result[k];
    if (v !== undefined) out[firstDefined + k] = v;
  }
  return out;
}

/** Double exponential moving average: 2*EMA - EMA(EMA). */
export function dema(values: readonly number[], period: number): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  const e1 = ema(values, period);
  const e2 = emaOfDefined(e1, period);
  for (let i = 0; i < values.length; i++) {
    const a = e1[i];
    const b = e2[i];
    if (a !== undefined && b !== undefined) out[i] = 2 * a - b;
  }
  return out;
}

/** Triple exponential moving average: 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA)). */
export function tema(values: readonly number[], period: number): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  const e1 = ema(values, period);
  const e2 = emaOfDefined(e1, period);
  const e3 = emaOfDefined(e2, period);
  for (let i = 0; i < values.length; i++) {
    const a = e1[i];
    const b = e2[i];
    const c = e3[i];
    if (a !== undefined && b !== undefined && c !== undefined) {
      out[i] = 3 * a - 3 * b + c;
    }
  }
  return out;
}

/** Moving-average ribbon: one series per period in `periods`. */
export function maRibbon(
  values: readonly number[],
  periods: readonly number[],
  kind: 'sma' | 'ema' = 'ema',
): Record<number, (number | undefined)[]> {
  const out: Record<number, (number | undefined)[]> = {};
  for (const p of periods) {
    out[p] = kind === 'ema' ? ema(values, p) : sma(values, p);
  }
  return out;
}

export interface EnvelopeResult {
  upper: (number | undefined)[];
  basis: (number | undefined)[];
  lower: (number | undefined)[];
}

/** Price envelope: SMA +/- `percent` percent. */
export function envelope(
  values: readonly number[],
  period: number,
  percent: number,
): EnvelopeResult {
  const basis = sma(values, period);
  const upper: (number | undefined)[] = new Array<number | undefined>(values.length).fill(undefined);
  const lower: (number | undefined)[] = new Array<number | undefined>(values.length).fill(undefined);
  for (let i = 0; i < values.length; i++) {
    const b = basis[i];
    if (b === undefined) continue;
    upper[i] = b * (1 + percent / 100);
    lower[i] = b * (1 - percent / 100);
  }
  return { upper, basis, lower };
}

/** Convenience wrappers over candle arrays. */
export function smaCandles(candles: readonly Candle[], settings: MovingAverageSettings): (number | undefined)[] {
  return sma(sourceSeries(candles, settings.source), settings.period);
}

export function emaCandles(candles: readonly Candle[], settings: MovingAverageSettings): (number | undefined)[] {
  return ema(sourceSeries(candles, settings.source), settings.period);
}

export function wmaCandles(candles: readonly Candle[], settings: MovingAverageSettings): (number | undefined)[] {
  return wma(sourceSeries(candles, settings.source), settings.period);
}

export function hmaCandles(candles: readonly Candle[], settings: MovingAverageSettings): (number | undefined)[] {
  return hma(sourceSeries(candles, settings.source), settings.period);
}

export function demaCandles(candles: readonly Candle[], settings: MovingAverageSettings): (number | undefined)[] {
  return dema(sourceSeries(candles, settings.source), settings.period);
}

export function temaCandles(candles: readonly Candle[], settings: MovingAverageSettings): (number | undefined)[] {
  return tema(sourceSeries(candles, settings.source), settings.period);
}

export function vwmaCandles(candles: readonly Candle[], settings: MovingAverageSettings): (number | undefined)[] {
  return vwma(
    sourceSeries(candles, settings.source),
    candles.map((c) => c.volume),
    settings.period,
  );
}
