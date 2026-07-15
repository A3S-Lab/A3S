import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

type ComposerPopoverContent = ReactNode | ((close: () => void) => ReactNode);

export function ComposerPopover({
  label,
  panelLabel,
  className = '',
  trigger,
  disabled = false,
  onOpenChange,
  children,
}: {
  label: string;
  panelLabel: string;
  className?: string;
  trigger: ReactNode;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ComposerPopoverContent;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const updateOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  const close = () => {
    updateOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (disabled && open) updateOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) updateOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [open]);

  return (
    <section ref={rootRef} className={`composer-popover-control ${className}`}>
      <button
        ref={triggerRef}
        type='button'
        className={`composer-quick-trigger ${open ? 'active' : ''}`}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={disabled}
        onClick={() => updateOpen(!open)}
      >
        {trigger}
      </button>
      {open && (
        <section id={panelId} className='composer-control-popover' aria-label={panelLabel}>
          {typeof children === 'function' ? children(close) : children}
        </section>
      )}
    </section>
  );
}
