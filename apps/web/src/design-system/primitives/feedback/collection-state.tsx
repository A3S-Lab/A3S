import type { ReactNode } from 'react';

export function CollectionState({
  children,
  icon,
  actions,
  tone = 'neutral',
  role,
  className = '',
}: {
  children: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  tone?: 'neutral' | 'info' | 'warning' | 'danger';
  role?: 'alert' | 'status' | 'note';
  className?: string;
}) {
  return (
    <div className={`ds-collection-state ${tone}${className ? ` ${className}` : ''}`} role={role}>
      {icon && (
        <span className='ds-collection-state-icon' aria-hidden='true'>
          {icon}
        </span>
      )}
      <span>{children}</span>
      {actions && <span className='ds-collection-state-actions'>{actions}</span>}
    </div>
  );
}
