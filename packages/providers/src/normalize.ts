import { alignCandleOpenTime, candleSchema, dedupeCandles, timeframeMs } from '@trade/core';
import type { Candle, Timeframe } from '@trade/core';

/**
 * Normalization rules (single source of truth for every adapter):
 * - timestamps are candle OPEN times in UTC seconds;
 * - candles are aligned down to the timeframe grid;
 * - series are sorted ascending, de-duplicated by open time;
 * - OHLC sanity is enforced (high >= max(open, close), low <= min(open, close));
 * - invalid rows (non-finite, negative prices, high < low) are dropped;
 * - volume is base-asset volume unless documented otherwise per adapter.
 */

export interface Gap {
  /** Open time of the last candle before the gap, UTC seconds. */
  from: number;
  /** Open time of the first candle after the gap, UTC seconds. */
  to: number;
  /** Number of missing candles in the gap. */
  missingBars: number;
}

export interface NormalizedSeries {
  candles: Candle[];
  gaps: Gap[];
  /** True when the newest candle is still forming (not yet closed). */
  hasFormingCandle: boolean;
  /** Number of raw rows dropped as invalid during normalization. */
  droppedRows: number;
}

/** Convert a millisecond timestamp to UTC seconds. */
export function toUtcSeconds(timeMs: number): number {
  return Math.floor(timeMs / 1000);
}

/** Round a price down to the symbol tick size. */
export function roundToTick(price: number, tickSize: number): number {
  if (!Number.isFinite(price) || tickSize <= 0) return price;
  return Math.round(price / tickSize) * tickSize;
}

/** One raw OHLCV row before normalization. */
export interface RawRow {
  timeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Normalize raw rows into a clean candle series for one timeframe.
 * `serverNowMs` is the provider server time (or local time corrected by
 * the measured server-time offset) used to decide forming vs closed.
 */
export function normalizeCandles(
  rows: readonly RawRow[],
  timeframe: Timeframe,
  serverNowMs: number,
): NormalizedSeries {
  const cleaned: Candle[] = [];
  let droppedRows = 0;
  for (const row of rows) {
    const time = alignCandleOpenTime(row.timeMs, timeframe);
    const parsed = candleSchema.safeParse({
      time,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    });
    if (!parsed.success) {
      droppedRows += 1;
      continue;
    }
    const c = parsed.data;
    if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) {
      droppedRows += 1;
      continue;
    }
    if (c.high < c.low) {
      droppedRows += 1;
      continue;
    }
    // Repair minor high/low inconsistencies instead of dropping the row.
    const high = Math.max(c.high, c.open, c.close);
    const low = Math.min(c.low, c.open, c.close);
    cleaned.push({ ...c, high, low });
  }
  const candles = dedupeCandles(cleaned);
  const gaps = detectGaps(candles, timeframe);
  const stepMs = timeframeMs(timeframe);
  const last = candles[candles.length - 1];
  const hasFormingCandle =
    last !== undefined && last.time * 1000 + stepMs > serverNowMs;
  return { candles, gaps, hasFormingCandle, droppedRows };
}

/** Find missing candles in an otherwise sorted, de-duplicated series. */
export function detectGaps(candles: readonly Candle[], timeframe: Timeframe): Gap[] {
  const stepSeconds = timeframeMs(timeframe) / 1000;
  const gaps: Gap[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (prev === undefined || curr === undefined) continue;
    const diff = curr.time - prev.time;
    if (diff > stepSeconds * 1.5) {
      gaps.push({
        from: prev.time,
        to: curr.time,
        missingBars: Math.round(diff / stepSeconds) - 1,
      });
    }
  }
  return gaps;
}

/**
 * Merge a live tick into a series: replace the forming candle when the tick
 * belongs to the same open time, append when it opens a new candle, and
 * drop it when it is older than the last closed candle. Never reorders.
 */
export function mergeLiveTick(
  series: readonly Candle[],
  tick: Candle,
  timeframe: Timeframe,
): Candle[] {
  const aligned: Candle = {
    ...tick,
    time: alignCandleOpenTime(tick.time * 1000, timeframe),
  };
  if (series.length === 0) return [aligned];
  const last = series[series.length - 1];
  if (last === undefined) return [aligned];
  if (aligned.time === last.time) {
    return [...series.slice(0, -1), aligned];
  }
  if (aligned.time > last.time) {
    return [...series, aligned];
  }
  return [...series];
}

/**
 * Server-time offset (serverMs - localMs). Positive when the server clock
 * is ahead. Apply to local timestamps before comparing with candle times,
 * so clock skew never marks a closed candle as forming (or vice versa).
 */
export function serverTimeOffset(serverMs: number, localMs: number): number {
  return serverMs - localMs;
}

/** Correct a local timestamp with a measured server-time offset. */
export function applyServerOffset(localMs: number, offsetMs: number): number {
  return localMs + offsetMs;
}

/** True when a candle is still forming at the given (server-corrected) time. */
export function isFormingCandle(
  candle: Candle,
  timeframe: Timeframe,
  serverNowMs: number,
): boolean {
  return candle.time * 1000 + timeframeMs(timeframe) > serverNowMs;
}

/** True when a candle is closed at the given (server-corrected) time. */
export function isClosedCandle(
  candle: Candle,
  timeframe: Timeframe,
  serverNowMs: number,
): boolean {
  return !isFormingCandle(candle, timeframe, serverNowMs);
}
