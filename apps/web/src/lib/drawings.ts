/** Drawing-tool definitions: id, neutral label, keyboard shortcut, group. */

export type DrawingToolGroup = 'lines' | 'shapes' | 'fibonacci' | 'position' | 'annotations';

export interface DrawingTool {
  id: string;
  label: string;
  shortcut: string | null;
  group: DrawingToolGroup;
}

export const DRAWING_TOOLS: readonly DrawingTool[] = [
  { id: 'trend-line', label: 'Trend line', shortcut: 'T', group: 'lines' },
  { id: 'ray', label: 'Ray', shortcut: null, group: 'lines' },
  { id: 'extended-line', label: 'Extended line', shortcut: null, group: 'lines' },
  { id: 'horizontal-line', label: 'Horizontal line', shortcut: 'H', group: 'lines' },
  { id: 'horizontal-ray', label: 'Horizontal ray', shortcut: null, group: 'lines' },
  { id: 'vertical-line', label: 'Vertical line', shortcut: 'V', group: 'lines' },
  { id: 'parallel-channel', label: 'Parallel channel', shortcut: null, group: 'lines' },
  { id: 'regression-trend', label: 'Regression trend', shortcut: null, group: 'lines' },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R', group: 'shapes' },
  { id: 'ellipse', label: 'Ellipse', shortcut: null, group: 'shapes' },
  { id: 'triangle', label: 'Triangle', shortcut: null, group: 'shapes' },
  { id: 'polyline', label: 'Path', shortcut: null, group: 'shapes' },
  { id: 'brush', label: 'Brush', shortcut: 'B', group: 'shapes' },
  { id: 'arrow', label: 'Arrow', shortcut: null, group: 'shapes' },
  { id: 'fib-retracement', label: 'Fibonacci retracement', shortcut: 'F', group: 'fibonacci' },
  { id: 'fib-extension', label: 'Fibonacci extension', shortcut: null, group: 'fibonacci' },
  { id: 'fib-channel', label: 'Fibonacci channel', shortcut: null, group: 'fibonacci' },
  { id: 'fib-timezones', label: 'Fibonacci time zones', shortcut: null, group: 'fibonacci' },
  { id: 'fib-fan', label: 'Fibonacci fan', shortcut: null, group: 'fibonacci' },
  { id: 'fib-arcs', label: 'Fibonacci arcs', shortcut: null, group: 'fibonacci' },
  { id: 'gann-fan', label: 'Gann fan', shortcut: null, group: 'fibonacci' },
  { id: 'gann-box', label: 'Gann box', shortcut: null, group: 'fibonacci' },
  { id: 'pitchfork', label: 'Pitchfork', shortcut: null, group: 'fibonacci' },
  { id: 'long-position', label: 'Long position', shortcut: 'L', group: 'position' },
  { id: 'short-position', label: 'Short position', shortcut: 'S', group: 'position' },
  { id: 'anchored-vwap', label: 'Anchored VWAP', shortcut: null, group: 'position' },
  { id: 'text', label: 'Text note', shortcut: 'X', group: 'annotations' },
  { id: 'price-label', label: 'Price label', shortcut: null, group: 'annotations' },
  { id: 'price-range', label: 'Price range', shortcut: null, group: 'annotations' },
  { id: 'date-range', label: 'Date range', shortcut: null, group: 'annotations' },
  { id: 'date-price-range', label: 'Date & price range', shortcut: null, group: 'annotations' },
  { id: 'measure', label: 'Measure', shortcut: 'M', group: 'annotations' },
  { id: 'callout', label: 'Callout', shortcut: null, group: 'annotations' },
  { id: 'flag', label: 'Flag mark', shortcut: null, group: 'annotations' },
] as const;

export function drawingTool(id: string): DrawingTool | undefined {
  return DRAWING_TOOLS.find((tool) => tool.id === id);
}

/** Two-letter glyph used on the tool buttons (no icon font dependency). */
export function toolGlyph(id: string): string {
  switch (id) {
    case 'trend-line':
      return '╱';
    case 'ray':
      return '↗';
    case 'extended-line':
      return '↔';
    case 'horizontal-line':
      return '—';
    case 'horizontal-ray':
      return '→';
    case 'vertical-line':
      return '|';
    case 'parallel-channel':
      return '═';
    case 'regression-trend':
      return '∿';
    case 'rectangle':
      return '▭';
    case 'ellipse':
      return '○';
    case 'triangle':
      return '△';
    case 'polyline':
      return '∿';
    case 'brush':
      return '✎';
    case 'arrow':
      return '➔';
    case 'fib-retracement':
      return 'ƒ';
    case 'fib-extension':
      return 'ƒ+';
    case 'fib-channel':
      return 'ƒ═';
    case 'fib-timezones':
      return 'ƒt';
    case 'fib-fan':
      return 'ƒ∠';
    case 'fib-arcs':
      return 'ƒ◠';
    case 'gann-fan':
      return 'G∠';
    case 'gann-box':
      return 'G▦';
    case 'pitchfork':
      return '⑂';
    case 'long-position':
      return 'L↑';
    case 'short-position':
      return 'S↓';
    case 'anchored-vwap':
      return 'V⚓';
    case 'text':
      return 'T';
    case 'price-label':
      return '$';
    case 'price-range':
      return '↕';
    case 'date-range':
      return '⇄';
    case 'date-price-range':
      return '⊞';
    case 'measure':
      return 'M↔';
    case 'callout':
      return '❝';
    case 'flag':
      return '⚑';
    default:
      return '•';
  }
}
