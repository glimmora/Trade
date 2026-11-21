import { BinanceAdapter } from './binance';
import { BybitAdapter } from './bybit';
import { CoinbaseAdapter } from './coinbase';
import { GateAdapter } from './gate';
import { KrakenAdapter } from './kraken';
import { OkxAdapter } from './okx';
import { StooqAdapter } from './stooq';
import { TwelveDataAdapter } from './twelvedata';
import { YahooAdapter } from './yahoo';
import { providersForSymbol } from '../registry';
import type { ProviderAdapter, ProviderClientOptions } from '../types';
import type { ProviderId } from '@trade/core';

export { BinanceAdapter } from './binance';
export { BybitAdapter } from './bybit';
export { CoinbaseAdapter } from './coinbase';
export { GateAdapter } from './gate';
export { KrakenAdapter } from './kraken';
export { OkxAdapter } from './okx';
export { StooqAdapter } from './stooq';
export { TwelveDataAdapter } from './twelvedata';
export { YahooAdapter } from './yahoo';
export { parseBinanceKlines } from './binance';
export { parseBybitKlines } from './bybit';
export { parseOkxCandles } from './okx';
export { parseKrakenOhlc } from './kraken';
export { parseCoinbaseCandles } from './coinbase';
export { parseGateCandles } from './gate';
export { parseTwelveDataCandles } from './twelvedata';
export { parseYahooChart } from './yahoo';
export { parseStooqCsv } from './stooq';

export type AdapterFactory = (options?: ProviderClientOptions) => ProviderAdapter;

export const ADAPTER_FACTORIES: Record<ProviderId, AdapterFactory> = {
  binance: (options) => new BinanceAdapter(options),
  bybit: (options) => new BybitAdapter(options),
  okx: (options) => new OkxAdapter(options),
  kraken: (options) => new KrakenAdapter(options),
  coinbase: (options) => new CoinbaseAdapter(options),
  gate: (options) => new GateAdapter(options),
  twelvedata: (options) => new TwelveDataAdapter(options),
  yahoo: (options) => new YahooAdapter(options),
  stooq: (options) => new StooqAdapter(options),
};

export function createAdapter(
  providerId: ProviderId,
  options?: ProviderClientOptions,
): ProviderAdapter {
  return ADAPTER_FACTORIES[providerId](options);
}

/** Adapters that can serve a symbol. `verifiedOnly` hides unconfirmed mappings. */
export function adaptersForSymbol(
  symbolId: string,
  options?: ProviderClientOptions,
  verifiedOnly = false,
): ProviderAdapter[] {
  return providersForSymbol(symbolId, verifiedOnly).map((providerId) =>
    createAdapter(providerId, options),
  );
}
