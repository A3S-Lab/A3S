import {
  type AriaAttributes,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
  type RefCallback,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

export type PopoverTriggerProps = {
  ref: RefCallback<HTMLButtonElement>;
  type: 'button';
  disabled: boolean;
  'aria-label': string;
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
  'aria-haspopup': AriaAttributes['aria-haspopup'];
  onClick: MouseEventHandler<HTMLButtonElement>;
};

type PopoverContent = ReactNode | ((close: () => void) => ReactNode);

const openPopoverStack: symbol[] = [];

function pushOpenPopover(token: symbol) {
  const existing = openPopoverStack.indexOf(token);
  if (existing >= 0) openPopoverStack.splice(existing, 1);
  openPopoverStack.push(token);
}

function removeOpenPopover(token: symbol) {
  const index = openPopoverStack.lastIndexOf(token);
  if (index >= 0) openPopoverStack.splice(index, 1);
}

export function Popover({
  label,
  panelLabel,
  trigger,
  children,
  disabled = false,
  className = '',
  panelClassName = '',
  panelRole = 'region',
  placement = 'bottom-start',
  open: controlledOpen,
  defaultOpen = false,
  panelRef,
  onPanelKeyDown,
  onOpenChange,
}: {
  label: string;
  panelLabel: string;
  trigger: (props: PopoverTriggerProps, state: { open: boolean }) => ReactNode;
  children: PopoverContent;
  disabled?: boolean;
  className?: string;
  panelClassName?: string;
  panelRole?: 'region' | 'dialog' | 'menu' | 'listbox';
  placement?: 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  open?: boolean;
  defaultOpen?: boolean;
  panelRef?: Ref<HTMLElement>;
  onPanelKeyDown?: KeyboardEventHandler<HTMLElement>;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const openRef = useRef(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tokenRef = useRef(Symbol('popover'));
  const panelId = useId();

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const updateOpen = useCallback(
    (next: boolean) => {
      if (openRef.current === next) return;
      openRef.current = next;
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange]
  );

  const close = useCallback(() => {
    updateOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, [updateOpen]);

  useEffect(() => {
    if (!disabled || !openRef.current) return;
    updateOpen(false);
  }, [disabled, updateOpen]);

  useEffect(() => {
    if (!open) return;
    const token = tokenRef.current;
    pushOpenPopover(token);

    const closeFromOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      updateOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || openPopoverStack.at(-1) !== token) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      removeOpenPopover(token);
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [close, open, updateOpen]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const closeFromFocusOut = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && root.contains(nextTarget)) return;
      updateOpen(false);
    };
    root.addEventListener('focusout', closeFromFocusOut);
    return () => root.removeEventListener('focusout', closeFromFocusOut);
  }, [updateOpen]);

  const triggerProps: PopoverTriggerProps = {
    ref: (element) => {
      triggerRef.current = element;
    },
    type: 'button',
    disabled,
    'aria-label': label,
    'aria-expanded': open,
    'aria-controls': open ? panelId : undefined,
    'aria-haspopup': panelRole === 'region' ? undefined : panelRole,
    onClick: () => updateOpen(!openRef.current),
  };

  return (
    <div
      ref={rootRef}
      className={`ds-popover${open ? ' open' : ''}${className ? ` ${className}` : ''}`}
      data-placement={placement}
    >
      {trigger(triggerProps, { open })}
      {open && (
        <section
          ref={panelRef}
          id={panelId}
          className={`ds-popover-panel${panelClassName ? ` ${panelClassName}` : ''}`}
          role={panelRole}
          aria-label={panelLabel}
          onKeyDown={onPanelKeyDown}
        >
          {typeof children === 'function' ? children(close) : children}
        </section>
      )}
    </div>
  );
}
