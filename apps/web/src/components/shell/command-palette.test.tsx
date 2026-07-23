import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CodeActions } from '../../features/code/use-code-controller';
import { appState } from '../../state/app-state';
import { CommandPalette } from './command-palette';

describe('CommandPalette', () => {
  afterEach(() => {
    cleanup();
    appState.settingsOpen = false;
    appState.commandPaletteOpen = false;
    appState.fileQuickOpenOpen = false;
    appState.activeSessionId = null;
    appState.workspaceRoot = '';
    appState.workspacePresentation = 'docked';
    appState.taskView = 'conversation';
    window.history.replaceState(null, '', '#code/conversation');
  });

  it('filters every command and runs the selected result from the keyboard', () => {
    appState.commandPaletteOpen = true;
    render(<CommandPalette actions={{ newConversation: vi.fn() } as unknown as CodeActions} />);
    const input = screen.getByRole('combobox', { name: '搜索页面或操作' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: '设置' } });
    expect(screen.getByRole('option', { name: /设置/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /新建任务/ })).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(appState.settingsOpen).toBe(true);
    expect(window.location.hash).toBe('#settings/general');
    expect(appState.commandPaletteOpen).toBe(false);
  });

  it('shows one truthful empty state when no operation matches', () => {
    render(<CommandPalette actions={{} as CodeActions} />);
    fireEvent.change(screen.getByRole('combobox', { name: '搜索页面或操作' }), {
      target: { value: 'not-a-real-command' },
    });
    expect(screen.getByText('没有匹配的操作')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('only offers task-scoped destinations when a task exists', () => {
    appState.activeSessionId = null;
    const { unmount } = render(<CommandPalette actions={{ newConversation: vi.fn() } as unknown as CodeActions} />);
    expect(screen.queryByRole('option', { name: /任务活动/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /帮助与快捷键/ })).toBeInTheDocument();
    unmount();

    appState.activeSessionId = 'task-1';
    render(<CommandPalette actions={{ newConversation: vi.fn() } as unknown as CodeActions} />);
    expect(screen.getByRole('option', { name: /任务活动/ })).toBeInTheDocument();
  });

  it('opens Help as the selected Settings tab', () => {
    appState.commandPaletteOpen = true;
    render(<CommandPalette actions={{ newConversation: vi.fn() } as unknown as CodeActions} />);

    fireEvent.click(screen.getByRole('option', { name: /帮助与快捷键/ }));

    expect(appState.settingsOpen).toBe(true);
    expect(appState.settingsTab).toBe('help');
    expect(window.location.hash).toBe('#settings/help');
  });
  it('opens the Memory visualization from global navigation', () => {
    appState.commandPaletteOpen = true;
    render(<CommandPalette actions={{ newConversation: vi.fn() } as unknown as CodeActions} />);

    fireEvent.click(screen.getByRole('option', { name: /记忆图谱/ }));

    expect(appState.activeProduct).toBe('code');
    expect(appState.codeSurface).toBe('memory');
    expect(window.location.hash).toBe('#code/memory');
    expect(appState.commandPaletteOpen).toBe(false);
  });

  it('offers file quick open only for an active task', () => {
    appState.activeSessionId = 'task-1';
    appState.workspaceRoot = '/repo';
    appState.commandPaletteOpen = true;
    render(<CommandPalette actions={{ newConversation: vi.fn() } as unknown as CodeActions} />);

    fireEvent.click(screen.getByRole('option', { name: /快速打开文件/ }));

    expect(appState.commandPaletteOpen).toBe(false);
    expect(appState.fileQuickOpenOpen).toBe(true);
  });

  it('toggles the current task workspace presentation', () => {
    appState.activeSessionId = 'task-1';
    appState.workspaceRoot = '/repo';
    appState.taskView = 'review';
    appState.commandPaletteOpen = true;
    render(<CommandPalette actions={{ newConversation: vi.fn() } as unknown as CodeActions} />);

    fireEvent.click(screen.getByRole('option', { name: /全屏显示工作区/ }));

    expect(appState.commandPaletteOpen).toBe(false);
    expect(appState.workspacePresentation).toBe('fullscreen');
  });

  it('contains keyboard focus and restores the invoker after dismissal', () => {
    const invoker = document.createElement('button');
    document.body.append(invoker);
    invoker.focus();
    appState.commandPaletteOpen = true;
    const view = render(<CommandPalette actions={{ newConversation: vi.fn() } as unknown as CodeActions} />);

    const dialog = screen.getByRole('dialog', { name: '快速导航' });
    const input = screen.getByRole('combobox', { name: '搜索页面或操作' });
    const options = screen.getAllByRole('option');
    expect(input).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(options.at(-1)).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(input).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(appState.commandPaletteOpen).toBe(false);
    view.unmount();
    expect(invoker).toHaveFocus();
    invoker.remove();
  });
});
