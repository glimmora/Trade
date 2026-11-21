import type { ProviderId, Timeframe } from '@trade/core';
import { TIMEFRAMES } from '@trade/core';

/**
 * Provider symbol registry.
 *
 * This is the authoritative mapping for the providers package. It mirrors
 * the core symbol list and adds per-provider verification flags.
 *
 * INSTRUMENT IDENTITY — READ FIRST:
 * - "XAU/USD" is SPOT GOLD. Twelve Data serves true spot gold here, and
 *   OANDA v20 (practice) also serves spot gold — but its instrument name
 *   (XAU_USD) was unconfirmed at implementation time, so the adapter
 *   verifies it at runtime via the account instruments endpoint.
 *   Yahoo "GC=F" is a gold FUTURES contract and Stooq "xauusd" is a daily
 *   delayed quote; both are labelled as proxies, never as spot.
 * - "XAUT/USDT" is TOKENIZED GOLD (Tether Gold), a different instrument
 *   from spot gold. Never substitute one for the other.
 * - "PAXG/USDT" is TOKENIZED GOLD (Pax Gold), a gold proxy, not spot gold.
 * - CoinGecko serves TOKENIZED GOLD only (PAXG/XAUT), with automatic
 *   coarse granularity (30m candles for days=1, 4h for days=2-30) —
 *   never spot gold.
 * - TradingView Scanner serves a live quote snapshot (OANDA:XAUUSD)
 *   for spot gold — ticker only, no candles. It is a fallback quote
 *   source, never a chart source.
 * - "BTC/USDT" on Coinbase is served as BTC-USD (US dollars, not Tether);
 *   it is a BTC price reference, labelled as such in the UI.
 * - Bybit "XAUUSDT" is a PERPETUAL contract, listed only as a live proxy
 *   for the spot-gold pair and flagged `proxy: true`.
 *
 * `verified` means the symbol/endpoint mapping was checked against the
 * provider's current public API documentation or a live instruments list
 * at implementation time. `verified: false` means the mapping is plausible
 * but NOT confirmed — the app must confirm it at runtime (instruments
 * endpoint) or hide the provider for that symbol until confirmed.
 */

export type InstrumentKind = 'crypto' | 'spot-gold' | 'tokenized-gold';

export interface ProviderSymbolEntry {
  /** Provider-native symbol, e.g. "BTCUSDT". */
  providerSymbol: string;
  /** True when the mapping was verified against current public API docs. */
  verified: boolean;
  /** True when this is a proxy/perpetual/futures stand-in, not the instrument itself. */
  proxy?: boolean;
  /** Human note shown in the provider dropdown when relevant. */
  note?: string;
}

export interface RegistrySymbol {
  id: string;
  label: string;
  kind: InstrumentKind;
  /** Display decimals. */
  precision: number;
  /** Minimum price movement. */
  tickSize: number;
  /** Volume unit documentation. */
  volumeUnit: string;
  providers: Partial<Record<ProviderId, ProviderSymbolEntry>>;
}

export const REGISTRY_SYMBOLS: readonly RegistrySymbol[] = [
  {
    id: 'BTC/USDT',
    label: 'Bitcoin / Tether',
    kind: 'crypto',
    precision: 2,
    tickSize: 0.01,
    volumeUnit: 'BTC (base asset)',
    providers: {
      binance: { providerSymbol: 'BTCUSDT', verified: true },
      bybit: { providerSymbol: 'BTCUSDT', verified: true },
      okx: { providerSymbol: 'BTC-USDT', verified: true },
      kraken: { providerSymbol: 'XBT/USDT', verified: true },
      coinbase: {
        providerSymbol: 'BTC-USD',
        verified: true,
        note: 'Priced in USD, not USDT — BTC reference.',
      },
      gate: { providerSymbol: 'BTC_USDT', verified: true },
      yahoo: {
        providerSymbol: 'BTC-USD',
        verified: true,
        proxy: true,
        note: 'BTC-USD reference, priced in USD — delayed, via proxy.',
      },
    },
  },
  {
    id: 'XAU/USD',
    label: 'Spot Gold / US Dollar',
    kind: 'spot-gold',
    precision: 2,
    tickSize: 0.01,
    volumeUnit: 'troy ounces (where reported; often 0 for spot FX feeds)',
    providers: {
      // Yahoo (GC=F gold futures) is first: the keyless default for XAU/USD.
      yahoo: {
        providerSymbol: 'GC=F',
        verified: true,
        proxy: true,
        note: 'Gold futures (GC=F), proxy for spot gold — not spot itself.',
      },
      oanda: {
        providerSymbol: 'XAU_USD',
        verified: false,
        note: 'Instrument name XAU_USD is unconfirmed — verified at runtime via the account instruments endpoint before use.',
      },
      twelvedata: { providerSymbol: 'XAU/USD', verified: true },
      stooq: {
        providerSymbol: 'xauusd',
        verified: true,
        proxy: true,
        note: 'Daily, delayed CSV — fallback only.',
      },
      bybit: {
        providerSymbol: 'XAUUSDT',
        verified: false,
        proxy: true,
        note: 'Perpetual contract (XAUUSDT) — live proxy, not spot. Confirm via instruments-info before use.',
      },
      tradingview: {
        providerSymbol: 'OANDA:XAUUSD',
        verified: true,
        note: 'Live quote snapshot only — no candles; ticker fallback, never a chart source.',
      },
    },
  },
  {
    id: 'XAUT/USDT',
    label: 'Tokenized Gold (Tether Gold) / Tether',
    kind: 'tokenized-gold',
    precision: 2,
    tickSize: 0.01,
    volumeUnit: 'XAUT (base asset)',
    providers: {
      binance: { providerSymbol: 'XAUTUSDT', verified: true },
      bybit: { providerSymbol: 'XAUTUSDT', verified: true },
      okx: { providerSymbol: 'XAUT-USDT', verified: true },
      kraken: { providerSymbol: 'XAUT/USD', verified: true },
      gate: { providerSymbol: 'XAUT_USDT', verified: true },
      // After the crypto exchanges: exchange granularity is better.
      coingecko: {
        providerSymbol: 'tether-gold',
        verified: true,
        note: 'Tokenized gold via CoinGecko — 30m/4h candles only (automatic granularity), never spot gold.',
      },
    },
  },
  {
    id: 'PAXG/USDT',
    label: 'Tokenized Gold (Pax Gold) / Tether — gold proxy',
    kind: 'tokenized-gold',
    precision: 2,
    tickSize: 0.01,
    volumeUnit: 'PAXG (base asset)',
    providers: {
      binance: { providerSymbol: 'PAXGUSDT', verified: true },
      okx: { providerSymbol: 'PAXG-USDT', verified: true },
      kraken: { providerSymbol: 'PAXG/USD', verified: true },
      gate: { providerSymbol: 'PAXG_USDT', verified: true },
      bybit: {
        providerSymbol: 'PAXGUSDT',
        verified: false,
        note: 'Not confirmed in the Bybit spot list at implementation time — confirm before use.',
      },
      // After the crypto exchanges: exchange granularity is better.
      coingecko: {
        providerSymbol: 'pax-gold',
        verified: true,
        note: 'Tokenized gold via CoinGecko — 30m/4h candles only (automatic granularity), never spot gold.',
      },
    },
  },
] as const;

/** Timeframes each provider serves natively (no resampling). */
export const PROVIDER_TIMEFRAMES: Record<ProviderId, readonly Timeframe[]> = {
  binance: TIMEFRAMES,
  bybit: TIMEFRAMES,
  okx: TIMEFRAMES,
  kraken: ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'],
  coinbase: ['1m', '5m', '15m', '1h', '6h', '1D'],
  gate: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1D'],
  twelvedata: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1D', '1W', '1M'],
  // All app timeframes except 3m — OANDA has no M3 granularity.
  oanda: TIMEFRAMES.filter((tf) => tf !== '3m'),
  yahoo: ['1m', '5m', '15m', '30m', '1h', '1D', '1W', '1M'],
  stooq: ['1D'],
  // All app timeframes map to a CoinGecko days window (30m/4h candles).
  coingecko: TIMEFRAMES,
  // Quote snapshot only — no candles at any timeframe.
  tradingview: [],
};

export function getRegistrySymbol(id: string): RegistrySymbol | undefined {
  return REGISTRY_SYMBOLS.find((s) => s.id === id);
}

/** Providers that serve a symbol. `verifiedOnly` hides unconfirmed mappings. */
export function providersForSymbol(
  symbolId: string,
  verifiedOnly = false,
): ProviderId[] {
  const symbol = getRegistrySymbol(symbolId);
  if (symbol === undefined) return [];
  return (Object.keys(symbol.providers) as ProviderId[]).filter((providerId) => {
    const entry = symbol.providers[providerId];
    if (entry === undefined) return false;
    if (verifiedOnly && !entry.verified) return false;
    return true;
  });
}

/** Provider-native symbol for an app symbol, or undefined when unsupported. */
export function providerSymbolFor(
  symbolId: string,
  providerId: ProviderId,
): ProviderSymbolEntry | undefined {
  return getRegistrySymbol(symbolId)?.providers[providerId];
}

/** True when the provider natively supports the timeframe (no resampling). */
export function providerSupportsTimeframe(
  providerId: ProviderId,
  timeframe: Timeframe,
): boolean {
  return PROVIDER_TIMEFRAMES[providerId]?.includes(timeframe) ?? false;
}
