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

  it('never lists spot-gold providers for tokenized gold or vice versa', () => {
    expect(providersForSymbol('XAU/USD')).toEqual(
      expect.arrayContaining(['twelvedata', 'yahoo', 'stooq']),
    );
    expect(providersForSymbol('XAU/USD')).not.toContain('binance');
    expect(providersForSymbol('XAUT/USDT')).not.toContain('twelvedata');
    expect(providersForSymbol('XAUT/USDT')).not.toContain('yahoo');
    expect(providersForSymbol('XAUT/USDT')).not.toContain('stooq');
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

  it('documents tick size and volume units per symbol', () => {
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
    expect(providerSupportsTimeframe('coinbase', '1D')).toBe(true);
    expect(providerSupportsTimeframe('coinbase', '4h')).toBe(false);
    expect(providerSupportsTimeframe('stooq', '1D')).toBe(true);
    expect(providerSupportsTimeframe('stooq', '1h')).toBe(false);
    expect(providerSupportsTimeframe('binance', '1M')).toBe(true);
    expect(providerSupportsTimeframe('gate', '1W')).toBe(false);
    expect(providerSupportsTimeframe('yahoo', '2h')).toBe(false);
  });

  it('covers every provider in the registry', () => {
    expect(Object.keys(PROVIDER_TIMEFRAMES).sort()).toEqual(
      ['binance', 'bybit', 'coinbase', 'gate', 'kraken', 'oanda', 'okx', 'stooq', 'twelvedata', 'yahoo'].sort(),
    );
  });
});
