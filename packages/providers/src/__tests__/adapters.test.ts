import { describe, expect, it } from 'vitest';
import { parseBinanceKlines } from '../adapters/binance';
import { parseBybitKlines } from '../adapters/bybit';
import { parseCoinbaseCandles } from '../adapters/coinbase';
import { parseGateCandles } from '../adapters/gate';
import { parseKrakenOhlc } from '../adapters/kraken';
import { parseOkxCandles } from '../adapters/okx';
import { parseStooqCsv } from '../adapters/stooq';
import { parseTwelveDataCandles } from '../adapters/twelvedata';
import { parseYahooChart } from '../adapters/yahoo';
import { createAdapter, adaptersForSymbol } from '../adapters/index';
import binanceFixture from '../fixtures/binance-klines.json';
import bybitFixture from '../fixtures/bybit-klines.json';
import coinbaseFixture from '../fixtures/coinbase-candles.json';
import gateFixture from '../fixtures/gate-candles.json';
import krakenFixture from '../fixtures/kraken-ohlc.json';
import okxFixture from '../fixtures/okx-candles.json';
const stooqFixture = `Date,Open,High,Low,Close,Volume
2026-11-19,4115.00,4122.00,4110.50,4120.00,0
2026-11-20,4120.00,4130.00,4118.00,4128.40,0
2026-11-21,4128.40,4135.00,4125.00,4130.50,0
`;
import twelvedataFixture from '../fixtures/twelvedata-series.json';
import yahooFixture from '../fixtures/yahoo-chart.json';

// Server time just after the last 1h fixture candle closes.
const SERVER_NOW_MS = 1763732400 * 1000;

describe('adapter response parsing (recorded fixtures, no network)', () => {
  it('Binance: ascending, aligned, 3 candles', () => {
    const candles = parseBinanceKlines(binanceFixture, '1h', SERVER_NOW_MS);
    expect(candles).toHaveLength(3);
    expect(candles.map((c) => c.time)).toEqual([1763721600, 1763725200, 1763728800]);
    expect(candles[0]?.close).toBe(96480);
    expect(candles[2]?.volume).toBeCloseTo(11.111, 3);
  });

  it('Bybit: reverses newest-first list into ascending order', () => {
    const candles = parseBybitKlines(bybitFixture, '1h', SERVER_NOW_MS);
    expect(candles.map((c) => c.time)).toEqual([1763721600, 1763725200, 1763728800]);
    expect(candles[2]?.close).toBe(96650);
  });

  it('OKX: reverses newest-first rows into ascending order', () => {
    const candles = parseOkxCandles(okxFixture, '1h', SERVER_NOW_MS);
    expect(candles.map((c) => c.time)).toEqual([1763721600, 1763725200, 1763728800]);
    expect(candles[0]?.open).toBe(96412.5);
  });

  it('Kraken: parses the pair-keyed OHLC object', () => {
    const candles = parseKrakenOhlc(krakenFixture, 'XXBTZUSDT', '1h', SERVER_NOW_MS);
    expect(candles).toHaveLength(3);
    expect(candles[1]?.close).toBe(96590.3);
  });

  it('Coinbase: reorders [time, low, high, open, close, volume] correctly', () => {
    const candles = parseCoinbaseCandles(coinbaseFixture, '1h', SERVER_NOW_MS);
    expect(candles.map((c) => c.time)).toEqual([1763721600, 1763725200, 1763728800]);
    expect(candles[0]?.open).toBe(96412.5);
    expect(candles[0]?.high).toBe(96500);
    expect(candles[0]?.low).toBe(96380.1);
  });

  it('Gate.io: reorders [ts, volume, close, high, low, open] correctly', () => {
    const candles = parseGateCandles(gateFixture, '1h', SERVER_NOW_MS);
    expect(candles.map((c) => c.time)).toEqual([1763721600, 1763725200, 1763728800]);
    expect(candles[2]?.open).toBe(96590.3);
    expect(candles[2]?.close).toBe(96650);
  });

  it('Twelve Data: reverses newest-first values, parses datetimes as UTC', () => {
    const candles = parseTwelveDataCandles(twelvedataFixture, '1h', SERVER_NOW_MS);
    expect(candles).toHaveLength(3);
    expect(candles[0]?.close).toBe(4120);
    expect(candles[2]?.close).toBe(4128.4);
    expect(candles[2]?.volume).toBe(0);
  });

  it('Yahoo: parses chart timestamps and skips null bars', () => {
    const candles = parseYahooChart(yahooFixture, '1h', SERVER_NOW_MS);
    expect(candles).toHaveLength(3);
    expect(candles[2]?.close).toBe(4130.5);
  });

  it('Stooq: parses daily CSV into 1D candles', () => {
    const candles = parseStooqCsv(stooqFixture, SERVER_NOW_MS);
    expect(candles).toHaveLength(3);
    expect(candles[0]?.time).toBe(Math.floor(Date.parse('2026-11-19T00:00:00Z') / 1000));
    expect(candles[2]?.close).toBe(4130.5);
  });

  it('each parser rejects malformed input instead of returning garbage', () => {
    expect(() => parseBinanceKlines({}, '1h', SERVER_NOW_MS)).toThrow();
    expect(() => parseBybitKlines({ retCode: 1 }, '1h', SERVER_NOW_MS)).toThrow();
    expect(() => parseOkxCandles({ code: '1', data: [] }, '1h', SERVER_NOW_MS)).toThrow();
    expect(() => parseYahooChart({}, '1h', SERVER_NOW_MS)).toThrow();
  });
});

describe('adapter factory', () => {
  it('creates every adapter with the right id and capabilities', () => {
    for (const id of ['binance', 'bybit', 'okx', 'kraken', 'coinbase', 'gate', 'twelvedata', 'yahoo', 'stooq'] as const) {
      const adapter = createAdapter(id);
      expect(adapter.id).toBe(id);
      expect(adapter.displayName.length).toBeGreaterThan(0);
      expect(adapter.capabilities.timeframes.length).toBeGreaterThan(0);
    }
  });

  it('Twelve Data needs a key; Kraken rejects unsupported timeframes', async () => {
    const twelvedata = createAdapter('twelvedata');
    await expect(
      twelvedata.getCandles({ symbol: 'XAU/USD', timeframe: '1h' }),
    ).rejects.toThrow(/key/i);
    const kraken = createAdapter('kraken');
    await expect(
      kraken.getCandles({ symbol: 'BTC/USDT', timeframe: '3m' }),
    ).rejects.toThrow(/does not support timeframe/);
  });

  it('adaptersForSymbol lists only providers that serve the symbol', () => {
    const btc = adaptersForSymbol('BTC/USDT').map((a) => a.id);
    expect(btc).toContain('binance');
    expect(btc).not.toContain('twelvedata');
    expect(btc).not.toContain('stooq');
    const gold = adaptersForSymbol('XAU/USD').map((a) => a.id);
    expect(gold).toContain('twelvedata');
    expect(gold).toContain('yahoo');
    expect(gold).toContain('stooq');
    expect(gold).not.toContain('binance');
    const xaut = adaptersForSymbol('XAUT/USDT').map((a) => a.id);
    expect(xaut).toContain('binance');
    expect(xaut).not.toContain('twelvedata');
  });
});
