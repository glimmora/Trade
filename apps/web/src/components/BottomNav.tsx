import { useApp } from '../store/state';

export type MobileSheet = 'none' | 'tools' | 'sidebar' | 'panes';

interface BottomNavProps {
  sheet: MobileSheet;
  onSheet: (sheet: MobileSheet) => void;
  onOpenSettings: () => void;
}

/** Mobile bottom navigation. Desktop is styled away by CSS. */
export function BottomNav({ sheet, onSheet, onOpenSettings }: BottomNavProps): JSX.Element {
  const { translate } = useApp();
  const toggle = (target: MobileSheet): void => {
    onSheet(sheet === target ? 'none' : target);
  };
  return (
    <nav className="bottom-nav" aria-label={translate('menu')}>
      <button
        type="button"
        className="bottom-nav-button"
        aria-pressed={sheet === 'none'}
        onClick={() => {
          onSheet('none');
        }}
      >
        {translate('bottomNavCharts')}
      </button>
      <button
        type="button"
        className="bottom-nav-button"
        aria-pressed={sheet === 'tools'}
        onClick={() => {
          toggle('tools');
        }}
      >
        {translate('bottomNavTools')}
      </button>
      <button
        type="button"
        className="bottom-nav-button"
        aria-pressed={sheet === 'sidebar'}
        onClick={() => {
          toggle('sidebar');
        }}
      >
        {translate('bottomNavWatchlist')}
      </button>
      <button
        type="button"
        className="bottom-nav-button"
        aria-pressed={sheet === 'panes'}
        onClick={() => {
          toggle('panes');
        }}
      >
        {translate('bottomPanes')}
      </button>
      <button type="button" className="bottom-nav-button" onClick={onOpenSettings}>
        {translate('bottomNavMore')}
      </button>
    </nav>
  );
}
