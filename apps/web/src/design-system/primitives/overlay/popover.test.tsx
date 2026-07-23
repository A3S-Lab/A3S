import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popover } from './popover';

afterEach(cleanup);

function ExamplePopover({
  disabled = false,
  onOpenChange,
}: {
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Popover
      label='选择模式'
      panelLabel='模式'
      disabled={disabled}
      onOpenChange={onOpenChange}
      trigger={(props, { open }) => (
        <button {...props} className={open ? 'active' : ''}>
          模式
        </button>
      )}
    >
      {(close) => (
        <button type='button' onClick={close}>
          自动执行
        </button>
      )}
    </Popover>
  );
}

describe('Popover', () => {
  it('owns trigger semantics and returns focus after a content action', () => {
    const onOpenChange = vi.fn();
    render(<ExamplePopover onOpenChange={onOpenChange} />);

    const trigger = screen.getByRole('button', { name: '选择模式' });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: '模式' })).toHaveClass('ds-popover-panel');
    fireEvent.click(screen.getByRole('button', { name: '自动执行' }));

    expect(screen.queryByRole('region', { name: '模式' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('closes on outside pointer input without moving focus back', () => {
    render(
      <>
        <ExamplePopover />
        <button type='button'>页面操作</button>
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: '选择模式' }));
    const outside = screen.getByRole('button', { name: '页面操作' });
    outside.focus();
    fireEvent.pointerDown(outside);

    expect(screen.queryByRole('region', { name: '模式' })).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
  });

  it('closes on Escape, restores focus, and closes when disabled', () => {
    const { rerender } = render(<ExamplePopover />);
    const trigger = screen.getByRole('button', { name: '选择模式' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('region', { name: '模式' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    rerender(<ExamplePopover disabled />);
    expect(screen.queryByRole('region', { name: '模式' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择模式' })).toBeDisabled();
  });
});
