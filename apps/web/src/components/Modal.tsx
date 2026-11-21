import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '../store/state';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Accessible modal: overlay click / Escape closes, focus starts on the close button. */
export function Modal({ title, onClose, children }: ModalProps): JSX.Element {
  const { translate } = useApp();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={translate('close')}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
