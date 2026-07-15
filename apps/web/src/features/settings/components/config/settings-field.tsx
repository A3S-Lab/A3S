import type { ReactNode } from 'react';

export function SettingsField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className='config-field'>
      <legend>{label}</legend>
      {children}
    </fieldset>
  );
}
