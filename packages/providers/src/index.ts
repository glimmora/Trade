/**
 * @trade/providers — market-data provider layer.
 *
 * One adapter per free public provider, one normalized OHLCV contract for
 * all of them. Spot gold (XAU/USD), tokenized gold (XAUT/USDT, PAXG/USDT)
 * and BTC/USDT are distinct instruments and are never substituted for
 * each other — see registry.ts.
 */
export * from './types';
export * from './normalize';
export * from './cache';
export * from './crosscheck';
export * from './registry';
export * from './adapters/index';
