import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface WorkspaceContextMenuItem {
  id: string;
  label: string;
  ariaLabel?: string;
  icon: ReactNode;
  onSelect(): void;
  shortcut?: string;
  ariaKeyShortcut?: string;
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

function WorkspaceContextMenuButton({ item, onSelect }: { item: WorkspaceContextMenuItem; onSelect(): void }) {
  const content = (
    <>
      {item.icon}
      <span>{item.label}</span>
      {item.shortcut && <kbd>{item.shortcut}</kbd>}
    </>
  );
  const props = {
    type: 'button' as const,
    'aria-label': item.ariaLabel ?? item.label,
    'aria-keyshortcuts': item.ariaKeyShortcut,
    className: item.danger ? 'danger' : undefined,
    disabled: item.disabled,
    onClick: onSelect,
  };

  if (item.checked !== undefined) {
    return (
      <button {...props} role='menuitemradio' aria-checked={item.checked}>
        {content}
      </button>
    );
  }

  return (
    <button {...props} role='menuitem'>
      {content}
    </button>
  );
}

export function WorkspaceContextMenu({
  label,
  x,
  y,
  items,
  onClose,
}: {
  label: string;
  x: number;
  y: number;
  items: readonly WorkspaceContextMenuItem[];
  onClose(): void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  );
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const margin = 8;
    const bounds = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - bounds.width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - bounds.height - margin)),
    });
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [x, y]);

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', closeFromOutside, true);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', closeFromOutside, true);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const moveFocus = (direction: 1 | -1) => {
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = current < 0 ? 0 : (current + direction + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  const dismissAndRestoreFocus = () => {
    restoreFocusRef.current?.focus();
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className='workspace-context-menu'
      role='menu'
      aria-label={label}
      style={position}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'Tab') {
          event.preventDefault();
          dismissAndRestoreFocus();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveFocus(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveFocus(-1);
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
          (event.key === 'Home' ? buttons[0] : buttons.at(-1))?.focus();
        }
      }}
    >
      {items.map((item) => (
        <div className='workspace-context-menu-item' key={item.id}>
          {item.separatorBefore && <hr />}
          <WorkspaceContextMenuButton
            item={item}
            onSelect={() => {
              restoreFocusRef.current?.focus();
              onClose();
              item.onSelect();
            }}
          />
        </div>
      ))}
    </div>,
    document.body
  );
}
