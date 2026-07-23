import type { ReactNode } from 'react';

export function PageHeader({
  icon,
  title,
  description,
  status,
  navigation,
  actions,
  accent = 'blue',
  className = '',
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  navigation?: ReactNode;
  actions?: ReactNode;
  accent?: 'blue' | 'green' | 'purple' | 'neutral';
  className?: string;
}) {
  return (
    <header
      className={`ds-page-header${navigation ? ' has-navigation' : ''}${className ? ` ${className}` : ''}`}
      data-accent={accent}
    >
      <div className='ds-page-header-identity'>
        {icon && (
          <span className='ds-page-header-icon' aria-hidden='true'>
            {icon}
          </span>
        )}
        <div className='ds-page-header-copy'>
          <div className='ds-page-header-title-line'>
            <h1>{title}</h1>
            {status && <span className='ds-page-header-status'>{status}</span>}
          </div>
          {description && <p>{description}</p>}
        </div>
      </div>
      {navigation && <div className='ds-page-header-navigation'>{navigation}</div>}
      {actions && <div className='ds-page-header-actions'>{actions}</div>}
    </header>
  );
}
