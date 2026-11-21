import { drawingTool } from '../lib/drawings';
import { useApp } from '../store/state';

export function ObjectTree(): JSX.Element {
  const {
    state,
    translate,
    removeDrawing,
    toggleDrawingVisibility,
    toggleDrawingLock,
    duplicateDrawing,
    clearDrawings,
  } = useApp();

  return (
    <section className="sidebar-section" aria-label={translate('objectTree')}>
      <div className="sidebar-section-header">
        <h3>{translate('objects')}</h3>
        {state.drawings.length > 0 ? (
          <button
            type="button"
            className="toolbar-button"
            onClick={() => {
              if (window.confirm(translate('confirmClearDrawings'))) clearDrawings();
            }}
          >
            {translate('clearAll')}
          </button>
        ) : null}
      </div>
      {state.drawings.length === 0 ? (
        <p className="empty-state">{translate('noDrawings')}</p>
      ) : (
        <ul className="object-list">
          {state.drawings.map((drawing) => {
            const tool = drawingTool(drawing.tool);
            return (
              <li key={drawing.id} className="object-row">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    toggleDrawingVisibility(drawing.id);
                  }}
                  aria-label={`${translate('visible')}: ${drawing.label}`}
                  aria-pressed={drawing.visible}
                  title={drawing.visible ? translate('hide') : translate('show')}
                >
                  {drawing.visible ? '◉' : '○'}
                </button>
                <span className="object-label">{tool?.label ?? drawing.label}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    toggleDrawingLock(drawing.id);
                  }}
                  aria-label={drawing.locked ? translate('unlock') : translate('lock')}
                  aria-pressed={drawing.locked}
                  title={drawing.locked ? translate('unlock') : translate('lock')}
                >
                  {drawing.locked ? '◼' : '◻'}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    duplicateDrawing(drawing.id);
                  }}
                  aria-label={`${translate('duplicate')}: ${drawing.label}`}
                  title={translate('duplicate')}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={drawing.locked}
                  onClick={() => {
                    removeDrawing(drawing.id);
                  }}
                  aria-label={`${translate('delete')}: ${drawing.label}`}
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
