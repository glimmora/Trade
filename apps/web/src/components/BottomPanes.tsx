import { useState } from 'react';
import { INDICATOR_CATALOG } from '../lib/indicators';
import { clamp } from '../lib/utils';
import { useApp } from '../store/state';

/**
 * Bottom oscillator panes. Each pane is a resizable placeholder: the header
 * shows the indicator name and a remove button, the body shows the waiting
 * state until the indicator worker renders real values into it.
 */
export function BottomPanes(): React.JSX.Element {
  const { state, translate, addPane, removePane } = useApp();
  const [height, setHeight] = useState(140);
  const oscillators = INDICATOR_CATALOG.filter((entry) => entry.group === 'oscillators');

  return (
    <section className="bottom-panes" aria-label={translate('bottomPanes')}>
      <div className="panes-header">
        <span>{translate('bottomPanes')}</span>
        <label className="pane-height-field">
          {translate('paneHeight')}
          <input
            type="range"
            min={80}
            max={320}
            step={10}
            value={height}
            onChange={(event) => {
              setHeight(clamp(Number(event.target.value), 80, 320));
            }}
            aria-label={translate('paneHeight')}
          />
        </label>
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) addPane(event.target.value);
          }}
          aria-label={translate('addOscillator')}
        >
          <option value="">{translate('addOscillator')}</option>
          {oscillators.map((entry) => (
            <option key={entry.kind} value={entry.kind} disabled={state.panes.includes(entry.kind)}>
              {entry.name}
            </option>
          ))}
        </select>
      </div>
      <div className="panes-body">
        {state.panes.length === 0 ? (
          <p className="empty-state">{translate('paneWaitingForData')}</p>
        ) : (
          state.panes.map((kind) => {
            const entry = oscillators.find((item) => item.kind === kind);
            return (
              <div key={kind} className="pane" style={{ height: `${String(height)}px` }}>
                <div className="pane-header">
                  <strong>{entry?.name ?? kind}</strong>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      removePane(kind);
                    }}
                    aria-label={`${translate('remove')}: ${entry?.name ?? kind}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="pane-body">{translate('paneWaitingForData')}</div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
