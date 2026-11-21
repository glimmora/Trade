/**
 * Pure position-tool math: risk/reward, P&L percentages and position
 * sizing for the long/short position tool. No DOM, no I/O.
 *
 * All functions are total over finite numbers except where documented:
 * `calculatePosition` returns `null` when the setup is invalid (zero or
 * negative risk, zero or negative reward, or a non-finite input), so the
 * UI can refuse to render a box instead of showing a nonsense ratio.
 */
import type { PositionDirection, PositionToolData } from './types.js';

export interface PositionCalcInput {
  direction: PositionDirection;
  entry: number;
  stop: number;
  target: number;
  /** Amount of account currency risked on the trade, if known. */
  riskAmount?: number;
  /** Account size in account currency, if known. */
  accountSize?: number;
}

export interface PositionCalcResult {
  direction: PositionDirection;
  entry: number;
  stop: number;
  target: number;
  /** Price distance risked per unit. Always positive when valid. */
  riskPerUnit: number;
  /** Price distance gained per unit at target. Always positive when valid. */
  rewardPerUnit: number;
  /** Reward / risk, e.g. 2 means 1:2. */
  riskReward: number;
  /** Risk as a percentage of the entry price. */
  riskPercent: number;
  /** Reward as a percentage of the entry price. */
  rewardPercent: number;
  /** P&L percent if the target is hit (positive). */
  pnlPercentAtTarget: number;
  /** P&L percent if the stop is hit (negative). */
  pnlPercentAtStop: number;
  /** Units to trade so the loss at the stop equals `riskAmount`. */
  positionSizeUnits?: number;
  /** Notional value of the position (units × entry price). */
  notionalValue?: number;
  /** Risk as a percentage of the account, when both inputs are known. */
  riskPercentOfAccount?: number;
}

function isValidCalcInput(input: PositionCalcInput): boolean {
  return (
    Number.isFinite(input.entry) &&
    Number.isFinite(input.stop) &&
    Number.isFinite(input.target) &&
    input.entry > 0 &&
    (input.riskAmount === undefined || Number.isFinite(input.riskAmount)) &&
    (input.accountSize === undefined || Number.isFinite(input.accountSize))
  );
}

/**
 * Calculate risk/reward for a long or short setup.
 * Long: risk = entry − stop, reward = target − entry.
 * Short: risk = stop − entry, reward = entry − target.
 * Returns null when risk or reward is not strictly positive.
 */
export function calculatePosition(input: PositionCalcInput): PositionCalcResult | null {
  if (!isValidCalcInput(input)) {
    return null;
  }
  const riskPerUnit =
    input.direction === 'long' ? input.entry - input.stop : input.stop - input.entry;
  const rewardPerUnit =
    input.direction === 'long' ? input.target - input.entry : input.entry - input.target;
  if (!(riskPerUnit > 0) || !(rewardPerUnit > 0)) {
    return null;
  }
  const riskReward = rewardPerUnit / riskPerUnit;
  const riskPercent = (riskPerUnit / input.entry) * 100;
  const rewardPercent = (rewardPerUnit / input.entry) * 100;
  const result: PositionCalcResult = {
    direction: input.direction,
    entry: input.entry,
    stop: input.stop,
    target: input.target,
    riskPerUnit,
    rewardPerUnit,
    riskReward,
    riskPercent,
    rewardPercent,
    pnlPercentAtTarget: rewardPercent,
    pnlPercentAtStop: -riskPercent,
    ...(input.riskAmount !== undefined && input.riskAmount > 0
      ? {
          positionSizeUnits: input.riskAmount / riskPerUnit,
          notionalValue: (input.riskAmount / riskPerUnit) * input.entry,
        }
      : {}),
    ...(input.riskAmount !== undefined &&
    input.accountSize !== undefined &&
    input.accountSize > 0
      ? { riskPercentOfAccount: (input.riskAmount / input.accountSize) * 100 }
      : {}),
  };
  return result;
}

/** Convenience wrapper over a stored `PositionToolData`. */
export function calculatePositionFromData(data: PositionToolData): PositionCalcResult | null {
  return calculatePosition({
    direction: data.direction,
    entry: data.entry,
    stop: data.stop,
    target: data.target,
    ...(data.riskAmount !== undefined ? { riskAmount: data.riskAmount } : {}),
    ...(data.accountSize !== undefined ? { accountSize: data.accountSize } : {}),
  });
}

/**
 * Format a risk:reward ratio as "1:2.00". Returns "—" for invalid setups.
 */
export function formatRiskReward(input: PositionCalcInput): string {
  const result = calculatePosition(input);
  if (result === null) {
    return '—';
  }
  return `1:${result.riskReward.toFixed(2)}`;
}

/** Result of measuring between two anchor points. */
export interface MeasureResult {
  /** Price difference (signed, second − first). */
  priceChange: number;
  /** Price change as a percentage of the first price. */
  priceChangePercent: number;
  /** Time difference in seconds (signed, second − first). */
  timeChangeSeconds: number;
  /** Number of candles between the anchors at the given timeframe step. */
  bars: number;
}

/**
 * Measure tool math: price change, percent change, elapsed time and bar
 * count between two anchors. `timeframeStepSeconds` is the candle step
 * (e.g. 3600 for 1h); bars is rounded to the nearest whole candle.
 */
export function measureBetween(
  from: { time: number; price: number },
  to: { time: number; price: number },
  timeframeStepSeconds: number,
): MeasureResult {
  const priceChange = to.price - from.price;
  const priceChangePercent = from.price !== 0 ? (priceChange / from.price) * 100 : 0;
  const timeChangeSeconds = to.time - from.time;
  const bars =
    timeframeStepSeconds > 0
      ? Math.round(Math.abs(timeChangeSeconds) / timeframeStepSeconds)
      : 0;
  return { priceChange, priceChangePercent, timeChangeSeconds, bars };
}
