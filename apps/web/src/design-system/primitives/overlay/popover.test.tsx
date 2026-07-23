import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popover } from './popover';

afterEach(cleanup);

function ExamplePopover({
  disabled = false,
  placement = 'bottom-start',
  portal = false,
  onOpenChange,
}: {
  disabled?: boolean;
  placement?: 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  portal?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Popover
      label='选择模式'
      panelLabel='模式'
      disabled={disabled}
      placement={placement}
      portal={portal}
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
    fireEvent.pointerDown(outside);
    outside.focus();

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

  it('portals floating content, keeps focus transitions inside it open, and aligns it to the trigger', () => {
    const getBoundingClientRect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.classList.contains('ds-popover-panel')) {
        return domRect({ left: 0, top: 0, right: 202, bottom: 120, width: 202, height: 120 });
      }
      if (this.getAttribute('aria-label') === '选择模式') {
        return domRect({ left: 560, top: 40, right: 600, bottom: 70, width: 40, height: 30 });
      }
      return domRect({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    });
    const { container } = render(<ExamplePopover placement='bottom-end' portal />);

    fireEvent.click(screen.getByRole('button', { name: '选择模式' }));
    const panel = screen.getByRole('region', { name: '模式' });
    const floatingLayer = panel.parentElement;

    expect(container.querySelector('.ds-popover-panel')).toBeNull();
    expect(floatingLayer).toHaveClass('ds-popover-portal-anchor');
    expect(floatingLayer).toHaveStyle({ left: '398px', top: '78px', width: '40px', visibility: 'visible' });

    const action = screen.getByRole('button', { name: '自动执行' });
    action.focus();
    expect(panel).toBeInTheDocument();

    getBoundingClientRect.mockRestore();
  });
});

function domRect({
  left,
  top,
  right,
  bottom,
  width,
  height,
}: {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}
