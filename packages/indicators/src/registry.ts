import type { IndicatorDefinition } from './types.js';

/**
 * Registry of every indicator the package implements, keyed by id.
 * The UI adds / removes / reorders instances against this registry and
 * stores per-instance settings (templates are just named settings objects).
 *
 * `origin` is kept honest:
 * - `source-derived`: described in the studied method (MA 50 / 200 as
 *   dynamic support/resistance, support/resistance, break & retest,
 *   supply/demand, channels, engulfing / pin bar / double top /
 *   head & shoulders as confirmation patterns).
 * - `app-spec`: a standard, neutral technical-analysis feature required
 *   by the app specification (all oscillators and volatility/volume
 *   indicators, Fibonacci, fair-value gaps, order blocks, divergence,
 *   BOS / CHoCH labels). Standard tools, not part of the studied method.
 */
export const INDICATOR_REGISTRY: readonly IndicatorDefinition[] = [
  // Overlays — moving averages
  { id: 'sma', name: 'Simple Moving Average', kind: 'overlay', origin: 'source-derived', description: 'Mean of the last N closes. Periods 50 / 200 are the dynamic support/resistance presets.', defaults: { period: 50, source: 'close' } },
  { id: 'ema', name: 'Exponential Moving Average', kind: 'overlay', origin: 'app-spec', description: 'Recency-weighted moving average.', defaults: { period: 21, source: 'close' } },
  { id: 'wma', name: 'Weighted Moving Average', kind: 'overlay', origin: 'app-spec', description: 'Linearly weighted moving average.', defaults: { period: 21, source: 'close' } },
  { id: 'vwma', name: 'Volume-Weighted Moving Average', kind: 'overlay', origin: 'app-spec', description: 'Moving average weighted by volume.', defaults: { period: 20, source: 'close' } },
  { id: 'hma', name: 'Hull Moving Average', kind: 'overlay', origin: 'app-spec', description: 'Low-lag moving average from weighted averages.', defaults: { period: 16, source: 'close' } },
  { id: 'dema', name: 'Double Exponential Moving Average', kind: 'overlay', origin: 'app-spec', description: 'EMA with reduced lag.', defaults: { period: 21, source: 'close' } },
  { id: 'tema', name: 'Triple Exponential Moving Average', kind: 'overlay', origin: 'app-spec', description: 'EMA with further reduced lag.', defaults: { period: 21, source: 'close' } },
  { id: 'ma-ribbon', name: 'Moving Average Ribbon', kind: 'overlay', origin: 'app-spec', description: 'Several moving averages plotted together.', defaults: { periods: [5, 8, 13, 21, 34, 55], kind: 'ema' } },
  { id: 'envelope', name: 'Envelope', kind: 'overlay', origin: 'app-spec', description: 'Moving average with upper / lower percent bands.', defaults: { period: 20, percent: 5, source: 'close' } },
  // Overlays — volatility / bands / channels
  { id: 'bollinger', name: 'Bollinger Bands', kind: 'overlay', origin: 'app-spec', description: 'Moving average plus/minus standard-deviation bands.', defaults: { period: 20, multiplier: 2, source: 'close' } },
  { id: 'keltner', name: 'Keltner Channel', kind: 'overlay', origin: 'app-spec', description: 'EMA channel widened by average true range.', defaults: { period: 20, multiplier: 2, atrPeriod: 10 } },
  { id: 'donchian', name: 'Donchian Channel', kind: 'overlay', origin: 'app-spec', description: 'Highest high / lowest low over the lookback.', defaults: { period: 20 } },
  { id: 'ichimoku', name: 'Ichimoku Cloud', kind: 'overlay', origin: 'app-spec', description: 'Conversion / base lines and forward cloud spans.', defaults: { conversionPeriod: 9, basePeriod: 26, spanBPeriod: 52, displacement: 26 } },
  { id: 'parabolic-sar', name: 'Parabolic SAR', kind: 'overlay', origin: 'app-spec', description: 'Trailing stop-and-reverse dots.', defaults: { step: 0.02, maxAf: 0.2 } },
  { id: 'supertrend', name: 'Supertrend', kind: 'overlay', origin: 'app-spec', description: 'ATR band that flips with trend direction.', defaults: { period: 10, multiplier: 3 } },
  { id: 'vwap', name: 'VWAP', kind: 'overlay', origin: 'app-spec', description: 'Session-anchored volume-weighted average price.', defaults: { anchor: 'day' } },
  { id: 'pivot-points', name: 'Pivot Points', kind: 'overlay', origin: 'app-spec', description: 'Classic / Fibonacci / Camarilla pivots from the prior period.', defaults: { type: 'classic' } },
  // Oscillators / panes
  { id: 'rsi', name: 'Relative Strength Index', kind: 'oscillator', origin: 'app-spec', description: 'Momentum oscillator, 0–100.', defaults: { period: 14, source: 'close' } },
  { id: 'stochastic', name: 'Stochastic', kind: 'oscillator', origin: 'app-spec', description: '%K / %D momentum oscillator.', defaults: { period: 14, smoothK: 3, smoothD: 3 } },
  { id: 'stoch-rsi', name: 'Stochastic RSI', kind: 'oscillator', origin: 'app-spec', description: 'Stochastic applied to RSI.', defaults: { rsiPeriod: 14, stochPeriod: 14, smoothK: 3, smoothD: 3 } },
  { id: 'macd', name: 'MACD', kind: 'oscillator', origin: 'app-spec', description: 'Moving-average convergence / divergence.', defaults: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
  { id: 'cci', name: 'Commodity Channel Index', kind: 'oscillator', origin: 'app-spec', description: 'Deviation of typical price from its mean.', defaults: { period: 20 } },
  { id: 'williams-r', name: 'Williams %R', kind: 'oscillator', origin: 'app-spec', description: 'Overbought / oversold oscillator, -100 to 0.', defaults: { period: 14 } },
  { id: 'roc', name: 'Rate of Change', kind: 'oscillator', origin: 'app-spec', description: 'Percent change over the lookback.', defaults: { period: 12 } },
  { id: 'momentum', name: 'Momentum', kind: 'oscillator', origin: 'app-spec', description: 'Close minus close N bars ago.', defaults: { period: 10 } },
  { id: 'mfi', name: 'Money Flow Index', kind: 'oscillator', origin: 'app-spec', description: 'Volume-weighted RSI-style oscillator.', defaults: { period: 14 } },
  { id: 'adx', name: 'ADX / DMI', kind: 'oscillator', origin: 'app-spec', description: 'Trend strength with +DI / -DI.', defaults: { period: 14 } },
  { id: 'atr', name: 'Average True Range', kind: 'oscillator', origin: 'app-spec', description: 'Volatility measure from true range.', defaults: { period: 14 } },
  { id: 'obv', name: 'On-Balance Volume', kind: 'oscillator', origin: 'app-spec', description: 'Cumulative volume by close direction.', defaults: {} },
  { id: 'volume', name: 'Volume', kind: 'oscillator', origin: 'app-spec', description: 'Volume bars with a moving average.', defaults: { period: 20 } },
  { id: 'accumulation-distribution', name: 'Accumulation / Distribution', kind: 'oscillator', origin: 'app-spec', description: 'Cumulative money-flow line.', defaults: {} },
  { id: 'awesome-oscillator', name: 'Awesome Oscillator', kind: 'oscillator', origin: 'app-spec', description: 'Short minus long median-price moving average.', defaults: {} },
  { id: 'chaikin-money-flow', name: 'Chaikin Money Flow', kind: 'oscillator', origin: 'app-spec', description: 'Money flow over the lookback, -1 to 1.', defaults: { period: 20 } },
  { id: 'std-dev', name: 'Standard Deviation', kind: 'oscillator', origin: 'app-spec', description: 'Rolling standard deviation of price.', defaults: { period: 20 } },
  // Structure / analysis
  { id: 'support-resistance', name: 'Support & Resistance', kind: 'structure', origin: 'source-derived', description: 'Swing-pivot zones, clustered, with body-close invalidation and touch-count strength.', defaults: { pivotLeft: 2, pivotRight: 2, tolerancePct: 0.25, minTouches: 2 } },
  { id: 'break-retest', name: 'Break & Retest', kind: 'structure', origin: 'source-derived', description: 'Breakout candle, retest zone, confirmation candle, with entry / stop / target data.', defaults: { tolerancePct: 0.25, lookback: 100, minRetestWait: 1, maxRetestWindow: 20, minRiskReward: 2, requireConfirmation: true, entryMode: 'retest' } },
  { id: 'supply-demand', name: 'Supply & Demand Zones', kind: 'structure', origin: 'source-derived', description: 'Three-candle buy / sell zones, with optional retest requirement.', defaults: { retestRequired: false } },
  { id: 'order-blocks', name: 'Order Blocks', kind: 'structure', origin: 'app-spec', description: 'Last opposite-colour candle before an impulsive move.', defaults: { minMovePct: 0.5 } },
  { id: 'fair-value-gap', name: 'Fair Value Gap', kind: 'structure', origin: 'app-spec', description: 'Imbalance gaps between candles.', defaults: { minGapPct: 0 } },
  { id: 'market-structure', name: 'Market Structure', kind: 'structure', origin: 'source-derived', description: 'HH / HL / LH / LL labels, trend state, BOS / CHoCH and role-flip events.', defaults: { left: 2, right: 2 } },
  { id: 'trendlines', name: 'Trendlines', kind: 'structure', origin: 'source-derived', description: 'Auto trendlines through swing highs / lows.', defaults: { tolerancePct: 0.25 } },
  { id: 'channels', name: 'Channels', kind: 'structure', origin: 'source-derived', description: 'Parallel channels from a three-point zigzag, with midline.', defaults: { tolerancePct: 0.25 } },
  { id: 'fibonacci', name: 'Fibonacci Levels', kind: 'structure', origin: 'app-spec', description: 'Retracement and extension levels from a swing high / low.', defaults: { lookback: 50 } },
  { id: 'candlestick-patterns', name: 'Candlestick Patterns', kind: 'structure', origin: 'source-derived', description: 'Engulfing, pin bar / hammer, doji, morning / evening star, inside bar, double top / bottom, head & shoulders, and the standard extended set.', defaults: {} },
  { id: 'divergence', name: 'Divergence', kind: 'structure', origin: 'app-spec', description: 'RSI / MACD regular and hidden divergence.', defaults: { oscillator: 'rsi', period: 14 } },
];

export const INDICATOR_BY_ID: Readonly<Record<string, IndicatorDefinition>> = Object.fromEntries(
  INDICATOR_REGISTRY.map((d) => [d.id, d]),
);

export function getIndicatorDefinition(id: string): IndicatorDefinition | undefined {
  return INDICATOR_BY_ID[id];
}

/** Up to 20 simultaneous indicators is a UI limit; the registry itself is unbounded. */
export const MAX_SIMULTANEOUS_INDICATORS = 20;
