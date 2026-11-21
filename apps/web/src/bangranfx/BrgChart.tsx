/**
 * Chart interaktif strategi BRG (BangranFX) untuk XAU/USD.
 *
 * Memakai ulang lightweight-charts dan palet tema aplikasi yang sudah ada
 * (`chartOptionsForTheme`, `candlestickColorsForTheme`, `resolveTheme`).
 * Lapisan yang bisa dihidupkan/dimatikan: SNR, zona SND, parallel channel,
 * EMA 21/34/89, Fibonacci RR, Entry/SL/TP, dan pola W/M.
 *
 * Semua label berbahasa Indonesia. Tinggi chart 420px di desktop dan
 * 320px di layar sempit (< 640px), lebar 100% tanpa overflow horizontal.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { LineStyle, createChart } from 'lightweight-charts';
import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
  LineWidth,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import { candlestickColorsForTheme, chartOptionsForTheme } from '../chart/themes';
import { resolveTheme, useApp } from '../store/state';
import { fibRrLevels } from './calc';
import type { FibRrLevel } from './calc';
import { buildBrgExample } from './data';
import type {
  BrgPatternMarker,
  Candle,
  ChannelPoint,
  SndZone,
  SnrLevel,
} from './data';

export interface BrgTradePlan {
  entry: number;
  sl: number;
  tp: number;
  direction: 'buy' | 'sell';
}

export interface BrgChartProps {
  /**
   * Candle yang digambar. Bila tidak diisi, dipakai skenario contoh
   * sintetis dari `buildBrgExample()` (sell 1943) sehingga chart bisa
   * berdiri sendiri tanpa data dari luar.
   */
  candles?: readonly Candle[];
  snrLevels?: readonly SnrLevel[];
  sndZones?: readonly SndZone[];
  channel?: { top: readonly ChannelPoint[]; bottom: readonly ChannelPoint[] };
  ema?: {
    p21?: readonly number[];
    p34?: readonly number[];
    p89?: readonly number[];
  };
  entrySlTp?: BrgTradePlan;
  fibLevels?: readonly FibRrLevel[];
  patterns?: readonly BrgPatternMarker[];
  presetName?: string;
  onZoneClick?: (zone: SndZone) => void;
}

type LayerKey = 'snr' | 'snd' | 'channel' | 'ema' | 'fib' | 'plan' | 'pattern';

const LAYER_LABELS: readonly { key: LayerKey; label: string }[] = [
  { key: 'snr', label: 'SNR (garis sakti)' },
  { key: 'snd', label: 'Zona SND' },
  { key: 'channel', label: 'Parallel channel' },
  { key: 'ema', label: 'EMA 21/34/89' },
  { key: 'fib', label: 'Fibonacci RR' },
  { key: 'plan', label: 'Entry / SL / TP' },
  { key: 'pattern', label: 'Pola W / M' },
] as const;

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  snr: true,
  snd: true,
  channel: true,
  ema: true,
  fib: true,
  plan: true,
  pattern: true,
};

const EMA_COLORS = { p21: '#2962ff', p34: '#ff9800', p89: '#7e57c2' } as const;
const FIB_COLORS: Record<FibRrLevel['level'], string> = {
  0: '#94a3b8',
  1: '#26a69a',
  2: '#2962ff',
  3: '#7e57c2',
} as const;

function toTime(value: number): UTCTimestamp {
  return value as UTCTimestamp;
}

function chartHeightForWidth(width: number): number {
  return width < 640 ? 320 : 420;
}

export function BrgChart(props: BrgChartProps): ReactElement {
  const { state } = useApp();
  const theme = resolveTheme(state.theme);

  // Skenario contoh bawaan: dipakai untuk setiap prop yang tidak diisi,
  // supaya <BrgChart /> tanpa prop pun menampilkan chart lengkap.
  const defaultScenario = useMemo(() => buildBrgExample(), []);
  const candles = props.candles ?? defaultScenario.candles;
  const snrLevels = props.snrLevels ?? defaultScenario.snrLevels;
  const sndZones = props.sndZones ?? defaultScenario.sndZones;
  const channel = props.channel ?? defaultScenario.channel;
  const ema = props.ema ?? defaultScenario.ema;
  const preset = defaultScenario.preset;
  const entrySlTp = useMemo<BrgTradePlan>(
    () =>
      props.entrySlTp ?? {
        entry: preset.entry,
        sl: preset.sl,
        tp: preset.tp,
        direction: preset.direction,
      },
    [props.entrySlTp, preset],
  );
  const fibLevels = useMemo<readonly FibRrLevel[]>(
    () => props.fibLevels ?? fibRrLevels(preset.entry, preset.sl, preset.direction),
    [props.fibLevels, preset],
  );
  const patterns = props.patterns ?? defaultScenario.patterns;
  const presetName = props.presetName ?? preset.name;
  const { onZoneClick } = props;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const overlaySeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const sizeRef = useRef({ width: 600, height: 420 });
  const onZoneClickRef = useRef(onZoneClick);
  const zonesRef = useRef<readonly SndZone[]>(sndZones);
  onZoneClickRef.current = onZoneClick;
  zonesRef.current = sndZones;

  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(DEFAULT_LAYERS);
  const [height, setHeight] = useState(420);

  function toggleLayer(key: LayerKey): void {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Buat chart sekali; ResizeObserver menjaga ukuran mengikuti wadah.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const width = container.clientWidth > 0 ? container.clientWidth : 600;
    const initialHeight = chartHeightForWidth(width);
    sizeRef.current = { width, height: initialHeight };
    setHeight(initialHeight);
    const chart = createChart(container, chartOptionsForTheme(theme, width, initialHeight));
    chartRef.current = chart;
    const colors = candlestickColorsForTheme(theme, 'candlestick');
    const candleSeries = chart.addCandlestickSeries({
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderUpColor: colors.borderUpColor,
      borderDownColor: colors.borderDownColor,
      wickUpColor: colors.wickUpColor,
      wickDownColor: colors.wickDownColor,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    candleSeriesRef.current = candleSeries;

    const onClick = (param: { point?: { x: number; y: number } }): void => {
      const series = candleSeriesRef.current;
      if (param.point === undefined || series === null) {
        return;
      }
      const price = series.coordinateToPrice(param.point.y);
      if (price === null) {
        return;
      }
      const hit = zonesRef.current.find(
        (zone) => price >= zone.bottom && price <= zone.top,
      );
      if (hit !== undefined) {
        onZoneClickRef.current?.(hit);
      }
    };
    chart.subscribeClick(onClick);

    const observer = new ResizeObserver(() => {
      const element = containerRef.current;
      const currentChart = chartRef.current;
      if (element === null || currentChart === null) {
        return;
      }
      const nextWidth = element.clientWidth;
      if (nextWidth <= 0) {
        return;
      }
      const nextHeight = chartHeightForWidth(nextWidth);
      sizeRef.current = { width: nextWidth, height: nextHeight };
      setHeight(nextHeight);
      currentChart.resize(nextWidth, nextHeight);
    });
    observer.observe(container);

    return () => {
      chart.unsubscribeClick(onClick);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      overlaySeriesRef.current = [];
      priceLinesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Terapkan tema aplikasi saat theme berubah (tanpa membuat ulang chart).
  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) {
      return;
    }
    chart.applyOptions(
      chartOptionsForTheme(theme, sizeRef.current.width, sizeRef.current.height),
    );
    const colors = candlestickColorsForTheme(theme, 'candlestick');
    candleSeriesRef.current?.applyOptions({
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderUpColor: colors.borderUpColor,
      borderDownColor: colors.borderDownColor,
      wickUpColor: colors.wickUpColor,
      wickDownColor: colors.wickDownColor,
    });
  }, [theme]);

  // Data candle + seluruh lapisan gambar; dibangun ulang saat data,
  // toggle lapisan, atau tema berubah.
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (chart === null || candleSeries === null) {
      return;
    }
    candleSeries.setData(
      candles.map((candle) => ({
        time: toTime(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    // Bersihkan lapisan sebelumnya.
    for (const series of overlaySeriesRef.current) {
      chart.removeSeries(series);
    }
    overlaySeriesRef.current = [];
    for (const line of priceLinesRef.current) {
      candleSeries.removePriceLine(line);
    }
    priceLinesRef.current = [];
    const addPriceLine = (options: {
      price: number;
      color: string;
      title: string;
      lineStyle?: LineStyle;
      lineWidth?: LineWidth;
    }): void => {
      priceLinesRef.current.push(
        candleSeries.createPriceLine({
          price: options.price,
          color: options.color,
          lineWidth: options.lineWidth ?? 1,
          lineStyle: options.lineStyle ?? LineStyle.Solid,
          axisLabelVisible: true,
          lineVisible: true,
          title: options.title,
        }),
      );
    };
    const addLineSeries = (
      points: readonly { time: number; value: number }[],
      color: string,
      lineStyle: LineStyle,
      lineWidth: LineWidth,
    ): void => {
      if (points.length < 2) {
        return;
      }
      const series = chart.addLineSeries({
        color,
        lineWidth,
        lineStyle,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData(
        points.map((point) => ({ time: toTime(point.time), value: point.value })),
      );
      overlaySeriesRef.current.push(series);
    };

    // SNR: garis horizontal per level.
    if (layers.snr) {
      for (const level of snrLevels) {
        addPriceLine({
          price: level.price,
          color: '#f59e0b',
          title: `SNR ${level.price.toFixed(2)} — ${level.label}`,
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
        });
      }
    }

    // Zona SND: garis atas + bawah (putus-putus) + penanda di candle pertama.
    if (layers.snd) {
      for (const zone of sndZones) {
        const color = zone.kind === 'demand' ? '#26a69a' : '#ef5350';
        const freshness = zone.fresh ? 'fresh' : 'sudah tersentuh';
        addPriceLine({
          price: zone.top,
          color,
          title: `${zone.label} (atas, ${zone.thickness}, ${freshness})`,
          lineStyle: LineStyle.Dashed,
        });
        addPriceLine({
          price: zone.bottom,
          color,
          title: `${zone.label} (bawah, ${zone.thickness}, ${freshness})`,
          lineStyle: LineStyle.Dashed,
        });
      }
    }

    // Parallel channel: dua garis miring sejajar.
    if (layers.channel) {
      const toValuePoints = (
        points: readonly ChannelPoint[],
      ): { time: number; value: number }[] =>
        points.map((point) => ({ time: point.time, value: point.price }));
      addLineSeries(toValuePoints(channel.top), '#94a3b8', LineStyle.Dashed, 1);
      addLineSeries(toValuePoints(channel.bottom), '#94a3b8', LineStyle.Dashed, 1);
    }

    // EMA 21/34/89.
    if (layers.ema) {
      const emaEntries: readonly {
        values: readonly number[] | undefined;
        color: string;
      }[] = [
        { values: ema.p21, color: EMA_COLORS.p21 },
        { values: ema.p34, color: EMA_COLORS.p34 },
        { values: ema.p89, color: EMA_COLORS.p89 },
      ];
      for (const entry of emaEntries) {
        if (entry.values === undefined) {
          continue;
        }
        const points: { time: number; value: number }[] = [];
        for (let i = 0; i < candles.length; i += 1) {
          const candle = candles[i];
          const value = entry.values[i];
          if (candle !== undefined && value !== undefined) {
            points.push({ time: candle.time, value });
          }
        }
        addLineSeries(points, entry.color, LineStyle.Solid, 1);
      }
    }

    // Entry / SL / TP.
    if (layers.plan) {
      addPriceLine({
        price: entrySlTp.entry,
        color: '#2962ff',
        title: `Entry ${entrySlTp.entry.toFixed(2)} (${entrySlTp.direction === 'buy' ? 'Buy' : 'Sell'})`,
        lineWidth: 2,
      });
      addPriceLine({
        price: entrySlTp.sl,
        color: '#ef5350',
        title: `SL ${entrySlTp.sl.toFixed(2)}`,
        lineWidth: 2,
      });
      addPriceLine({
        price: entrySlTp.tp,
        color: '#26a69a',
        title: `TP ${entrySlTp.tp.toFixed(2)}`,
        lineWidth: 2,
      });
    }

    // Fibonacci sebagai penggaris RR: level 0 = entry, 1/2/3 = TP 1:1/1:2/1:3.
    if (layers.fib) {
      for (const level of fibLevels) {
        addPriceLine({
          price: level.price,
          color: FIB_COLORS[level.level],
          title: `${level.label} ${level.price.toFixed(2)}`,
          lineStyle: level.level === 0 ? LineStyle.Solid : LineStyle.Dotted,
        });
      }
    }

    // Penanda pola W (panah naik di bawah candle) dan M (panah turun di atas).
    if (layers.pattern) {
      const markers: SeriesMarker<Time>[] = [];
      for (const pattern of patterns) {
        markers.push({
          time: toTime(pattern.time),
          position: pattern.kind === 'W' ? 'belowBar' : 'aboveBar',
          color: pattern.kind === 'W' ? '#26a69a' : '#ef5350',
          shape: pattern.kind === 'W' ? 'arrowUp' : 'arrowDown',
          text: pattern.kind === 'W' ? 'W — pembalikan naik' : 'M — pembalikan turun',
        });
      }
      candleSeries.setMarkers(markers);
    } else {
      candleSeries.setMarkers([]);
    }

    chart.timeScale().fitContent();
  }, [candles, snrLevels, sndZones, channel, ema, entrySlTp, fibLevels, patterns, layers]);

  const ariaLabel = `Chart XAU/USD metode BRG — ${presetName}, ${candles.length.toString()} candle`;

  return (
    <div style={{ width: '100%', maxWidth: '100%' }}>
      <fieldset
        style={{
          border: '1px solid var(--border, #cbd5e1)',
          borderRadius: 8,
          padding: '8px 12px',
          margin: '0 0 8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
        }}
      >
        <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 4px' }}>
          Lapisan chart
        </legend>
        {LAYER_LABELS.map(({ key, label }) => (
          <label
            key={key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => {
                toggleLayer(key);
              }}
              aria-label={`Tampilkan lapisan ${label}`}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div
        ref={wrapperRef}
        style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}
      >
        <div
          ref={containerRef}
          style={{ width: '100%', height }}
          role="img"
          aria-label={ariaLabel}
          data-testid="brg-chart"
        />
      </div>
      {candles.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted, #64748b)' }}>
          Tidak ada data candle untuk ditampilkan.
        </p>
      ) : null}
      {onZoneClick !== undefined && sndZones.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 8,
          }}
        >
          {sndZones.map((zone) => (
            <button
              key={zone.label}
              type="button"
              onClick={() => {
                onZoneClick(zone);
              }}
              aria-label={`Pilih zona ${zone.label}`}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              {zone.label} · {zone.top.toFixed(2)}–{zone.bottom.toFixed(2)}
            </button>
          ))}
        </div>
      ) : null}
      <p style={{ fontSize: 12, color: 'var(--muted, #64748b)', margin: '8px 0 0' }}>
        Klik zona SND pada chart (atau tombol zona di atas) untuk memilihnya.
        Harga contoh memakai data sintetis, bukan harga pasar live.
      </p>
    </div>
  );
}

export default BrgChart;
