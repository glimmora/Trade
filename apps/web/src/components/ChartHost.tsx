import { lazy, Suspense, useCallback, useMemo } from 'react';
import { SYMBOLS } from '@trade/core';
import type { ChartHandle } from '../chart/types';
import { registerPrimaryChart } from '../lib/chartHandle';
import { computeIndicatorOverlays } from '../lib/indicatorOverlays';
import { useMarketData } from '../lib/useMarketData';
import { resolveTheme, useApp } from '../store/state';

/**
 * Chart host: renders the real ChartView, lazy-loaded so the charting
 * library stays out of the initial bundle (per the chart engine's wiring
 * notes) and code-splits into its own chunk.
 *
 * Candles come from the market-data hook; visible indicators are computed
 * into overlay descriptors on every candle / indicator change. Only the
 * primary panel (index 0) registers its imperative handle, which the shell
 * uses for PNG export / fullscreen.
 */
const ChartView = lazy(() =>
  import('../chart/ChartView').then((module) => ({ default: module.ChartView })),
);

export function ChartHost({
  panelLabel,
  isPrimary,
}: {
  panelLabel: string;
  isPrimary: boolean;
}): JSX.Element {
  const { state, translate } = useApp();
  const { candles } = useMarketData();
  const overlays = useMemo(
    () => computeIndicatorOverlays(candles, state.indicators),
    [candles, state.indicators],
  );
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
          candles={candles}
          overlays={overlays}
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
