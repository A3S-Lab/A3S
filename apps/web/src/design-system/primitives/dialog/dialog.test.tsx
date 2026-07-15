import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';

describe('Dialog interaction contract', () => {
  afterEach(cleanup);

  it('moves focus inside, closes with Escape, and restores the invoker', () => {
    const onClose = vi.fn();
    const invoker = document.createElement('button');
    document.body.append(invoker);
    invoker.focus();
    const view = render(
      <Dialog title='Rename file' onClose={onClose}>
        <label>
          Name
          <input aria-label='Name' />
        </label>
      </Dialog>
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(invoker).toHaveFocus();
    invoker.remove();
  });

  it('defaults destructive confirmations to the first safe footer action', () => {
    render(
      <Dialog
        title='Delete file'
        onClose={vi.fn()}
        footer={
          <>
            <button type='button'>Cancel</button>
            <button type='button'>Delete</button>
          </>
        }
      >
        <p>This cannot be undone.</p>
      </Dialog>
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('makes dismissal visibly unavailable while a mutation is in progress', () => {
    const onClose = vi.fn();
    render(
      <Dialog title='Saving' closeDisabled onClose={onClose}>
        <p>Saving changes</p>
      </Dialog>
    );
    expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
