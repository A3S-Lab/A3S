import type { ReactNode } from 'react';
import { InlineNotice } from '../../../../design-system/primitives';

export function SettingsEmptyNotice({ children }: { children: ReactNode }) {
  return (
    <InlineNotice className='settings-empty-notice' tone='neutral' role='note'>
      {children}
    </InlineNotice>
  );
}
