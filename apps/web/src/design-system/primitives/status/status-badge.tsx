import type { ReactNode } from 'react';

export function StatusBadge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  return <span className={`ds-status-badge ${tone}${className ? ` ${className}` : ''}`}>{children}</span>;
}
