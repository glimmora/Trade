import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem('trade:theme');
    return saved === 'light' || saved === 'dark' || saved === 'system'
      ? saved
      : 'system';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(theme);
    window.localStorage.setItem('trade:theme', theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <header className="top-toolbar" role="banner">
        <span className="brand">Trade</span>
        <span className="toolbar-placeholder" aria-label="Symbol selector placeholder">
          BTC/USDT
        </span>
        <span className="toolbar-placeholder">1h</span>
        <span className="toolbar-placeholder">Candlestick</span>
        <span className="toolbar-placeholder">Indicators</span>
        <span className="toolbar-placeholder">Data source</span>
        <label className="theme-switch">
          Theme
          <select
            value={theme}
            onChange={(event) => {
              setTheme(event.target.value as Theme);
            }}
            aria-label="Theme"
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <span className="connection-status" data-status="offline">
          Offline
        </span>
      </header>
      <main className="chart-area">
        <div
          className="chart-container"
          data-testid="chart-container"
          aria-label="Chart area"
        >
          <p className="hello-chart">Hello chart — live candles arrive in M2.</p>
        </div>
      </main>
      <footer className="app-footer">
        For informational purposes only. Not financial advice.
      </footer>
    </div>
  );
}
