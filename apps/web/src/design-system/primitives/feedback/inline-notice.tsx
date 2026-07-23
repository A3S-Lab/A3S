import type { ReactNode } from 'react';

export function InlineNotice({
  title,
  children,
  icon,
  actions,
  tone = 'info',
  role,
  className = '',
}: {
  title?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  role?: 'alert' | 'status' | 'note';
  className?: string;
}) {
  return (
    <div className={`ds-inline-notice ${tone}${className ? ` ${className}` : ''}`} role={role}>
      {icon && (
        <span className='ds-inline-notice-icon' aria-hidden='true'>
          {icon}
        </span>
      )}
      <div className='ds-inline-notice-copy'>
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
      {actions && <div className='ds-inline-notice-actions'>{actions}</div>}
    </div>
  );
}
