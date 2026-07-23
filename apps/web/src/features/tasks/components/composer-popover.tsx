import type { ReactNode } from 'react';
import { Popover } from '../../../design-system/primitives';

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
  return (
    <Popover
      label={label}
      panelLabel={panelLabel}
      className={`composer-popover-control${className ? ` ${className}` : ''}`}
      panelClassName='composer-control-popover'
      placement='top-start'
      disabled={disabled}
      onOpenChange={onOpenChange}
      trigger={(triggerProps, { open }) => (
        <button {...triggerProps} className={`composer-quick-trigger${open ? ' active' : ''}`} title={label}>
          {trigger}
        </button>
      )}
    >
      {children}
    </Popover>
  );
}
