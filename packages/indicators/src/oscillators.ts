import type { Candle } from './types.js';
import { ema, sma } from './movingAverages.js';
import { meanDeviation, medianPrices, typicalPrices, wilderSmooth } from './utils.js';

function undefinedSeries(length: number): (number | undefined)[] {
  return new Array<number | undefined>(length).fill(undefined);
}

/** RSI (Wilder). 100 on a pure up-move, 0 on a pure down-move, 50 when flat. */
export function rsi(values: readonly number[], period = 14): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  if (period <= 0 || values.length <= period) return out;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const cur = values[i];
    const prev = values[i - 1];
    if (cur === undefined || prev === undefined) {
      gains.push(0);
      losses.push(0);
    } else {
      const diff = cur - prev;
      gains.push(Math.max(0, diff));
      losses.push(Math.max(0, -diff));
    }
  }
  // gains/losses align with values[1..]; Wilder smoothing starts at index period-1 of gains.
  const avgGain = wilderSmooth(gains, period);
  const avgLoss = wilderSmooth(losses, period);
  for (let i = 0; i < values.length; i++) {
    const g = avgGain[i - 1];
    const l = avgLoss[i - 1];
    if (g === undefined || l === undefined) continue;
    if (g === 0 && l === 0) out[i] = 50;
    else if (l === 0) out[i] = 100;
    else if (g === 0) out[i] = 0;
    else {
      const rs = g / l;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

export function rsiCandles(candles: readonly Candle[], period = 14): (number | undefined)[] {
  return rsi(candles.map((c) => c.close), period);
}

export interface StochasticResult {
  k: (number | undefined)[];
  d: (number | undefined)[];
}

/** Stochastic oscillator (%K raw, %D = SMA of %K). */
export function stochastic(
  candles: readonly Candle[],
  period = 14,
  smoothK = 3,
  smoothD = 3,
): StochasticResult {
  const rawK = undefinedSeries(candles.length);
  for (let i = period - 1; i < candles.length; i++) {
    let hi = Number.NEGATIVE_INFINITY;
    let lo = Number.POSITIVE_INFINITY;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j];
      if (c === undefined) continue;
      hi = Math.max(hi, c.high);
      lo = Math.min(lo, c.low);
    }
    const close = candles[i]?.close;
    if (close === undefined || hi === lo) continue;
    rawK[i] = ((close - lo) / (hi - lo)) * 100;
  }
  const compact = (s: (number | undefined)[]): number[] => s.map((v) => (v === undefined ? Number.NaN : v));
  const smooth = (s: (number | undefined)[], p: number): (number | undefined)[] => {
    const first = s.findIndex((v) => v !== undefined);
    if (first < 0) return undefinedSeries(s.length);
    const filled = compact(s.slice(first));
    let last = 0;
    const vals = filled.map((v) => {
      if (Number.isNaN(v)) return last;
      last = v;
      return v;
    });
    const sm = sma(vals, p);
    const out = undefinedSeries(s.length);
    for (let k = 0; k < sm.length; k++) {
      if (sm[k] !== undefined) out[first + k] = sm[k];
    }
    return out;
  };
  const k = smooth(rawK, smoothK);
  const d = smooth(k, smoothD);
  return { k, d };
}

export interface StochRsiResult {
  k: (number | undefined)[];
  d: (number | undefined)[];
}

/** Stochastic RSI: Stochastic applied to the RSI series. */
export function stochRsi(
  values: readonly number[],
  rsiPeriod = 14,
  stochPeriod = 14,
  smoothK = 3,
  smoothD = 3,
): StochRsiResult {
  const rsiSeries = rsi(values, rsiPeriod);
  const raw = undefinedSeries(values.length);
  for (let i = stochPeriod - 1; i < values.length; i++) {
    const window: number[] = [];
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const v = rsiSeries[j];
      if (v !== undefined) window.push(v);
    }
    if (window.length < stochPeriod) continue;
    const hi = Math.max(...window);
    const lo = Math.min(...window);
    const cur = rsiSeries[i];
    if (cur === undefined || hi === lo) continue;
    raw[i] = ((cur - lo) / (hi - lo)) * 100;
  }
  const smooth = (s: (number | undefined)[], p: number): (number | undefined)[] => {
    const first = s.findIndex((v) => v !== undefined);
    if (first < 0) return undefinedSeries(s.length);
    let last = 0;
    const vals = s.slice(first).map((v) => {
      if (v === undefined) return last;
      last = v;
      return v;
    });
    const sm = sma(vals, p);
    const out = undefinedSeries(s.length);
    for (let k = 0; k < sm.length; k++) {
      if (sm[k] !== undefined) out[first + k] = sm[k];
    }
    return out;
  };
  const k = smooth(raw, smoothK);
  const d = smooth(k, smoothD);
  return { k, d };
}

export interface MacdResult {
  macd: (number | undefined)[];
  signal: (number | undefined)[];
  histogram: (number | undefined)[];
}

/** MACD: fast EMA - slow EMA, signal = EMA of MACD, histogram = MACD - signal. */
export function macd(
  values: readonly number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MacdResult {
  const fast = ema(values, fastPeriod);
  const slow = ema(values, slowPeriod);
  const macdLine = undefinedSeries(values.length);
  for (let i = 0; i < values.length; i++) {
    const f = fast[i];
    const s = slow[i];
    if (f !== undefined && s !== undefined) macdLine[i] = f - s;
  }
  // Signal is the EMA of the defined MACD tail.
  const first = macdLine.findIndex((v) => v !== undefined);
  const signal = undefinedSeries(values.length);
  const histogram = undefinedSeries(values.length);
  if (first >= 0) {
    const tail = macdLine.slice(first).map((v) => v ?? 0);
    const sigTail = ema(tail, signalPeriod);
    for (let k = 0; k < sigTail.length; k++) {
      const v = sigTail[k];
      if (v !== undefined) signal[first + k] = v;
    }
  }
  for (let i = 0; i < values.length; i++) {
    const m = macdLine[i];
    const s = signal[i];
    if (m !== undefined && s !== undefined) histogram[i] = m - s;
  }
  return { macd: macdLine, signal, histogram };
}

/** Commodity Channel Index. */
export function cci(candles: readonly Candle[], period = 20): (number | undefined)[] {
  const tp = typicalPrices(candles);
  const out = undefinedSeries(candles.length);
  for (let i = period - 1; i < candles.length; i++) {
    const window = tp.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const md = meanDeviation(window, mean);
    const cur = tp[i];
    if (cur === undefined || md === 0) continue;
    out[i] = (cur - mean) / (0.015 * md);
  }
  return out;
}

/** Williams %R (range -100..0). */
export function williamsR(candles: readonly Candle[], period = 14): (number | undefined)[] {
  const out = undefinedSeries(candles.length);
  for (let i = period - 1; i < candles.length; i++) {
    let hi = Number.NEGATIVE_INFINITY;
    let lo = Number.POSITIVE_INFINITY;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j];
      if (c === undefined) continue;
      hi = Math.max(hi, c.high);
      lo = Math.min(lo, c.low);
    }
    const close = candles[i]?.close;
    if (close === undefined || hi === lo) continue;
    out[i] = ((hi - close) / (hi - lo)) * -100;
  }
  return out;
}

/** Rate of Change, in percent. */
export function roc(values: readonly number[], period = 12): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  for (let i = period; i < values.length; i++) {
    const cur = values[i];
    const prev = values[i - period];
    if (cur === undefined || prev === undefined || prev === 0) continue;
    out[i] = ((cur - prev) / prev) * 100;
  }
  return out;
}

/** Momentum: close - close[period]. */
export function momentum(values: readonly number[], period = 10): (number | undefined)[] {
  const out = undefinedSeries(values.length);
  for (let i = period; i < values.length; i++) {
    const cur = values[i];
    const prev = values[i - period];
    if (cur === undefined || prev === undefined) continue;
    out[i] = cur - prev;
  }
  return out;
}

/** Money Flow Index. */
export function mfi(candles: readonly Candle[], period = 14): (number | undefined)[] {
  const out = undefinedSeries(candles.length);
  const tp = typicalPrices(candles);
  const flow = tp.map((t, i) => t * (candles[i]?.volume ?? 0));
  for (let i = period; i < candles.length; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const cur = tp[j];
      const prev = tp[j - 1];
      const f = flow[j];
      if (cur === undefined || prev === undefined || f === undefined) continue;
      if (cur > prev) pos += f;
      else if (cur < prev) neg += f;
    }
    if (pos + neg === 0) continue;
    out[i] = 100 - 100 / (1 + (neg === 0 ? Number.POSITIVE_INFINITY : pos / neg));
    if (neg === 0 && pos > 0) out[i] = 100;
  }
  return out;
}

export interface AdxResult {
  adx: (number | undefined)[];
  plusDi: (number | undefined)[];
  minusDi: (number | undefined)[];
}

/** ADX / DMI (Wilder smoothing). */
export function adx(candles: readonly Candle[], period = 14): AdxResult {
  const n = candles.length;
  const adxOut = undefinedSeries(n);
  const plusDi = undefinedSeries(n);
  const minusDi = undefinedSeries(n);
  if (n <= period) return { adx: adxOut, plusDi, minusDi };
  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    if (c === undefined) {
      tr.push(0);
      plusDm.push(0);
      minusDm.push(0);
      continue;
    }
    if (prev === undefined) {
      tr.push(c.high - c.low);
      plusDm.push(0);
      minusDm.push(0);
      continue;
    }
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
    const up = c.high - prev.high;
    const down = prev.low - c.low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }
  const smoothTr = wilderSmooth(tr, period);
  const smoothPlus = wilderSmooth(plusDm, period);
  const smoothMinus = wilderSmooth(minusDm, period);
  const dx: (number | undefined)[] = undefinedSeries(n);
  for (let i = 0; i < n; i++) {
    const t = smoothTr[i];
    const p = smoothPlus[i];
    const m = smoothMinus[i];
    if (t === undefined || p === undefined || m === undefined || t === 0) continue;
    const pdi = (p / t) * 100;
    const mdi = (m / t) * 100;
    plusDi[i] = pdi;
    minusDi[i] = mdi;
    const sum = pdi + mdi;
    dx[i] = sum === 0 ? 0 : (Math.abs(pdi - mdi) / sum) * 100;
  }
  // ADX is the Wilder-smoothed DX, seeded with the mean of the first period.
  const firstDx = dx.findIndex((v) => v !== undefined);
  if (firstDx >= 0) {
    const tail = dx.slice(firstDx);
    const defined = tail.filter((v): v is number => v !== undefined);
    if (defined.length >= period) {
      const seed = defined.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const seedIndex = firstDx + period - 1;
      adxOut[seedIndex] = seed;
      for (let i = seedIndex + 1; i < n; i++) {
        const prev = adxOut[i - 1];
        const d = dx[i];
        if (prev === undefined || d === undefined) continue;
        adxOut[i] = (prev * (period - 1) + d) / period;
      }
    }
  }
  return { adx: adxOut, plusDi, minusDi };
}

/** On-Balance Volume. */
export function obv(candles: readonly Candle[]): number[] {
  const out: number[] = new Array(candles.length).fill(0);
  let running = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    if (c === undefined) {
      out[i] = running;
      continue;
    }
    if (prev !== undefined) {
      if (c.close > prev.close) running += c.volume;
      else if (c.close < prev.close) running -= c.volume;
    }
    out[i] = running;
  }
  return out;
}

/** Volume with its SMA. */
export function volumeWithMa(
  candles: readonly Candle[],
  period = 20,
): { volume: number[]; ma: (number | undefined)[] } {
  const volume = candles.map((c) => c.volume);
  return { volume, ma: sma(volume, period) };
}

/** Accumulation / Distribution line. */
export function accumulationDistribution(candles: readonly Candle[]): number[] {
  const out: number[] = new Array(candles.length).fill(0);
  let running = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c === undefined) {
      out[i] = running;
      continue;
    }
    const range = c.high - c.low;
    const mfm = range === 0 ? 0 : ((c.close - c.low) - (c.high - c.close)) / range;
    running += mfm * c.volume;
    out[i] = running;
  }
  return out;
}

/** Awesome Oscillator: SMA(5, median) - SMA(34, median). */
export function awesomeOscillator(candles: readonly Candle[]): (number | undefined)[] {
  const median = medianPrices(candles);
  const fast = sma(median, 5);
  const slow = sma(median, 34);
  const out = undefinedSeries(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const f = fast[i];
    const s = slow[i];
    if (f !== undefined && s !== undefined) out[i] = f - s;
  }
  return out;
}

/** Chaikin Money Flow over `period` bars. */
export function chaikinMoneyFlow(candles: readonly Candle[], period = 20): (number | undefined)[] {
  const out = undefinedSeries(candles.length);
  const ad = accumulationDistribution(candles);
  // CMF needs the per-bar money-flow volume, not the cumulative line:
  // recompute the per-bar flow from A/D increments.
  const flowVol: number[] = [];
  let prevAd = 0;
  for (let i = 0; i < candles.length; i++) {
    const cur = ad[i] ?? 0;
    flowVol.push(cur - prevAd);
    prevAd = cur;
  }
  void ad;
  for (let i = period - 1; i < candles.length; i++) {
    let volSum = 0;
    let flowSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j];
      const f = flowVol[j];
      if (c === undefined || f === undefined) continue;
      volSum += c.volume;
      flowSum += f;
    }
    if (volSum === 0) continue;
    out[i] = flowSum / volSum;
  }
  return out;
}
