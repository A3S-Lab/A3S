import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

export function SettingsDisclosure({
  title,
  description,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className='settings-disclosure' open={defaultOpen}>
      <summary>
        <span>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
        {badge && <span className='settings-disclosure-badge'>{badge}</span>}
        <ChevronDown size={15} />
      </summary>
      <div className='settings-disclosure-content'>{children}</div>
    </details>
  );
}
