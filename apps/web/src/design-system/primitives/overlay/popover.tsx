import {
  type AriaAttributes,
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
  type RefCallback,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

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
type PopoverPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

type FloatingPosition = {
  top: number;
  left: number;
  anchorWidth: number;
};

const FLOATING_GAP = 8;
const FLOATING_VIEWPORT_PADDING = 16;

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
  portal = false,
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
  placement?: PopoverPlacement;
  portal?: boolean;
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
  const panelElementRef = useRef<HTMLElement | null>(null);
  const tokenRef = useRef(Symbol('popover'));
  const panelId = useId();
  const [floatingPosition, setFloatingPosition] = useState<FloatingPosition | null>(null);

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

  const setPanelElement = useCallback(
    (element: HTMLElement | null) => {
      panelElementRef.current = element;
      if (typeof panelRef === 'function') panelRef(element);
      else if (panelRef) (panelRef as { current: HTMLElement | null }).current = element;
    },
    [panelRef]
  );

  const updateFloatingPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelElementRef.current;
    if (!trigger || !panel || typeof window === 'undefined') return;

    const triggerBounds = trigger.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    const panelWidth = Math.min(panelBounds.width, Math.max(0, window.innerWidth - FLOATING_VIEWPORT_PADDING * 2));
    const panelHeight = Math.min(panelBounds.height, Math.max(0, window.innerHeight - FLOATING_VIEWPORT_PADDING * 2));
    const spaceBelow = window.innerHeight - FLOATING_VIEWPORT_PADDING - triggerBounds.bottom - FLOATING_GAP;
    const spaceAbove = triggerBounds.top - FLOATING_GAP - FLOATING_VIEWPORT_PADDING;
    const preferBottom = placement.startsWith('bottom');
    const placeBelow = preferBottom
      ? panelHeight <= spaceBelow || spaceBelow >= spaceAbove
      : !(panelHeight <= spaceAbove || spaceAbove >= spaceBelow);
    const desiredTop = placeBelow
      ? triggerBounds.bottom + FLOATING_GAP
      : triggerBounds.top - FLOATING_GAP - panelHeight;
    const desiredLeft = placement.endsWith('end') ? triggerBounds.right - panelWidth : triggerBounds.left;
    const next = {
      top: clamp(
        desiredTop,
        FLOATING_VIEWPORT_PADDING,
        Math.max(FLOATING_VIEWPORT_PADDING, window.innerHeight - FLOATING_VIEWPORT_PADDING - panelHeight)
      ),
      left: clamp(
        desiredLeft,
        FLOATING_VIEWPORT_PADDING,
        Math.max(FLOATING_VIEWPORT_PADDING, window.innerWidth - FLOATING_VIEWPORT_PADDING - panelWidth)
      ),
      anchorWidth: triggerBounds.width,
    };
    setFloatingPosition((current) => (sameFloatingPosition(current, next) ? current : next));
  }, [placement]);

  useEffect(() => {
    if (!disabled || !openRef.current) return;
    updateOpen(false);
  }, [disabled, updateOpen]);

  useEffect(() => {
    if (!open) return;
    const token = tokenRef.current;
    pushOpenPopover(token);

    const closeFromOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        (rootRef.current?.contains(event.target) || panelElementRef.current?.contains(event.target))
      ) {
        return;
      }
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
    if (!open) return;
    const root = rootRef.current;
    const panel = panelElementRef.current;
    const closeFromFocusOut = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget;
      if (
        nextTarget instanceof Node &&
        (rootRef.current?.contains(nextTarget) || panelElementRef.current?.contains(nextTarget))
      ) {
        return;
      }
      updateOpen(false);
    };
    root?.addEventListener('focusout', closeFromFocusOut);
    if (portal) panel?.addEventListener('focusout', closeFromFocusOut);
    return () => {
      root?.removeEventListener('focusout', closeFromFocusOut);
      if (portal) panel?.removeEventListener('focusout', closeFromFocusOut);
    };
  }, [open, portal, updateOpen]);

  useLayoutEffect(() => {
    if (!open || !portal) {
      setFloatingPosition(null);
      return;
    }
    updateFloatingPosition();
    const frame = requestAnimationFrame(updateFloatingPosition);
    return () => cancelAnimationFrame(frame);
  }, [floatingPosition?.anchorWidth, open, portal, updateFloatingPosition]);

  useEffect(() => {
    if (!open || !portal) return;
    window.addEventListener('resize', updateFloatingPosition);
    window.addEventListener('scroll', updateFloatingPosition, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => updateFloatingPosition());
    if (triggerRef.current) observer?.observe(triggerRef.current);
    if (panelElementRef.current) observer?.observe(panelElementRef.current);
    return () => {
      window.removeEventListener('resize', updateFloatingPosition);
      window.removeEventListener('scroll', updateFloatingPosition, true);
      observer?.disconnect();
    };
  }, [open, portal, updateFloatingPosition]);

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

  const panel = open ? (
    <section
      ref={setPanelElement}
      id={panelId}
      className={`ds-popover-panel${panelClassName ? ` ${panelClassName}` : ''}`}
      role={panelRole}
      aria-label={panelLabel}
      data-floating={portal ? 'true' : undefined}
      onKeyDown={onPanelKeyDown}
      style={portal ? { position: 'absolute', top: 0, left: 0 } : undefined}
    >
      {typeof children === 'function' ? children(close) : children}
    </section>
  ) : null;

  const floatingStyle: CSSProperties = {
    top: floatingPosition?.top ?? 0,
    left: floatingPosition?.left ?? 0,
    width: floatingPosition?.anchorWidth ?? 0,
    visibility: floatingPosition ? 'visible' : 'hidden',
  };

  return (
    <div
      ref={rootRef}
      className={`ds-popover${open ? ' open' : ''}${className ? ` ${className}` : ''}`}
      data-placement={placement}
    >
      {trigger(triggerProps, { open })}
      {panel && portal && typeof document !== 'undefined'
        ? createPortal(
            <div className='ds-popover-portal-anchor' data-placement={placement} style={floatingStyle}>
              {panel}
            </div>,
            document.body
          )
        : panel}
    </div>
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function sameFloatingPosition(current: FloatingPosition | null, next: FloatingPosition): boolean {
  return (
    current !== null &&
    Math.abs(current.top - next.top) < 0.5 &&
    Math.abs(current.left - next.left) < 0.5 &&
    Math.abs(current.anchorWidth - next.anchorWidth) < 0.5
  );
}
