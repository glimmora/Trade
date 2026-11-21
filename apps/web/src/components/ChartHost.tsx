import { lazy, Suspense, useCallback } from 'react';
import type { Candle } from '@trade/core';
import { SYMBOLS } from '@trade/core';
import type { ChartHandle } from '../chart/types';
import { registerPrimaryChart } from '../lib/chartHandle';
import { resolveTheme, useApp } from '../store/state';

/**
 * Chart host: renders the real ChartView, lazy-loaded so the charting
 * library stays out of the initial bundle (per the chart engine's wiring
 * notes) and code-splits into its own chunk.
 *
 * Candles are empty until the provider agent wires live data in — ChartView
 * honestly shows "No data" until then. The empty array is a module constant
 * so its identity stays stable and the chart is never rebuilt per tick.
 * Only the primary panel (index 0) registers its imperative handle, which
 * the shell uses for PNG export / fullscreen.
 */
const ChartView = lazy(() =>
  import('../chart/ChartView').then((module) => ({ default: module.ChartView })),
);

const EMPTY_CANDLES: readonly Candle[] = [];

export function ChartHost({
  panelLabel,
  isPrimary,
}: {
  panelLabel: string;
  isPrimary: boolean;
}): JSX.Element {
  const { state, translate } = useApp();
  const symbol = SYMBOLS.find((entry) => entry.id === state.symbol);
  const precision = symbol ? symbol.precision : 2;

  const setHandle = useCallback(
    (handle: ChartHandle | null) => {
      if (isPrimary) registerPrimaryChart(handle);
    },
    [isPrimary],
  );

  return (
    <div
      className="chart-container"
      data-testid="chart"
      role="region"
      aria-label={`${panelLabel}: ${state.symbol} ${state.timeframe}`}
    >
      <Suspense
        fallback={
          <div className="chart-loading" role="status">
            {translate('loadingChart')}
          </div>
        }
      >
        <ChartView
          ref={setHandle}
          candles={EMPTY_CANDLES}
          symbol={state.symbol}
          timeframe={state.timeframe}
          chartType={state.chartType}
          priceScale={state.priceScale}
          theme={resolveTheme(state.theme)}
          precision={precision}
          magnet={state.magnet}
        />
      </Suspense>
    </div>
  );
}
