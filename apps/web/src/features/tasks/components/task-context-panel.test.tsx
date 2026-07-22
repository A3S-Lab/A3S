import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodeActions } from '../../code/use-code-controller';
import { appState } from '../../../state/app-state';
import { TaskContextPanel } from './task-context-panel';

describe('TaskContextPanel presentation', () => {
  beforeEach(() => {
    appState.activeSessionId = null;
    appState.taskView = 'activity';
    appState.workspacePresentation = 'docked';
    window.history.replaceState(null, '', '#code/activity');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    appState.taskView = 'conversation';
    appState.workspacePresentation = 'docked';
    window.history.replaceState(null, '', '#code/conversation');
  });

  it('preserves a more specific focus target established inside the opened panel', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    render(<TaskContextPanel view='activity' actions={{} as CodeActions} />);

    const returnToConversation = screen.getByRole('button', { name: '返回对话' });
    returnToConversation.focus();
    act(() => frames.shift()?.(0));

    expect(returnToConversation).toHaveFocus();
  });

  it('expands the existing task context and exits full screen with Escape', async () => {
    render(<TaskContextPanel view='activity' actions={{} as CodeActions} />);

    const panel = screen.getByRole('complementary', { name: '任务活动面板' });
    const enter = screen.getByRole('button', { name: '全屏显示任务活动面板' });
    fireEvent.click(enter);

    expect(appState.workspacePresentation).toBe('fullscreen');
    await waitFor(() => expect(panel).toHaveClass('fullscreen'));
    const exit = await screen.findByRole('button', { name: '退出任务活动面板全屏' });
    expect(exit).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(appState.workspacePresentation).toBe('docked');
    await waitFor(() => expect(panel).not.toHaveClass('fullscreen'));
    await waitFor(() => expect(screen.getByRole('button', { name: '全屏显示任务活动面板' })).toHaveFocus());
  });

  it('returns to a docked presentation when the context panel is closed', () => {
    appState.workspacePresentation = 'fullscreen';
    render(<TaskContextPanel view='activity' actions={{} as CodeActions} />);

    fireEvent.click(screen.getByRole('button', { name: '关闭任务上下文面板' }));

    expect(appState.taskView).toBe('conversation');
    expect(appState.workspacePresentation).toBe('docked');
    expect(window.location.hash).toBe('#code/conversation');
  });
});
