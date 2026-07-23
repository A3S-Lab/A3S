import type { ReactNode } from 'react';

export function StateView({
  icon,
  title,
  description,
  descriptionTitle,
  actions,
  children,
  tone = 'neutral',
  size = 'standard',
  role,
  className = '',
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  descriptionTitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  size?: 'standard' | 'compact';
  role?: 'alert' | 'status';
  className?: string;
}) {
  return (
    <div className={`ds-state-view ${tone} ${size}${className ? ` ${className}` : ''}`} role={role}>
      {icon && <span className='ds-state-view-icon'>{icon}</span>}
      <h2>{title}</h2>
      {description && <p title={descriptionTitle}>{description}</p>}
      {children && <div className='ds-state-view-details'>{children}</div>}
      {actions && <div className='ds-state-view-actions'>{actions}</div>}
    </div>
  );
}
