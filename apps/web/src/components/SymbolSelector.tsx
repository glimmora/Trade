import { useState } from 'react';
import { SYMBOLS } from '@trade/core';
import { providersForSymbol } from '../lib/providers';
import { useApp } from '../store/state';
import { Modal } from './Modal';

export function SymbolSelector({ onClose }: { onClose: () => void }): JSX.Element {
  const { state, translate, setSymbol } = useApp();
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const results = SYMBOLS.filter((symbol) => {
    if (!needle) return true;
    return (
      symbol.id.toLowerCase().includes(needle) || symbol.label.toLowerCase().includes(needle)
    );
  });

  return (
    <Modal title={translate('symbol')} onClose={onClose}>
      <label className="field-label">
        {translate('search')}
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder={translate('symbolSearchPlaceholder')}
          aria-label={translate('symbolSearchPlaceholder')}
        />
      </label>
      <ul className="symbol-list">
        {results.map((symbol) => {
          const providers = providersForSymbol(symbol.id);
          const kindLabel =
            symbol.kind === 'spot-gold'
              ? translate('spotGold')
              : symbol.kind === 'tokenized-gold'
                ? translate('tokenizedGold')
                : translate('crypto');
          return (
            <li key={symbol.id}>
              <button
                type="button"
                className="symbol-row"
                aria-pressed={state.symbol === symbol.id}
                onClick={() => {
                  setSymbol(symbol.id);
                  onClose();
                }}
              >
                <span className="symbol-row-main">
                  <strong>{symbol.id}</strong>
                  <span className="kind-badge">{kindLabel}</span>
                </span>
                <span className="symbol-row-sub">
                  {symbol.label} · {translate('supportedProviders')}:{' '}
                  {providers.map((meta) => meta.label).join(', ')}
                </span>
              </button>
            </li>
          );
        })}
        {results.length === 0 ? <li className="empty-state">{translate('noResults')}</li> : null}
      </ul>
    </Modal>
  );
}
