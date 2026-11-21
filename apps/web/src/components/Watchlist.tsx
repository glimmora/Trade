import { SYMBOLS } from '@trade/core';
import { providerMeta } from '../lib/providers';
import { useApp } from '../store/state';

/**
 * Watchlist. Prices are NOT faked: until the provider agent wires live data
 * in, every row shows an em dash and a "Connecting…" state. A row only shows
 * a price once the store's lastPrice is set by a real provider update.
 */
export function Watchlist(): JSX.Element {
  const { state, translate, connection, setSymbol } = useApp();
  const connecting = connection === 'connecting' || connection === 'offline';

  return (
    <section className="sidebar-section" aria-label={translate('watchlist')}>
      <div className="sidebar-section-header">
        <h3>{translate('watchlist')}</h3>
        <span className="connection-status" data-status={connection}>
          {connecting ? translate('connecting') : translate(connection)}
        </span>
      </div>
      <p className="watchlist-note">{translate('watchlistNote')}</p>
      <ul className="watchlist">
        {SYMBOLS.map((symbol) => {
          const active = state.symbol === symbol.id;
          const isCurrent = active && state.lastPrice !== null;
          return (
            <li key={symbol.id}>
              <button
                type="button"
                className="watchlist-row"
                aria-pressed={active}
                onClick={() => {
                  setSymbol(symbol.id);
                }}
              >
                <span className="watchlist-symbol">
                  <strong>{symbol.id}</strong>
                  <span className="watchlist-provider">
                    {providerMeta(state.provider).label}
                  </span>
                </span>
                <span className="watchlist-price">
                  {isCurrent && state.lastPrice !== null
                    ? state.lastPrice.toFixed(symbol.precision)
                    : '—'}
                </span>
                <span className="watchlist-change">—</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
