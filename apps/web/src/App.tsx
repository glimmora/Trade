import { useCallback, useEffect, useState } from 'react';
import { getPrimaryChart } from './lib/chartHandle';
import { downloadChartSnapshot } from './lib/exportChart';
import { providerMeta } from './lib/providers';
import { AppProvider, useApp } from './store/state';
import { AlertsDialog } from './components/AlertsDialog';
import { BottomNav } from './components/BottomNav';
import type { MainView, MobileSheet } from './components/BottomNav';
import BangranFxPage from './bangranfx/BangranFxPage';
import { BottomPanes } from './components/BottomPanes';
import { DrawingToolbar } from './components/DrawingToolbar';
import { IndicatorDialog } from './components/IndicatorDialog';
import { IndicatorList } from './components/IndicatorList';
import { MultiChartLayout } from './components/MultiChartLayout';
import { ObjectTree } from './components/ObjectTree';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { SymbolSelector } from './components/SymbolSelector';
import { Toasts } from './components/Toasts';
import { TopToolbar } from './components/TopToolbar';
import type { DialogKind } from './components/TopToolbar';
import { Watchlist } from './components/Watchlist';

function Shell(): React.JSX.Element {
  const { state, translate, setActiveTool, pushToast } = useApp();
  const [dialog, setDialog] = useState<DialogKind>('none');
  const [sheet, setSheet] = useState<MobileSheet>('none');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [view, setView] = useState<MainView>('chart');

  const switchView = useCallback((next: MainView) => {
    setSheet('none');
    setView(next);
  }, []);

  useEffect(() => {
    const onChange = (): void => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        // Fullscreen may be unavailable (e.g. inside an iframe).
      });
    }
  }, []);

  const takeScreenshot = useCallback(() => {
    const chart = getPrimaryChart();
    if (chart !== null) {
      const done = chart.downloadPng(
        `trade-${state.symbol.replace('/', '-')}-${state.timeframe}.png`,
      );
      if (done) {
        pushToast(translate('screenshotSaved'), 'success');
        return;
      }
    }
    // No live chart handle yet: fall back to a labelled state snapshot.
    downloadChartSnapshot({
      symbol: state.symbol,
      timeframe: state.timeframe,
      providerLabel: providerMeta(state.provider).label,
      chartType: state.chartType,
    });
    pushToast(translate('screenshotSaved'), 'success');
  }, [state.symbol, state.timeframe, state.provider, state.chartType, translate, pushToast]);

  const closeDialog = useCallback(() => {
    setDialog('none');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target !== null &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (event.key === 'Escape') {
        if (dialog !== 'none') {
          setDialog('none');
        } else if (sheet !== 'none') {
          setSheet('none');
        } else if (state.activeTool !== null) {
          setActiveTool(null);
        }
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === '?') {
        setDialog('shortcuts');
      } else if (event.key === 'f' || event.key === 'F') {
        toggleFullscreen();
      } else if (event.key === 's' || event.key === 'S') {
        takeScreenshot();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dialog, sheet, state.activeTool, setActiveTool, toggleFullscreen, takeScreenshot]);

  const openDialog = (next: Exclude<DialogKind, 'none'>): void => {
    setSheet('none');
    setDialog(next);
  };

  return (
    <div className="app-shell">
      <TopToolbar
        onOpenDialog={openDialog}
        onScreenshot={takeScreenshot}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />
      <PwaUpdatePrompt />
      <div className="brg-viewbar" role="group" aria-label="Lihat">
        <span className="brg-viewbar-label">Lihat:</span>
        <button
          type="button"
          className="brg-viewbar-button"
          aria-pressed={view === 'chart'}
          onClick={() => {
            switchView('chart');
          }}
        >
          Chart
        </button>
        <button
          type="button"
          className="brg-viewbar-button"
          aria-pressed={view === 'bangranfx'}
          onClick={() => {
            switchView('bangranfx');
          }}
        >
          BangranFX
        </button>
      </div>
      {view === 'bangranfx' ? (
        <main className="brg-view-main">
          <BangranFxPage />
        </main>
      ) : (
        <div className="workspace">
          <DrawingToolbar />
          <main className="main-column">
            <div className="chart-area">
              <MultiChartLayout />
            </div>
            <BottomPanes />
          </main>
          {state.sidebarOpen ? (
            <aside className="sidebar" aria-label={translate('sidebar')}>
              <Watchlist />
              <IndicatorList
                onOpenDialog={() => {
                  openDialog('indicators');
                }}
              />
              <ObjectTree />
            </aside>
          ) : null}
        </div>
      )}

      {view === 'chart' && sheet !== 'none' ? (
        <div className="bottom-sheet" role="dialog" aria-modal="false" aria-label={translate('menu')}>
          <div className="bottom-sheet-header">
            <strong>
              {sheet === 'tools'
                ? translate('drawingTools')
                : sheet === 'sidebar'
                  ? translate('watchlist')
                  : translate('bottomPanes')}
            </strong>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setSheet('none');
              }}
              aria-label={translate('close')}
            >
              ✕
            </button>
          </div>
          <div className="bottom-sheet-body">
            {sheet === 'tools' ? (
              <DrawingToolbar />
            ) : sheet === 'sidebar' ? (
              <>
                <Watchlist />
                <IndicatorList
                  onOpenDialog={() => {
                    openDialog('indicators');
                  }}
                />
                <ObjectTree />
              </>
            ) : (
              <BottomPanes />
            )}
          </div>
        </div>
      ) : null}

      <BottomNav
        sheet={sheet}
        onSheet={setSheet}
        view={view}
        onView={switchView}
        onOpenSettings={() => {
          openDialog('settings');
        }}
      />

      <footer className="app-footer">{translate('disclaimer')}</footer>
      <Toasts />

      {dialog === 'symbol' ? <SymbolSelector onClose={closeDialog} /> : null}
      {dialog === 'indicators' ? <IndicatorDialog onClose={closeDialog} /> : null}
      {dialog === 'alerts' ? <AlertsDialog onClose={closeDialog} /> : null}
      {dialog === 'settings' ? <SettingsDialog onClose={closeDialog} /> : null}
      {dialog === 'shortcuts' ? <ShortcutsDialog onClose={closeDialog} /> : null}
    </div>
  );
}

export default function App(): React.JSX.Element {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
