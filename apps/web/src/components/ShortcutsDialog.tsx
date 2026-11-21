import { DRAWING_TOOLS } from '../lib/drawings';
import { useApp } from '../store/state';
import { Modal } from './Modal';

const GLOBAL_SHORTCUTS: readonly { keys: string; action: string }[] = [
  { keys: '?', action: 'Open this cheat sheet' },
  { keys: 'Ctrl/⌘ + Z', action: 'Undo drawing' },
  { keys: 'Ctrl/⌘ + Y', action: 'Redo drawing' },
  { keys: 'Esc', action: 'Close dialog / deselect tool' },
  { keys: 'F', action: 'Toggle fullscreen' },
  { keys: 'S', action: 'Save chart as PNG' },
] as const;

export function ShortcutsDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { translate } = useApp();
  const toolsWithShortcuts = DRAWING_TOOLS.filter((tool) => tool.shortcut !== null);
  return (
    <Modal title={translate('shortcutsTitle')} onClose={onClose}>
      <table className="shortcuts-table">
        <thead>
          <tr>
            <th scope="col">Keys</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {GLOBAL_SHORTCUTS.map((entry) => (
            <tr key={entry.keys}>
              <td>
                <kbd>{entry.keys}</kbd>
              </td>
              <td>{entry.action}</td>
            </tr>
          ))}
          {toolsWithShortcuts.map((tool) => (
            <tr key={tool.id}>
              <td>
                <kbd>{tool.shortcut}</kbd>
              </td>
              <td>{tool.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
