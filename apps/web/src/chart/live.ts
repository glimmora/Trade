import { alignCandleOpenTime, timeframeMs } from '@trade/core';
import type { Candle, Timeframe } from '@trade/core';
import type { MainSeriesHandle } from './series';

/** Outcome of applying one live tick. */
export type LiveTickResult = 'updated' | 'appended' | 'ignored';

/**
 * Merge one live tick into a candle array, purely.
 * - Tick time equals the last candle's open time: the forming candle is
 *   replaced with the tick (result 'updated').
 * - Tick time is later: the tick starts a new candle (result 'appended').
 * - Tick time is earlier: out-of-order tick, ignored (result 'ignored').
 * The input array is never mutated.
 */
export function mergeLiveTick(
  candles: readonly Candle[],
  tick: Candle,
): { candles: Candle[]; result: LiveTickResult } {
  const last = candles[candles.length - 1];
  if (last === undefined) {
    return { candles: [tick], result: 'appended' };
  }
  if (tick.time === last.time) {
    return { candles: [...candles.slice(0, -1), tick], result: 'updated' };
  }
  if (tick.time > last.time) {
    return { candles: [...candles, tick], result: 'appended' };
  }
  return { candles: [...candles], result: 'ignored' };
}

/** Open time (UTC seconds) of the candle that follows `candle`. Month-aware for 1M. */
export function nextCandleOpenTime(candle: Candle, timeframe: Timeframe): number {
  if (timeframe === '1M') {
    const date = new Date(candle.time * 1000);
    return Math.floor(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000,
    );
  }
  return candle.time + Math.floor(timeframeMs(timeframe) / 1000);
}

/**
 * Whether a candle is still forming or already closed at `nowMs`.
 * A candle closes when the next candle's open time has been reached.
 * Uses the candle's own open time, so provider clock skew in the tick
 * timestamp cannot misclassify it; pass a server-time-derived `nowMs`
 * when available.
 */
export function candleStatus(
  candle: Candle,
  timeframe: Timeframe,
  nowMs: number = Date.now(),
): 'forming' | 'closed' {
  return nowMs / 1000 >= nextCandleOpenTime(candle, timeframe) ? 'closed' : 'forming';
}

/**
 * Apply one live tick to a chart series and return the merged history.
 * Only the affected candle is sent to the library (`series.update`); the
 * whole series is never rebuilt per tick.
 */
export function applyLiveTick(
  handle: MainSeriesHandle,
  candles: readonly Candle[],
  tick: Candle,
): { candles: Candle[]; result: LiveTickResult } {
  const merged = mergeLiveTick(candles, tick);
  if (merged.result !== 'ignored') {
    handle.update(tick);
  }
  return merged;
}

/**
 * Reconnect-safe resync: replace the whole series with fresh history.
 * Call this after a reconnect / provider switch instead of replaying
 * incremental ticks, then resume `applyLiveTick` for new ticks.
 */
export function resyncSeries(handle: MainSeriesHandle, candles: readonly Candle[]): void {
  handle.setData(candles);
}

/** True when `timeMs` falls inside `candle`'s period (open <= t < next open). */
export function isTimeInCandle(
  candle: Candle,
  timeframe: Timeframe,
  timeMs: number,
): boolean {
  return alignCandleOpenTime(timeMs, timeframe) === candle.time;
}
