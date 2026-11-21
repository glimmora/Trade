# Chart engine

React wrapper around the Lightweight Charts library (Apache-2.0; the required
attribution is preserved in the repo `NOTICE` file and in the built bundle).
This directory is the only place that imports the charting library, so the
app shell can code-split it into its own chunk — `vite.config.ts` already
maps `lightweight-charts` to a `charts` manual chunk.

## Files

- `ChartView.tsx` — the React component. Owns the chart instance, the main
  price series, overlay series and drawing primitives. It does not fetch
  data or compute indicators.
- `types.ts` — `ChartType`, `PriceScaleKind`, `ChartViewProps`, `ChartHandle`,
  overlay / drawing descriptors, `OhlcvLegend`, `CrosshairMoveEvent`.
- `series.ts` — main-series factory for all 7 chart types, Heikin-Ashi
  conversion, overlay-series factory, price-scale modes.
- `themes.ts` — dark / light chart palettes and full chart options.
- `live.ts` — incremental live-tick merging, forming vs closed candle status,
  reconnect-safe resync.
- `layouts.ts` — multi-chart layout configs (`1`, `2`, `2x2`) and the
  mobile single-chart collapse.
- `export.ts` — PNG screenshot / download and fullscreen helpers.
- `index.ts` — barrel exports.

## Wiring it into the app shell (UI agent)

Do not import `ChartView` statically from `App.tsx` — lazy-load it so the
charting library stays out of the initial bundle:

```tsx
import { lazy, Suspense, useRef } from 'react';
import type { ChartHandle } from './chart/ChartView';

const ChartView = lazy(() =>
  import('./chart/ChartView').then((module) => ({ default: module.ChartView })),
);

function ChartPane(props: { candles: Candle[]; /* ... */ }) {
  const chartRef = useRef<ChartHandle | null>(null);
  return (
    <Suspense fallback={<div>Loading chart…</div>}>
      <ChartView
        ref={chartRef}
        candles={props.candles}
        symbol="BTC/USDT"
        timeframe="1h"
        chartType="candlestick"
        priceScale="linear"
        theme="dark"
        precision={2}
        magnet={false}
        overlays={[]}
        drawings={[]}
        autoFit
        onCrosshairMove={(event) => {
          // event.legend is the hovered candle's OHLCV (null when the
          // crosshair leaves the chart); event.price is the crosshair price.
        }}
        onVisibleRangeChange={(range) => {
          // range is { from, to } in UTC seconds, or null.
        }}
      />
    </Suspense>
  );
}
```

Notes:

- The container must have a definite size (the component fills 100% of its
  parent). `ResizeObserver` keeps the chart fitted on resize.
- `theme` is `'dark' | 'light'` — resolve `'system'` in the shell first
  (as `App.tsx` already does) and pass the resolved value. Theme changes
  apply instantly without recreating the chart or its series.
- `chartType`, `priceScale` and `magnet` are applied in place where
  possible; changing `chartType` rebuilds only the main series (overlays
  survive, price lines are recreated automatically).

## Live ticks (providers agent)

Keep the `candles` prop referentially stable between ticks and drive ticks
through the imperative handle — never pass a new candles array per tick:

```ts
// On a new tick from the provider:
chartRef.current?.applyTick(tickCandle);
// Returns 'updated' (forming candle), 'appended' (new period) or
// 'ignored' (out-of-order tick).

// After a reconnect or provider switch, reload history, then:
chartRef.current?.fitContent();
```

`applyLiveTick` / `mergeLiveTick` / `resyncSeries` in `live.ts` are the
underlying pure helpers; `candleStatus(candle, timeframe)` reports
`'forming' | 'closed'` from the candle's own open time, so provider clock
skew cannot misclassify a candle.

## Chart types and scales

- Candlestick, hollow candles (rising bodies transparent with a solid
  border), bar (OHLC), line, area, Heikin-Ashi (converted from source
  candles with `computeHeikinAshi`, incrementally updated per tick), and
  baseline (baseline value tracks the first loaded candle's close).
- Price scales: linear, log (falls back to linear if any loaded candle has
  a non-positive low), percentage (percent change from the first visible
  bar). The price scale stays on the right; the time scale auto-fits on
  symbol / timeframe change when `autoFit` is set.

## Overlays and drawings

- Indicator overlays are descriptors: `{ id, kind: 'line' | 'area' |
  'histogram', title, color, lineWidth, lineStyle, priceScaleId, data }`.
  They are diffed by `id`; value updates reuse the series. Changing a
  descriptor's kind or colour requires a new `id`. Use
  `priceScaleId: 'volume'` for volume histograms (rendered on a dedicated
  lower scale).
- Drawing primitives are descriptors: `hline` / `price-label` (a horizontal
  price line at `price`) and `segment` (a two-point line). Richer shapes
  (channels, rectangles, fans, pitchforks) belong to the drawings layer and
  should be rendered as overlay series or segments, not in this directory.

## Multi-chart layouts

```ts
import { CHART_LAYOUTS, effectiveLayout, layoutGridStyle } from './chart/layouts';

const layoutId = effectiveLayout(selectedLayout, window.innerWidth); // '1' below 768px
<div style={layoutGridStyle(layoutId)}>{/* one <ChartView> per cell */}</div>
```

Each pane needs its own `ChartView` instance (and its own ref); layouts
only describe the grid.

## Export and fullscreen

```ts
chartRef.current?.takeScreenshot(); // HTMLCanvasElement | null
chartRef.current?.downloadPng('btc-usdt-1h.png'); // boolean
chartRef.current?.requestFullscreen();
```

`export.ts` also exposes standalone `takeChartScreenshot`,
`chartScreenshotDataUrl`, `downloadChartPng`, `requestFullscreen`,
`exitFullscreen` and `isFullscreen` for use without a component ref.

## Bundle

Only this directory imports the charting library. Keep it that way — do not
import it from components, providers or indicators code, or the code-split
chunking in `vite.config.ts` stops working.
