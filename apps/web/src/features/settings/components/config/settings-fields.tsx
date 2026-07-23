import { CheckCircle2, ChevronDown, Eye, EyeOff, X } from 'lucide-react';
import { type CSSProperties, useId, useState } from 'react';
import { type FieldControlProps, IconButton } from '../../../../design-system/primitives';

export const configuredSecret = '[configured]';

type SettingsFieldControlProps = Partial<FieldControlProps>;

export function SettingsTextField({
  value,
  onChange,
  label,
  placeholder,
  type = 'text',
  disabled = false,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: {
  value?: string | null;
  onChange(value: string): void;
  label: string;
  placeholder?: string;
  type?: 'text' | 'url';
  disabled?: boolean;
} & SettingsFieldControlProps) {
  return (
    <input
      className='config-input'
      id={id}
      type={type}
      value={value ?? ''}
      aria-label={label}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-required={ariaRequired}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function SettingsTextArea({
  value,
  onChange,
  label,
  placeholder,
  rows = 3,
  disabled = false,
}: {
  value?: string | null;
  onChange(value: string): void;
  label: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      className='config-input textarea'
      value={value ?? ''}
      aria-label={label}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function SettingsNumberField({
  value,
  onChange,
  label,
  min,
  max,
  step,
  placeholder,
  suffix,
  disabled = false,
}: {
  value?: number | null;
  onChange(value: number | null): void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  const errorId = useId();
  const validationMessage = numberValidationMessage(value, min, max);
  return (
    <div className={`config-number-field ${validationMessage ? 'invalid' : ''}`}>
      <div className='config-number-control'>
        <input
          className={`config-input number ${suffix ? 'with-suffix' : ''}`}
          type='number'
          value={formatNumberForStep(value, step)}
          aria-label={label}
          aria-invalid={Boolean(validationMessage)}
          aria-describedby={validationMessage ? errorId : undefined}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        />
        {suffix && (
          <span className='config-number-suffix' aria-hidden='true'>
            {suffix}
          </span>
        )}
      </div>
      {validationMessage && (
        <small className='config-field-error' id={errorId} role='alert'>
          {validationMessage}
        </small>
      )}
    </div>
  );
}

function numberValidationMessage(value?: number | null, min?: number, max?: number): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (min !== undefined && value < min) return `不能小于 ${min}`;
  if (max !== undefined && value > max) return `不能大于 ${max}`;
  return null;
}

function formatNumberForStep(value: number | null | undefined, step?: number): number | '' {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  if (!step || !Number.isFinite(step) || step <= 0) return value;

  const precision = decimalPrecision(step);
  return Number(value.toFixed(precision));
}

function decimalPrecision(value: number): number {
  const text = String(value).toLowerCase();
  const exponent = text.match(/e-(\d+)$/)?.[1];
  if (exponent) return Math.min(Number(exponent), 20);
  return Math.min(text.split('.')[1]?.length ?? 0, 20);
}

export function SettingsSelect<T extends string>({
  value,
  onChange,
  label,
  options,
  disabled = false,
}: {
  value: T;
  onChange(value: T): void;
  label: string;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div className='config-select-field'>
      <select
        className='config-input select'
        value={value}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden='true' size={14} />
    </div>
  );
}

export function SettingsSegmentedControl<T extends string>({
  value,
  onChange,
  label,
  options,
  disabled = false,
}: {
  value: T;
  onChange(value: T): void;
  label: string;
  options: Array<{ value: T; label: string; description?: string }>;
  disabled?: boolean;
}) {
  const groupName = useId();

  return (
    <div className='config-segmented-control' role='radiogroup' aria-label={label}>
      {options.map((option) => (
        <label className={value === option.value ? 'selected' : ''} title={option.description} key={option.value}>
          <input
            type='radio'
            name={groupName}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export function SettingsSliderField({
  value,
  onChange,
  label,
  min,
  max,
  step,
  formatValue = (current) => String(current),
  disabled = false,
}: {
  value: number;
  onChange(value: number): void;
  label: string;
  min: number;
  max: number;
  step: number;
  formatValue?(value: number): string;
  disabled?: boolean;
}) {
  const inputId = useId();
  const progress = max === min ? 0 : ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
  return (
    <div className='config-slider-field'>
      <input
        id={inputId}
        type='range'
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--config-slider-progress': `${progress}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output htmlFor={inputId}>{formatValue(value)}</output>
    </div>
  );
}

export function SettingsSecretField({
  value,
  onChange,
  label,
  disabled = false,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: {
  value?: string | null;
  onChange(value: string | null): void;
  label: string;
  disabled?: boolean;
} & SettingsFieldControlProps) {
  const [visible, setVisible] = useState(false);
  const configured = value === configuredSecret;
  return (
    <div className='config-secret-field'>
      <input
        className='config-input'
        id={id}
        type={visible ? 'text' : 'password'}
        value={configured ? '' : (value ?? '')}
        aria-label={label}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired}
        disabled={disabled}
        placeholder={configured ? '已配置；输入新值可替换' : '未配置'}
        onChange={(event) => onChange(event.target.value)}
      />
      {configured && (
        <span className='configured-dot'>
          <CheckCircle2 size={12} /> 已配置
        </span>
      )}
      <span className='config-secret-actions'>
        {!configured && (
          <IconButton
            label={`${visible ? '隐藏' : '显示'}${label}`}
            disabled={disabled}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </IconButton>
        )}
        {value && (
          <IconButton label={`清除${label}`} disabled={disabled} onClick={() => onChange(null)}>
            <X size={14} />
          </IconButton>
        )}
      </span>
    </div>
  );
}
