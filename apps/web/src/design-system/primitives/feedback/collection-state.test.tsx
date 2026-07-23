import { render, screen } from '@testing-library/react';
import { AlertTriangle } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { CollectionState } from './collection-state';

describe('CollectionState', () => {
  it('provides one compact semantic state for lists, menus, and trees', () => {
    render(
      <CollectionState tone='danger' role='alert' icon={<AlertTriangle data-testid='icon' />}>
        无法读取目录
      </CollectionState>
    );

    expect(screen.getByRole('alert')).toHaveClass('ds-collection-state', 'danger');
    expect(screen.getByText('无法读取目录')).toBeInTheDocument();
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});
