import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { TaskLibrary } from './task-library';

const task = {
  sessionId: 'task-1',
  workspace: '/repo',
  cwd: '/repo',
  model: 'codex/gpt',
  followDefaultModel: false,
  permissionMode: 'default',
  state: 'connected',
  title: 'Parser task',
  createdAt: 1,
};

describe('TaskLibrary management', () => {
  beforeEach(() => {
    appState.sessions = [task];
    appState.activeSessionId = 'task-1';
    appState.streamingSessionId = null;
    appState.searchQuery = '';
    appState.health = null;
  });
  afterEach(cleanup);

  it('uses a quiet grouped task list with relative time and collapsible search', () => {
    appState.sessions = [{ ...task, createdAt: Date.now() - 7 * 60 * 60 * 1000 }];
    render(<TaskLibrary actions={{} as TaskActions} />);

    expect(screen.getByText('编码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起编码侧边栏' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收起编码侧边栏' }));
    expect(appState.sidebarOpen).toBe(false);
    expect(screen.getByRole('button', { name: '任务 (1)' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('7小时前')).toBeInTheDocument();
    expect(screen.queryByText('codex/gpt')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: '搜索任务' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '搜索任务' }));
    const search = screen.getByRole('searchbox', { name: '搜索任务' });
    expect(search).toHaveFocus();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('searchbox', { name: '搜索任务' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '搜索任务' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: '任务 (1)' }));
    expect(screen.queryByRole('button', { name: /打开任务 Parser task/ })).not.toBeInTheDocument();
  });

  it('keeps Work AI assistant sessions out of the Code task list', () => {
    appState.sessions = [task, { ...task, sessionId: 'work-assistant', title: 'Work conversation', agentId: 'work' }];
    render(<TaskLibrary actions={{} as TaskActions} />);

    expect(screen.getByRole('button', { name: '任务 (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /打开任务 Parser task/ })).toBeInTheDocument();
    expect(screen.queryByText('Work conversation')).not.toBeInTheDocument();
  });

  it('closes the task overlay after selecting a task on a compact viewport', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    appState.sidebarOpen = true;
    const selectSession = vi.fn(async () => undefined);
    render(<TaskLibrary actions={{ selectSession } as unknown as TaskActions} />);

    fireEvent.click(screen.getByRole('button', { name: /打开任务 Parser task/ }));

    expect(selectSession).toHaveBeenCalledWith('task-1');
    expect(appState.sidebarOpen).toBe(false);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  });

  it('keeps deletion confirmation open when deleting the task fails', async () => {
    const removeSession = vi.fn(async () => {
      throw new Error('delete failed');
    });
    render(<TaskLibrary actions={{ removeSession } as unknown as TaskActions} />);
    fireEvent.click(screen.getByRole('button', { name: '删除 Parser task' }));
    expect(screen.getByRole('group', { name: '确认删除 Parser task' })).toHaveTextContent('保留工作区文件');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认删除 Parser task' }));
    await waitFor(() => expect(removeSession).toHaveBeenCalledWith('task-1'));
    expect(screen.getByRole('group', { name: '确认删除 Parser task' })).toHaveTextContent('删除失败，请重试');
  });

  it('does not offer deletion while the task is running', () => {
    appState.streamingSessionId = 'task-1';
    render(<TaskLibrary actions={{} as TaskActions} />);
    expect(screen.queryByRole('button', { name: '删除 Parser task' })).not.toBeInTheDocument();
  });

  it('renames the task inline and prevents an unchanged save', () => {
    const renameSession = vi.fn(async () => undefined);
    render(<TaskLibrary actions={{ renameSession } as unknown as TaskActions} />);
    fireEvent.click(screen.getByRole('button', { name: '重命名 Parser task' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存任务名称' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: '任务名称' }), { target: { value: 'Parser follow-up' } });
    fireEvent.click(screen.getByRole('button', { name: '保存任务名称' }));
    expect(renameSession).toHaveBeenCalledWith('task-1', 'Parser follow-up');
  });

  it('associates an inline rename failure with the task name field', async () => {
    const renameSession = vi.fn(async () => {
      throw new Error('rename failed');
    });
    render(<TaskLibrary actions={{ renameSession } as unknown as TaskActions} />);

    fireEvent.click(screen.getByRole('button', { name: '重命名 Parser task' }));
    const input = screen.getByRole('textbox', { name: '任务名称' });
    fireEvent.change(input, { target: { value: 'Parser follow-up' } });
    fireEvent.click(screen.getByRole('button', { name: '保存任务名称' }));

    await waitFor(() => expect(renameSession).toHaveBeenCalledWith('task-1', 'Parser follow-up'));
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('重命名失败，请重试');
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
