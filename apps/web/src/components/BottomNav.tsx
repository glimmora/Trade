import { useApp } from '../store/state';

export type MobileSheet = 'none' | 'tools' | 'sidebar' | 'panes';
export type MainView = 'chart' | 'bangranfx';

interface BottomNavProps {
  sheet: MobileSheet;
  onSheet: (sheet: MobileSheet) => void;
  onOpenSettings: () => void;
  /** Current top-level view; when omitted the nav only switches sheets. */
  view?: MainView;
  onView?: (view: MainView) => void;
}

/** Mobile bottom navigation. Desktop is styled away by CSS. */
export function BottomNav({
  sheet,
  onSheet,
  onOpenSettings,
  view,
  onView,
}: BottomNavProps): React.JSX.Element {
  const { translate } = useApp();
  const toggle = (target: MobileSheet): void => {
    // Sheet panels belong to the chart view; return there first.
    if (view === 'bangranfx' && onView) {
      onView('chart');
    }
    onSheet(sheet === target ? 'none' : target);
  };
  const goView = (target: MainView): void => {
    if (onView) {
      onView(target);
    } else {
      onSheet('none');
    }
  };
  return (
    <nav className="bottom-nav" aria-label={translate('menu')}>
      <button
        type="button"
        className="bottom-nav-button"
        aria-pressed={view === undefined ? sheet === 'none' : view === 'chart'}
        onClick={() => {
          goView('chart');
        }}
      >
        {translate('bottomNavCharts')}
      </button>
      <button
        type="button"
        className="bottom-nav-button"
        aria-pressed={view === 'bangranfx'}
        onClick={() => {
          goView('bangranfx');
        }}
      >
        BangranFX
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
