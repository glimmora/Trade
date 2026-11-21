/**
 * Web Worker entry point for indicator computation.
 *
 * Pure dispatch: the worker receives `{ id, indicatorId, candles, settings }`
 * and posts back `{ id, indicatorId, result }` or `{ id, indicatorId, error }`.
 * No DOM access anywhere in this file. The host installs the handler with
 * `installWorkerHandler()`; calling it outside a worker is a no-op.
 */
import type { Candle, Source } from './types.js';
import { adx, accumulationDistribution, awesomeOscillator, chaikinMoneyFlow, cci, macd, mfi, momentum, obv, roc, rsi, stochRsi, stochastic, volumeWithMa, williamsR } from './oscillators.js';
import {
  atr,
  bollingerBands,
  donchianChannel,
  ichimoku,
  keltnerChannel,
  parabolicSar,
  pivotPoints,
  standardDeviation,
  supertrend,
  vwap,
} from './volatility.js';
import { dema, ema, envelope, hma, maRibbon, sma, tema, vwma, wma } from './movingAverages.js';
import {
  detectBreakRetest,
  detectCandlestickPatterns,
  detectChannels,
  detectDivergence,
  detectFairValueGaps,
  detectMarketStructure,
  detectOrderBlocks,
  detectSupportResistance,
  detectSupplyDemand,
  detectTrendlines,
  fibonacciAuto,
} from './structure.js';
import { sourceSeries } from './utils.js';

export interface WorkerRequest {
  id: string;
  indicatorId: string;
  candles: Candle[];
  settings?: Record<string, unknown>;
}

export type WorkerResponse =
  | { id: string; indicatorId: string; result: unknown }
  | { id: string; indicatorId: string; error: string };

function num(settings: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const v = settings?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(settings: Record<string, unknown> | undefined, key: string, fallback: string): string {
  const v = settings?.[key];
  return typeof v === 'string' ? v : fallback;
}

/** Compute one indicator synchronously; throws on an unknown indicator id. */
export function computeIndicator(request: WorkerRequest): unknown {
  const { indicatorId, candles, settings } = request;
  const closes = candles.map((c) => c.close);
  switch (indicatorId) {
    case 'sma':
      return sma(sourceSeries(candles, str(settings, 'source', 'close') as Source), num(settings, 'period', 50));
    case 'ema':
      return ema(sourceSeries(candles, str(settings, 'source', 'close') as Source), num(settings, 'period', 21));
    case 'wma':
      return wma(sourceSeries(candles, str(settings, 'source', 'close') as Source), num(settings, 'period', 21));
    case 'vwma': {
      const values = sourceSeries(candles, str(settings, 'source', 'close') as Source);
      return vwma(values, candles.map((c) => c.volume), num(settings, 'period', 20));
    }
    case 'hma':
      return hma(sourceSeries(candles, str(settings, 'source', 'close') as Source), num(settings, 'period', 16));
    case 'dema':
      return dema(sourceSeries(candles, str(settings, 'source', 'close') as Source), num(settings, 'period', 21));
    case 'tema':
      return tema(sourceSeries(candles, str(settings, 'source', 'close') as Source), num(settings, 'period', 21));
    case 'ma-ribbon':
      return maRibbon(closes, [5, 8, 13, 21, 34, 55], 'ema');
    case 'envelope':
      return envelope(sourceSeries(candles, str(settings, 'source', 'close') as Source), num(settings, 'period', 20), num(settings, 'percent', 5));
    case 'bollinger':
      return bollingerBands(sourceSeries(candles, str(settings, 'source', 'close') as Source), num(settings, 'period', 20), num(settings, 'multiplier', 2));
    case 'keltner':
      return keltnerChannel(candles, num(settings, 'period', 20), num(settings, 'multiplier', 2), num(settings, 'atrPeriod', 10));
    case 'donchian':
      return donchianChannel(candles, num(settings, 'period', 20));
    case 'ichimoku':
      return ichimoku(candles, num(settings, 'conversionPeriod', 9), num(settings, 'basePeriod', 26), num(settings, 'spanBPeriod', 52), num(settings, 'displacement', 26));
    case 'parabolic-sar':
      return parabolicSar(candles, num(settings, 'step', 0.02), num(settings, 'maxAf', 0.2));
    case 'supertrend':
      return supertrend(candles, num(settings, 'period', 10), num(settings, 'multiplier', 3));
    case 'vwap':
      return vwap(candles, (str(settings, 'anchor', 'day') as 'day' | 'week' | 'session') ?? 'day');
    case 'pivot-points': {
      const last = candles[candles.length - 1];
      if (last === undefined) return undefined;
      return pivotPoints(last.high, last.low, last.close, (str(settings, 'type', 'classic') as 'classic' | 'fibonacci' | 'camarilla') ?? 'classic');
    }
    case 'rsi':
      return rsi(closes, num(settings, 'period', 14));
    case 'stochastic':
      return stochastic(candles, num(settings, 'period', 14), num(settings, 'smoothK', 3), num(settings, 'smoothD', 3));
    case 'stoch-rsi':
      return stochRsi(closes, num(settings, 'rsiPeriod', 14), num(settings, 'stochPeriod', 14), num(settings, 'smoothK', 3), num(settings, 'smoothD', 3));
    case 'macd':
      return macd(closes, num(settings, 'fastPeriod', 12), num(settings, 'slowPeriod', 26), num(settings, 'signalPeriod', 9));
    case 'cci':
      return cci(candles, num(settings, 'period', 20));
    case 'williams-r':
      return williamsR(candles, num(settings, 'period', 14));
    case 'roc':
      return roc(closes, num(settings, 'period', 12));
    case 'momentum':
      return momentum(closes, num(settings, 'period', 10));
    case 'mfi':
      return mfi(candles, num(settings, 'period', 14));
    case 'adx':
      return adx(candles, num(settings, 'period', 14));
    case 'atr':
      return atr(candles, num(settings, 'period', 14));
    case 'obv':
      return obv(candles);
    case 'volume':
      return volumeWithMa(candles, num(settings, 'period', 20));
    case 'accumulation-distribution':
      return accumulationDistribution(candles);
    case 'awesome-oscillator':
      return awesomeOscillator(candles);
    case 'chaikin-money-flow':
      return chaikinMoneyFlow(candles, num(settings, 'period', 20));
    case 'std-dev':
      return standardDeviation(closes, num(settings, 'period', 20));
    case 'support-resistance':
      return detectSupportResistance(candles, {
        pivotLeft: num(settings, 'pivotLeft', 2),
        pivotRight: num(settings, 'pivotRight', 2),
        tolerancePct: num(settings, 'tolerancePct', 0.25),
        minTouches: num(settings, 'minTouches', 2),
      });
    case 'break-retest':
      return detectBreakRetest(candles, {
        tolerancePct: num(settings, 'tolerancePct', 0.25),
        lookback: num(settings, 'lookback', 100),
        minRetestWait: num(settings, 'minRetestWait', 1),
        maxRetestWindow: num(settings, 'maxRetestWindow', 20),
        minRiskReward: num(settings, 'minRiskReward', 2),
        requireConfirmation: settings?.requireConfirmation !== false,
        entryMode: (str(settings, 'entryMode', 'retest') as 'rejection' | 'breakout' | 'retest') ?? 'retest',
      });
    case 'supply-demand':
      return detectSupplyDemand(candles, { retestRequired: settings?.retestRequired === true });
    case 'order-blocks':
      return detectOrderBlocks(candles, num(settings, 'minMovePct', 0.5));
    case 'fair-value-gap':
      return detectFairValueGaps(candles, num(settings, 'minGapPct', 0));
    case 'market-structure':
      return detectMarketStructure(candles, num(settings, 'left', 2), num(settings, 'right', 2));
    case 'trendlines':
      return detectTrendlines(candles, num(settings, 'tolerancePct', 0.25));
    case 'channels':
      return detectChannels(candles, num(settings, 'tolerancePct', 0.25));
    case 'fibonacci':
      return fibonacciAuto(candles, num(settings, 'lookback', 50));
    case 'candlestick-patterns':
      return detectCandlestickPatterns(candles);
    case 'divergence':
      return detectDivergence(candles, (str(settings, 'oscillator', 'rsi') as 'rsi' | 'macd') ?? 'rsi', num(settings, 'period', 14));
    default:
      throw new Error(`Unknown indicator: ${indicatorId}`);
  }
}

/** Dispatch a worker request to a worker response (never throws). */
export function handleWorkerMessage(request: WorkerRequest): WorkerResponse {
  try {
    return { id: request.id, indicatorId: request.indicatorId, result: computeIndicator(request) };
  } catch (error) {
    return {
      id: request.id,
      indicatorId: request.indicatorId,
      error: error instanceof Error ? error.message : 'Unknown worker error',
    };
  }
}

type WorkerScope = {
  onmessage?: ((event: { data: WorkerRequest }) => void) | null;
  postMessage?: (message: WorkerResponse) => void;
};

/** Install `onmessage` on the worker global scope. No-op outside a worker. */
export function installWorkerHandler(): void {
  const scope = globalThis as unknown as WorkerScope;
  if (typeof scope.postMessage !== 'function') return;
  scope.onmessage = (event: { data: WorkerRequest }) => {
    scope.postMessage?.(handleWorkerMessage(event.data));
  };
}

// Auto-install when loaded inside a worker (postMessage exists there).
installWorkerHandler();
