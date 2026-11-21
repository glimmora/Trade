import type { ProviderId } from '@trade/core';

/**
 * Cross-provider price accuracy check.
 *
 * Compares the last price for the same app-level symbol across two or
 * more providers. A deviation beyond the threshold raises a warning that
 * carries BOTH values, so the UI can show them side by side instead of
 * silently picking one.
 *
 * Thresholds: >0.3% for crypto, >0.15% for gold instruments. Gold uses the
 * tighter band because tokenized gold tracks spot gold closely and a
 * larger gap usually means a stale feed or a wrong instrument.
 */

export type CrosscheckKind = 'crypto' | 'gold';

export interface PriceSample {
  provider: ProviderId;
  symbol: string;
  price: number;
  /** Quote timestamp, UTC milliseconds. */
  timestampMs: number;
}

export interface PriceDeviation {
  provider: ProviderId;
  price: number;
  /** Signed deviation vs the reference (median) price, as a fraction. */
  deviationPct: number;
  /** True when this sample exceeds the threshold. */
  exceedsThreshold: boolean;
}

export interface CrossCheckWarning {
  symbol: string;
  kind: CrosscheckKind;
  thresholdPct: number;
  referencePrice: number;
  maxDeviationPct: number;
  /** All samples that exceed the threshold. */
  outliers: PriceDeviation[];
  message: string;
}

export interface CrossCheckResult {
  symbol: string;
  kind: CrosscheckKind;
  thresholdPct: number;
  referencePrice: number;
  maxDeviationPct: number;
  deviations: PriceDeviation[];
  /** Undefined when all providers agree within the threshold. */
  warning?: CrossCheckWarning;
}

export function thresholdForKind(kind: CrosscheckKind): number {
  return kind === 'gold' ? 0.0015 : 0.003;
}

/** Median of a non-empty number list. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (sorted.length % 2 === 1) {
    return upper ?? 0;
  }
  return ((lower ?? 0) + (upper ?? 0)) / 2;
}

/**
 * Compare last prices across providers. Requires at least two samples
 * for the same symbol; with fewer, returns the single price with no
 * warning (nothing to compare against).
 */
export function crossCheckPrices(
  symbol: string,
  kind: CrosscheckKind,
  samples: readonly PriceSample[],
): CrossCheckResult {
  const thresholdPct = thresholdForKind(kind);
  const valid = samples.filter((s) => Number.isFinite(s.price) && s.price > 0);
  if (valid.length === 0) {
    return { symbol, kind, thresholdPct, referencePrice: 0, maxDeviationPct: 0, deviations: [] };
  }
  const referencePrice = median(valid.map((s) => s.price));
  const deviations: PriceDeviation[] = valid.map((s) => {
    const deviationPct =
      referencePrice === 0 ? 0 : (s.price - referencePrice) / referencePrice;
    return {
      provider: s.provider,
      price: s.price,
      deviationPct,
      exceedsThreshold: Math.abs(deviationPct) > thresholdPct,
    };
  });
  const maxDeviationPct = deviations.reduce(
    (max, d) => Math.max(max, Math.abs(d.deviationPct)),
    0,
  );
  const outliers = deviations.filter((d) => d.exceedsThreshold);
  const result: CrossCheckResult = {
    symbol,
    kind,
    thresholdPct,
    referencePrice,
    maxDeviationPct,
    deviations,
  };
  if (outliers.length > 0) {
    result.warning = {
      symbol,
      kind,
      thresholdPct,
      referencePrice,
      maxDeviationPct,
      outliers,
      message:
        `Price disagreement for ${symbol}: ` +
        outliers
          .map(
            (o) =>
              `${o.provider} ${o.price.toFixed(2)} (${(o.deviationPct * 100).toFixed(2)}% vs median ${referencePrice.toFixed(2)})`,
          )
          .join(', ') +
        `. Threshold is ${(thresholdPct * 100).toFixed(2)}%.`,
    };
  }
  return result;
}

export type FeedStatus = 'live' | 'delayed' | 'offline';

/**
 * Derive a feed status from the age of the last update.
 * Live: updated within 5s. Delayed: within 60s (or a provider flagged
 * delayed, e.g. daily CSV). Offline: older than 60s / no update yet.
 */
export function feedStatus(
  lastUpdateMs: number | undefined,
  nowMs: number,
  providerDelayed = false,
): FeedStatus {
  if (lastUpdateMs === undefined) return 'offline';
  const ageMs = nowMs - lastUpdateMs;
  if (ageMs < 0) return 'live';
  if (ageMs <= 5_000) return providerDelayed ? 'delayed' : 'live';
  if (ageMs <= 60_000) return 'delayed';
  return 'offline';
}

/** Human-readable age of the last update, e.g. "3s ago", "2m ago". */
export function lastUpdateAge(lastUpdateMs: number | undefined, nowMs: number): string {
  if (lastUpdateMs === undefined) return 'never';
  const ageSec = Math.max(0, Math.floor((nowMs - lastUpdateMs) / 1000));
  if (ageSec < 5) return 'just now';
  if (ageSec < 60) return `${String(ageSec)}s ago`;
  const minutes = Math.floor(ageSec / 60);
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${String(hours)}h ago`;
}
