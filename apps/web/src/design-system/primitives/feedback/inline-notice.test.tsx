import { cleanup, render, screen } from '@testing-library/react';
import { AlertTriangle } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { InlineNotice } from './inline-notice';

afterEach(cleanup);

describe('InlineNotice', () => {
  it('renders one semantic message with optional action', () => {
    render(
      <InlineNotice
        tone='danger'
        role='alert'
        icon={<AlertTriangle />}
        title='设置未同步'
        actions={<button type='button'>重试</button>}
      >
        当前草稿仍然保留。
      </InlineNotice>
    );

    expect(screen.getByRole('alert')).toHaveClass('ds-inline-notice', 'danger');
    expect(screen.getByText('设置未同步')).toBeInTheDocument();
    expect(screen.getByText('当前草稿仍然保留。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});
