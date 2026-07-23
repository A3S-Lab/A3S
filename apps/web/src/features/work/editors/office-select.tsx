import { Check, ChevronDown } from 'lucide-react';
import { type KeyboardEvent, useId, useMemo, useState } from 'react';
import { Popover } from '../../../design-system/primitives';

export interface OfficeSelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function OfficeSelect<T extends string>({
  ariaLabel,
  value,
  options,
  onValueChange,
  disabled = false,
  placeholder = '请选择',
  className = '',
}: {
  ariaLabel: string;
  value: T;
  options: readonly OfficeSelectOption<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const reactId = useId().replaceAll(':', '');
  const [open, setOpen] = useState(false);
  const selectedIndex = useMemo(() => options.findIndex((option) => option.value === value), [options, value]);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));
  const selected = options[selectedIndex];

  const openAt = (index: number) => {
    const next = nearestEnabledOption(options, index, 1);
    setActiveIndex(next);
    setOpen(true);
    requestAnimationFrame(() => document.getElementById(`${reactId}-option-${next}`)?.focus());
  };

  const selectOption = (index: number, close: () => void) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange(option.value);
    close();
  };

  const moveOptionFocus = (event: KeyboardEvent, direction: -1 | 1) => {
    event.preventDefault();
    const next = nearestEnabledOption(options, activeIndex + direction, direction);
    setActiveIndex(next);
    document.getElementById(`${reactId}-option-${next}`)?.focus();
  };

  return (
    <Popover
      label={ariaLabel}
      panelLabel={ariaLabel}
      panelRole='listbox'
      portal
      className={`work-office-select${className ? ` ${className}` : ''}`}
      panelClassName='work-office-select-menu'
      open={open}
      disabled={disabled}
      onOpenChange={setOpen}
      trigger={(triggerProps, { open: popoverOpen }) => (
        <button
          {...triggerProps}
          role='combobox'
          aria-expanded={popoverOpen}
          onClick={(event) => {
            if (!popoverOpen) {
              const next = nearestEnabledOption(options, selectedIndex >= 0 ? selectedIndex : 0, 1);
              setActiveIndex(next);
              requestAnimationFrame(() => document.getElementById(`${reactId}-option-${next}`)?.focus());
            }
            triggerProps.onClick(event);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              openAt(selectedIndex >= 0 ? selectedIndex + 1 : 0);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              openAt(selectedIndex >= 0 ? selectedIndex - 1 : options.length - 1);
            }
          }}
        >
          <span>{selected?.label ?? placeholder}</span>
          <ChevronDown size={13} aria-hidden='true' />
        </button>
      )}
    >
      {(close) => (
        <>
          {options.map((option, index) => (
            <button
              type='button'
              role='option'
              id={`${reactId}-option-${index}`}
              key={option.value}
              aria-selected={option.value === value}
              disabled={option.disabled}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => selectOption(index, close)}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') moveOptionFocus(event, 1);
                else if (event.key === 'ArrowUp') moveOptionFocus(event, -1);
                else if (event.key === 'Home') {
                  event.preventDefault();
                  const next = nearestEnabledOption(options, 0, 1);
                  setActiveIndex(next);
                  document.getElementById(`${reactId}-option-${next}`)?.focus();
                } else if (event.key === 'End') {
                  event.preventDefault();
                  const next = nearestEnabledOption(options, options.length - 1, -1);
                  setActiveIndex(next);
                  document.getElementById(`${reactId}-option-${next}`)?.focus();
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectOption(index, close);
                }
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={12} aria-hidden='true' />}
            </button>
          ))}
        </>
      )}
    </Popover>
  );
}

function nearestEnabledOption<T extends string>(
  options: readonly OfficeSelectOption<T>[],
  requestedIndex: number,
  direction: -1 | 1
): number {
  if (options.length === 0) return 0;
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (requestedIndex + offset * direction + options.length * 2) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return 0;
}
