import { computeIndicator } from '@trade/indicators';
import type { Candle } from '@trade/core';
import type { OverlayPoint, OverlaySeriesDescriptor } from '../chart/types';
import type { IndicatorInstance } from '../store/state';
import { catalogEntry } from './indicators';

/**
 * Map visible indicator instances to chart overlay descriptors.
 *
 * Plottable kinds are computed synchronously with the indicator package's
 * single dispatch (`computeIndicator`) and aligned to candle times.
 * Structure kinds return zones / labels / events, not plottable series,
 * so they are skipped here (no invented points); a separate layer owns
 * rendering them. Pivot points are a single snapshot of levels, not a
 * time series, so they are skipped too.
 */

/** Kinds whose results are zones / labels / events, not series. */
const STRUCTURE_KINDS: ReadonlySet<string> = new Set([
  'support-resistance',
  'break-retest',
  'supply-demand',
  'order-blocks',
  'fair-value-gap',
  'market-structure',
  'trendlines',
  'channels',
  'fibonacci',
  'candlestick-patterns',
  'divergence',
]);

/** A value aligned with the input candles; `undefined` = not enough data. */
type IndicatorSeries = readonly (number | undefined)[];

function isSeries(value: unknown): value is IndicatorSeries {
  return (
    Array.isArray(value) &&
    value.every((entry) => entry === undefined || typeof entry === 'number')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function seriesField(result: Record<string, unknown>, field: string): IndicatorSeries | undefined {
  const value = result[field];
  return isSeries(value) ? value : undefined;
}

/** One named line inside a multi-line indicator result. */
interface LineField {
  /** Field of the result object holding the series. */
  field: string;
  /** Suffix appended to the indicator name for the descriptor title. */
  label: string;
  /** Histogram lines (MACD) render as bars instead of a line. */
  kind?: 'line' | 'histogram';
}

/**
 * Multi-line results, keyed by indicator kind. Each entry maps one result
 * field to one overlay descriptor. Single-series results need no entry:
 * an array result maps to one line overlay.
 */
const MULTI_LINE_FIELDS: Readonly<Record<string, readonly LineField[]>> = {
  envelope: [
    { field: 'upper', label: 'Upper' },
    { field: 'basis', label: 'Middle' },
    { field: 'lower', label: 'Lower' },
  ],
  bollinger: [
    { field: 'upper', label: 'Upper' },
    { field: 'basis', label: 'Middle' },
    { field: 'lower', label: 'Lower' },
  ],
  keltner: [
    { field: 'upper', label: 'Upper' },
    { field: 'basis', label: 'Middle' },
    { field: 'lower', label: 'Lower' },
  ],
  donchian: [
    { field: 'upper', label: 'Upper' },
    { field: 'basis', label: 'Middle' },
    { field: 'lower', label: 'Lower' },
  ],
  ichimoku: [
    { field: 'conversion', label: 'Conversion' },
    { field: 'base', label: 'Base' },
    { field: 'spanA', label: 'Span A' },
    { field: 'spanB', label: 'Span B' },
    { field: 'lagging', label: 'Lagging' },
  ],
  stochastic: [
    { field: 'k', label: '%K' },
    { field: 'd', label: '%D' },
  ],
  'stoch-rsi': [
    { field: 'k', label: '%K' },
    { field: 'd', label: '%D' },
  ],
  macd: [
    { field: 'macd', label: 'MACD' },
    { field: 'signal', label: 'Signal' },
    { field: 'histogram', label: 'Histogram', kind: 'histogram' },
  ],
  adx: [
    { field: 'adx', label: 'ADX' },
    { field: 'plusDi', label: '+DI' },
    { field: 'minusDi', label: '-DI' },
  ],
  // Only the `value` series is plottable; `trend` is a direction flag.
  supertrend: [{ field: 'value', label: '' }],
  'parabolic-sar': [{ field: 'value', label: '' }],
};

function toPoints(
  candles: readonly Candle[],
  series: IndicatorSeries,
  color?: string,
): OverlayPoint[] {
  const points: OverlayPoint[] = [];
  const count = Math.min(candles.length, series.length);
  for (let i = 0; i < count; i++) {
    const value = series[i];
    const candle = candles[i];
    if (value === undefined || candle === undefined) continue;
    if (!Number.isFinite(value)) continue;
    points.push(
      color === undefined
        ? { time: candle.time, value }
        : { time: candle.time, value, color },
    );
  }
  return points;
}

function lineDescriptor(
  id: string,
  title: string,
  instance: IndicatorInstance,
  kind: 'line' | 'histogram',
  data: readonly OverlayPoint[],
  priceScaleId?: string,
): OverlaySeriesDescriptor {
  return {
    id,
    kind,
    title,
    color: instance.color,
    lineWidth: instance.lineWidth,
    visible: true,
    data,
    ...(priceScaleId !== undefined ? { priceScaleId } : {}),
  };
}

/**
 * Settings for one compute call. The indicator package already carries its
 * own defaults, so only the instance's period override is passed — mapped
 * onto the period key(s) the kind actually reads. A null period passes
 * nothing and the package defaults apply.
 */
function periodSettings(instance: IndicatorInstance): Record<string, unknown> {
  const period = instance.period;
  if (period === null) return {};
  switch (instance.kind) {
    case 'macd':
      return { fastPeriod: period };
    case 'stoch-rsi':
      return { rsiPeriod: period, stochPeriod: period };
    case 'ichimoku':
      return { conversionPeriod: period };
    default:
      return { period };
  }
}

function descriptorsForInstance(
  instance: IndicatorInstance,
  result: unknown,
  candles: readonly Candle[],
): OverlaySeriesDescriptor[] {
  const name = catalogEntry(instance.kind)?.name ?? instance.kind;

  // Most kinds return a single series aligned with the candles.
  if (isSeries(result)) {
    return [
      lineDescriptor(
        instance.id,
        name,
        instance,
        'line',
        toPoints(candles, result),
      ),
    ];
  }

  if (!isRecord(result)) return [];

  // Moving-average ribbon: one series per period, keyed by period.
  if (instance.kind === 'ma-ribbon') {
    const descriptors: OverlaySeriesDescriptor[] = [];
    for (const key of Object.keys(result)) {
      const series = seriesField(result, key);
      if (series === undefined) continue;
      descriptors.push(
        lineDescriptor(
          `${instance.id}:${key}`,
          `${name} ${key}`,
          instance,
          'line',
          toPoints(candles, series),
        ),
      );
    }
    return descriptors;
  }

  // Volume: bars on the dedicated volume scale plus its moving average.
  if (instance.kind === 'volume') {
    const descriptors: OverlaySeriesDescriptor[] = [];
    const volume = seriesField(result, 'volume');
    if (volume !== undefined) {
      descriptors.push(
        lineDescriptor(
          `${instance.id}:volume`,
          name,
          instance,
          'histogram',
          toPoints(candles, volume, instance.color),
          'volume',
        ),
      );
    }
    const ma = seriesField(result, 'ma');
    if (ma !== undefined) {
      descriptors.push(
        lineDescriptor(
          `${instance.id}:ma`,
          `${name} MA`,
          instance,
          'line',
          toPoints(candles, ma),
        ),
      );
    }
    return descriptors;
  }

  const fields = MULTI_LINE_FIELDS[instance.kind];
  if (fields === undefined) return [];
  const descriptors: OverlaySeriesDescriptor[] = [];
  for (const field of fields) {
    const series = seriesField(result, field.field);
    if (series === undefined) continue;
    descriptors.push(
      lineDescriptor(
        `${instance.id}:${field.field}`,
        field.label === '' ? name : `${name} ${field.label}`,
        instance,
        field.kind ?? 'line',
        field.kind === 'histogram'
          ? toPoints(candles, series, instance.color)
          : toPoints(candles, series),
      ),
    );
  }
  return descriptors;
}

/**
 * Compute overlay descriptors for every visible indicator instance.
 * Skipped silently (no descriptor, no throw): hidden instances, structure
 * kinds, pivot points (single snapshot, not a series), unknown kinds, and
 * any kind whose compute throws.
 */
export function computeIndicatorOverlays(
  candles: readonly Candle[],
  indicators: readonly IndicatorInstance[],
): OverlaySeriesDescriptor[] {
  const descriptors: OverlaySeriesDescriptor[] = [];
  for (const instance of indicators) {
    if (!instance.visible) continue;
    if (STRUCTURE_KINDS.has(instance.kind)) continue;
    // Pivot points are one snapshot of levels, not a time series.
    if (instance.kind === 'pivot-points') continue;
    let result: unknown;
    try {
      result = computeIndicator({
        id: instance.id,
        indicatorId: instance.kind,
        candles: [...candles],
        settings: periodSettings(instance),
      });
    } catch {
      continue;
    }
    descriptors.push(...descriptorsForInstance(instance, result, candles));
  }
  return descriptors;
}
