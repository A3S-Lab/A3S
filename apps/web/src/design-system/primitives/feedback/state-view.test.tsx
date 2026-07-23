import { cleanup, render, screen } from '@testing-library/react';
import { AlertTriangle } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { StateView } from './state-view';

afterEach(cleanup);

describe('StateView', () => {
  it('renders one factual state and its next action', () => {
    render(
      <StateView
        tone='danger'
        role='alert'
        icon={<AlertTriangle />}
        title='无法加载'
        description='现有内容仍然安全。'
        actions={<button type='button'>重新加载</button>}
      />
    );

    expect(screen.getByRole('alert')).toHaveClass('ds-state-view', 'danger');
    expect(screen.getByRole('heading', { name: '无法加载', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('现有内容仍然安全。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  });

  it('supports compact in-panel states and structured details', () => {
    render(
      <StateView title='敬请期待' size='compact'>
        <p>功能仍在规划中。</p>
      </StateView>
    );

    expect(screen.getByText('敬请期待').closest('.ds-state-view')).toHaveClass('compact');
    expect(screen.getByText('功能仍在规划中。')).toBeInTheDocument();
  });
});
