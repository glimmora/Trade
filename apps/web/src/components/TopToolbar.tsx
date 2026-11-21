import { TIMEFRAMES, SYMBOLS, type ProviderId } from '@trade/core';
import { LANGUAGES } from '../i18n';
import { isTimeframeSupported, providerMeta, providersForSymbol } from '../lib/providers';
import { CHART_TYPE_LABELS, useApp, type ChartType, type LayoutMode, type ThemeMode } from '../store/state';

export type DialogKind = 'none' | 'symbol' | 'indicators' | 'alerts' | 'settings' | 'shortcuts';

interface TopToolbarProps {
  onOpenDialog: (dialog: Exclude<DialogKind, 'none'>) => void;
  onScreenshot: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

const LAYOUT_OPTIONS: readonly { id: LayoutMode; label: string }[] = [
  { id: '1', label: '1' },
  { id: '2', label: '2' },
  { id: '2x2', label: '2×2' },
] as const;

export function TopToolbar({
  onOpenDialog,
  onScreenshot,
  onToggleFullscreen,
  isFullscreen,
}: TopToolbarProps): JSX.Element {
  const { state, translate, connection, setTimeframe, setChartType, setPriceScale, setProvider, setTheme, setLanguage, setLayout, toggleSidebar } = useApp();
  const symbol = SYMBOLS.find((entry) => entry.id === state.symbol);
  const kindLabel =
    symbol?.kind === 'spot-gold'
      ? translate('spotGold')
      : symbol?.kind === 'tokenized-gold'
        ? translate('tokenizedGold')
        : translate('crypto');
  const enabledAlerts = state.alerts.filter((alert) => alert.enabled).length;
  const connectionLabel =
    connection === 'live'
      ? translate('live')
      : connection === 'delayed'
        ? translate('delayed')
        : connection === 'offline'
          ? translate('offline')
          : translate('connecting');

  return (
    <header className="top-toolbar" role="banner">
      <button
        type="button"
        className="brand-button"
        onClick={toggleSidebar}
        aria-label={translate('sidebar')}
        title={translate('sidebar')}
      >
        Trade
      </button>

      <button
        type="button"
        className="symbol-button"
        onClick={() => {
          onOpenDialog('symbol');
        }}
        aria-label={`${translate('symbol')}: ${state.symbol}`}
        aria-haspopup="dialog"
      >
        <strong>{state.symbol}</strong>
        <span className="kind-badge">{kindLabel}</span>
      </button>

      <div className="timeframe-group" role="group" aria-label={translate('timeframe')}>
        {TIMEFRAMES.map((timeframe) => {
          const supported = isTimeframeSupported(state.provider, timeframe);
          return (
            <button
              key={timeframe}
              type="button"
              className="timeframe-button"
              aria-pressed={state.timeframe === timeframe}
              disabled={!supported}
              title={supported ? timeframe : translate('notSupportedByProvider')}
              onClick={() => {
                setTimeframe(timeframe);
              }}
            >
              {timeframe}
            </button>
          );
        })}
      </div>

      <label className="toolbar-field">
        <span className="visually-hidden">{translate('chartType')}</span>
        <select
          value={state.chartType}
          onChange={(event) => {
            setChartType(event.target.value as ChartType);
          }}
          aria-label={translate('chartType')}
        >
          {(Object.keys(CHART_TYPE_LABELS) as ChartType[]).map((chartType) => (
            <option key={chartType} value={chartType}>
              {CHART_TYPE_LABELS[chartType]}
            </option>
          ))}
        </select>
      </label>

      <label className="toolbar-field">
        <span className="visually-hidden">{translate('priceScale')}</span>
        <select
          value={state.priceScale}
          onChange={(event) => {
            setPriceScale(event.target.value as 'linear' | 'log' | 'percentage');
          }}
          aria-label={translate('priceScale')}
        >
          <option value="linear">{translate('scaleLinear')}</option>
          <option value="log">{translate('scaleLog')}</option>
          <option value="percentage">{translate('scalePercentage')}</option>
        </select>
      </label>

      <button
        type="button"
        className="toolbar-button"
        onClick={() => {
          onOpenDialog('indicators');
        }}
        aria-label={translate('indicators')}
      >
        {translate('indicators')}
        {state.indicators.length > 0 ? ` (${state.indicators.length})` : ''}
      </button>

      <div className="layout-group" role="group" aria-label={translate('layout')}>
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="layout-button"
            aria-pressed={state.layout === option.id}
            title={
              option.id === '1'
                ? translate('layoutSingle')
                : option.id === '2'
                  ? translate('layoutTwo')
                  : translate('layoutGrid')
            }
            onClick={() => {
              setLayout(option.id);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="toolbar-field">
        <span className="visually-hidden">{translate('dataSource')}</span>
        <select
          value={state.provider}
          onChange={(event) => {
            setProvider(event.target.value as ProviderId);
          }}
          aria-label={translate('dataSource')}
        >
          {providersForSymbol(state.symbol).map((meta) => (
            <option key={meta.id} value={meta.id}>
              {meta.label}
              {meta.delayed ? ` (${translate('delayed')})` : ''}
              {meta.requiresKey ? ' *' : ''}
            </option>
          ))}
        </select>
      </label>

      <span
        className="connection-status"
        data-status={connection}
        title={`${providerMeta(state.provider).label} · ${connectionLabel}`}
      >
        {connectionLabel}
      </span>

      <div className="toolbar-spacer" />

      <button
        type="button"
        className="toolbar-button"
        onClick={() => {
          onOpenDialog('alerts');
        }}
        aria-label={`${translate('alerts')} (${enabledAlerts})`}
      >
        {translate('alerts')}
        {enabledAlerts > 0 ? ` (${enabledAlerts})` : ''}
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={onScreenshot}
        aria-label={translate('screenshot')}
        title={translate('screenshot')}
      >
        PNG
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? translate('exitFullscreen') : translate('fullscreen')}
        title={isFullscreen ? translate('exitFullscreen') : translate('fullscreen')}
      >
        ⛶
      </button>
      <label className="toolbar-field">
        <span className="visually-hidden">{translate('theme')}</span>
        <select
          value={state.theme}
          onChange={(event) => {
            setTheme(event.target.value as ThemeMode);
          }}
          aria-label={translate('theme')}
        >
          <option value="system">{translate('themeSystem')}</option>
          <option value="dark">{translate('themeDark')}</option>
          <option value="light">{translate('themeLight')}</option>
        </select>
      </label>
      <label className="toolbar-field">
        <span className="visually-hidden">{translate('language')}</span>
        <select
          value={state.language}
          onChange={(event) => {
            setLanguage(event.target.value as 'en' | 'id');
          }}
          aria-label={translate('language')}
        >
          {LANGUAGES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="toolbar-button"
        onClick={() => {
          onOpenDialog('shortcuts');
        }}
        aria-label={translate('shortcuts')}
        title={translate('shortcuts')}
      >
        ?
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={() => {
          onOpenDialog('settings');
        }}
        aria-label={translate('settings')}
      >
        ⚙
      </button>
    </header>
  );
}
