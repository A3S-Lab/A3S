import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonTone = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'standard' | 'compact';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone = 'secondary', size = 'standard', loading = false, children, className = '', disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type='button'
      className={`ds-button ${tone} ${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className='ds-button-spinner' aria-hidden='true' />}
      {children}
    </button>
  );
});
