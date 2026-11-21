import { describe, expect, it } from 'vitest';
import {
  PROVIDER_TIMEFRAMES,
  REGISTRY_SYMBOLS,
  getRegistrySymbol,
  providerSupportsTimeframe,
  providerSymbolFor,
  providersForSymbol,
} from '../registry';

describe('registry symbols', () => {
  it('lists four distinct instruments with distinct identities', () => {
    const ids = REGISTRY_SYMBOLS.map((s) => s.id);
    expect(ids).toEqual(['BTC/USDT', 'XAU/USD', 'XAUT/USDT', 'PAXG/USDT']);
    expect(getRegistrySymbol('XAU/USD')?.kind).toBe('spot-gold');
    expect(getRegistrySymbol('XAUT/USDT')?.kind).toBe('tokenized-gold');
    expect(getRegistrySymbol('PAXG/USDT')?.kind).toBe('tokenized-gold');
    expect(getRegistrySymbol('BTC/USDT')?.kind).toBe('crypto');
  });

  it('lists Yahoo (GC=F gold futures) first for XAU/USD — the keyless default', () => {
    expect(providersForSymbol('XAU/USD')[0]).toBe('yahoo');
    expect(providersForSymbol('XAU/USD', true)[0]).toBe('yahoo');
    expect(providerSymbolFor('XAU/USD', 'yahoo')?.verified).toBe(true);
    expect(providerSymbolFor('XAU/USD', 'yahoo')?.proxy).toBe(true);
  });

  it('never lists spot-gold providers for tokenized gold or vice versa', () => {
    expect(providersForSymbol('XAU/USD')).toEqual(
      expect.arrayContaining(['twelvedata', 'yahoo', 'stooq']),
    );
    expect(providersForSymbol('XAU/USD')).not.toContain('binance');
    expect(providersForSymbol('XAUT/USDT')).not.toContain('twelvedata');
    expect(providersForSymbol('XAUT/USDT')).not.toContain('yahoo');
    expect(providersForSymbol('XAUT/USDT')).not.toContain('stooq');
    // CoinGecko serves tokenized gold only — never spot gold.
    expect(providersForSymbol('XAU/USD')).not.toContain('coingecko');
    expect(providersForSymbol('PAXG/USDT')).toContain('coingecko');
    expect(providersForSymbol('XAUT/USDT')).toContain('coingecko');
    // TradingView Scanner serves the spot-gold quote only — never tokenized gold.
    expect(providersForSymbol('XAU/USD')).toContain('tradingview');
    expect(providersForSymbol('XAUT/USDT')).not.toContain('tradingview');
    expect(providersForSymbol('PAXG/USDT')).not.toContain('tradingview');
  });

  it('flags proxies explicitly and marks unverified mappings', () => {
    const yahooGold = providerSymbolFor('XAU/USD', 'yahoo');
    expect(yahooGold?.proxy).toBe(true);
    expect(yahooGold?.providerSymbol).toBe('GC=F');
    const bybitGold = providerSymbolFor('XAU/USD', 'bybit');
    expect(bybitGold?.proxy).toBe(true);
    expect(bybitGold?.verified).toBe(false);
    const bybitPaxg = providerSymbolFor('PAXG/USDT', 'bybit');
    expect(bybitPaxg?.verified).toBe(false);
    // verifiedOnly hides unconfirmed mappings.
    expect(providersForSymbol('XAU/USD', true)).not.toContain('bybit');
    expect(providersForSymbol('PAXG/USDT', true)).not.toContain('bybit');
  });

  it('maps Kraken tokenized gold to USD pairs (Kraken lists no USDT pair)', () => {
    expect(providerSymbolFor('PAXG/USDT', 'kraken')?.providerSymbol).toBe('PAXG/USD');
    expect(providerSymbolFor('XAUT/USDT', 'kraken')?.providerSymbol).toBe('XAUT/USD');
  });

  it('lists CoinGecko after the crypto exchanges, never as the default', () => {
    const paxg = providersForSymbol('PAXG/USDT');
    const xaut = providersForSymbol('XAUT/USDT');
    expect(paxg.indexOf('coingecko')).toBeGreaterThan(paxg.indexOf('binance'));
    expect(xaut.indexOf('coingecko')).toBeGreaterThan(xaut.indexOf('binance'));
    expect(providerSymbolFor('PAXG/USDT', 'coingecko')?.providerSymbol).toBe('pax-gold');
    expect(providerSymbolFor('XAUT/USDT', 'coingecko')?.providerSymbol).toBe('tether-gold');
    expect(providerSymbolFor('PAXG/USDT', 'coingecko')?.verified).toBe(true);
    expect(providerSymbolFor('XAUT/USDT', 'coingecko')?.verified).toBe(true);
  });

  it('lists TradingView Scanner after the other spot-gold providers', () => {
    const xau = providersForSymbol('XAU/USD');
    expect(xau.indexOf('tradingview')).toBeGreaterThan(xau.indexOf('twelvedata'));
    expect(xau.indexOf('tradingview')).toBeGreaterThan(xau.indexOf('yahoo'));
    expect(xau.indexOf('tradingview')).toBeGreaterThan(xau.indexOf('oanda'));
    expect(providerSymbolFor('XAU/USD', 'tradingview')?.providerSymbol).toBe('OANDA:XAUUSD');
    expect(providerSymbolFor('XAU/USD', 'tradingview')?.verified).toBe(true);
  });
  it('gives every registry symbol a positive tick size and precision', () => {
    for (const symbol of REGISTRY_SYMBOLS) {
      expect(symbol.tickSize).toBeGreaterThan(0);
      expect(symbol.volumeUnit.length).toBeGreaterThan(0);
      expect(symbol.precision).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns undefined for unknown symbols', () => {
    expect(getRegistrySymbol('ETH/USDT')).toBeUndefined();
    expect(providersForSymbol('ETH/USDT')).toEqual([]);
  });
});

describe('provider timeframes', () => {
  it('excludes timeframes a provider cannot serve natively', () => {
    expect(providerSupportsTimeframe('kraken', '3m')).toBe(false);
    expect(providerSupportsTimeframe('kraken', '1h')).toBe(true);
    expect(providerSupportsTimeframe('kraken', '2h')).toBe(false);
    expect(providerSupportsTimeframe('kraken', '6h')).toBe(false);
    expect(providerSupportsTimeframe('kraken', '12h')).toBe(false);
    expect(providerSupportsTimeframe('kraken', '1M')).toBe(false);
    expect(PROVIDER_TIMEFRAMES.kraken).toEqual([
      '1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W',
    ]);
    expect(providerSupportsTimeframe('coinbase', '1D')).toBe(true);
    expect(providerSupportsTimeframe('coinbase', '4h')).toBe(false);
    expect(providerSupportsTimeframe('stooq', '1D')).toBe(true);
    expect(providerSupportsTimeframe('stooq', '1h')).toBe(false);
    expect(providerSupportsTimeframe('binance', '1M')).toBe(true);
    expect(providerSupportsTimeframe('gate', '1W')).toBe(false);
    expect(providerSupportsTimeframe('yahoo', '2h')).toBe(false);
    // CoinGecko maps every app timeframe to a days window.
    expect(providerSupportsTimeframe('coingecko', '1m')).toBe(true);
    expect(providerSupportsTimeframe('coingecko', '1M')).toBe(true);
    // TradingView Scanner serves no candles at any timeframe.
    expect(providerSupportsTimeframe('tradingview', '1D')).toBe(false);
    expect(providerSupportsTimeframe('tradingview', '1m')).toBe(false);
  });

  it('covers every provider in the registry', () => {
    expect(Object.keys(PROVIDER_TIMEFRAMES).sort()).toEqual(
      ['binance', 'bybit', 'coingecko', 'coinbase', 'gate', 'kraken', 'oanda', 'okx', 'stooq', 'tradingview', 'twelvedata', 'yahoo'].sort(),
    );
  });
});
