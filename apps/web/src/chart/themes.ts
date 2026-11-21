import { ColorType, CrosshairMode } from 'lightweight-charts';
import type { ChartOptions } from 'lightweight-charts';
import type { ChartThemeName, ChartType } from './types';

/**
 * Chart colour palettes.
 *
 * Text contrast (WCAG AA, normal text >= 4.5:1):
 * - Dark: text #f1f5f9 on background #0f172a (~15:1); muted #94a3b8 on
 *   #0f172a (~7:1).
 * - Light: text #0f172a on background #ffffff (~15:1); muted #64748b on
 *   #ffffff (~4.8:1).
 * Up/down colours are data fills on the candles, not body text; the OHLCV
 * legend always renders in the theme text colour, so legend legibility does
 * not depend on the up/down colours.
 */
export interface ChartPalette {
  background: string;
  text: string;
  muted: string;
  grid: string;
  border: string;
  up: string;
  down: string;
  crosshair: string;
  areaTop: string;
  areaBottom: string;
  baselineTop: string;
  baselineBottom: string;
  accent: string;
}

export const CHART_PALETTES: Record<ChartThemeName, ChartPalette> = {
  dark: {
    background: '#0f172a',
    text: '#f1f5f9',
    muted: '#94a3b8',
    grid: '#1e293b',
    border: '#334155',
    up: '#26a69a',
    down: '#ef5350',
    crosshair: '#94a3b8',
    areaTop: 'rgba(38, 166, 154, 0.4)',
    areaBottom: 'rgba(38, 166, 154, 0.0)',
    baselineTop: 'rgba(38, 166, 154, 0.4)',
    baselineBottom: 'rgba(239, 83, 80, 0.4)',
    accent: '#60a5fa',
  },
  light: {
    background: '#ffffff',
    text: '#0f172a',
    muted: '#64748b',
    grid: '#e2e8f0',
    border: '#cbd5e1',
    up: '#089981',
    down: '#f23645',
    crosshair: '#64748b',
    areaTop: 'rgba(8, 153, 129, 0.35)',
    areaBottom: 'rgba(8, 153, 129, 0.0)',
    baselineTop: 'rgba(8, 153, 129, 0.35)',
    baselineBottom: 'rgba(242, 54, 69, 0.35)',
    accent: '#2563eb',
  },
};

/** Full chart options for a theme. Applied on creation and on every theme change. */
export function chartOptionsForTheme(
  theme: ChartThemeName,
  width: number,
  height: number,
): ChartOptions {
  const palette = CHART_PALETTES[theme];
  return {
    width,
    height,
    autoSize: false,
    layout: {
      background: { type: ColorType.Solid, color: palette.background },
      textColor: palette.text,
      fontSize: 12,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    },
    grid: {
      vertLines: { color: palette.grid },
      horzLines: { color: palette.grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: palette.crosshair,
        labelBackgroundColor: palette.crosshair,
      },
      horzLine: {
        color: palette.crosshair,
        labelBackgroundColor: palette.crosshair,
      },
    },
    rightPriceScale: {
      borderColor: palette.border,
    },
    timeScale: {
      borderColor: palette.border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 6,
      barSpacing: 9,
    },
  };
}

/** Candlestick / bar colours for a theme and chart type. */
export interface CandlestickColors {
  upColor: string;
  downColor: string;
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;
}

export function candlestickColorsForTheme(
  theme: ChartThemeName,
  chartType: ChartType,
): CandlestickColors {
  const palette = CHART_PALETTES[theme];
  // Hollow candles: rising candles are drawn with a transparent body and a
  // solid border, falling candles are filled. Every other candle type is
  // filled on both sides.
  const upColor = chartType === 'hollow' ? 'transparent' : palette.up;
  return {
    upColor,
    downColor: palette.down,
    borderUpColor: palette.up,
    borderDownColor: palette.down,
    wickUpColor: palette.up,
    wickDownColor: palette.down,
  };
}
