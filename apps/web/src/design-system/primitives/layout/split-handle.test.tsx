import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SplitHandle } from './split-handle';

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.dsResizing;
});

describe('SplitHandle', () => {
  it('supports bounded keyboard resizing, range jumps, and reset', () => {
    let current = 460;
    const onCommit = vi.fn((value: number) => {
      current = value;
    });
    const { rerender } = render(
      <SplitHandle
        label='调整面板宽度'
        value={current}
        min={360}
        max={500}
        defaultValue={440}
        direction='reverse'
        onChange={onCommit}
      />
    );
    const handle = screen.getByRole('separator', { name: '调整面板宽度' });

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onCommit).toHaveBeenLastCalledWith(480);
    rerender(
      <SplitHandle
        label='调整面板宽度'
        value={current}
        min={360}
        max={500}
        defaultValue={440}
        direction='reverse'
        onChange={onCommit}
      />
    );
    fireEvent.keyDown(handle, { key: 'End' });
    expect(onCommit).toHaveBeenLastCalledWith(500);
    fireEvent.doubleClick(handle);
    expect(onCommit).toHaveBeenLastCalledWith(440);
  });

  it('uses pointer movement in the declared direction and commits once', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <SplitHandle
        label='调整面板宽度'
        value={460}
        min={360}
        max={680}
        direction='reverse'
        onChange={onChange}
        onCommit={onCommit}
      />
    );
    const handle = screen.getByRole('separator', { name: '调整面板宽度' });
    fireEvent.pointerDown(handle, { button: 0, pointerId: 7, clientX: 600 });
    expect(document.documentElement).toHaveAttribute('data-ds-resizing', 'vertical');
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 540 });
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 540 });

    expect(onChange).toHaveBeenLastCalledWith(520);
    expect(onCommit).toHaveBeenCalledWith(520);
    expect(document.documentElement).not.toHaveAttribute('data-ds-resizing');
  });
});
