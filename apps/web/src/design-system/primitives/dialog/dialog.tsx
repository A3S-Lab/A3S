import { X } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from 'react';
import { IconButton } from '../button/icon-button';

export function Dialog({
  title,
  description,
  children,
  footer,
  onClose,
  closeDisabled = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = dialogRef.current;
    const initial =
      root?.querySelector<HTMLElement>('[data-autofocus]') ??
      root?.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled)') ??
      root?.querySelector<HTMLElement>(':scope > footer button:not(:disabled)') ??
      root?.querySelector<HTMLElement>('button:not(:disabled)');
    initial?.focus();
    return () => restoreFocusRef.current?.focus();
  }, []);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !closeDisabled) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
      ) ?? []),
    ].filter((element) => !element.hasAttribute('hidden'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <dialog
      open
      className='ds-dialog-backdrop'
      role='presentation'
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className='ds-dialog'
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton label='关闭' disabled={closeDisabled} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className='ds-dialog-body'>{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </dialog>
  );
}
