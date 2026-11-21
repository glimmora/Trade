import { describe, expect, it } from 'vitest';
import { BinanceAdapter, parseBinanceKlines } from '../adapters/binance';
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
    expect(candles.map((c) => c.time)).toEqual([1763719200, 1763722800, 1763726400]);
    expect(candles[0]?.close).toBe(96480);
    expect(candles[2]?.volume).toBeCloseTo(11.111, 3);
  });

  it('Bybit: reverses newest-first list into ascending order', () => {
    const candles = parseBybitKlines(bybitFixture, '1h', SERVER_NOW_MS);
    expect(candles.map((c) => c.time)).toEqual([1763719200, 1763722800, 1763726400]);
    expect(candles[2]?.close).toBe(96650);
  });

  it('OKX: reverses newest-first rows into ascending order', () => {
    const candles = parseOkxCandles(okxFixture, '1h', SERVER_NOW_MS);
    expect(candles.map((c) => c.time)).toEqual([1763719200, 1763722800, 1763726400]);
    expect(candles[0]?.open).toBe(96412.5);
  });

  it('Kraken: parses the pair-keyed OHLC object', () => {
    const candles = parseKrakenOhlc(krakenFixture, 'XXBTZUSDT', '1h', SERVER_NOW_MS);
    expect(candles).toHaveLength(3);
    expect(candles[1]?.close).toBe(96590.3);
  });

  it('Coinbase: reorders [time, low, high, open, close, volume] correctly', () => {
    const candles = parseCoinbaseCandles(coinbaseFixture, '1h', SERVER_NOW_MS);
    expect(candles.map((c) => c.time)).toEqual([1763719200, 1763722800, 1763726400]);
    expect(candles[0]?.open).toBe(96412.5);
    expect(candles[0]?.high).toBe(96500);
    expect(candles[0]?.low).toBe(96380.1);
  });

  it('Gate.io: reorders [ts, volume, close, high, low, open] correctly', () => {
    const candles = parseGateCandles(gateFixture, '1h', SERVER_NOW_MS);
    expect(candles.map((c) => c.time)).toEqual([1763719200, 1763722800, 1763726400]);
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

  it('Yahoo rejects unsupported timeframes instead of substituting', async () => {
    const yahoo = createAdapter('yahoo');
    for (const timeframe of ['3m', '2h', '4h', '6h', '12h'] as const) {
      await expect(
        yahoo.getCandles({ symbol: 'XAU/USD', timeframe }),
      ).rejects.toThrow(/does not support timeframe/);
    }
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
    const paxg = adaptersForSymbol('PAXG/USDT').map((a) => a.id);
    expect(paxg).toContain('binance');
    expect(paxg).toContain('kraken');
    expect(paxg).not.toContain('twelvedata');
  });
});

type FetchStub = typeof fetch;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** fetch stub: the primary host geo-blocks (451); the fallback host serves. */
function geoBlockedFetch(calls: string[]): FetchStub {
  // eslint-disable-next-line @typescript-eslint/require-await -- handler must return Promise<Response> per FetchStub (typeof fetch)
  const handler = async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    if (url.startsWith('https://api.binance.com')) {
      return jsonResponse(
        { code: 0, msg: 'Service unavailable from a restricted location' },
        451,
      );
    }
    if (url.startsWith('https://data-api.binance.vision/api/v3/klines')) {
      return jsonResponse(binanceFixture, 200);
    }
    if (url.startsWith('https://data-api.binance.vision/api/v3/time')) {
      return jsonResponse({ serverTime: SERVER_NOW_MS }, 200);
    }
    if (url.startsWith('https://data-api.binance.vision/api/v3/ticker/price')) {
      return jsonResponse({ symbol: 'BTCUSDT', price: '96480.00' }, 200);
    }
    return jsonResponse({ code: -1121, msg: 'Invalid symbol.' }, 400);
  };
  return handler;
}

/** fetch stub: every host geo-blocks (451). */
function alwaysGeoBlockedFetch(calls: string[]): FetchStub {
  // eslint-disable-next-line @typescript-eslint/require-await -- handler must return Promise<Response> per FetchStub (typeof fetch)
  const handler = async (input: string | URL | Request): Promise<Response> => {
    calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return jsonResponse(
      { code: 0, msg: 'Service unavailable from a restricted location' },
      451,
    );
  };
  return handler;
}

describe('Binance geo-restriction fallback (data-api.binance.vision)', () => {
  it('retries klines on the fallback host when the primary host answers 451', async () => {
    const calls: string[] = [];
    const binance = new BinanceAdapter({ fetchFn: geoBlockedFetch(calls) });
    const candles = await binance.getCandles({ symbol: 'BTC/USDT', timeframe: '1h' });
    expect(candles).toHaveLength(3);
    expect(candles.map((c) => c.time)).toEqual([1763719200, 1763722800, 1763726400]);
    expect(
      calls.some((url) => url.startsWith('https://data-api.binance.vision/api/v3/klines')),
    ).toBe(true);
    expect(
      calls.some((url) => url.startsWith('https://data-api.binance.vision/api/v3/time')),
    ).toBe(true);
  });

  it('retries the ticker on the fallback host when the primary host answers 451', async () => {
    const calls: string[] = [];
    const binance = new BinanceAdapter({ fetchFn: geoBlockedFetch(calls) });
    const ticker = await binance.getTicker('BTC/USDT');
    expect(ticker.price).toBe(96480);
    expect(ticker.providerSymbol).toBe('BTCUSDT');
    expect(
      calls.some((url) =>
        url.startsWith('https://data-api.binance.vision/api/v3/ticker/price'),
      ),
    ).toBe(true);
  });

  it('does not fall back when baseUrl is set explicitly', async () => {
    const calls: string[] = [];
    const binance = new BinanceAdapter({
      baseUrl: 'https://api.binance.com',
      fetchFn: geoBlockedFetch(calls),
    });
    await expect(binance.getTicker('BTC/USDT')).rejects.toThrow('HTTP 451 from api.binance.com');
    expect(calls.some((url) => url.includes('data-api.binance.vision'))).toBe(false);
  });

  it('throws the original error when the fallback host also geo-blocks', async () => {
    const calls: string[] = [];
    const binance = new BinanceAdapter({ fetchFn: alwaysGeoBlockedFetch(calls) });
    await expect(binance.getTicker('BTC/USDT')).rejects.toThrow('HTTP 451 from api.binance.com');
    expect(calls).toHaveLength(2);
  });
});
