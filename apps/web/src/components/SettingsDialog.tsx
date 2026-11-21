import { useRef, useState } from 'react';
import { LANGUAGES } from '../i18n';
import { useApp } from '../store/state';
import { Modal } from './Modal';

export function SettingsDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { state, translate, setLanguage, exportState, importState, resetState, pushToast } =
    useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState(() => {
    try {
      return window.localStorage.getItem('trade:twelvedata-key') ?? '';
    } catch {
      return '';
    }
  });
  const [oandaToken, setOandaToken] = useState(() => {
    try {
      return window.localStorage.getItem('trade:oanda-token') ?? '';
    } catch {
      return '';
    }
  });
  const [oandaAccountId, setOandaAccountId] = useState(() => {
    try {
      return window.localStorage.getItem('trade:oanda-account-id') ?? '';
    } catch {
      return '';
    }
  });

  const downloadExport = (): void => {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trade-state.json';
    link.click();
    URL.revokeObjectURL(url);
    pushToast(translate('stateExported'), 'success');
  };

  const saveApiKey = (): void => {
    try {
      if (apiKey.trim()) {
        window.localStorage.setItem('trade:twelvedata-key', apiKey.trim());
      } else {
        window.localStorage.removeItem('trade:twelvedata-key');
      }
    } catch {
      // Storage is best-effort.
    }
  };

  const saveOandaToken = (): void => {
    try {
      if (oandaToken.trim()) {
        window.localStorage.setItem('trade:oanda-token', oandaToken.trim());
      } else {
        window.localStorage.removeItem('trade:oanda-token');
      }
    } catch {
      // Storage is best-effort.
    }
  };

  const saveOandaAccountId = (): void => {
    try {
      if (oandaAccountId.trim()) {
        window.localStorage.setItem('trade:oanda-account-id', oandaAccountId.trim());
      } else {
        window.localStorage.removeItem('trade:oanda-account-id');
      }
    } catch {
      // Storage is best-effort.
    }
  };

  return (
    <Modal title={translate('settingsTitle')} onClose={onClose}>
      <label className="field-label">
        {translate('language')}
        <select
          value={state.language}
          onChange={(event) => {
            setLanguage(event.target.value as 'en' | 'id');
          }}
        >
          {LANGUAGES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field-label">
        Twelve Data API key ({translate('requiresApiKey')})
        <input
          type="password"
          value={apiKey}
          autoComplete="off"
          onChange={(event) => {
            setApiKey(event.target.value);
          }}
          onBlur={saveApiKey}
          placeholder="••••••••"
        />
      </label>
      <label className="field-label">
        OANDA personal access token ({translate('requiresApiKey')})
        <input
          type="password"
          value={oandaToken}
          autoComplete="off"
          onChange={(event) => {
            setOandaToken(event.target.value);
          }}
          onBlur={saveOandaToken}
          placeholder="••••••••"
        />
      </label>
      <label className="field-label">
        OANDA account ID (optional — blank means auto-discovered from the account list)
        <input
          type="text"
          value={oandaAccountId}
          autoComplete="off"
          onChange={(event) => {
            setOandaAccountId(event.target.value);
          }}
          onBlur={saveOandaAccountId}
          placeholder="Leave blank to auto-discover"
        />
      </label>
      <p className="dialog-note">
        The OANDA token grants trading access to the practice account. It is stored only in
        this browser&apos;s localStorage and must never be shared or committed.
      </p>
      <p className="dialog-note">
        Keys are stored only in this browser&apos;s localStorage and are never sent anywhere
        except the provider&apos;s own API.
      </p>

      <div className="settings-actions">
        <button type="button" className="toolbar-button" onClick={downloadExport}>
          {translate('exportState')}
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => {
            fileRef.current?.click();
          }}
        >
          {translate('importState')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          aria-label={translate('importState')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              importState(text);
            });
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className="toolbar-button danger-button"
          onClick={() => {
            if (window.confirm(translate('resetState'))) resetState();
          }}
        >
          {translate('resetState')}
        </button>
      </div>
    </Modal>
  );
}
