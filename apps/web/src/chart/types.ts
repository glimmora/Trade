import type { Candle, Timeframe } from '@trade/core';

/** Chart rendering styles supported by the chart wrapper. */
export type ChartType =
  | 'candlestick'
  | 'hollow'
  | 'bar'
  | 'line'
  | 'area'
  | 'heikin-ashi'
  | 'baseline';

export const CHART_TYPES: readonly { id: ChartType; label: string }[] = [
  { id: 'candlestick', label: 'Candlestick' },
  { id: 'hollow', label: 'Hollow candles' },
  { id: 'bar', label: 'Bar (OHLC)' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'heikin-ashi', label: 'Heikin-Ashi' },
  { id: 'baseline', label: 'Baseline' },
] as const;

/** Price scale modes for the right-hand price axis. */
export type PriceScaleKind = 'linear' | 'log' | 'percentage';

export const PRICE_SCALES: readonly { id: PriceScaleKind; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'log', label: 'Logarithmic' },
  { id: 'percentage', label: 'Percentage' },
] as const;

/** Chart colour theme. 'system' is resolved by the app shell before it reaches the chart. */
export type ChartThemeName = 'dark' | 'light';

/** Line dash styles, in neutral terms shared by overlays and drawings. */
export type OverlayLineStyle =
  | 'solid'
  | 'dotted'
  | 'dashed'
  | 'large-dashed'
  | 'sparse-dotted';

/** OHLCV values for one candle, as shown in the crosshair legend. */
export interface OhlcvLegend {
  /** Candle open time, UTC seconds. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** close - open, in price units. */
  change: number;
  /** (close - open) / open * 100. */
  changePercent: number;
  /** True once the candle's period has fully elapsed. */
  isClosed: boolean;
}

/** Payload delivered to `onCrosshairMove`. All fields are null when the crosshair leaves the chart. */
export interface CrosshairMoveEvent {
  legend: OhlcvLegend | null;
  time: number | null;
  price: number | null;
}

/** Visible time range, in UTC seconds. */
export interface VisibleRange {
  from: number;
  to: number;
}

/** A single point of an indicator overlay series. */
export interface OverlayPoint {
  time: number;
  value: number;
  /** Optional per-bar colour (used by histogram overlays). */
  color?: string;
}

/** Kinds of indicator overlay series the chart can render. */
export type OverlayKind = 'line' | 'area' | 'histogram';

/**
 * Descriptor for one indicator overlay series.
 * The chart owns rendering only; indicator values are computed elsewhere
 * (indicator package / worker) and passed in as points.
 */
export interface OverlaySeriesDescriptor {
  id: string;
  kind: OverlayKind;
  title: string;
  color: string;
  lineWidth?: number;
  lineStyle?: OverlayLineStyle;
  /**
   * Price scale id. Defaults to 'right'. Use 'volume' for volume histograms,
   * which the chart renders on a dedicated lower scale.
   */
  priceScaleId?: string;
  visible?: boolean;
  data: readonly OverlayPoint[];
}

/** Drawing primitives the chart can render without depending on the drawings package. */
export type DrawingOverlayKind = 'hline' | 'price-label' | 'segment';

/**
 * Descriptor for one drawing overlay.
 * - `hline` / `price-label`: a horizontal price line at `price`.
 * - `segment`: a straight line from (`time`, `price`) to (`time2`, `price2`).
 * Richer shapes (channels, rectangles, fans, pitchforks) are rendered by the
 * drawings layer as overlay series; this type covers only the primitives
 * the chart wrapper itself needs.
 */
export interface DrawingOverlayDescriptor {
  id: string;
  kind: DrawingOverlayKind;
  title?: string;
  color: string;
  lineWidth?: number;
  lineStyle?: OverlayLineStyle;
  price?: number;
  time?: number;
  price2?: number;
  time2?: number;
  text?: string;
}

/** Props for the ChartView component. */
export interface ChartViewProps {
  /** Full candle history, sorted ascending by open time. Kept stable between live ticks. */
  candles: readonly Candle[];
  /** Display symbol, e.g. 'BTC/USDT'. */
  symbol: string;
  timeframe: Timeframe;
  chartType: ChartType;
  priceScale: PriceScaleKind;
  theme: ChartThemeName;
  /** Decimal places used in the OHLCV legend. Defaults to 2. */
  precision?: number;
  /** Magnet mode: snap the crosshair to the nearest OHLC value. Defaults to false. */
  magnet?: boolean;
  /** Indicator overlay series (line / area / histogram). */
  overlays?: readonly OverlaySeriesDescriptor[];
  /** Drawing primitives (horizontal price lines, segments). */
  drawings?: readonly DrawingOverlayDescriptor[];
  /** Fit the time scale to the data when the symbol or timeframe changes. Defaults to true. */
  autoFit?: boolean;
  onCrosshairMove?: (event: CrosshairMoveEvent) => void;
  onVisibleRangeChange?: (range: VisibleRange | null) => void;
}

/** Imperative handle exposed by ChartView via ref. */
export interface ChartHandle {
  /** Fit the visible time range to all loaded data. */
  fitContent: () => void;
  /**
   * Apply one live tick. Updates the forming candle in place when the tick
   * belongs to it, appends a new candle when a new period starts, and
   * ignores out-of-order ticks. Never rebuilds the whole series.
   */
  applyTick: (tick: Candle) => 'updated' | 'appended' | 'ignored';
  /** Render the chart to a canvas, or null when screenshots are unavailable. */
  takeScreenshot: () => HTMLCanvasElement | null;
  /** Download the chart as a PNG file. Returns true when the download started. */
  downloadPng: (filename?: string) => boolean;
  /** Request fullscreen for the chart container. */
  requestFullscreen: () => void;
}
