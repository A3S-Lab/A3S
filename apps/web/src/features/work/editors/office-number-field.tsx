import { ChevronDown, ChevronUp } from 'lucide-react';

export function OfficeNumberField({
  ariaLabel,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  disabled = false,
  className = '',
  placeholder,
}: {
  ariaLabel: string;
  value: number | string;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const numericValue = value === '' ? null : Number(value);
  const invalid =
    numericValue !== null &&
    (!Number.isFinite(numericValue) ||
      (min !== undefined && numericValue < min) ||
      (max !== undefined && numericValue > max));
  const changeBy = (direction: -1 | 1) => {
    const current = Number(value);
    const fallback = min ?? 0;
    const next = clampNumber(Number.isFinite(current) ? current + step * direction : fallback, min, max);
    onValueChange(formatSteppedNumber(next, step));
  };

  return (
    <div className={`work-office-number-field ${className}`.trim()}>
      <input
        type='text'
        inputMode='decimal'
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            changeBy(1);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            changeBy(-1);
          }
        }}
      />
      <span className='work-office-number-steppers'>
        <button type='button' aria-label={`增加${ariaLabel}`} disabled={disabled} onClick={() => changeBy(1)}>
          <ChevronUp size={10} />
        </button>
        <button type='button' aria-label={`减少${ariaLabel}`} disabled={disabled} onClick={() => changeBy(-1)}>
          <ChevronDown size={10} />
        </button>
      </span>
    </div>
  );
}

function clampNumber(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value));
}

function formatSteppedNumber(value: number, step: number): string {
  const decimalPlaces = Math.max(0, (String(step).split('.')[1] ?? '').length);
  return decimalPlaces === 0 ? String(Math.round(value)) : value.toFixed(decimalPlaces).replace(/\.?0+$/, '');
}
