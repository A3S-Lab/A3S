import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appState } from '../state/app-state';
import { ActivityBar } from './activity-bar';

describe('A3S activity bar', () => {
  afterEach(() => {
    cleanup();
    appState.settingsOpen = false;
  });

  it('keeps Code active and marks the future products as coming soon', () => {
    render(<ActivityBar />);
    const codeButton = screen.getByRole('button', { name: '编码' });
    expect(codeButton).toHaveAttribute('aria-current', 'page');
    expect(codeButton).toHaveAttribute('data-activity-tooltip', '编码');
    expect(screen.queryByRole('button', { name: /金融/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '科学，敬请期待' }));
    expect(appState.toast?.message).toBe('科学敬请期待');
  });

  it('keeps settings as the only system entry', async () => {
    render(<ActivityBar />);
    expect(screen.queryByRole('button', { name: '账户与连接' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '设置' })).toHaveAttribute('data-activity-tooltip', '设置');
    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    expect(appState.settingsOpen).toBe(true);
    expect(appState.settingsTab).toBe('general');
    await waitFor(() => expect(screen.getByRole('button', { name: '编码' })).toHaveAttribute('aria-current', 'page'));
    expect(screen.getByRole('button', { name: '设置' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: '设置' })).toHaveAttribute('aria-expanded', 'true');
  });
});
