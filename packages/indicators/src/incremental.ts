/**
 * Incremental (stateful) calculators for live ticks.
 *
 * Each `create*State` builds a small state object from a warm-up series;
 * each `*Update` folds one new value / candle in O(1) (or O(period) for
 * windowed averages) and returns the new indicator value without
 * recomputing the whole series. The UI calls the batch functions for
 * history and these helpers for the forming candle.
 */
import type { Candle } from './types.js';

/** EMA state. */
export interface EmaState {
  period: number;
  k: number;
  value: number | undefined;
  count: number;
  /** Values seen during the seed window (for the initial SMA). */
  seed: number[];
}

export function createEmaState(period: number): EmaState {
  return { period, k: 2 / (period + 1), value: undefined, count: 0, seed: [] };
}

export function emaUpdate(state: EmaState, value: number): number | undefined {
  if (state.value !== undefined) {
    state.value = value * state.k + state.value * (1 - state.k);
    state.count++;
    return state.value;
  }
  state.seed.push(value);
  state.count++;
  if (state.seed.length >= state.period) {
    state.value = state.seed.reduce((a, b) => a + b, 0) / state.period;
    state.seed = [];
    return state.value;
  }
  return undefined;
}

/** SMA state (rolling window). */
export interface SmaState {
  period: number;
  window: number[];
  sum: number;
}

export function createSmaState(period: number): SmaState {
  return { period, window: [], sum: 0 };
}

export function smaUpdate(state: SmaState, value: number): number | undefined {
  state.window.push(value);
  state.sum += value;
  if (state.window.length > state.period) {
    const leaving = state.window.shift();
    if (leaving !== undefined) state.sum -= leaving;
  }
  if (state.window.length < state.period) return undefined;
  return state.sum / state.period;
}

/** RSI state (Wilder smoothing). */
export interface RsiState {
  period: number;
  prevClose: number | undefined;
  avgGain: number | undefined;
  avgLoss: number | undefined;
  gains: number[];
  losses: number[];
}

export function createRsiState(period = 14): RsiState {
  return { period, prevClose: undefined, avgGain: undefined, avgLoss: undefined, gains: [], losses: [] };
}

export function rsiUpdate(state: RsiState, close: number): number | undefined {
  if (state.prevClose !== undefined) {
    const diff = close - state.prevClose;
    const gain = Math.max(0, diff);
    const loss = Math.max(0, -diff);
    if (state.avgGain !== undefined && state.avgLoss !== undefined) {
      state.avgGain = (state.avgGain * (state.period - 1) + gain) / state.period;
      state.avgLoss = (state.avgLoss * (state.period - 1) + loss) / state.period;
    } else {
      state.gains.push(gain);
      state.losses.push(loss);
      if (state.gains.length >= state.period) {
        state.avgGain = state.gains.reduce((a, b) => a + b, 0) / state.period;
        state.avgLoss = state.losses.reduce((a, b) => a + b, 0) / state.period;
        state.gains = [];
        state.losses = [];
      }
    }
  }
  state.prevClose = close;
  if (state.avgGain === undefined || state.avgLoss === undefined) return undefined;
  if (state.avgGain === 0 && state.avgLoss === 0) return 50;
  if (state.avgLoss === 0) return 100;
  if (state.avgGain === 0) return 0;
  const rs = state.avgGain / state.avgLoss;
  return 100 - 100 / (1 + rs);
}

/** ATR state (Wilder smoothing of true range). */
export interface AtrState {
  period: number;
  prevClose: number | undefined;
  value: number | undefined;
  seed: number[];
}

export function createAtrState(period = 14): AtrState {
  return { period, prevClose: undefined, value: undefined, seed: [] };
}

export function atrUpdate(state: AtrState, candle: Candle): number | undefined {
  const tr =
    state.prevClose === undefined
      ? candle.high - candle.low
      : Math.max(candle.high - candle.low, Math.abs(candle.high - state.prevClose), Math.abs(candle.low - state.prevClose));
  state.prevClose = candle.close;
  if (state.value !== undefined) {
    state.value = (state.value * (state.period - 1) + tr) / state.period;
    return state.value;
  }
  state.seed.push(tr);
  if (state.seed.length >= state.period) {
    state.value = state.seed.reduce((a, b) => a + b, 0) / state.period;
    state.seed = [];
    return state.value;
  }
  return undefined;
}

/** MACD state (two EMAs + signal EMA). */
export interface MacdState {
  fast: EmaState;
  slow: EmaState;
  signal: EmaState;
}

export function createMacdState(fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MacdState {
  return { fast: createEmaState(fastPeriod), slow: createEmaState(slowPeriod), signal: createEmaState(signalPeriod) };
}

export function macdUpdate(
  state: MacdState,
  close: number,
): { macd: number | undefined; signal: number | undefined; histogram: number | undefined } {
  const fast = emaUpdate(state.fast, close);
  const slow = emaUpdate(state.slow, close);
  if (fast === undefined || slow === undefined) return { macd: undefined, signal: undefined, histogram: undefined };
  const macdValue = fast - slow;
  const signal = emaUpdate(state.signal, macdValue);
  return {
    macd: macdValue,
    signal,
    histogram: signal === undefined ? undefined : macdValue - signal,
  };
}

/** VWAP state (session-anchored, resets on a new UTC day by default). */
export interface VwapState {
  anchorKey: string;
  cumPv: number;
  cumVol: number;
}

export function createVwapState(): VwapState {
  return { anchorKey: '', cumPv: 0, cumVol: 0 };
}

export function vwapUpdate(state: VwapState, candle: Candle): number {
  const d = new Date(candle.time * 1000);
  const key = `${String(d.getUTCFullYear())}-${String(d.getUTCMonth())}-${String(d.getUTCDate())}`;
  if (key !== state.anchorKey) {
    state.anchorKey = key;
    state.cumPv = 0;
    state.cumVol = 0;
  }
  const typical = (candle.high + candle.low + candle.close) / 3;
  state.cumPv += typical * candle.volume;
  state.cumVol += candle.volume;
  return state.cumVol === 0 ? typical : state.cumPv / state.cumVol;
}

/** Bollinger state (rolling window mean + population StdDev). */
export interface BollingerState {
  period: number;
  multiplier: number;
  window: number[];
}

export function createBollingerState(period = 20, multiplier = 2): BollingerState {
  return { period, multiplier, window: [] };
}

export function bollingerUpdate(
  state: BollingerState,
  value: number,
): { upper: number | undefined; basis: number | undefined; lower: number | undefined } {
  state.window.push(value);
  if (state.window.length > state.period) state.window.shift();
  if (state.window.length < state.period) return { upper: undefined, basis: undefined, lower: undefined };
  const mean = state.window.reduce((a, b) => a + b, 0) / state.period;
  const variance = state.window.reduce((a, b) => a + (b - mean) * (b - mean), 0) / state.period;
  const sd = Math.sqrt(variance);
  return { upper: mean + state.multiplier * sd, basis: mean, lower: mean - state.multiplier * sd };
}
