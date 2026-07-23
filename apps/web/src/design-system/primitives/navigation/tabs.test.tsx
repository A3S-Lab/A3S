import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from './tabs';

afterEach(cleanup);

describe('Tabs', () => {
  it('renders one selected tab and reports pointer selection', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        ariaLabel='页面'
        value='overview'
        onChange={onChange}
        items={[
          { id: 'overview', label: '概览', panelId: 'overview-panel' },
          { id: 'details', label: '详情', panelId: 'details-panel', badge: 2 },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: '概览' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '概览' })).toHaveAttribute('aria-controls', 'overview-panel');
    expect(screen.getByRole('tab', { name: '详情 2' })).toHaveAttribute('tabindex', '-1');

    fireEvent.click(screen.getByRole('tab', { name: '详情 2' }));
    expect(onChange).toHaveBeenCalledWith('details');
  });

  it('supports roving keyboard selection and skips disabled items', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        ariaLabel='渠道'
        value='weixin'
        onChange={onChange}
        items={[
          { id: 'weixin', label: '微信' },
          { id: 'disabled', label: '不可用', disabled: true },
          { id: 'feishu', label: '飞书' },
        ]}
      />
    );

    const weixin = screen.getByRole('tab', { name: '微信' });
    const feishu = screen.getByRole('tab', { name: '飞书' });
    weixin.focus();
    fireEvent.keyDown(weixin, { key: 'ArrowRight' });

    expect(onChange).toHaveBeenLastCalledWith('feishu');
    expect(feishu).toHaveFocus();

    fireEvent.keyDown(feishu, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('weixin');
    expect(weixin).toHaveFocus();
  });

  it('exposes consistent visual variants without changing tab semantics', () => {
    const { rerender } = render(
      <Tabs ariaLabel='视图' value='one' onChange={() => undefined} items={[{ id: 'one', label: '一' }]} />
    );
    expect(screen.getByRole('tablist', { name: '视图' })).toHaveClass('ds-tabs', 'segment');

    rerender(
      <Tabs
        ariaLabel='视图'
        value='one'
        variant='line'
        size='compact'
        onChange={() => undefined}
        items={[{ id: 'one', label: '一' }]}
      />
    );
    expect(screen.getByRole('tablist', { name: '视图' })).toHaveClass('ds-tabs', 'line', 'compact');
  });
});
