import { describe, expect, it } from 'vitest';
import {
  calculatePosition,
  calculatePositionFromData,
  formatRiskReward,
  measureBetween,
} from './position.js';

describe('calculatePosition', () => {
  it('computes a 1:2 long setup', () => {
    const result = calculatePosition({ direction: 'long', entry: 100, stop: 90, target: 120 });
    expect(result).not.toBeNull();
    expect(result?.riskPerUnit).toBe(10);
    expect(result?.rewardPerUnit).toBe(20);
    expect(result?.riskReward).toBe(2);
    expect(result?.riskPercent).toBe(10);
    expect(result?.rewardPercent).toBe(20);
    expect(result?.pnlPercentAtTarget).toBe(20);
    expect(result?.pnlPercentAtStop).toBe(-10);
  });

  it('computes a 1:2 short setup', () => {
    const result = calculatePosition({ direction: 'short', entry: 100, stop: 110, target: 80 });
    expect(result).not.toBeNull();
    expect(result?.riskPerUnit).toBe(10);
    expect(result?.rewardPerUnit).toBe(20);
    expect(result?.riskReward).toBe(2);
    expect(result?.pnlPercentAtTarget).toBe(20);
    expect(result?.pnlPercentAtStop).toBe(-10);
  });

  it('sizes the position from the risk amount and account size', () => {
    const result = calculatePosition({
      direction: 'long',
      entry: 100,
      stop: 90,
      target: 120,
      riskAmount: 100,
      accountSize: 10_000,
    });
    expect(result?.positionSizeUnits).toBe(10);
    expect(result?.notionalValue).toBe(1000);
    expect(result?.riskPercentOfAccount).toBe(1);
  });

  it('omits sizing fields when no risk amount is given', () => {
    const result = calculatePosition({ direction: 'long', entry: 100, stop: 90, target: 120 });
    expect(result?.positionSizeUnits).toBeUndefined();
    expect(result?.notionalValue).toBeUndefined();
    expect(result?.riskPercentOfAccount).toBeUndefined();
  });

  it('returns null for invalid setups instead of nonsense ratios', () => {
    // Stop above entry on a long: negative risk.
    expect(calculatePosition({ direction: 'long', entry: 100, stop: 110, target: 120 })).toBeNull();
    // Target below entry on a long: negative reward.
    expect(calculatePosition({ direction: 'long', entry: 100, stop: 90, target: 80 })).toBeNull();
    // Zero risk.
    expect(calculatePosition({ direction: 'short', entry: 100, stop: 100, target: 80 })).toBeNull();
    // Non-finite input.
    expect(
      calculatePosition({ direction: 'long', entry: Number.NaN, stop: 90, target: 120 }),
    ).toBeNull();
    expect(
      calculatePosition({ direction: 'long', entry: 0, stop: 90, target: 120 }),
    ).toBeNull();
  });

  it('works from stored PositionToolData', () => {
    const result = calculatePositionFromData({
      direction: 'short',
      entry: 200,
      stop: 220,
      target: 160,
    });
    expect(result?.riskReward).toBe(2);
  });
});

describe('formatRiskReward', () => {
  it('formats valid setups and dashes invalid ones', () => {
    expect(formatRiskReward({ direction: 'long', entry: 100, stop: 90, target: 120 })).toBe(
      '1:2.00',
    );
    expect(formatRiskReward({ direction: 'long', entry: 100, stop: 110, target: 120 })).toBe('—');
  });
});

describe('measureBetween', () => {
  it('measures price, percent, time and bars', () => {
    const result = measureBetween({ time: 1_700_000_000, price: 100 }, { time: 1_700_003_600, price: 110 }, 60);
    expect(result.priceChange).toBe(10);
    expect(result.priceChangePercent).toBe(10);
    expect(result.timeChangeSeconds).toBe(3600);
    expect(result.bars).toBe(60);
  });

  it('handles a downward move with negative values', () => {
    const result = measureBetween({ time: 1_700_003_600, price: 110 }, { time: 1_700_000_000, price: 100 }, 60);
    expect(result.priceChange).toBe(-10);
    expect(result.timeChangeSeconds).toBe(-3600);
    expect(result.bars).toBe(60);
  });
});
