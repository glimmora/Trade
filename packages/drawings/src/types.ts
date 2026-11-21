/**
 * Drawing model types for the Trade charting terminal.
 *
 * Pure data model only: no DOM, no chart library, no I/O. All geometry
 * lives in time/price anchor space, so a drawing is stored per symbol and
 * is timeframe-agnostic — the same anchors render on any timeframe.
 */

export interface AnchorPoint {
  /** Candle open time, in UTC seconds. */
  time: number;
  /** Price at the anchor. */
  price: number;
}

export type DrawingType =
  | 'trend-line'
  | 'ray'
  | 'extended-line'
  | 'horizontal-line'
  | 'horizontal-ray'
  | 'vertical-line'
  | 'parallel-channel'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'polyline'
  | 'brush'
  | 'arrow'
  | 'text-label'
  | 'price-label'
  | 'price-range'
  | 'date-range'
  | 'date-price-range'
  | 'measure'
  | 'fib-retracement'
  | 'fib-extension'
  | 'fib-channel'
  | 'fib-timezones'
  | 'fib-fan'
  | 'fib-arcs'
  | 'gann-fan'
  | 'gann-box'
  | 'pitchfork'
  | 'regression-trend'
  | 'long-position'
  | 'short-position'
  | 'anchored-vwap'
  | 'callout'
  | 'flag';

export const DRAWING_TYPES: readonly DrawingType[] = [
  'trend-line',
  'ray',
  'extended-line',
  'horizontal-line',
  'horizontal-ray',
  'vertical-line',
  'parallel-channel',
  'rectangle',
  'ellipse',
  'triangle',
  'polyline',
  'brush',
  'arrow',
  'text-label',
  'price-label',
  'price-range',
  'date-range',
  'date-price-range',
  'measure',
  'fib-retracement',
  'fib-extension',
  'fib-channel',
  'fib-timezones',
  'fib-fan',
  'fib-arcs',
  'gann-fan',
  'gann-box',
  'pitchfork',
  'regression-trend',
  'long-position',
  'short-position',
  'anchored-vwap',
  'callout',
  'flag',
] as const;

export type DashStyle = 'solid' | 'dashed' | 'dotted';

export interface DrawingStyle {
  /** Stroke colour, CSS colour string. */
  color: string;
  /** Overall opacity, 0–1. */
  opacity: number;
  /** Stroke thickness in pixels. */
  thickness: number;
  /** Stroke dash pattern. */
  dash: DashStyle;
  /** Fill colour for closed shapes; omitted means no fill. */
  fill?: string;
  /** Font size in pixels for text-based tools. */
  fontSize?: number;
  /** Whether level / measurement labels are shown. */
  showLabels?: boolean;
}

export type PositionDirection = 'long' | 'short';

/** Pure inputs for the long/short position tool (risk-reward box). */
export interface PositionToolData {
  direction: PositionDirection;
  /** Entry price. */
  entry: number;
  /** Stop-loss price. */
  stop: number;
  /** Take-profit price. */
  target: number;
  /** Amount of account currency risked on the trade, if known. */
  riskAmount?: number;
  /** Account size in account currency, if known. */
  accountSize?: number;
}

export type FibKind = 'retracement' | 'extension';

export interface DrawingObject {
  /** Stable unique id (UUID when available). */
  id: string;
  /** Symbol the drawing belongs to, e.g. "BTC/USDT". */
  symbol: string;
  type: DrawingType;
  /**
   * Time/price anchors. Meaning depends on the tool; see TOOL_POINTS.
   * Stored per symbol and timeframe-agnostic.
   */
  points: AnchorPoint[];
  style: DrawingStyle;
  locked: boolean;
  hidden: boolean;
  /** Higher values render on top. */
  zIndex: number;
  /** Unix epoch milliseconds. */
  createdAt: number;
  /** Unix epoch milliseconds. */
  updatedAt: number;
  /** Text content for text-label / callout / flag / price-label tools. */
  label?: string;
  /** Position-tool inputs (long-position / short-position only). */
  position?: PositionToolData;
  /** Fibonacci mode for fib-retracement / fib-extension tools. */
  fibKind?: FibKind;
}

/** Minimum / maximum anchor counts per tool. `max: null` means unbounded. */
export interface ToolPointSpec {
  min: number;
  max: number | null;
}

export const TOOL_POINTS: Readonly<Record<DrawingType, ToolPointSpec>> = {
  'trend-line': { min: 2, max: 2 },
  ray: { min: 2, max: 2 },
  'extended-line': { min: 2, max: 2 },
  'horizontal-line': { min: 1, max: 1 },
  'horizontal-ray': { min: 1, max: 1 },
  'vertical-line': { min: 1, max: 1 },
  'parallel-channel': { min: 3, max: 3 },
  rectangle: { min: 2, max: 2 },
  ellipse: { min: 2, max: 2 },
  triangle: { min: 3, max: 3 },
  polyline: { min: 2, max: null },
  brush: { min: 2, max: null },
  arrow: { min: 2, max: 2 },
  'text-label': { min: 1, max: 1 },
  'price-label': { min: 1, max: 1 },
  'price-range': { min: 2, max: 2 },
  'date-range': { min: 2, max: 2 },
  'date-price-range': { min: 2, max: 2 },
  measure: { min: 2, max: 2 },
  'fib-retracement': { min: 2, max: 2 },
  'fib-extension': { min: 2, max: 2 },
  'fib-channel': { min: 2, max: 2 },
  'fib-timezones': { min: 2, max: 2 },
  'fib-fan': { min: 2, max: 2 },
  'fib-arcs': { min: 2, max: 2 },
  'gann-fan': { min: 2, max: 2 },
  'gann-box': { min: 2, max: 2 },
  pitchfork: { min: 3, max: 3 },
  'regression-trend': { min: 2, max: null },
  'long-position': { min: 3, max: 3 },
  'short-position': { min: 3, max: 3 },
  'anchored-vwap': { min: 1, max: 1 },
  callout: { min: 1, max: 1 },
  flag: { min: 1, max: 1 },
};

/** Tools whose geometry is a single price level (horizontal). */
export const PRICE_LEVEL_TOOLS: readonly DrawingType[] = [
  'horizontal-line',
  'horizontal-ray',
  'price-label',
] as const;

/** Tools whose geometry is a single time level (vertical). */
export const TIME_LEVEL_TOOLS: readonly DrawingType[] = ['vertical-line', 'date-range'] as const;

export const DEFAULT_STYLE: DrawingStyle = {
  color: '#2962ff',
  opacity: 1,
  thickness: 2,
  dash: 'solid',
};

/** Default style per tool family (fills for closed shapes, thinner lines). */
export function defaultStyleFor(type: DrawingType): DrawingStyle {
  const base: DrawingStyle = { ...DEFAULT_STYLE };
  switch (type) {
    case 'rectangle':
    case 'ellipse':
    case 'triangle':
    case 'gann-box':
    case 'parallel-channel':
      return { ...base, fill: 'rgba(41, 98, 255, 0.10)' };
    case 'long-position':
      return { ...base, color: '#089981', fill: 'rgba(8, 153, 129, 0.15)' };
    case 'short-position':
      return { ...base, color: '#f23645', fill: 'rgba(242, 54, 69, 0.15)' };
    case 'text-label':
    case 'callout':
    case 'flag':
    case 'price-label':
      return { ...base, fontSize: 13, showLabels: true };
    case 'fib-retracement':
    case 'fib-extension':
    case 'fib-channel':
    case 'fib-timezones':
    case 'fib-fan':
    case 'fib-arcs':
      return { ...base, thickness: 1, showLabels: true };
    case 'brush':
      return { ...base, thickness: 3 };
    default:
      return base;
  }
}

export interface CreateDrawingInput {
  symbol: string;
  type: DrawingType;
  points: AnchorPoint[];
  style?: Partial<DrawingStyle>;
  label?: string;
  position?: PositionToolData;
  fibKind?: FibKind;
  zIndex?: number;
  /** Explicit id (tests / import). Generated when omitted. */
  id?: string;
  /** Explicit timestamps (tests / import). Now when omitted. */
  createdAt?: number;
  updatedAt?: number;
}

let fallbackIdCounter = 0;

/** Generate a stable unique id without depending on Node or DOM APIs. */
export function createDrawingId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoObj?.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  fallbackIdCounter += 1;
  return `drawing-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}-${Math.floor(
    Math.random() * 0xffff,
  ).toString(16)}`;
}

/**
 * Validate anchor counts for a tool. Returns an error message, or null
 * when the point list is valid for the tool.
 */
export function validatePoints(type: DrawingType, points: readonly AnchorPoint[]): string | null {
  const spec = TOOL_POINTS[type];
  if (points.length < spec.min) {
    return `${type} needs at least ${String(spec.min)} point(s), got ${String(points.length)}`;
  }
  if (spec.max !== null && points.length > spec.max) {
    return `${type} needs at most ${String(spec.max)} point(s), got ${String(points.length)}`;
  }
  for (const point of points) {
    if (!Number.isFinite(point.time) || !Number.isFinite(point.price)) {
      return `${type} has a non-finite anchor point`;
    }
  }
  return null;
}

/** Build a DrawingObject, filling defaults. Throws on an invalid point list. */
export function createDrawingObject(input: CreateDrawingInput): DrawingObject {
  const error = validatePoints(input.type, input.points);
  if (error !== null) {
    throw new Error(`Invalid drawing: ${error}`);
  }
  const now = Date.now();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? createdAt;
  const style: DrawingStyle = {
    ...defaultStyleFor(input.type),
    ...(input.style ?? {}),
  };
  const obj: DrawingObject = {
    id: input.id ?? createDrawingId(),
    symbol: input.symbol,
    type: input.type,
    points: input.points.map((p) => ({ time: p.time, price: p.price })),
    style,
    locked: false,
    hidden: false,
    zIndex: input.zIndex ?? 0,
    createdAt,
    updatedAt,
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.position !== undefined ? { position: { ...input.position } } : {}),
    ...(input.fibKind !== undefined ? { fibKind: input.fibKind } : {}),
  };
  return obj;
}

/** Whether a drawing is a long/short position tool. */
export function isPositionTool(type: DrawingType): boolean {
  return type === 'long-position' || type === 'short-position';
}

/** Whether a drawing is one of the Fibonacci tools. */
export function isFibonacciTool(type: DrawingType): boolean {
  return (
    type === 'fib-retracement' ||
    type === 'fib-extension' ||
    type === 'fib-channel' ||
    type === 'fib-timezones' ||
    type === 'fib-fan' ||
    type === 'fib-arcs'
  );
}

/** Sort a copy of the objects by z-index (lowest first = drawn first). */
export function sortByZIndex(objects: readonly DrawingObject[]): DrawingObject[] {
  return [...objects].sort((a, b) => a.zIndex - b.zIndex);
}
