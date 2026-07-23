import { Search, X } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, useRef } from 'react';

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'size'> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  size?: 'standard' | 'compact';
  className?: string;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    label,
    value,
    onValueChange,
    onClear,
    clearLabel = `清除${label}`,
    size = 'standard',
    className = '',
    disabled,
    ...inputProps
  },
  forwardedRef
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element;
    if (typeof forwardedRef === 'function') forwardedRef(element);
    else if (forwardedRef) forwardedRef.current = element;
  };

  return (
    <label className={`ds-search-field ${size}${className ? ` ${className}` : ''}`}>
      <Search size={14} aria-hidden='true' />
      <input
        {...inputProps}
        ref={setInputRef}
        type='search'
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {value && !disabled && (
        <button
          type='button'
          className='ds-search-field-clear'
          aria-label={clearLabel}
          onClick={() => {
            onClear?.();
            onValueChange('');
            inputRef.current?.focus();
          }}
        >
          <X size={13} />
        </button>
      )}
    </label>
  );
});
