import { DRAWING_TOOLS, toolGlyph } from '../lib/drawings';
import { useApp } from '../store/state';

/**
 * Left drawing toolbar (desktop). On mobile it is hidden by CSS and the same
 * tools are offered from the bottom sheet (see BottomNav / App).
 * Selecting a tool also creates a placeholder drawing object so the object
 * tree, undo/redo and persistence flows work end-to-end before the canvas
 * hit-testing lands with the drawings agent.
 */
export function DrawingToolbar(): React.JSX.Element {
  const { state, translate, setActiveTool, addDrawing, toggleMagnet, pushToast } = useApp();

  return (
    <nav className="drawing-toolbar" aria-label={translate('drawingTools')}>
      {DRAWING_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className="tool-button"
          aria-pressed={state.activeTool === tool.id}
          title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
          aria-label={tool.label}
          onClick={() => {
            const next = state.activeTool === tool.id ? null : tool.id;
            setActiveTool(next);
            if (next) addDrawing(next);
          }}
        >
          {toolGlyph(tool.id)}
        </button>
      ))}
      <div className="tool-divider" aria-hidden="true" />
      <button
        type="button"
        className="tool-button"
        aria-pressed={state.magnet}
        title={translate('magnet')}
        aria-label={translate('magnet')}
        onClick={toggleMagnet}
      >
        ⌖
      </button>
      <button
        type="button"
        className="tool-button"
        title={translate('undo')}
        aria-label={translate('undo')}
        onClick={() => {
          // Undo history lives with the drawings engine; until it lands,
          // report honestly instead of pretending to undo.
          pushToast(translate('nothingToUndo'), 'info');
        }}
      >
        ↩
      </button>
      <button
        type="button"
        className="tool-button"
        title={translate('redo')}
        aria-label={translate('redo')}
        onClick={() => {
          pushToast(translate('nothingToRedo'), 'info');
        }}
      >
        ↪
      </button>
    </nav>
  );
}
