import { Check, Pipette } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Popover } from '../../../design-system/primitives';

const OFFICE_COLORS = [
  '#111827',
  '#374151',
  '#6b7280',
  '#d1d5db',
  '#ffffff',
  '#dc2626',
  '#ea580c',
  '#d97706',
  '#65a30d',
  '#16a34a',
  '#0d9488',
  '#0891b2',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#c026d3',
  '#db2777',
] as const;

export function OfficeColorPicker({
  ariaLabel,
  value,
  onValueChange,
  disabled = false,
  compact = false,
  className = '',
}: {
  ariaLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const choose = (color: string, close: () => void) => {
    onValueChange(color);
    setDraft(color);
    close();
  };

  const applyDraft = (close: () => void) => {
    const normalized = normalizeCssColor(draft);
    if (normalized) choose(normalized, close);
  };

  return (
    <Popover
      label={ariaLabel}
      panelLabel={ariaLabel}
      panelRole='dialog'
      placement='bottom-end'
      portal
      className={`work-office-color-picker${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`}
      panelClassName='work-office-color-menu'
      disabled={disabled}
      trigger={(triggerProps) => (
        <button {...triggerProps} className='work-office-color-trigger' title={ariaLabel}>
          <span className='work-office-color-swatch' style={{ background: value }} aria-hidden='true' />
          {!compact && <span>{value.toUpperCase()}</span>}
          <Pipette size={12} aria-hidden='true' />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className='work-office-color-grid' role='listbox' aria-label='颜色'>
            {OFFICE_COLORS.map((color) => (
              <button
                type='button'
                role='option'
                aria-label={`颜色 ${color}`}
                aria-selected={color.toLowerCase() === value.toLowerCase()}
                key={color}
                style={{ background: color }}
                onClick={() => choose(color, close)}
              >
                {color.toLowerCase() === value.toLowerCase() && <Check size={12} />}
              </button>
            ))}
          </div>
          <div className='work-office-color-custom'>
            <input
              type='text'
              aria-label='自定义颜色值'
              value={draft}
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyDraft(close);
                }
              }}
            />
            <Button
              size='compact'
              tone='primary'
              disabled={!normalizeCssColor(draft)}
              onClick={() => applyDraft(close)}
            >
              应用
            </Button>
          </div>
        </>
      )}
    </Popover>
  );
}

function normalizeCssColor(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((part) => `${part}${part}`)
      .join('')}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}
