import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Clock3 } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './segmented-control';

afterEach(cleanup);

describe('SegmentedControl', () => {
  it('renders one native single-selection group and reports changes', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel='时间范围'
        value='all'
        layout='equal'
        size='compact'
        items={[
          { id: 'all', label: '全部' },
          { id: '7d', label: '7 天', icon: <Clock3 /> },
        ]}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('radiogroup', { name: '时间范围' })).toHaveClass(
      'ds-segmented-control',
      'compact',
      'equal'
    );
    expect(screen.getByRole('radio', { name: '全部' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '7 天' }));
    expect(onChange).toHaveBeenCalledWith('7d');
  });

  it('supports item labels, descriptions, and disabled states without relying on button semantics', () => {
    render(
      <SegmentedControl
        ariaLabel='搜索范围'
        value='folder'
        disabled
        items={[
          {
            id: 'folder',
            label: 'Reports',
            ariaLabel: '仅搜索当前文件夹 Reports',
            description: '当前文件夹',
          },
          { id: 'workspace', label: '全部文件', ariaLabel: '搜索全部文件 docs' },
        ]}
        onChange={() => undefined}
      />
    );

    expect(screen.getByRole('radiogroup', { name: '搜索范围' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('radio', { name: '仅搜索当前文件夹 Reports' })).toBeDisabled();
    expect(screen.getByTitle('当前文件夹')).toHaveClass('selected');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
