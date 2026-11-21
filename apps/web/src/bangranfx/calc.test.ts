import { describe, expect, it } from 'vitest';
import {
  calcLot,
  calcRiskReward,
  compoundingSteps,
  fibRrLevels,
  layeringPercent,
  slMaxFor,
} from './calc';

describe('calcLot', () => {
  it('contoh Bab 10: modal $1.000, risiko 1% ($10), SL 10 pip → lot 0,10', () => {
    expect(calcLot(1000, 1, 10)).toBe(0.1);
  });

  it('risiko 2% pada contoh yang sama → lot 0,20', () => {
    expect(calcLot(1000, 2, 10)).toBe(0.2);
  });

  it('lot mengecil saat SL membesar (risiko sama)', () => {
    expect(calcLot(1000, 1, 20)).toBe(0.05);
    expect(calcLot(1000, 1, 20)).toBeLessThan(calcLot(1000, 1, 10));
    expect(calcLot(1000, 1, 40)).toBeLessThan(calcLot(1000, 1, 20));
  });

  it('modal $100, siap rugi $2, SL 20 pip → lot 0,01', () => {
    expect(calcLot(100, 2, 20)).toBe(0.01);
  });

  it('menolak input tidak valid', () => {
    expect(() => calcLot(0, 1, 10)).toThrow(RangeError);
    expect(() => calcLot(1000, 0, 10)).toThrow(RangeError);
    expect(() => calcLot(1000, 1, 0)).toThrow(RangeError);
  });
});

describe('calcRiskReward', () => {
  it('sell 1943, SL 1945, TP 1941 → risiko 20 pip, reward 20 pip, RR 1:1', () => {
    const rr = calcRiskReward(1943, 1945, 1941);
    expect(rr.riskPips).toBe(20);
    expect(rr.rewardPips).toBe(20);
    expect(rr.ratio).toBe(1);
    expect(rr.meetsMinimum).toBe(false);
  });

  it('RR di bawah 1:2 tidak memenuhi standar minimal', () => {
    expect(calcRiskReward(1943, 1945, 1942).meetsMinimum).toBe(false);
  });

  it('arah eksplisit: buy dengan TP di bawah entry memberi reward negatif', () => {
    const rr = calcRiskReward(1956, 1954, 1954, 'buy');
    expect(rr.rewardPips).toBe(-20);
    expect(rr.rr).toBe(-1);
    expect(rr.meetsMinimum).toBe(false);
  });

  it('arah eksplisit sell: TP di bawah entry memberi reward positif', () => {
    const rr = calcRiskReward(1943, 1945, 1941, 'sell');
    expect(rr.rewardPips).toBe(20);
    expect(rr.rr).toBe(1);
  });
});

describe('fibRrLevels', () => {
  it('entry 1956, SL 1954, buy → TP 1:1 di 1958, TP 1:2 di 1960', () => {
    const levels = fibRrLevels(1956, 1954, 'buy');
    expect(levels.map((level) => level.price)).toEqual([1956, 1958, 1960, 1962]);
    expect(levels.map((level) => level.level)).toEqual([0, 1, 2, 3]);
    expect(levels[1]?.label).toBe('TP 1:1');
    expect(levels[2]?.label).toBe('TP 1:2');
  });

  it('sell membalik arah level ke bawah entry', () => {
    const levels = fibRrLevels(1943, 1945, 'sell');
    expect(levels.map((level) => level.price)).toEqual([1943, 1941, 1939, 1937]);
  });
});

describe('slMaxFor', () => {
  it('SL maks per tipe: scalping 20, intraday 60, swing 120 pip', () => {
    expect(slMaxFor('scalping')).toBe(20);
    expect(slMaxFor('intraday')).toBe(60);
    expect(slMaxFor('swing')).toBe(120);
  });
});

describe('layeringPercent', () => {
  it('total 0,50 dibagi 5 layer → 0,10 tiap layer', () => {
    const split = layeringPercent(0.5, 5);
    expect(split.layers).toEqual([0.1, 0.1, 0.1, 0.1, 0.1]);
    expect(split.total).toBe(0.5);
  });

  it('jumlah layer selalu sama dengan total (sisa pembulatan di layer terakhir)', () => {
    const split = layeringPercent(0.25, 3);
    const sum = split.layers.reduce((acc, lot) => acc + lot, 0);
    expect(Math.round(sum * 100) / 100).toBe(0.25);
    expect(split.layers).toHaveLength(3);
  });

  it('menolak layer di luar 1–5', () => {
    expect(() => layeringPercent(0.5, 0)).toThrow(RangeError);
    expect(() => layeringPercent(0.5, 6)).toThrow(RangeError);
  });
});

describe('compoundingSteps', () => {
  it('step pertama: $20 risiko 30% → risiko $6, saldo $26', () => {
    const steps = compoundingSteps(20, 30, 1);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.balanceBefore).toBe(20);
    expect(steps[0]?.riskUsd).toBe(6);
    expect(steps[0]?.balance).toBe(26);
    expect(steps[0]?.balanceAfter).toBe(26);
  });

  it('saldo tumbuh tiap step (RR 1:1)', () => {
    const steps = compoundingSteps(100, 10, 3);
    expect(steps.map((step) => step.balanceAfter)).toEqual([110, 121, 133.1]);
  });
});
