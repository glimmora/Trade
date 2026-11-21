/** Multi-chart layout identifiers. */
export type ChartLayoutId = '1' | '2' | '2x2';

export interface ChartLayoutCell {
  /** Stable cell key, e.g. 'main', 'second', 'third'. */
  key: string;
  row: number;
  column: number;
}

export interface ChartLayout {
  id: ChartLayoutId;
  label: string;
  columns: number;
  rows: number;
  cells: readonly ChartLayoutCell[];
  gridTemplateColumns: string;
  gridTemplateRows: string;
}

export const CHART_LAYOUTS: Record<ChartLayoutId, ChartLayout> = {
  '1': {
    id: '1',
    label: 'Single chart',
    columns: 1,
    rows: 1,
    cells: [{ key: 'main', row: 0, column: 0 }],
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
  },
  '2': {
    id: '2',
    label: 'Two charts side by side',
    columns: 2,
    rows: 1,
    cells: [
      { key: 'main', row: 0, column: 0 },
      { key: 'second', row: 0, column: 1 },
    ],
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr',
  },
  '2x2': {
    id: '2x2',
    label: 'Four charts (2 by 2)',
    columns: 2,
    rows: 2,
    cells: [
      { key: 'main', row: 0, column: 0 },
      { key: 'second', row: 0, column: 1 },
      { key: 'third', row: 1, column: 0 },
      { key: 'fourth', row: 1, column: 1 },
    ],
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
  },
};

/** Number of chart panes in a layout. */
export function paneCount(layoutId: ChartLayoutId): number {
  return CHART_LAYOUTS[layoutId].cells.length;
}

/** CSS grid style for a layout container. */
export function layoutGridStyle(layoutId: ChartLayoutId): {
  display: 'grid';
  gridTemplateColumns: string;
  gridTemplateRows: string;
  gap: string;
} {
  const layout = CHART_LAYOUTS[layoutId];
  return {
    display: 'grid',
    gridTemplateColumns: layout.gridTemplateColumns,
    gridTemplateRows: layout.gridTemplateRows,
    gap: '8px',
  };
}

/** Viewport widths below this use a single chart, whatever layout is selected. */
export const SINGLE_CHART_BREAKPOINT_PX = 768;

/** True when the viewport is narrow enough that only one chart fits. */
export function isSingleChartViewport(viewportWidthPx: number): boolean {
  return viewportWidthPx < SINGLE_CHART_BREAKPOINT_PX;
}

/**
 * Effective layout for a viewport: multi-chart layouts collapse to a single
 * chart on narrow (mobile) viewports. The selected layout is preserved and
 * restored when the viewport widens again.
 */
export function effectiveLayout(
  layoutId: ChartLayoutId,
  viewportWidthPx: number,
): ChartLayoutId {
  return isSingleChartViewport(viewportWidthPx) ? '1' : layoutId;
}
