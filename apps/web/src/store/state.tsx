import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { SYMBOLS, TIMEFRAMES, type ProviderId, type Timeframe } from '@trade/core';
import type { PriceScaleKind } from '../chart/types';
import { t } from '../i18n';
import type { DictKey, Language } from '../i18n';
import { firstProviderForSymbol } from '../lib/providers';
import { catalogEntry } from '../lib/indicators';
import { playAlertSound } from '../lib/sound';
import { uid } from '../lib/utils';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ChartType =
  | 'candlestick'
  | 'hollow'
  | 'bar'
  | 'line'
  | 'area'
  | 'heikin-ashi'
  | 'baseline';
export type LayoutMode = '1' | '2' | '2x2';
export type ConnectionStatus = 'connecting' | 'live' | 'delayed' | 'offline';

export interface IndicatorInstance {
  id: string;
  kind: string;
  visible: boolean;
  period: number | null;
  color: string;
  lineWidth: number;
}

export interface DrawingObject {
  id: string;
  tool: string;
  label: string;
  visible: boolean;
  locked: boolean;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  enabled: boolean;
  createdAt: number;
}

export interface Toast {
  id: string;
  message: string;
  kind: 'info' | 'success' | 'warning';
}

export interface AppState {
  version: 1;
  symbol: string;
  timeframe: Timeframe;
  chartType: ChartType;
  priceScale: PriceScaleKind;
  provider: ProviderId;
  theme: ThemeMode;
  language: Language;
  layout: LayoutMode;
  activeTool: string | null;
  magnet: boolean;
  indicators: IndicatorInstance[];
  drawings: DrawingObject[];
  alerts: PriceAlert[];
  panes: string[];
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  sidebarOpen: boolean;
}

export const STATE_STORAGE_KEY = 'trade:state:v1';
export const STATE_VERSION = 1;

const CHART_TYPES: readonly ChartType[] = [
  'candlestick',
  'hollow',
  'bar',
  'line',
  'area',
  'heikin-ashi',
  'baseline',
] as const;

const LAYOUTS: readonly LayoutMode[] = ['1', '2', '2x2'] as const;

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  candlestick: 'Candlestick',
  hollow: 'Hollow candles',
  bar: 'Bar (OHLC)',
  line: 'Line',
  area: 'Area',
  'heikin-ashi': 'Heikin-Ashi',
  baseline: 'Baseline',
};

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function asIndicators(value: unknown): IndicatorInstance[] {
  if (!Array.isArray(value)) return [];
  const out: IndicatorInstance[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const kind = typeof entry.kind === 'string' ? entry.kind : null;
    const id = typeof entry.id === 'string' ? entry.id : null;
    if (!kind || !id) continue;
    out.push({
      id,
      kind,
      visible: asBoolean(entry.visible, true),
      period: typeof entry.period === 'number' ? entry.period : null,
      color: typeof entry.color === 'string' ? entry.color : '#2563eb',
      lineWidth: typeof entry.lineWidth === 'number' ? entry.lineWidth : 1,
    });
  }
  return out;
}

function asDrawings(value: unknown): DrawingObject[] {
  if (!Array.isArray(value)) return [];
  const out: DrawingObject[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const tool = typeof entry.tool === 'string' ? entry.tool : null;
    const id = typeof entry.id === 'string' ? entry.id : null;
    if (!tool || !id) continue;
    out.push({
      id,
      tool,
      label: typeof entry.label === 'string' ? entry.label : tool,
      visible: asBoolean(entry.visible, true),
      locked: asBoolean(entry.locked, false),
    });
  }
  return out;
}

function asAlerts(value: unknown): PriceAlert[] {
  if (!Array.isArray(value)) return [];
  const out: PriceAlert[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === 'string' ? entry.id : null;
    const symbol = typeof entry.symbol === 'string' ? entry.symbol : null;
    const price = typeof entry.price === 'number' && Number.isFinite(entry.price) ? entry.price : null;
    if (!id || !symbol || price === null) continue;
    out.push({
      id,
      symbol,
      condition: entry.condition === 'below' ? 'below' : 'above',
      price,
      enabled: asBoolean(entry.enabled, true),
      createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
    });
  }
  return out;
}

export function defaultState(): AppState {
  const firstSymbol = SYMBOLS[0];
  const symbol = firstSymbol ? firstSymbol.id : 'BTC/USDT';
  return {
    version: STATE_VERSION,
    symbol,
    timeframe: '1h',
    chartType: 'candlestick',
    priceScale: 'linear',
    provider: firstProviderForSymbol(symbol) ?? 'binance',
    theme: 'system',
    language: 'en',
    layout: '1',
    activeTool: null,
    magnet: true,
    indicators: [],
    drawings: [],
    alerts: [],
    panes: [],
    soundEnabled: true,
    notificationsEnabled: false,
    sidebarOpen: true,
  };
}

/**
 * Migrate a stored value to the current schema. Unknown or older shapes fall
 * back to defaults field by field (migration stub for v0 → v1: a v0 document
 * is any stored object without `version: 1`; its theme, if present, is kept).
 */
export function migrateState(value: unknown): AppState {
  const base = defaultState();
  if (!isRecord(value)) return base;
  const symbol =
    typeof value.symbol === 'string' && SYMBOLS.some((entry) => entry.id === value.symbol)
      ? value.symbol
      : base.symbol;
  const provider = asEnum<ProviderId>(
    value.provider,
    ['binance', 'bybit', 'okx', 'kraken', 'coinbase', 'gate', 'twelvedata', 'oanda', 'yahoo', 'stooq'],
    base.provider,
  );
  return {
    version: STATE_VERSION,
    symbol,
    timeframe: asEnum<Timeframe>(value.timeframe, TIMEFRAMES, base.timeframe),
    chartType: asEnum<ChartType>(value.chartType, CHART_TYPES, base.chartType),
    priceScale: asEnum<PriceScaleKind>(
      value.priceScale,
      ['linear', 'log', 'percentage'],
      base.priceScale,
    ),
    provider,
    theme: asEnum<ThemeMode>(value.theme, ['light', 'dark', 'system'], base.theme),
    language: asEnum<Language>(value.language, ['en', 'id'], base.language),
    layout: asEnum<LayoutMode>(value.layout, LAYOUTS, base.layout),
    activeTool: typeof value.activeTool === 'string' ? value.activeTool : null,
    magnet: asBoolean(value.magnet, true),
    indicators: asIndicators(value.indicators),
    drawings: asDrawings(value.drawings),
    alerts: asAlerts(value.alerts),
    panes: asStringArray(value.panes),
    soundEnabled: asBoolean(value.soundEnabled, true),
    notificationsEnabled: asBoolean(value.notificationsEnabled, false),
    sidebarOpen: asBoolean(value.sidebarOpen, true),
  };
}

function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STATE_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      return migrateState(parsed);
    }
    // Legacy v0: only the theme was persisted under its own key.
    const legacyTheme = window.localStorage.getItem('trade:theme');
    const base = defaultState();
    if (legacyTheme === 'light' || legacyTheme === 'dark' || legacyTheme === 'system') {
      base.theme = legacyTheme;
    }
    return base;
  } catch {
    return defaultState();
  }
}

export interface AppStore {
  state: AppState;
  translate: (key: DictKey) => string;
  connection: ConnectionStatus;
  lastPrice: number | null;
  lastUpdateAt: number | null;
  toasts: Toast[];
  pushToast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
  setConnection: (status: ConnectionStatus) => void;
  setLastPrice: (price: number | null) => void;
  checkAlerts: (price: number) => void;
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setChartType: (chartType: ChartType) => void;
  setPriceScale: (priceScale: PriceScaleKind) => void;
  setProvider: (provider: ProviderId) => void;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: Language) => void;
  setLayout: (layout: LayoutMode) => void;
  setActiveTool: (tool: string | null) => void;
  toggleMagnet: () => void;
  toggleSidebar: () => void;
  addIndicator: (kind: string) => void;
  removeIndicator: (id: string) => void;
  toggleIndicator: (id: string) => void;
  moveIndicator: (id: string, direction: -1 | 1) => void;
  updateIndicator: (id: string, patch: Partial<Omit<IndicatorInstance, 'id' | 'kind'>>) => void;
  addDrawing: (tool: string) => void;
  removeDrawing: (id: string) => void;
  toggleDrawingVisibility: (id: string) => void;
  toggleDrawingLock: (id: string) => void;
  duplicateDrawing: (id: string) => void;
  clearDrawings: () => void;
  addAlert: (symbol: string, condition: 'above' | 'below', price: number) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  addPane: (kind: string) => void;
  removePane: (kind: string) => void;
  exportState: () => string;
  importState: (json: string) => boolean;
  resetState: () => void;
}

const AppContext = createContext<AppStore | null>(null);

export function useApp(): AppStore {
  const store = useContext(AppContext);
  if (!store) {
    throw new Error('useApp must be used inside <AppProvider>');
  }
  return store;
}

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<AppState>(loadState);
  const [connection, setConnection] = useState<ConnectionStatus>('connecting');
  const [lastPrice, setLastPriceState] = useState<number | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Persistence is best-effort (private mode, quota).
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(state.theme);
  }, [state.theme]);

  const pushToast = (message: string, kind: Toast['kind'] = 'info'): void => {
    const id = uid('toast');
    setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((entry) => entry.id !== id));
    }, 5000);
  };

  const dismissToast = (id: string): void => {
    setToasts((prev) => prev.filter((entry) => entry.id !== id));
  };

  const fireAlert = (alert: PriceAlert, price: number): void => {
    const current = stateRef.current;
    const message = `${alert.symbol} crossed ${alert.condition === 'above' ? 'above' : 'below'} ${price}`;
    pushToast(message, 'warning');
    if (current.soundEnabled) playAlertSound();
    if (current.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Trade — price alert', { body: message });
      } catch {
        // Notifications are best-effort.
      }
    }
  };

  const checkAlerts = (price: number): void => {
    const current = stateRef.current;
    for (const alert of current.alerts) {
      if (!alert.enabled || alert.symbol !== current.symbol) continue;
      const crossed =
        alert.condition === 'above' ? price >= alert.price : price <= alert.price;
      if (crossed) {
        fireAlert(alert, price);
        setState((prev) => ({
          ...prev,
          alerts: prev.alerts.map((entry) =>
            entry.id === alert.id ? { ...entry, enabled: false } : entry,
          ),
        }));
      }
    }
  };

  // Plain object (not memoised): the provider re-renders only when its own
  // state changes, which is exactly when consumers need a new value.
  const store: AppStore = {
      state,
      translate: (key: DictKey) => t(state.language, key),
      connection,
      lastPrice,
      lastUpdateAt,
      toasts,
      pushToast,
      dismissToast,
      setConnection,
      setLastPrice: (price: number | null) => {
        setLastPriceState(price);
        setLastUpdateAt(price === null ? null : Date.now());
        if (price !== null) checkAlerts(price);
      },
      checkAlerts,
      setSymbol: (symbol: string) => {
        setState((prev) => {
          const nextProvider =
            prev.provider && SYMBOLS.find((entry) => entry.id === symbol)?.providerSymbols[prev.provider]
              ? prev.provider
              : (firstProviderForSymbol(symbol) ?? prev.provider);
          return { ...prev, symbol, provider: nextProvider };
        });
        pushToast(t(state.language, 'symbolChanged'), 'info');
      },
      setTimeframe: (timeframe: Timeframe) => {
        setState((prev) => ({ ...prev, timeframe }));
        pushToast(t(state.language, 'timeframeChanged'), 'info');
      },
      setChartType: (chartType: ChartType) => {
        setState((prev) => ({ ...prev, chartType }));
      },
      setPriceScale: (priceScale: PriceScaleKind) => {
        setState((prev) => ({ ...prev, priceScale }));
      },
      setProvider: (provider: ProviderId) => {
        setState((prev) => ({ ...prev, provider }));
        pushToast(t(state.language, 'providerChanged'), 'info');
      },
      setTheme: (theme: ThemeMode) => {
        setState((prev) => ({ ...prev, theme }));
      },
      setLanguage: (language: Language) => {
        setState((prev) => ({ ...prev, language }));
      },
      setLayout: (layout: LayoutMode) => {
        setState((prev) => ({ ...prev, layout }));
      },
      setActiveTool: (tool: string | null) => {
        setState((prev) => ({ ...prev, activeTool: tool }));
        if (tool) pushToast(t(state.language, 'toolSelected'), 'info');
      },
      toggleMagnet: () => {
        setState((prev) => ({ ...prev, magnet: !prev.magnet }));
      },
      toggleSidebar: () => {
        setState((prev) => ({ ...prev, sidebarOpen: !prev.sidebarOpen }));
      },
      addIndicator: (kind: string) => {
        setState((prev) => {
          if (prev.indicators.length >= 20) return prev;
          // Use the catalog defaults for this kind (e.g. SMA 50, EMA 20)
          // instead of a blanket period of 14.
          const entry = catalogEntry(kind);
          return {
            ...prev,
            indicators: [
              ...prev.indicators,
              {
                id: uid('ind'),
                kind,
                visible: true,
                period: entry?.defaultPeriod ?? 14,
                color: entry?.defaultColor ?? '#2563eb',
                lineWidth: 1,
              },
            ],
          };
        });
      },
      removeIndicator: (id: string) => {
        setState((prev) => ({ ...prev, indicators: prev.indicators.filter((entry) => entry.id !== id) }));
      },
      toggleIndicator: (id: string) => {
        setState((prev) => ({
          ...prev,
          indicators: prev.indicators.map((entry) =>
            entry.id === id ? { ...entry, visible: !entry.visible } : entry,
          ),
        }));
      },
      moveIndicator: (id: string, direction: -1 | 1) => {
        setState((prev) => {
          const index = prev.indicators.findIndex((entry) => entry.id === id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= prev.indicators.length) return prev;
          const next = [...prev.indicators];
          const [moved] = next.splice(index, 1);
          if (!moved) return prev;
          next.splice(target, 0, moved);
          return { ...prev, indicators: next };
        });
      },
      updateIndicator: (id: string, patch: Partial<Omit<IndicatorInstance, 'id' | 'kind'>>) => {
        setState((prev) => ({
          ...prev,
          indicators: prev.indicators.map((entry) =>
            entry.id === id ? { ...entry, ...patch } : entry,
          ),
        }));
      },
      addDrawing: (tool: string) => {
        setState((prev) => ({
          ...prev,
          drawings: [
            ...prev.drawings,
            { id: uid('draw'), tool, label: tool, visible: true, locked: false },
          ],
        }));
      },
      removeDrawing: (id: string) => {
        setState((prev) => ({ ...prev, drawings: prev.drawings.filter((entry) => entry.id !== id) }));
      },
      toggleDrawingVisibility: (id: string) => {
        setState((prev) => ({
          ...prev,
          drawings: prev.drawings.map((entry) =>
            entry.id === id ? { ...entry, visible: !entry.visible } : entry,
          ),
        }));
      },
      toggleDrawingLock: (id: string) => {
        setState((prev) => ({
          ...prev,
          drawings: prev.drawings.map((entry) =>
            entry.id === id ? { ...entry, locked: !entry.locked } : entry,
          ),
        }));
      },
      duplicateDrawing: (id: string) => {
        setState((prev) => {
          const source = prev.drawings.find((entry) => entry.id === id);
          if (!source) return prev;
          return {
            ...prev,
            drawings: [...prev.drawings, { ...source, id: uid('draw'), label: `${source.label} (2)` }],
          };
        });
      },
      clearDrawings: () => {
        setState((prev) => ({ ...prev, drawings: [] }));
      },
      addAlert: (symbol: string, condition: 'above' | 'below', price: number) => {
        setState((prev) => ({
          ...prev,
          alerts: [
            ...prev.alerts,
            { id: uid('alert'), symbol, condition, price, enabled: true, createdAt: Date.now() },
          ],
        }));
        pushToast(t(state.language, 'alertAdded'), 'success');
      },
      removeAlert: (id: string) => {
        setState((prev) => ({ ...prev, alerts: prev.alerts.filter((entry) => entry.id !== id) }));
        pushToast(t(state.language, 'alertRemoved'), 'info');
      },
      toggleAlert: (id: string) => {
        setState((prev) => ({
          ...prev,
          alerts: prev.alerts.map((entry) =>
            entry.id === id ? { ...entry, enabled: !entry.enabled } : entry,
          ),
        }));
      },
      setSoundEnabled: (enabled: boolean) => {
        setState((prev) => ({ ...prev, soundEnabled: enabled }));
      },
      setNotificationsEnabled: (enabled: boolean) => {
        setState((prev) => ({ ...prev, notificationsEnabled: enabled }));
      },
      addPane: (kind: string) => {
        setState((prev) =>
          prev.panes.includes(kind) ? prev : { ...prev, panes: [...prev.panes, kind] },
        );
      },
      removePane: (kind: string) => {
        setState((prev) => ({ ...prev, panes: prev.panes.filter((entry) => entry !== kind) }));
      },
      exportState: () => JSON.stringify(stateRef.current, null, 2),
      importState: (json: string) => {
        try {
          const parsed: unknown = JSON.parse(json);
          setState(migrateState(parsed));
          pushToast(t(state.language, 'importSuccess'), 'success');
          return true;
        } catch {
          pushToast(t(state.language, 'importFailed'), 'warning');
          return false;
        }
      },
      resetState: () => {
        setState(defaultState());
      },
  };

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}
