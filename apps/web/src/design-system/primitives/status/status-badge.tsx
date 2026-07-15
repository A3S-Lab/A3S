import type { ReactNode } from 'react';

export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return <span className={`ds-status-badge ${tone}`}>{children}</span>;
}
