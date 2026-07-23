import { type ReactNode, useId } from 'react';

export type SegmentedControlItem<T extends string> = {
  id: T;
  label: string;
  ariaLabel?: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  items,
  onChange,
  size = 'standard',
  layout = 'fit',
  disabled = false,
  className = '',
}: {
  ariaLabel: string;
  value: T;
  items: readonly SegmentedControlItem<T>[];
  onChange: (value: T) => void;
  size?: 'standard' | 'compact';
  layout?: 'fit' | 'equal';
  disabled?: boolean;
  className?: string;
}) {
  const groupName = useId();

  return (
    <div
      className={`ds-segmented-control ${size} ${layout}${className ? ` ${className}` : ''}`}
      role='radiogroup'
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      aria-orientation='horizontal'
    >
      {items.map((item) => {
        const selected = item.id === value;
        const itemDisabled = disabled || item.disabled;
        return (
          <label
            className={`ds-segmented-control-item${selected ? ' selected' : ''}`}
            title={item.description}
            key={item.id}
          >
            <input
              type='radio'
              name={groupName}
              value={item.id}
              checked={selected}
              disabled={itemDisabled}
              aria-label={item.ariaLabel}
              onChange={() => onChange(item.id)}
            />
            <span className='ds-segmented-control-content'>
              {item.icon && (
                <span className='ds-segmented-control-icon' aria-hidden='true'>
                  {item.icon}
                </span>
              )}
              <span className='ds-segmented-control-label'>{item.label}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
