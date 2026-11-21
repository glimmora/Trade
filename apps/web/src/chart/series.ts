import { LineStyle, PriceScaleMode } from 'lightweight-charts';
import type {
  AreaData,
  BarData,
  BaselineData,
  CandlestickData,
  HistogramData,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  LineData,
  PriceLineOptions,
  UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '@trade/core';
import { CHART_PALETTES, candlestickColorsForTheme } from './themes';
import type {
  ChartThemeName,
  ChartType,
  OverlayLineStyle,
  OverlayPoint,
  OverlaySeriesDescriptor,
  PriceScaleKind,
} from './types';

/**
 * Handle for the main price series. It hides the concrete series type so
 * the React wrapper never has to juggle the library's generic series APIs,
 * and it owns Heikin-Ashi state so live ticks stay incremental.
 */
export interface MainSeriesHandle {
  setData: (candles: readonly Candle[]) => void;
  update: (candle: Candle) => void;
  applyTheme: (theme: ChartThemeName) => void;
  createPriceLine: (options: PriceLineOptions) => IPriceLine;
  removePriceLine: (line: IPriceLine) => void;
  remove: () => void;
}

/** Handle for one indicator overlay series. */
export interface OverlayHandle {
  setData: (data: readonly OverlayPoint[]) => void;
  remove: () => void;
}

export function toLineStyle(style: OverlayLineStyle | undefined): LineStyle {
  switch (style) {
    case 'dotted':
      return LineStyle.Dotted;
    case 'dashed':
      return LineStyle.Dashed;
    case 'large-dashed':
      return LineStyle.LargeDashed;
    case 'sparse-dotted':
      return LineStyle.SparseDotted;
    case 'solid':
    case undefined:
      return LineStyle.Solid;
  }
}

function toCandlestickBar(candle: Candle): CandlestickData<UTCTimestamp> {
  return {
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

export function toCandlestickData(
  candles: readonly Candle[],
): CandlestickData<UTCTimestamp>[] {
  return candles.map(toCandlestickBar);
}

export function toBarData(candles: readonly Candle[]): BarData<UTCTimestamp>[] {
  return candles.map(toCandlestickBar);
}

export function toLineData(candles: readonly Candle[]): LineData<UTCTimestamp>[] {
  return candles.map((candle) => ({ time: candle.time, value: candle.close }));
}

export function toAreaData(candles: readonly Candle[]): AreaData<UTCTimestamp>[] {
  return candles.map((candle) => ({ time: candle.time, value: candle.close }));
}

export function toBaselineData(
  candles: readonly Candle[],
): BaselineData<UTCTimestamp>[] {
  return candles.map((candle) => ({ time: candle.time, value: candle.close }));
}

/**
 * One Heikin-Ashi candle from a source candle and the previous Heikin-Ashi
 * candle. Pure function; the series handle keeps the running state.
 * HA close = (open + high + low + close) / 4.
 * HA open  = (previous HA open + previous HA close) / 2, seeded with
 * (open + close) / 2 for the first candle.
 */
export function heikinAshiNext(previousHa: Candle | null, candle: Candle): Candle {
  const haClose = (candle.open + candle.high + candle.low + candle.close) / 4;
  const haOpen =
    previousHa === null ? (candle.open + candle.close) / 2 : (previousHa.open + previousHa.close) / 2;
  return {
    time: candle.time,
    open: haOpen,
    high: Math.max(candle.high, haOpen, haClose),
    low: Math.min(candle.low, haOpen, haClose),
    close: haClose,
    volume: candle.volume,
  };
}

/** Convert a full candle history to Heikin-Ashi candles. Pure. */
export function computeHeikinAshi(candles: readonly Candle[]): Candle[] {
  const result: Candle[] = [];
  let previous: Candle | null = null;
  for (const candle of candles) {
    const next = heikinAshiNext(previous, candle);
    result.push(next);
    previous = next;
  }
  return result;
}

function commonHandle(
  chart: IChartApi,
  series: ISeriesApi<'Candlestick' | 'Bar' | 'Line' | 'Area' | 'Baseline'>,
  applyThemeImpl: (theme: ChartThemeName) => void,
  setDataImpl: (candles: readonly Candle[]) => void,
  updateImpl: (candle: Candle) => void,
): MainSeriesHandle {
  return {
    setData: setDataImpl,
    update: updateImpl,
    applyTheme: applyThemeImpl,
    createPriceLine: (options: PriceLineOptions) => series.createPriceLine(options),
    removePriceLine: (line: IPriceLine) => {
      series.removePriceLine(line);
    },
    remove: () => {
      chart.removeSeries(series);
    },
  };
}

/**
 * Create the main price series for a chart type.
 * - 'hollow': rising candles are drawn with a transparent body and a solid
 *   border (the library has no dedicated hollow-candle series).
 * - 'heikin-ashi': source candles are converted with `computeHeikinAshi`;
 *   live ticks update only the affected Heikin-Ashi candle.
 * - 'baseline': the baseline value tracks the first loaded candle's close.
 */
export function createMainSeries(
  chart: IChartApi,
  chartType: ChartType,
  theme: ChartThemeName,
): MainSeriesHandle {
  if (chartType === 'bar') {
    const series = chart.addBarSeries({
      upColor: CHART_PALETTES[theme].up,
      downColor: CHART_PALETTES[theme].down,
    });
    return commonHandle(
      chart,
      series,
      (nextTheme) => {
        series.applyOptions({
          upColor: CHART_PALETTES[nextTheme].up,
          downColor: CHART_PALETTES[nextTheme].down,
        });
      },
      (candles) => {
        series.setData(toBarData(candles));
      },
      (candle) => {
        series.update(toCandlestickBar(candle));
      },
    );
  }

  if (chartType === 'line') {
    const series = chart.addLineSeries({
      color: CHART_PALETTES[theme].accent,
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerRadius: 4,
    });
    return commonHandle(
      chart,
      series,
      (nextTheme) => {
        series.applyOptions({ color: CHART_PALETTES[nextTheme].accent });
      },
      (candles) => {
        series.setData(toLineData(candles));
      },
      (candle) => {
        series.update({ time: candle.time, value: candle.close });
      },
    );
  }

  if (chartType === 'area') {
    const palette = CHART_PALETTES[theme];
    const series = chart.addAreaSeries({
      lineColor: palette.accent,
      topColor: palette.areaTop,
      bottomColor: palette.areaBottom,
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerRadius: 4,
    });
    return commonHandle(
      chart,
      series,
      (nextTheme) => {
        const next = CHART_PALETTES[nextTheme];
        series.applyOptions({
          lineColor: next.accent,
          topColor: next.areaTop,
          bottomColor: next.areaBottom,
        });
      },
      (candles) => {
        series.setData(toAreaData(candles));
      },
      (candle) => {
        series.update({ time: candle.time, value: candle.close });
      },
    );
  }

  if (chartType === 'baseline') {
    const palette = CHART_PALETTES[theme];
    const series = chart.addBaselineSeries({
      baseValue: { type: 'price', price: 0 },
      topLineColor: palette.up,
      topFillColor1: palette.baselineTop,
      topFillColor2: 'transparent',
      bottomLineColor: palette.down,
      bottomFillColor1: palette.baselineBottom,
      bottomFillColor2: 'transparent',
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerRadius: 4,
    });
    return commonHandle(
      chart,
      series,
      (nextTheme) => {
        const next = CHART_PALETTES[nextTheme];
        series.applyOptions({
          topLineColor: next.up,
          topFillColor1: next.baselineTop,
          bottomLineColor: next.down,
          bottomFillColor1: next.baselineBottom,
        });
      },
      (candles) => {
        const first = candles[0];
        if (first !== undefined) {
          series.applyOptions({ baseValue: { type: 'price', price: first.close } });
        }
        series.setData(toBaselineData(candles));
      },
      (candle) => {
        series.update({ time: candle.time, value: candle.close });
      },
    );
  }

  // Candlestick, hollow candles and Heikin-Ashi all render on a candlestick
  // series; hollow uses a transparent rising body, Heikin-Ashi uses
  // converted candles.
  const colors = candlestickColorsForTheme(theme, chartType);
  const series = chart.addCandlestickSeries({
    upColor: colors.upColor,
    downColor: colors.downColor,
    borderVisible: true,
    borderUpColor: colors.borderUpColor,
    borderDownColor: colors.borderDownColor,
    wickUpColor: colors.wickUpColor,
    wickDownColor: colors.wickDownColor,
  });
  const applyTheme = (nextTheme: ChartThemeName): void => {
    const next = candlestickColorsForTheme(nextTheme, chartType);
    series.applyOptions({
      upColor: next.upColor,
      downColor: next.downColor,
      borderUpColor: next.borderUpColor,
      borderDownColor: next.borderDownColor,
      wickUpColor: next.wickUpColor,
      wickDownColor: next.wickDownColor,
    });
  };

  if (chartType === 'heikin-ashi') {
    let source: Candle[] = [];
    let ha: Candle[] = [];
    return commonHandle(
      chart,
      series,
      applyTheme,
      (candles) => {
        source = [...candles];
        ha = computeHeikinAshi(source);
        series.setData(toCandlestickData(ha));
      },
      (tick) => {
        const lastSource = source[source.length - 1];
        if (lastSource === undefined) {
          source = [tick];
          ha = computeHeikinAshi(source);
          series.setData(toCandlestickData(ha));
          return;
        }
        if (tick.time === lastSource.time) {
          source[source.length - 1] = tick;
          const previousHa = ha.length >= 2 ? ha[ha.length - 2] : null;
          const next = heikinAshiNext(previousHa ?? null, tick);
          ha[ha.length - 1] = next;
          series.update(toCandlestickBar(next));
        } else if (tick.time > lastSource.time) {
          source.push(tick);
          const previousHa = ha.length > 0 ? ha[ha.length - 1] : null;
          const next = heikinAshiNext(previousHa ?? null, tick);
          ha.push(next);
          series.update(toCandlestickBar(next));
        }
        // Out-of-order ticks are ignored.
      },
    );
  }

  return commonHandle(
    chart,
    series,
    applyTheme,
    (candles) => {
      series.setData(toCandlestickData(candles));
    },
    (candle) => {
      series.update(toCandlestickBar(candle));
    },
  );
}

/**
 * Apply a price scale mode to the right price axis.
 * - 'log' falls back to 'linear' when any candle has a non-positive low,
 *   because logarithmic scales cannot represent zero or negative prices.
 * - 'percentage' shows prices as percent change from the first visible bar.
 * Returns the mode actually applied.
 */
export function applyPriceScaleMode(
  chart: IChartApi,
  mode: PriceScaleKind,
  candles?: readonly Candle[],
): PriceScaleKind {
  let effective = mode;
  if (
    mode === 'log' &&
    candles !== undefined &&
    candles.some((candle) => candle.low <= 0)
  ) {
    effective = 'linear';
  }
  const lwcMode =
    effective === 'log'
      ? PriceScaleMode.Logarithmic
      : effective === 'percentage'
        ? PriceScaleMode.Percentage
        : PriceScaleMode.Normal;
  chart.priceScale('right').applyOptions({ mode: lwcMode });
  return effective;
}

/** Create one indicator overlay series from its descriptor. */
export function createOverlaySeries(
  chart: IChartApi,
  descriptor: OverlaySeriesDescriptor,
): OverlayHandle {
  const priceScaleId = descriptor.priceScaleId ?? 'right';
  const visible = descriptor.visible ?? true;

  if (descriptor.kind === 'line') {
    const series = chart.addLineSeries({
      color: descriptor.color,
      lineWidth: descriptor.lineWidth ?? 2,
      lineStyle: toLineStyle(descriptor.lineStyle),
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      priceScaleId,
      visible,
      title: descriptor.title,
    });
    return {
      setData: (data) => {
        series.setData(
          data.map(
            (point): LineData<UTCTimestamp> => ({ time: point.time, value: point.value }),
          ),
        );
      },
      remove: () => {
        chart.removeSeries(series);
      },
    };
  }

  if (descriptor.kind === 'area') {
    const series = chart.addAreaSeries({
      lineColor: descriptor.color,
      topColor: descriptor.color,
      bottomColor: 'transparent',
      lineWidth: descriptor.lineWidth ?? 2,
      lineStyle: toLineStyle(descriptor.lineStyle),
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      priceScaleId,
      visible,
      title: descriptor.title,
    });
    return {
      setData: (data) => {
        series.setData(
          data.map(
            (point): AreaData<UTCTimestamp> => ({ time: point.time, value: point.value }),
          ),
        );
      },
      remove: () => {
        chart.removeSeries(series);
      },
    };
  }

  const series = chart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId,
    priceLineVisible: false,
    lastValueVisible: false,
    visible,
    title: descriptor.title,
  });
  if (priceScaleId === 'volume') {
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
  }
  return {
    setData: (data) => {
      series.setData(
        data.map((point): HistogramData<UTCTimestamp> => {
          if (point.color === undefined) {
            return { time: point.time, value: point.value };
          }
          return { time: point.time, value: point.value, color: point.color };
        }),
      );
    },
    remove: () => {
      chart.removeSeries(series);
    },
  };
}
