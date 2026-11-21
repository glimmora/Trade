import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CrosshairMode, createChart } from 'lightweight-charts';
import type { IChartApi, IPriceLine, MouseEventParams, Time } from 'lightweight-charts';
import type { Candle, Timeframe } from '@trade/core';
import {
  downloadChartPng,
  requestFullscreen as requestElementFullscreen,
  takeChartScreenshot,
} from './export';
import { applyLiveTick, candleStatus } from './live';
import type { LiveTickResult } from './live';
import {
  applyPriceScaleMode,
  createMainSeries,
  createOverlaySeries,
  toLineStyle,
  toLineWidth,
} from './series';
import type { MainSeriesHandle, OverlayHandle } from './series';
import { chartOptionsForTheme } from './themes';
import type { ChartHandle, ChartViewProps, OhlcvLegend } from './types';

function lastCandle(candles: readonly Candle[]): Candle | undefined {
  return candles[candles.length - 1];
}

function legendFromCandle(
  candle: Candle | undefined,
  timeframe: Timeframe,
): OhlcvLegend | null {
  if (candle === undefined) {
    return null;
  }
  const change = candle.close - candle.open;
  return {
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    change,
    changePercent: candle.open === 0 ? 0 : (change / candle.open) * 100,
    isClosed: candleStatus(candle, timeframe) === 'closed',
  };
}

/**
 * React wrapper around the charting library.
 *
 * Ownership: this component owns the chart instance, the main price series,
 * overlay series and drawing primitives. It does not fetch data, compute
 * indicators, or manage app state — the parent supplies candles and
 * descriptors, and drives live ticks through the imperative handle
 * (`ref.current.applyTick(tick)`) so the series is never rebuilt per tick.
 *
 * The `candles` prop must stay referentially stable between live ticks;
 * a new array means "new history was loaded" and triggers a full `setData`.
 * Mounting is safe under StrictMode: creation and teardown both run in
 * effects, so a double mount creates and destroys two chart instances.
 */
export const ChartView = forwardRef<ChartHandle, ChartViewProps>(function ChartView(
  props,
  ref,
) {
  const { candles, symbol, timeframe, chartType, priceScale, theme } = props;
  const precision = props.precision ?? 2;
  const magnet = props.magnet ?? false;
  const autoFit = props.autoFit ?? true;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<MainSeriesHandle | null>(null);
  const overlaySeriesRef = useRef(new Map<string, OverlayHandle>());
  const segmentSeriesRef = useRef(new Map<string, OverlayHandle>());
  const priceLinesRef = useRef(new Map<string, IPriceLine>());
  const candlesRef = useRef<readonly Candle[]>(candles);
  const themeRef = useRef(theme);
  const timeframeRef = useRef(timeframe);
  const autoFitRef = useRef(autoFit);
  const seriesEpochRef = useRef(0);
  const drawingsEpochRef = useRef(0);
  const lastFitKeyRef = useRef<string | null>(null);
  const callbacksRef = useRef({
    onCrosshairMove: props.onCrosshairMove,
    onVisibleRangeChange: props.onVisibleRangeChange,
  });
  const [legend, setLegend] = useState<OhlcvLegend | null>(() =>
    legendFromCandle(lastCandle(candles), timeframe),
  );

  // Keep mutable refs in sync with the latest props without re-running
  // the chart lifecycle effects.
  useEffect(() => {
    themeRef.current = theme;
    timeframeRef.current = timeframe;
    autoFitRef.current = autoFit;
    callbacksRef.current = {
      onCrosshairMove: props.onCrosshairMove,
      onVisibleRangeChange: props.onVisibleRangeChange,
    };
  });

  // Create the chart once per mount. ResizeObserver keeps it fitted to the
  // container; everything else is applied by the effects below.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const width = container.clientWidth > 0 ? container.clientWidth : 600;
    const height = container.clientHeight > 0 ? container.clientHeight : 400;
    const chart = createChart(container, chartOptionsForTheme(themeRef.current, width, height));
    chartRef.current = chart;

    const onCrosshair = (param: MouseEventParams<Time>): void => {
      const time = typeof param.time === 'number' ? param.time : null;
      if (time === null || param.point === undefined) {
        setLegend(legendFromCandle(lastCandle(candlesRef.current), timeframeRef.current));
        callbacksRef.current.onCrosshairMove?.({ legend: null, time: null, price: null });
        return;
      }
      const candle = candlesRef.current.find((item) => item.time === time);
      const legendValue = legendFromCandle(candle, timeframeRef.current);
      let price: number | null = legendValue === null ? null : legendValue.close;
      for (const item of param.seriesData.values()) {
        if ('close' in item) {
          price = item.close;
          break;
        }
        if ('value' in item) {
          price = item.value;
          break;
        }
      }
      if (legendValue !== null) {
        setLegend(legendValue);
      }
      callbacksRef.current.onCrosshairMove?.({ legend: legendValue, time, price });
    };

    const onVisibleRange = (range: { from: Time; to: Time } | null): void => {
      if (range === null) {
        callbacksRef.current.onVisibleRangeChange?.(null);
        return;
      }
      const from = typeof range.from === 'number' ? range.from : null;
      const to = typeof range.to === 'number' ? range.to : null;
      if (from === null || to === null) {
        callbacksRef.current.onVisibleRangeChange?.(null);
        return;
      }
      callbacksRef.current.onVisibleRangeChange?.({ from, to });
    };

    chart.subscribeCrosshairMove(onCrosshair);
    chart.timeScale().subscribeVisibleTimeRangeChange(onVisibleRange);

    const observer = new ResizeObserver(() => {
      const element = containerRef.current;
      if (element === null) {
        return;
      }
      const nextWidth = element.clientWidth;
      const nextHeight = element.clientHeight;
      if (nextWidth > 0 && nextHeight > 0) {
        chart.resize(nextWidth, nextHeight);
      }
    });
    observer.observe(container);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onVisibleRange);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      overlaySeriesRef.current.clear();
      segmentSeriesRef.current.clear();
      priceLinesRef.current.clear();
    };
  }, []);

  // Theme changes are applied instantly via options; the chart and its
  // series are not recreated.
  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) {
      return;
    }
    const container = containerRef.current;
    const width =
      container === null || container.clientWidth === 0 ? 600 : container.clientWidth;
    const height =
      container === null || container.clientHeight === 0 ? 400 : container.clientHeight;
    chart.applyOptions(chartOptionsForTheme(theme, width, height));
    mainSeriesRef.current?.applyTheme(theme);
  }, [theme]);

  // Rebuild the main series when the chart type changes. Price lines die
  // with the old series and are recreated by the drawings effect, which
  // also depends on chartType.
  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) {
      return;
    }
    mainSeriesRef.current?.remove();
    priceLinesRef.current.clear();
    seriesEpochRef.current += 1;
    const handle = createMainSeries(chart, chartType, themeRef.current);
    mainSeriesRef.current = handle;
    handle.setData(candlesRef.current);
    if (autoFitRef.current) {
      chart.timeScale().fitContent();
    }
  }, [chartType]);

  // Full history load. A new array identity means new history; live ticks
  // must go through the imperative handle instead, so this does not run
  // per tick. Auto-fit runs only when the symbol or timeframe changes.
  useEffect(() => {
    const previous = candlesRef.current;
    candlesRef.current = candles;
    const series = mainSeriesRef.current;
    if (series !== null && previous !== candles) {
      series.setData(candles);
    }
    const key = `${symbol}:${timeframe}`;
    if (autoFit && lastFitKeyRef.current !== key) {
      chartRef.current?.timeScale().fitContent();
      lastFitKeyRef.current = key;
    }
    setLegend(legendFromCandle(lastCandle(candles), timeframe));
  }, [candles, symbol, timeframe, autoFit]);

  // Indicator overlays, diffed by descriptor id. Changing a descriptor's
  // kind or colour requires a new id; value updates reuse the series.
  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) {
      return;
    }
    const next = props.overlays ?? [];
    const current = overlaySeriesRef.current;
    for (const [id, handle] of [...current.entries()]) {
      if (!next.some((descriptor) => descriptor.id === id)) {
        handle.remove();
        current.delete(id);
      }
    }
    for (const descriptor of next) {
      const existing = current.get(descriptor.id);
      if (existing === undefined) {
        current.set(descriptor.id, createOverlaySeries(chart, descriptor));
      } else {
        existing.setData(descriptor.data);
      }
    }
  }, [props.overlays]);

  // Drawing primitives. Horizontal price lines live on the main series;
  // segments render as two-point line overlays and survive series rebuilds.
  useEffect(() => {
    const series = mainSeriesRef.current;
    const next = props.drawings ?? [];
    if (series !== null && drawingsEpochRef.current === seriesEpochRef.current) {
      for (const line of priceLinesRef.current.values()) {
        series.removePriceLine(line);
      }
    }
    priceLinesRef.current.clear();
    if (series !== null) {
      drawingsEpochRef.current = seriesEpochRef.current;
      for (const drawing of next) {
        if (
          (drawing.kind === 'hline' || drawing.kind === 'price-label') &&
          drawing.price !== undefined
        ) {
          const line = series.createPriceLine({
            price: drawing.price,
            color: drawing.color,
            lineWidth: toLineWidth(drawing.lineWidth, 1),
            lineStyle: toLineStyle(drawing.lineStyle),
            axisLabelVisible: true,
            lineVisible: true,
            axisLabelColor: drawing.color,
            axisLabelTextColor: '#ffffff',
            title: drawing.title ?? drawing.text ?? '',
          });
          priceLinesRef.current.set(drawing.id, line);
        }
      }
    }
    const segments = segmentSeriesRef.current;
    for (const handle of segments.values()) {
      handle.remove();
    }
    segments.clear();
    const chart = chartRef.current;
    if (chart !== null) {
      for (const drawing of next) {
        if (
          drawing.kind === 'segment' &&
          drawing.time !== undefined &&
          drawing.price !== undefined &&
          drawing.time2 !== undefined &&
          drawing.price2 !== undefined
        ) {
          segments.set(
            drawing.id,
            createOverlaySeries(chart, {
              id: `segment:${drawing.id}`,
              kind: 'line',
              title: drawing.title ?? '',
              color: drawing.color,
              lineWidth: drawing.lineWidth ?? 1,
              ...(drawing.lineStyle !== undefined
                ? { lineStyle: drawing.lineStyle }
                : {}),
              data: [
                { time: drawing.time, value: drawing.price },
                { time: drawing.time2, value: drawing.price2 },
              ],
            }),
          );
        }
      }
    }
  }, [props.drawings, chartType]);

  // Price scale mode on the right axis. Log mode falls back to linear when
  // the loaded candles contain a non-positive low (see series.ts).
  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) {
      return;
    }
    applyPriceScaleMode(chart, priceScale, candlesRef.current);
  }, [priceScale]);

  // Magnet mode: snap the crosshair to the nearest OHLC value.
  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) {
      return;
    }
    chart.applyOptions({
      crosshair: { mode: magnet ? CrosshairMode.Magnet : CrosshairMode.Normal },
    });
  }, [magnet]);

  useImperativeHandle(
    ref,
    () => ({
      fitContent: () => {
        chartRef.current?.timeScale().fitContent();
      },
      applyTick: (tick: Candle): LiveTickResult => {
        const series = mainSeriesRef.current;
        if (series === null) {
          return 'ignored';
        }
        const merged = applyLiveTick(series, candlesRef.current, tick);
        candlesRef.current = merged.candles;
        if (merged.result !== 'ignored') {
          setLegend(legendFromCandle(lastCandle(merged.candles), timeframeRef.current));
        }
        return merged.result;
      },
      takeScreenshot: () => {
        const chart = chartRef.current;
        return chart === null ? null : takeChartScreenshot(chart);
      },
      downloadPng: (filename?: string) => {
        const chart = chartRef.current;
        if (chart === null) {
          return false;
        }
        return filename === undefined
          ? downloadChartPng(chart)
          : downloadChartPng(chart, filename);
      },
      requestFullscreen: () => {
        const element = containerRef.current;
        if (element !== null) {
          void requestElementFullscreen(element);
        }
      },
    }),
    [ref],
  );

  const legendText =
    legend === null
      ? `${symbol} · ${timeframe}`
      : `${symbol} · ${timeframe} · O ${legend.open.toFixed(precision)} ` +
        `H ${legend.high.toFixed(precision)} L ${legend.low.toFixed(precision)} ` +
        `C ${legend.close.toFixed(precision)} ` +
        `(${legend.changePercent >= 0 ? '+' : ''}${legend.changePercent.toFixed(2)}%) ` +
        `Vol ${legend.volume.toFixed(2)}${legend.isClosed ? '' : ' · forming'}`;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
      role="img"
      aria-label={`Price chart for ${symbol}, ${timeframe}`}
      data-testid="chart-view"
    >
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          zIndex: 1,
          pointerEvents: 'none',
          fontSize: 12,
          lineHeight: 1.5,
          color: 'var(--text, #0f172a)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 'calc(100% - 24px)',
        }}
      >
        {legendText}
      </div>
      {candles.length === 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            color: 'var(--muted, #64748b)',
            fontSize: 13,
          }}
        >
          No data
        </div>
      ) : null}
    </div>
  );
});

ChartView.displayName = 'ChartView';
