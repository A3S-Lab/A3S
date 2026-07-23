import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchField } from './search-field';

afterEach(cleanup);

describe('SearchField', () => {
  it('owns search semantics, value changes, and clear focus restoration', () => {
    const onValueChange = vi.fn();
    render(<SearchField label='搜索插件' value='agent' onValueChange={onValueChange} />);

    const input = screen.getByRole('searchbox', { name: '搜索插件' });
    fireEvent.change(input, { target: { value: 'runtime' } });
    expect(onValueChange).toHaveBeenCalledWith('runtime');

    fireEvent.click(screen.getByRole('button', { name: '清除搜索插件' }));
    expect(onValueChange).toHaveBeenCalledWith('');
    expect(input).toHaveFocus();
  });

  it('supports compact and disabled presentation without exposing a dead clear action', () => {
    render(<SearchField label='筛选文件' value='a3s' size='compact' disabled onValueChange={() => undefined} />);

    expect(screen.getByRole('searchbox', { name: '筛选文件' }).closest('.ds-search-field')).toHaveClass('compact');
    expect(screen.queryByRole('button', { name: '清除筛选文件' })).not.toBeInTheDocument();
  });
});
