import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId } from 'react';
import { IconButton } from '../button/icon-button';
import { useDialogFocusScope } from '../overlay/dialog-focus-scope';

export function Dialog({
  title,
  description,
  children,
  footer,
  onClose,
  closeDisabled = false,
  className,
  focusKey,
  restoreFocusTarget,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  className?: string;
  focusKey?: string | number;
  restoreFocusTarget?: () => HTMLElement | null;
}) {
  const titleId = useId();
  const focusScope = useDialogFocusScope<HTMLElement>({
    onEscape: onClose,
    escapeDisabled: closeDisabled,
    restoreFocusTarget,
  });
  useEffect(() => {
    if (focusKey !== undefined) focusScope.focusInitial();
  }, [focusKey, focusScope.focusInitial]);
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
        ref={focusScope.scopeRef}
        className={`ds-dialog${className ? ` ${className}` : ''}`}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        onKeyDown={focusScope.handleKeyDown}
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
