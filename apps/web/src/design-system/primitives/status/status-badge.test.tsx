import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('combines semantic tone and domain adapter classes', () => {
    render(
      <StatusBadge tone='warning' className='settings-local-badge'>
        需要处理
      </StatusBadge>
    );

    expect(screen.getByText('需要处理')).toHaveClass('ds-status-badge', 'warning', 'settings-local-badge');
  });
});
