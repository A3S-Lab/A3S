import type { ReactNode } from 'react';
import { SettingsSwitch } from './settings-switch';

export interface SettingsSectionToggle {
  checked: boolean;
  label: string;
  onChange(checked: boolean): void;
  disabled?: boolean;
}

export function SettingsSection({
  title,
  description,
  action,
  toggle,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  toggle?: SettingsSectionToggle;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`config-section ${className}`}>
      <header className='config-section-header'>
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {toggle ? (
          <div className='config-section-toggle'>
            <span>{toggle.checked ? '已启用' : '未启用'}</span>
            <SettingsSwitch
              checked={toggle.checked}
              label={toggle.label}
              disabled={toggle.disabled}
              onChange={toggle.onChange}
            />
          </div>
        ) : (
          action
        )}
      </header>
      <div className='config-section-content'>{children}</div>
    </section>
  );
}
