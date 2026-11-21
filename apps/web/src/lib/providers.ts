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
    // Registry serves 8 timeframes (no 3m/6h/12h/1W/1M).
    timeframes: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1D'],
    note: null,
    requiresKey: false,
    delayed: false,
  },
  {
    id: 'yahoo',
    label: 'Yahoo (Gold futures GC=F)',
    // Native intervals only: 3m, 2h, 4h, 6h, 12h are disabled in the UI.
    timeframes: ['1m', '5m', '15m', '30m', '1h', '1D', '1W', '1M'],
    note: null,
    requiresKey: false,
    delayed: false,
  },
  {
    id: 'twelvedata',
    label: 'Twelve Data',
    // Registry serves 10 timeframes (no 3m/6h/12h).
    timeframes: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1D', '1W', '1M'],
    note: 'requiresApiKey',
    requiresKey: true,
    delayed: false,
  },
  {
    id: 'stooq',
    label: 'Stooq',
    // Registry serves daily candles only.
    timeframes: ['1D'],
    note: 'delayedData',
    requiresKey: false,
    delayed: true,
  },
  {
    id: 'oanda',
    label: 'OANDA (Practice)',
    // All app timeframes except 3m — OANDA has no M3 granularity.
    timeframes: ALL_TIMEFRAMES.filter((tf) => tf !== '3m'),
    note: 'requiresApiKey',
    requiresKey: true,
    delayed: false,
  },
  {
    id: 'coingecko',
    label: 'CoinGecko',
    // Tokenized gold only (PAXG/XAUT) — 30m/4h candles, automatic granularity.
    timeframes: ALL_TIMEFRAMES,
    note: null,
    requiresKey: false,
    delayed: false,
  },
  {
    id: 'tradingview',
    label: 'TradingView Scanner (quote only)',
    // Quote snapshot only — no candles at any timeframe.
    timeframes: [],
    note: null,
    requiresKey: false,
    delayed: false,
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
