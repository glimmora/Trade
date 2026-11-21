import { useState } from 'react';
import { playAlertSound } from '../lib/sound';
import { useApp } from '../store/state';
import { Modal } from './Modal';

export function AlertsDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const {
    state,
    translate,
    addAlert,
    removeAlert,
    toggleAlert,
    setSoundEnabled,
    setNotificationsEnabled,
    pushToast,
  } = useApp();
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [notificationState, setNotificationState] = useState(
    'Notification' in window ? Notification.permission : 'denied',
  );

  const priceNumber = Number.parseFloat(price);
  const canAdd = Number.isFinite(priceNumber) && priceNumber > 0;

  const enableNotifications = (): void => {
    if (!('Notification' in window)) return;
    // Permission is requested only from this explicit user action.
    void Notification.requestPermission().then((permission) => {
      setNotificationState(permission);
      setNotificationsEnabled(permission === 'granted');
      if (permission !== 'granted') pushToast(translate('notificationsBlocked'), 'warning');
    });
  };

  return (
    <Modal title={translate('alertsTitle')} onClose={onClose}>
      <p className="dialog-note">{translate('alertCheckPending')}</p>

      <div className="alert-form">
        <label className="field-label">
          {translate('alertSymbol')}
          <input type="text" value={state.symbol} readOnly aria-readonly="true" />
        </label>
        <label className="field-label">
          {translate('alertCondition')}
          <select
            value={condition}
            onChange={(event) => {
              setCondition(event.target.value as 'above' | 'below');
            }}
          >
            <option value="above">{translate('alertAbove')}</option>
            <option value="below">{translate('alertBelow')}</option>
          </select>
        </label>
        <label className="field-label">
          {translate('alertPrice')}
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
            }}
            placeholder="0.00"
          />
        </label>
        <button
          type="button"
          className="toolbar-button"
          disabled={!canAdd}
          onClick={() => {
            if (canAdd) {
              addAlert(state.symbol, condition, priceNumber);
              setPrice('');
            }
          }}
        >
          {translate('addAlert')}
        </button>
      </div>

      {state.alerts.length === 0 ? (
        <p className="empty-state">{translate('noAlerts')}</p>
      ) : (
        <ul className="object-list">
          {state.alerts.map((alert) => (
            <li key={alert.id} className="object-row">
              <span className="object-label">
                {alert.symbol} {alert.condition === 'above' ? '≥' : '≤'} {alert.price}
              </span>
              <button
                type="button"
                className="toolbar-button"
                aria-pressed={alert.enabled}
                aria-label={`${translate('alerts')}: ${alert.symbol} ${alert.price}`}
                onClick={() => {
                  toggleAlert(alert.id);
                }}
              >
                {alert.enabled ? '●' : '○'}
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  removeAlert(alert.id);
                }}
                aria-label={`${translate('delete')}: ${alert.symbol} ${alert.price}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="alert-options">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={state.soundEnabled}
            onChange={(event) => {
              setSoundEnabled(event.target.checked);
              if (event.target.checked) playAlertSound();
            }}
          />
          {translate('sound')}
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={state.notificationsEnabled && notificationState === 'granted'}
            disabled={notificationState !== 'granted'}
            onChange={(event) => {
              setNotificationsEnabled(event.target.checked);
            }}
          />
          {translate('notifications')}
        </label>
        {notificationState !== 'granted' ? (
          <button type="button" className="toolbar-button" onClick={enableNotifications}>
            {translate('notificationsEnable')}
          </button>
        ) : null}
        {notificationState === 'denied' ? (
          <p className="dialog-note">{translate('notificationsBlocked')}</p>
        ) : null}
      </div>
    </Modal>
  );
}
