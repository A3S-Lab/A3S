import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

export function OfficeCheckbox({
  ariaLabel,
  checked,
  onCheckedChange,
  children,
  disabled = false,
  className = '',
}: {
  ariaLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={`work-office-checkbox ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} ${className}`.trim()}
    >
      <input
        type='checkbox'
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span className='work-office-checkbox-box' aria-hidden='true'>
        {checked && <Check size={11} />}
      </span>
      <span className='work-office-checkbox-label'>{children}</span>
    </label>
  );
}
