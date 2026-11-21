/**
 * Static indicator catalog for the UI. The names are neutral, industry-standard
 * technical-analysis names. The pure computations live in @trade/indicators;
 * this catalog only drives the picker, the settings dialog and the list.
 * `defaultPeriod: null` means the indicator has no single period setting.
 */
export type IndicatorGroup = 'overlays' | 'oscillators' | 'structure';

export interface IndicatorCatalogEntry {
  kind: string;
  name: string;
  group: IndicatorGroup;
  defaultPeriod: number | null;
  defaultColor: string;
  description: string;
}

export const INDICATOR_CATALOG: readonly IndicatorCatalogEntry[] = [
  // Overlays
  { kind: 'sma', name: 'Moving Average (SMA)', group: 'overlays', defaultPeriod: 50, defaultColor: '#2563eb', description: 'Simple moving average.' },
  { kind: 'ema', name: 'Moving Average (EMA)', group: 'overlays', defaultPeriod: 20, defaultColor: '#f59e0b', description: 'Exponential moving average.' },
  { kind: 'wma', name: 'Moving Average (WMA)', group: 'overlays', defaultPeriod: 20, defaultColor: '#8b5cf6', description: 'Weighted moving average.' },
  { kind: 'hma', name: 'Hull Moving Average', group: 'overlays', defaultPeriod: 16, defaultColor: '#06b6d4', description: 'Hull moving average.' },
  { kind: 'bollinger', name: 'Bollinger Bands', group: 'overlays', defaultPeriod: 20, defaultColor: '#2563eb', description: 'Volatility bands around a moving average.' },
  { kind: 'keltner', name: 'Keltner Channel', group: 'overlays', defaultPeriod: 20, defaultColor: '#0ea5e9', description: 'ATR-based channel.' },
  { kind: 'donchian', name: 'Donchian Channel', group: 'overlays', defaultPeriod: 20, defaultColor: '#64748b', description: 'Highest-high / lowest-low channel.' },
  { kind: 'ichimoku', name: 'Ichimoku Cloud', group: 'overlays', defaultPeriod: 9, defaultColor: '#ef4444', description: 'Ichimoku Cloud.' },
  { kind: 'supertrend', name: 'Supertrend', group: 'overlays', defaultPeriod: 10, defaultColor: '#16a34a', description: 'ATR-based trend overlay.' },
  { kind: 'parabolic-sar', name: 'Parabolic SAR', group: 'overlays', defaultPeriod: 2, defaultColor: '#db2777', description: 'Parabolic stop-and-reverse dots.' },
  { kind: 'vwap', name: 'VWAP (session-anchored)', group: 'overlays', defaultPeriod: null, defaultColor: '#f59e0b', description: 'Volume-weighted average price, anchored to the session.' },
  { kind: 'pivot-points', name: 'Pivot Points', group: 'overlays', defaultPeriod: null, defaultColor: '#64748b', description: 'Classic / Fibonacci / Camarilla pivots.' },
  { kind: 'ma-ribbon', name: 'Moving Average Ribbon', group: 'overlays', defaultPeriod: null, defaultColor: '#2563eb', description: 'Several moving averages plotted together.' },
  // Oscillators
  { kind: 'rsi', name: 'RSI', group: 'oscillators', defaultPeriod: 14, defaultColor: '#8b5cf6', description: 'Relative Strength Index.' },
  { kind: 'macd', name: 'MACD', group: 'oscillators', defaultPeriod: 12, defaultColor: '#2563eb', description: 'Moving Average Convergence Divergence.' },
  { kind: 'stochastic', name: 'Stochastic', group: 'oscillators', defaultPeriod: 14, defaultColor: '#06b6d4', description: 'Stochastic oscillator.' },
  { kind: 'stoch-rsi', name: 'Stochastic RSI', group: 'oscillators', defaultPeriod: 14, defaultColor: '#0ea5e9', description: 'Stochastic applied to RSI.' },
  { kind: 'cci', name: 'CCI', group: 'oscillators', defaultPeriod: 20, defaultColor: '#f59e0b', description: 'Commodity Channel Index.' },
  { kind: 'williams-r', name: 'Williams %R', group: 'oscillators', defaultPeriod: 14, defaultColor: '#db2777', description: 'Williams percent range.' },
  { kind: 'mfi', name: 'MFI', group: 'oscillators', defaultPeriod: 14, defaultColor: '#16a34a', description: 'Money Flow Index.' },
  { kind: 'adx', name: 'ADX / DMI', group: 'oscillators', defaultPeriod: 14, defaultColor: '#ef4444', description: 'Average Directional Index.' },
  { kind: 'atr', name: 'ATR', group: 'oscillators', defaultPeriod: 14, defaultColor: '#64748b', description: 'Average True Range.' },
  { kind: 'obv', name: 'OBV', group: 'oscillators', defaultPeriod: null, defaultColor: '#2563eb', description: 'On-Balance Volume.' },
  { kind: 'volume', name: 'Volume', group: 'oscillators', defaultPeriod: 20, defaultColor: '#64748b', description: 'Volume with moving average.' },
  { kind: 'awesome', name: 'Awesome Oscillator', group: 'oscillators', defaultPeriod: null, defaultColor: '#16a34a', description: 'Awesome Oscillator.' },
  { kind: 'cmf', name: 'Chaikin Money Flow', group: 'oscillators', defaultPeriod: 20, defaultColor: '#0ea5e9', description: 'Chaikin Money Flow.' },
  // Structure & analysis
  { kind: 'support-resistance', name: 'Support & Resistance', group: 'structure', defaultPeriod: null, defaultColor: '#2563eb', description: 'Auto-detected swing-pivot levels with strength scores.' },
  { kind: 'break-retest', name: 'Break & Retest', group: 'structure', defaultPeriod: null, defaultColor: '#16a34a', description: 'Breakout candle, retest zone and confirmation marker, with entry / stop / target guides.' },
  { kind: 'supply-demand', name: 'Supply & Demand Zones', group: 'structure', defaultPeriod: null, defaultColor: '#f59e0b', description: 'Auto-detected supply and demand zones.' },
  { kind: 'market-structure', name: 'Market Structure (HH/HL/LH/LL, BOS)', group: 'structure', defaultPeriod: null, defaultColor: '#64748b', description: 'Swing labels and break-of-structure markers.' },
  { kind: 'fibonacci', name: 'Fibonacci Retracement', group: 'structure', defaultPeriod: null, defaultColor: '#8b5cf6', description: 'Automatic retracement and extension levels.' },
  { kind: 'patterns', name: 'Candlestick Patterns', group: 'structure', defaultPeriod: null, defaultColor: '#db2777', description: 'Engulfing, pin bar, doji and more, as toggleable markers.' },
  { kind: 'divergence', name: 'Divergence (RSI / MACD)', group: 'structure', defaultPeriod: 14, defaultColor: '#ef4444', description: 'Regular and hidden divergence markers.' },
  { kind: 'channels', name: 'Trendlines & Channels', group: 'structure', defaultPeriod: null, defaultColor: '#0ea5e9', description: 'Auto-detected trendlines and parallel channels.' },
] as const;

export function catalogEntry(kind: string): IndicatorCatalogEntry | undefined {
  return INDICATOR_CATALOG.find((entry) => entry.kind === kind);
}
