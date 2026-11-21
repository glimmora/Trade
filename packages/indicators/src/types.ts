/**
 * Shared types for the indicator library.
 *
 * Pure data only: no DOM, no network, no side effects. Every function in
 * this package takes plain arrays / plain settings objects and returns
 * plain data, so it can run in a Web Worker or on the main thread.
 *
 * The `Candle` shape here matches the shared core candle type
 * (open time in UTC seconds, OHLCV). The package keeps its own copy so
 * the worker bundle has no workspace dependency at runtime.
 */

export interface Candle {
  /** Candle open time, UTC seconds. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Price source a moving average / oscillator reads from. */
export type Source = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';

export const SOURCES: readonly Source[] = [
  'open',
  'high',
  'low',
  'close',
  'hl2',
  'hlc3',
  'ohlc4',
] as const;

/** A value aligned with the input candles; `undefined` = not enough data. */
export type Series = readonly (number | undefined)[];

export type LineStyleKind = 'solid' | 'dashed' | 'dotted';

export interface LineStyle {
  color: string;
  width: number;
  style: LineStyleKind;
}

/** A chart timeframe id (mirrors the core timeframe list). */
export type TimeframeId =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '12h'
  | '1D'
  | '1W'
  | '1M';

/**
 * Visibility rule for an indicator instance: show on every timeframe,
 * or only on the listed ones.
 */
export type TimeframeVisibility = 'all' | readonly TimeframeId[];

export interface BaseIndicatorSettings {
  /** Period / lookback in bars. */
  period: number;
  /** Price source. */
  source: Source;
  /** Line appearance (settings data only; the chart renders it). */
  line: LineStyle;
  /** Timeframes this instance is visible on. */
  visibleTimeframes: TimeframeVisibility;
}

export function defaultBaseSettings(period: number, color = '#2962ff'): BaseIndicatorSettings {
  return {
    period,
    source: 'close',
    line: { color, width: 1, style: 'solid' },
    visibleTimeframes: 'all',
  };
}

/** Where an indicator is drawn. */
export type IndicatorKind = 'overlay' | 'oscillator' | 'structure';

/**
 * Provenance of a feature, kept honest in the registry:
 * - `source-derived`: described in the studied method (price action,
 *   support/resistance, break & retest, supply/demand, channels,
 *   MA 50 / MA 200, engulfing / pin bar / double top / head & shoulders).
 * - `app-spec`: a standard, neutral technical-analysis feature required
 *   by the app specification (all oscillators, Fibonacci, fair-value
 *   gaps, order blocks, divergence, BOS / CHoCH labels). It is a
 *   standard tool, not part of the studied method.
 */
export type IndicatorOrigin = 'source-derived' | 'app-spec';

export interface IndicatorDefinition {
  id: string;
  name: string;
  kind: IndicatorKind;
  origin: IndicatorOrigin;
  description: string;
  /** Default settings object for a new instance of this indicator. */
  defaults: Record<string, unknown>;
}

/** One user-added indicator instance (UI state; the registry is keyed by id). */
export interface IndicatorInstance {
  /** Unique instance id (not the indicator type id). */
  instanceId: string;
  /** Indicator type id, e.g. `sma`, `rsi`, `break-retest`. */
  indicatorId: string;
  /** Display name, e.g. `SMA 50`. */
  name: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

/** A saved indicator template: named settings for one indicator type. */
export interface IndicatorTemplate {
  name: string;
  indicatorId: string;
  settings: Record<string, unknown>;
}

export interface Zone {
  type: 'support' | 'resistance' | 'demand' | 'supply' | 'order-block' | 'fair-value-gap';
  top: number;
  bottom: number;
  mid: number;
  /** Index of the candle that formed the zone. */
  index: number;
  time: number;
  /** How many times price touched / reacted at the zone. */
  touches: number;
  /** 0..1 strength score (touch count, recency, breakout confirmation). */
  strength: number;
  /** True once a candle body has closed through the zone. */
  invalidated: boolean;
  /** True once price has broken out of / away from the zone after forming. */
  breakoutConfirmed: boolean;
}

export interface SwingPivot {
  index: number;
  time: number;
  price: number;
  kind: 'high' | 'low';
}

export interface StructureLabel {
  index: number;
  time: number;
  price: number;
  label: 'HH' | 'HL' | 'LH' | 'LL';
}

export type TrendState = 'uptrend' | 'downtrend' | 'sideways';

export interface StructureEvent {
  index: number;
  time: number;
  price: number;
  /** Break of structure / change of character (standard labels). */
  kind: 'BOS' | 'CHoCH' | 'SBR' | 'RBS';
  direction: 'bullish' | 'bearish';
}

export interface CandlestickPattern {
  index: number;
  time: number;
  /** e.g. `bullish-engulfing`, `pin-bar`, `doji`, `double-top`. */
  type: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  /** 0..1, higher = cleaner pattern shape. */
  confidence: number;
}

export interface Divergence {
  index: number;
  time: number;
  oscillator: 'rsi' | 'macd';
  kind: 'regular-bullish' | 'regular-bearish' | 'hidden-bullish' | 'hidden-bearish';
  priceSwing: [number, number];
  oscillatorSwing: [number, number];
}

export interface BreakRetestSetup {
  direction: 'long' | 'short';
  entryMode: 'rejection' | 'breakout' | 'retest';
  breakoutIndex: number;
  retestIndex: number | undefined;
  confirmationIndex: number | undefined;
  zone: Zone;
  /** Suggested entry price (data only). */
  entry: number;
  /** Suggested stop price (structural, beyond the zone). */
  stop: number;
  /** First target at the minimum risk:reward. */
  target1: number;
  /** Extended target at the next risk:reward multiple. */
  target2: number;
  riskReward1: number;
  riskReward2: number;
  status: 'awaiting-retest' | 'awaiting-confirmation' | 'confirmed' | 'stale' | 'invalidated' | 'false-breakout';
}

export interface FibonacciLevel {
  ratio: number;
  price: number;
  label: string;
}

export interface Channel {
  upperSlope: number;
  upperIntercept: number;
  lowerSlope: number;
  lowerIntercept: number;
  midSlope: number;
  midIntercept: number;
  startIndex: number;
  endIndex: number;
  /** Swing points the rails pass through. */
  touches: number;
}
