import { catalogEntry } from '../lib/indicators';
import { useApp } from '../store/state';

export function IndicatorList({ onOpenDialog }: { onOpenDialog: () => void }): JSX.Element {
  const { state, translate, removeIndicator, toggleIndicator, moveIndicator } = useApp();
  return (
    <section className="sidebar-section" aria-label={translate('indicators')}>
      <div className="sidebar-section-header">
        <h3>{translate('indicators')}</h3>
        <button type="button" className="toolbar-button" onClick={onOpenDialog}>
          {translate('add')}
        </button>
      </div>
      {state.indicators.length === 0 ? (
        <p className="empty-state">{translate('noIndicators')}</p>
      ) : (
        <ul className="object-list">
          {state.indicators.map((indicator, index) => {
            const entry = catalogEntry(indicator.kind);
            return (
              <li key={indicator.id} className="object-row">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    toggleIndicator(indicator.id);
                  }}
                  aria-label={`${translate('visible')}: ${entry?.name ?? indicator.kind}`}
                  aria-pressed={indicator.visible}
                  title={indicator.visible ? translate('hide') : translate('show')}
                >
                  {indicator.visible ? '◉' : '○'}
                </button>
                <span
                  className="object-color"
                  style={{ backgroundColor: indicator.color }}
                  aria-hidden="true"
                />
                <span className="object-label">{entry?.name ?? indicator.kind}</span>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === 0}
                  onClick={() => {
                    moveIndicator(indicator.id, -1);
                  }}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === state.indicators.length - 1}
                  onClick={() => {
                    moveIndicator(indicator.id, 1);
                  }}
                  aria-label="Move down"
                >
                  ↓
                </button>
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
    </section>
  );
}
