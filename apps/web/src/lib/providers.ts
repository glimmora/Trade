import { SYMBOLS, type ProviderId, type Timeframe } from '@trade/core';

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** Timeframes this provider can serve. */
  timeframes: readonly Timeframe[];
  /** Short note shown in the provider picker (key requirement, delay, …). */
  note: string | null;
  /** True when the provider needs a user-supplied key (stored only in localStorage). */
  requiresKey: boolean;
  /** True when this provider's data is delayed rather than live. */
  delayed: boolean;
}

const ALL_TIMEFRAMES: readonly Timeframe[] = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '12h',
  '1D',
  '1W',
  '1M',
] as const;

/**
 * Provider capabilities, verified against each provider's public docs at
 * scaffold time. Symbol support is derived from the core symbol registry —
 * a provider only appears for a symbol it actually serves. Timeframe support
 * is conservative: when a provider does not document a timeframe, it is
 * disabled in the UI with a tooltip instead of silently failing.
 */
export const PROVIDER_META: readonly ProviderMeta[] = [
  {
    id: 'binance',
    label: 'Binance',
    timeframes: ALL_TIMEFRAMES,
    note: null,
    requiresKey: false,
    delayed: false,
  },
  {
    id: 'bybit',
    label: 'Bybit',
    timeframes: ALL_TIMEFRAMES,
    note: null,
    requiresKey: false,
    delayed: false,
  },
  {
    id: 'okx',
    label: 'OKX',
    timeframes: ALL_TIMEFRAMES,
    note: null,
    requiresKey: false,
    delayed: false,
  },
  {
    id: 'kraken',
    label: 'Kraken',
    timeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'],
    note: null,
    requiresKey: false,
    delayed: false,
  },
  {
    id: 'coinbase',
    label: 'Coinbase Exchange',
    timeframes: ['1m', '5m', '15m', '1h', '6h', '1D'],
    note: null,
    requiresKey: false,
    delayed: false,
  },
  {
    id: 'gate',
    label: 'Gate.io',
    timeframes: ALL_TIMEFRAMES,
    note: null,
    requiresKey: false,
    delayed: false,
  },
  {
    id: 'twelvedata',
    label: 'Twelve Data',
    timeframes: ALL_TIMEFRAMES,
    note: 'requiresApiKey',
    requiresKey: true,
    delayed: false,
  },
  {
    id: 'yahoo',
    label: 'Yahoo Finance',
    timeframes: ['1m', '5m', '15m', '30m', '1h', '1D', '1W', '1M'],
    note: 'delayedData',
    requiresKey: false,
    delayed: true,
  },
  {
    id: 'stooq',
    label: 'Stooq',
    timeframes: ['1D', '1W', '1M'],
    note: 'delayedData',
    requiresKey: false,
    delayed: true,
  },
] as const;

export function providerMeta(id: ProviderId): ProviderMeta {
  const found = PROVIDER_META.find((meta) => meta.id === id);
  if (!found) {
    throw new Error(`Unknown provider: ${id}`);
  }
  return found;
}

/** Providers that actually serve the given symbol (from the core registry). */
export function providersForSymbol(symbolId: string): ProviderMeta[] {
  const symbol = SYMBOLS.find((entry) => entry.id === symbolId);
  if (!symbol) return [];
  return PROVIDER_META.filter((meta) => symbol.providerSymbols[meta.id] !== undefined);
}

export function isTimeframeSupported(provider: ProviderId, timeframe: Timeframe): boolean {
  return providerMeta(provider).timeframes.includes(timeframe);
}

/** First provider that serves a symbol, used when the current one does not. */
export function firstProviderForSymbol(symbolId: string): ProviderId | null {
  const list = providersForSymbol(symbolId);
  const first = list[0];
  return first ? first.id : null;
}
