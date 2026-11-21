import { useEffect, useState } from 'react';
import type { Candle, ProviderId, Timeframe } from '@trade/core';
import { createAdapter, providersForSymbol as registryProvidersForSymbol } from '@trade/providers';
import type { LiveTick, ProviderAdapter, ProviderClientOptions, ProviderRuntimeKeys } from '@trade/providers';
import { mergeLiveTick } from '../chart/live';
import { providerMeta } from './providers';
import { useApp } from '../store/state';
import type { ConnectionStatus } from '../store/state';

export interface MarketDataResult {
  candles: readonly Candle[];
  status: ConnectionStatus;
  error: string | null;
}

const TWELVE_DATA_KEY_STORAGE_KEY = 'trade:twelvedata-key';
const OANDA_TOKEN_STORAGE_KEY = 'trade:oanda-token';
const OANDA_ACCOUNT_ID_STORAGE_KEY = 'trade:oanda-account-id';
const CANDLE_LIMIT = 500;
/** Providers that need the proxy worker, which is not deployed. Yahoo is not
 * listed: it goes through the same-origin Vercel function at /api/yahoo. */
const PROXY_DEPENDENT_PROVIDERS: readonly ProviderId[] = ['stooq'];

interface EntrySnapshot {
  candles: readonly Candle[];
  status: ConnectionStatus;
  error: string | null;
}

type EntryListener = (snapshot: EntrySnapshot) => void;

interface StoreCallbacks {
  setConnection: (status: ConnectionStatus) => void;
  setLastPrice: (price: number | null) => void;
  pushToast: (message: string, kind?: 'info' | 'success' | 'warning') => void;
}

/**
 * One shared fetch + subscription per (provider, symbol, timeframe).
 * Every hook instance mounted for the same key joins this entry instead of
 * starting its own request; the entry lives while its refcount is > 0.
 */
interface SharedEntry {
  key: string;
  provider: ProviderId;
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  status: ConnectionStatus;
  error: string | null;
  refcount: number;
  listeners: Set<EntryListener>;
  /** Adapter that served the current series (primary, or the fallback). */
  adapter: ProviderAdapter | null;
  /** Bumped on dispose so stale async work can recognise itself. */
  generation: number;
  disposed: boolean;
}

const entries = new Map<string, SharedEntry>();

/** Keys that already showed the offline toast, so one failed series never
 * stacks the same warning once per chart panel or per view switch. Cleared
 * when that series loads successfully. */
const offlineToasted = new Set<string>();

function entryKey(provider: ProviderId, symbol: string, timeframe: Timeframe): string {
  return `${provider}\n${symbol}\n${timeframe}`;
}

function snapshotOf(entry: SharedEntry): EntrySnapshot {
  return { candles: entry.candles, status: entry.status, error: entry.error };
}

function notify(entry: SharedEntry): void {
  const snapshot = snapshotOf(entry);
  for (const listener of [...entry.listeners]) {
    listener(snapshot);
  }
}

function readTwelveDataKey(): string | undefined {
  try {
    const raw = window.localStorage.getItem(TWELVE_DATA_KEY_STORAGE_KEY);
    const key = raw === null ? undefined : raw.trim();
    return key === undefined || key === '' ? undefined : key;
  } catch {
    return undefined;
  }
}

function readOandaToken(): string | undefined {
  try {
    const raw = window.localStorage.getItem(OANDA_TOKEN_STORAGE_KEY);
    const key = raw === null ? undefined : raw.trim();
    return key === undefined || key === '' ? undefined : key;
  } catch {
    return undefined;
  }
}

function readOandaAccountId(): string | undefined {
  try {
    const raw = window.localStorage.getItem(OANDA_ACCOUNT_ID_STORAGE_KEY);
    const key = raw === null ? undefined : raw.trim();
    return key === undefined || key === '' ? undefined : key;
  } catch {
    return undefined;
  }
}

function adapterOptions(
  twelveDataKey: string | undefined,
  oandaToken: string | undefined,
  oandaAccountId: string | undefined,
): ProviderClientOptions {
  const keys: ProviderRuntimeKeys = {};
  if (twelveDataKey !== undefined) keys.twelvedata = twelveDataKey;
  if (oandaToken !== undefined) keys.oanda = oandaToken;
  if (oandaAccountId !== undefined) keys.oandaAccountId = oandaAccountId;
  return Object.keys(keys).length === 0 ? {} : { keys };
}

/**
 * The single fallback candidate: the next verified provider for the symbol
 * in registry order, excluding the failed one. Twelve Data is skipped when
 * no key is stored; OANDA is skipped when no token is stored; stooq is
 * skipped (it needs the proxy worker). Yahoo is keyless and served by the
 * same-origin /api/yahoo function, so it is an eligible fallback.
 */
function fallbackCandidates(
  symbol: string,
  failed: ProviderId,
  twelveDataKey: string | undefined,
  oandaToken: string | undefined,
): ProviderId[] {
  return registryProvidersForSymbol(symbol, true).filter((candidate) => {
    if (candidate === failed) return false;
    if (candidate === 'twelvedata' && twelveDataKey === undefined) return false;
    if (candidate === 'oanda' && oandaToken === undefined) return false;
    if (PROXY_DEPENDENT_PROVIDERS.includes(candidate)) return false;
    return true;
  });
}

function onTick(entry: SharedEntry, tick: LiveTick, callbacks: StoreCallbacks): void {
  if (entry.disposed || entries.get(entry.key) !== entry) return;
  const merged = mergeLiveTick(entry.candles, tick.candle);
  if (merged.result === 'ignored') return;
  entry.candles = merged.candles;
  callbacks.setLastPrice(tick.candle.close);
  notify(entry);
}

/**
 * Resync one entry from scratch: primary provider, then at most one
 * fallback. An empty history counts as a failure for fallback purposes.
 * Stale results (entry disposed or superseded) are never applied.
 */
async function loadEntry(entry: SharedEntry, callbacks: StoreCallbacks): Promise<void> {
  const generation = entry.generation;
  const isCurrent = (): boolean =>
    !entry.disposed && entry.generation === generation && entries.get(entry.key) === entry;
  const twelveDataKey = readTwelveDataKey();
  const oandaToken = readOandaToken();
  const oandaAccountId = readOandaAccountId();
  const attempts: readonly ProviderId[] = [
    entry.provider,
    ...fallbackCandidates(entry.symbol, entry.provider, twelveDataKey, oandaToken).slice(0, 1),
  ];

  for (const providerId of attempts) {
    if (!isCurrent()) return;
    let adapter: ProviderAdapter | null = null;
    try {
      adapter = createAdapter(providerId, adapterOptions(twelveDataKey, oandaToken, oandaAccountId));
      const candles = await adapter.getCandles({
        symbol: entry.symbol,
        timeframe: entry.timeframe,
        limit: CANDLE_LIMIT,
      });
      if (!isCurrent()) return;
      if (candles.length === 0) {
        throw new Error(`No candles returned by ${providerId}`);
      }
      await adapter.subscribe(entry.symbol, entry.timeframe, (tick) => { onTick(entry, tick, callbacks); },
      );
      if (!isCurrent()) {
        await adapter.unsubscribe(entry.symbol, entry.timeframe).catch(() => undefined);
        return;
      }
      // Success: the whole series comes from this one provider only.
      offlineToasted.delete(entry.key);
      entry.adapter = adapter;
      entry.candles = candles;
      entry.status = providerMeta(providerId).delayed ? 'delayed' : 'live';
      entry.error = null;
      const last = candles[candles.length - 1];
      if (last !== undefined) {
        callbacks.setLastPrice(last.close);
      }
      callbacks.setConnection(entry.status);
      notify(entry);
      return;
    } catch {
      if (adapter !== null) {
        await adapter.unsubscribe(entry.symbol, entry.timeframe).catch(() => undefined);
      }
      // Fall through to the single fallback, or to offline below.
    }
  }

  if (!isCurrent()) return;
  entry.adapter = null;
  entry.candles = [];
  entry.status = 'offline';
  entry.error = 'Market data unavailable';
  callbacks.setConnection('offline');
  if (!offlineToasted.has(entry.key)) {
    offlineToasted.add(entry.key);
    callbacks.pushToast('Market data unavailable — check your connection and try again.', 'warning');
  }
  notify(entry);
}

function acquireEntry(
  provider: ProviderId,
  symbol: string,
  timeframe: Timeframe,
  callbacks: StoreCallbacks,
): SharedEntry {
  const key = entryKey(provider, symbol, timeframe);
  const existing = entries.get(key);
  if (existing !== undefined) {
    existing.refcount += 1;
    return existing;
  }
  const entry: SharedEntry = {
    key,
    provider,
    symbol,
    timeframe,
    candles: [],
    status: 'connecting',
    error: null,
    refcount: 1,
    listeners: new Set(),
    adapter: null,
    generation: 0,
    disposed: false,
  };
  entries.set(key, entry);
  callbacks.setConnection('connecting');
  void loadEntry(entry, callbacks);
  return entry;
}

async function releaseEntry(entry: SharedEntry): Promise<void> {
  entry.refcount -= 1;
  if (entry.refcount > 0) return;
  entry.disposed = true;
  entry.generation += 1;
  entries.delete(entry.key);
  const adapter = entry.adapter;
  entry.adapter = null;
  if (adapter !== null) {
    await adapter.unsubscribe(entry.symbol, entry.timeframe).catch(() => undefined);
  }
}

const EMPTY_SNAPSHOT: EntrySnapshot = { candles: [], status: 'connecting', error: null };

/**
 * Live market data for the current provider / symbol / timeframe.
 *
 * One fetch + subscription is shared per (provider, symbol, timeframe) via
 * a module-level refcounted cache, so several chart panels never duplicate
 * requests. Switching provider/symbol/timeframe discards the old series
 * entirely and resyncs from the new provider; no data is ever faked —
 * candles stay empty and the price stays null until real data arrives.
 */
export function useMarketData(): MarketDataResult {
  const { state, setConnection, setLastPrice, pushToast } = useApp();
  const provider = state.provider;
  const symbol = state.symbol;
  const timeframe = state.timeframe;

  const [snapshot, setSnapshot] = useState<EntrySnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    // Discard the old series immediately; never mix providers in one series.
    setSnapshot(EMPTY_SNAPSHOT);
    setLastPrice(null);
    const callbacks: StoreCallbacks = { setConnection, setLastPrice, pushToast };
    const entry = acquireEntry(provider, symbol, timeframe, callbacks);
    // Join the shared entry: pick up whatever it has already loaded.
    setSnapshot(snapshotOf(entry));
    const listener: EntryListener = (next) => {
      setSnapshot(next);
    };
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
      void releaseEntry(entry);
    };
  }, [provider, symbol, timeframe, setConnection, setLastPrice, pushToast]);

  return snapshot;
}
