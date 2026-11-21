import { useApp } from '../store/state';

/** In-app toasts (alerts, confirmations, status). Announced via aria-live. */
export function Toasts(): JSX.Element {
  const { toasts, dismissToast, translate } = useApp();
  return (
    <div className="toasts" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
          <span>{toast.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            onClick={() => {
              dismissToast(toast.id);
            }}
            aria-label={translate('dismiss')}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
