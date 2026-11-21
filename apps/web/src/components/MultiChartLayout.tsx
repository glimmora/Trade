import { useApp } from '../store/state';
import { ChartHost } from './ChartHost';

/**
 * Multi-chart layout. Desktop: 1, 2 side-by-side, or 2×2. Mobile: always a
 * single chart (CSS collapses the grid). All panels currently mirror the same
 * symbol/timeframe; per-panel symbol selection is a follow-up once the chart
 * engine owns per-panel state.
 */
export function MultiChartLayout(): React.JSX.Element {
  const { state } = useApp();
  const count = state.layout === '1' ? 1 : state.layout === '2' ? 2 : 4;
  const panels = Array.from({ length: count }, (_, index) => index);
  return (
    <div className={`multi-chart multi-chart-${String(count)}`} role="region" aria-label="Charts">
      {panels.map((index) => (
        <div key={index} className="chart-panel">
          <div className="chart-panel-header">
            <span>
              {state.symbol} · {state.timeframe}
            </span>
            <span className="chart-panel-index">
              {index + 1}/{count}
            </span>
          </div>
          <ChartHost panelLabel={`Chart ${String(index + 1)}`} isPrimary={index === 0} />
        </div>
      ))}
    </div>
  );
}
