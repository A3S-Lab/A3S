import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  label: string;
  tooltip?: string;
  selected?: boolean;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tooltip = label, selected, children, className = '', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type='button'
      className={`ds-icon-button ${selected ? 'selected' : ''} ${className}`}
      aria-label={label}
      aria-pressed={selected}
      title={tooltip}
      {...props}
    >
      {children}
    </button>
  );
});
