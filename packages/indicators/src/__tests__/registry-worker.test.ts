import { describe, expect, it } from 'vitest';
import type { Candle } from '../types.js';
import {
  INDICATOR_BY_ID,
  INDICATOR_REGISTRY,
  MAX_SIMULTANEOUS_INDICATORS,
  getIndicatorDefinition,
} from '../registry.js';
import { computeIndicator, handleWorkerMessage } from '../worker.js';
import { detectDivergence } from '../structure.js';

function candle(o: number, h: number, l: number, c: number, v = 100, time = 0): Candle {
  return { time, open: o, high: h, low: l, close: c, volume: v };
}

describe('registry', () => {
  it('covers every required indicator id', () => {
    const ids = new Set(INDICATOR_REGISTRY.map((d) => d.id));
    for (const required of [
      'sma', 'ema', 'wma', 'vwma', 'hma', 'dema', 'tema',
      'bollinger', 'keltner', 'donchian', 'ichimoku', 'parabolic-sar',
      'supertrend', 'vwap', 'pivot-points', 'ma-ribbon', 'envelope',
      'rsi', 'stochastic', 'stoch-rsi', 'macd', 'cci', 'williams-r',
      'roc', 'momentum', 'mfi', 'adx', 'atr', 'obv', 'volume',
      'accumulation-distribution', 'awesome-oscillator',
      'chaikin-money-flow', 'std-dev',
      'support-resistance', 'break-retest', 'supply-demand',
      'order-blocks', 'fair-value-gap', 'market-structure',
      'trendlines', 'channels', 'fibonacci', 'candlestick-patterns',
      'divergence',
    ]) {
      expect(ids.has(required), `missing ${required}`).toBe(true);
    }
  });
  it('has unique ids and honest origins', () => {
    const ids = INDICATOR_REGISTRY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(INDICATOR_REGISTRY.length).toBeGreaterThanOrEqual(40);
    // Oscillators and Fibonacci are standard app features, not method-derived.
    expect(getIndicatorDefinition('rsi')?.origin).toBe('app-spec');
    expect(getIndicatorDefinition('fibonacci')?.origin).toBe('app-spec');
    expect(getIndicatorDefinition('divergence')?.origin).toBe('app-spec');
    // Price-action detectors are method-derived.
    expect(getIndicatorDefinition('break-retest')?.origin).toBe('source-derived');
    expect(getIndicatorDefinition('supply-demand')?.origin).toBe('source-derived');
    expect(getIndicatorDefinition('sma')?.origin).toBe('source-derived');
    expect(INDICATOR_BY_ID['unknown']).toBeUndefined();
    expect(MAX_SIMULTANEOUS_INDICATORS).toBe(20);
  });
});

describe('worker dispatch', () => {
  const candles: Candle[] = Array.from({ length: 30 }, (_, i) => {
    const close = 100 + i;
    return candle(close - 0.5, close + 1, close - 1, close, 100, i * 60);
  });
  it('computes SMA through the worker handler', () => {
    const res = handleWorkerMessage({ id: '1', indicatorId: 'sma', candles, settings: { period: 3 } });
    expect('result' in res).toBe(true);
    if ('result' in res) {
      const series = res.result as (number | undefined)[];
      expect(series[29]).toBeCloseTo(128, 10);
    }
  });
  it('computes RSI, MACD, Bollinger and structure detectors', () => {
    for (const indicatorId of ['rsi', 'macd', 'bollinger', 'support-resistance', 'candlestick-patterns', 'market-structure']) {
      const res = handleWorkerMessage({ id: 'x', indicatorId, candles });
      expect('result' in res, indicatorId).toBe(true);
    }
  });
  it('returns an error object for an unknown indicator', () => {
    const res = handleWorkerMessage({ id: '2', indicatorId: 'nope', candles });
    expect('error' in res).toBe(true);
    if ('error' in res) expect(res.error).toContain('Unknown indicator');
  });
  it('computeIndicator throws on unknown ids', () => {
    expect(() => computeIndicator({ id: '3', indicatorId: 'nope', candles })).toThrow('Unknown indicator');
  });
});

describe('divergence', () => {
  it('returns an array on a normal series and is deterministic', () => {
    const candles = Array.from({ length: 60 }, (_, i) => {
      const close = 100 + Math.sin(i / 3) * 5 + i * 0.1;
      return candle(close - 0.5, close + 1, close - 1, close, 100, i * 60);
    });
    const out = detectDivergence(candles, 'rsi', 14);
    expect(Array.isArray(out)).toBe(true);
    expect(detectDivergence(candles, 'rsi', 14)).toEqual(out);
    const macdOut = detectDivergence(candles, 'macd', 14);
    expect(Array.isArray(macdOut)).toBe(true);
    for (const d of out) {
      expect(['regular-bullish', 'regular-bearish', 'hidden-bullish', 'hidden-bearish']).toContain(d.kind);
    }
  });
});
