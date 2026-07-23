import type { ReactNode } from 'react';
import { useTabNavigation } from './tab-navigation';

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  tabId?: string;
  panelId?: string;
};

export function Tabs<T extends string>({
  ariaLabel,
  value,
  items,
  onChange,
  variant = 'segment',
  size = 'standard',
  className = '',
}: {
  ariaLabel: string;
  value: T;
  items: readonly TabItem<T>[];
  onChange: (value: T) => void;
  variant?: 'segment' | 'line';
  size?: 'standard' | 'compact';
  className?: string;
}) {
  const tabNavigation = useTabNavigation({ items, onChange });

  return (
    <div
      className={`ds-tabs ${variant} ${size}${className ? ` ${className}` : ''}`}
      role='tablist'
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(element) => {
              tabNavigation.setTabElement(item.id, element);
            }}
            type='button'
            role='tab'
            id={item.tabId}
            data-tab-id={item.id}
            aria-selected={selected}
            aria-controls={item.panelId}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => tabNavigation.handleTabKeyDown(event, item.id)}
          >
            {item.icon && (
              <span className='ds-tabs-icon' aria-hidden='true'>
                {item.icon}
              </span>
            )}
            <span className='ds-tabs-label'>{item.label}</span>
            {item.badge !== undefined && (
              <>
                {' '}
                <span className='ds-tabs-badge'>{item.badge}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
