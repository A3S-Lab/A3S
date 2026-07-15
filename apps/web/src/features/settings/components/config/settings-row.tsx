import type { ReactNode } from 'react';

export function SettingsRow({
  label,
  description,
  children,
  vertical = false,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  vertical?: boolean;
}) {
  return (
    <div className={`config-row ${vertical ? 'vertical' : ''}`}>
      <div className='config-row-copy'>
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className='config-row-control'>{children}</div>
    </div>
  );
}
