import type { ChartHandle } from '../chart/types';

/**
 * Registry for the primary (first) chart panel's imperative handle.
 * The app shell uses it for chart-wide actions — PNG export and fullscreen —
 * without prop-drilling a ref through the layout. Only panel 0 registers.
 * StrictMode double-mounts clear and re-register the handle, so this never
 * holds a handle to a destroyed chart.
 */
let primaryChart: ChartHandle | null = null;

export function registerPrimaryChart(handle: ChartHandle | null): void {
  primaryChart = handle;
}

export function getPrimaryChart(): ChartHandle | null {
  return primaryChart;
}
