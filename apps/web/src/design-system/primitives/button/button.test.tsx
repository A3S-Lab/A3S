import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './button';

afterEach(cleanup);

describe('Button', () => {
  it('exposes consistent tone and density variants', () => {
    render(
      <Button tone='danger' size='compact'>
        删除布局
      </Button>
    );

    expect(screen.getByRole('button', { name: '删除布局' })).toHaveClass('ds-button', 'danger', 'compact');
  });

  it('disables the action and reports progress while loading', () => {
    render(<Button loading>保存</Button>);

    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存' })).toHaveAttribute('aria-busy', 'true');
  });
});
