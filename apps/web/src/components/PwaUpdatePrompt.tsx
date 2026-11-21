import { useEffect, useState } from 'react';
import { useApp } from '../store/state';

/**
 * PWA update prompt.
 *
 * The service worker itself is registered by vite-plugin-pwa
 * (registerType: 'autoUpdate', default auto-injected registration). This
 * component only surfaces the update that the plugin reports: when a new
 * worker takes control, a banner offers a reload. Until the first real
 * update ships, nothing is shown.
 */
export function PwaUpdatePrompt(): JSX.Element | null {
  const { translate } = useApp();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const onUpdate = (): void => {
      setUpdateAvailable(true);
    };
    window.addEventListener('trade:pwa-update', onUpdate);
    return () => {
      window.removeEventListener('trade:pwa-update', onUpdate);
    };
  }, []);

  if (!updateAvailable) return null;
  return (
    <div className="pwa-banner" role="status">
      <span>{translate('updateAvailable')}</span>
      <button
        type="button"
        className="toolbar-button"
        onClick={() => {
          window.location.reload();
        }}
      >
        {translate('updateReload')}
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => {
          setUpdateAvailable(false);
        }}
        aria-label={translate('dismiss')}
      >
        ✕
      </button>
    </div>
  );
}
