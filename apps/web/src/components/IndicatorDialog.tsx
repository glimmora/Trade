import { useState } from 'react';
import { INDICATOR_CATALOG, catalogEntry } from '../lib/indicators';
import type { IndicatorGroup } from '../lib/indicators';
import { useApp } from '../store/state';
import { Modal } from './Modal';

const GROUPS: readonly IndicatorGroup[] = ['overlays', 'oscillators', 'structure'] as const;

/** Indicator picker + per-indicator settings (period, color, line width, visibility). */
export function IndicatorDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { state, translate, addIndicator, removeIndicator, toggleIndicator, updateIndicator } =
    useApp();
  const [group, setGroup] = useState<IndicatorGroup>('overlays');

  return (
    <Modal title={translate('indicators')} onClose={onClose}>
      <div className="tab-group" role="tablist" aria-label={translate('indicators')}>
        {GROUPS.map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={group === entry}
            className="tab-button"
            onClick={() => {
              setGroup(entry);
            }}
          >
            {translate(entry)}
          </button>
        ))}
      </div>

      <h3>{translate('availableIndicators')}</h3>
      <ul className="catalog-list">
        {INDICATOR_CATALOG.filter((entry) => entry.group === group).map((entry) => (
          <li key={entry.kind} className="catalog-row">
            <span>
              <strong>{entry.name}</strong>
              <span className="catalog-desc">{entry.description}</span>
            </span>
            <button
              type="button"
              className="toolbar-button"
              disabled={state.indicators.length >= 20}
              onClick={() => {
                addIndicator(entry.kind);
              }}
            >
              {translate('add')}
            </button>
          </li>
        ))}
      </ul>

      <h3>
        {translate('activeIndicators')} ({state.indicators.length}/20)
      </h3>
      {state.indicators.length === 0 ? (
        <p className="empty-state">{translate('noIndicators')}</p>
      ) : (
        <ul className="catalog-list">
          {state.indicators.map((indicator) => {
            const entry = catalogEntry(indicator.kind);
            return (
              <li key={indicator.id} className="settings-row">
                <label className="settings-row-main">
                  <input
                    type="checkbox"
                    checked={indicator.visible}
                    onChange={() => {
                      toggleIndicator(indicator.id);
                    }}
                    aria-label={`${translate('visible')}: ${entry?.name ?? indicator.kind}`}
                  />
                  <strong>{entry?.name ?? indicator.kind}</strong>
                </label>
                {entry?.defaultPeriod !== null ? (
                  <label className="settings-field">
                    {translate('period')}
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={indicator.period ?? entry?.defaultPeriod ?? 14}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        updateIndicator(indicator.id, {
                          period: Number.isFinite(value) ? value : null,
                        });
                      }}
                    />
                  </label>
                ) : (
                  <span className="settings-note">{translate('settingsPlaceholder')}</span>
                )}
                <label className="settings-field">
                  {translate('color')}
                  <input
                    type="color"
                    value={indicator.color}
                    onChange={(event) => {
                      updateIndicator(indicator.id, { color: event.target.value });
                    }}
                    aria-label={`${translate('color')}: ${entry?.name ?? indicator.kind}`}
                  />
                </label>
                <label className="settings-field">
                  {translate('lineWidth')}
                  <select
                    value={indicator.lineWidth}
                    onChange={(event) => {
                      updateIndicator(indicator.id, { lineWidth: Number(event.target.value) });
                    }}
                    aria-label={translate('lineWidth')}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    removeIndicator(indicator.id);
                  }}
                  aria-label={`${translate('remove')}: ${entry?.name ?? indicator.kind}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
