import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { CodeSession } from '../../../types/api';
import type { TaskActions } from '../task-actions';
import { NewTaskWorkspaceControl } from './new-task-workspace-control';

const recentSession: CodeSession = {
  sessionId: 'task-acme',
  workspace: '/clients/acme',
  cwd: '/clients/acme',
  followDefaultModel: true,
  permissionMode: 'default',
  state: 'idle',
  createdAt: 2,
};

describe('new task workspace control', () => {
  beforeEach(() => {
    appState.activeSessionId = null;
    appState.streamingSessionId = null;
    appState.workspaceRoot = '/repo';
    appState.health = {
      ok: true,
      app: 'A3S Code',
      version: '0.7.7',
      configPath: '/repo/config.acl',
      workspace: '/repo',
    };
    appState.sessions = [recentSession];
    appState.newTaskConfig = {
      workspace: '/repo',
      model: '',
      effort: 'medium',
      permissionMode: 'default',
      goal: '',
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens upward, filters recent workspaces, and selects one', async () => {
    const selectNewTaskWorkspace = vi.fn(async () => undefined);
    const actions = {
      selectNewTaskWorkspace,
      pickNewTaskWorkspace: vi.fn(async () => null),
    } as unknown as TaskActions;
    render(<NewTaskWorkspaceControl actions={actions} />);

    const trigger = screen.getByRole('button', { name: '工作区：repo' });
    fireEvent.click(trigger);

    const panel = screen.getByRole('region', { name: '选择新任务工作区' });
    expect(panel).toHaveClass('composer-control-popover');
    expect(screen.getByRole('searchbox', { name: '搜索工作区' })).toHaveFocus();
    expect(screen.getAllByRole('option')).toHaveLength(2);

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索工作区' }), {
      target: { value: 'acm' },
    });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /acme/ })).toContainHTML('<mark>acm</mark>');
    fireEvent.click(screen.getByRole('option', { name: /acme/ }));

    await waitFor(() => expect(selectNewTaskWorkspace).toHaveBeenCalledWith('/clients/acme'));
    expect(screen.queryByRole('region', { name: '选择新任务工作区' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('opens the system folder picker and keeps cancellation non-destructive', async () => {
    const pickNewTaskWorkspace = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('/local/project');
    const actions = {
      selectNewTaskWorkspace: vi.fn(async () => undefined),
      pickNewTaskWorkspace,
    } as unknown as TaskActions;
    render(<NewTaskWorkspaceControl actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: '工作区：repo' }));
    fireEvent.click(screen.getByRole('button', { name: /打开本地文件夹/ }));
    await waitFor(() => expect(pickNewTaskWorkspace).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('region', { name: '选择新任务工作区' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /打开本地文件夹/ }));
    await waitFor(() => expect(pickNewTaskWorkspace).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('region', { name: '选择新任务工作区' })).not.toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the workspace trigger', () => {
    const actions = {
      selectNewTaskWorkspace: vi.fn(async () => undefined),
      pickNewTaskWorkspace: vi.fn(async () => null),
    } as unknown as TaskActions;
    render(<NewTaskWorkspaceControl actions={actions} />);

    const trigger = screen.getByRole('button', { name: '工作区：repo' });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索工作区' }), { target: { value: 'acme' } });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('region', { name: '选择新任务工作区' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByRole('searchbox', { name: '搜索工作区' })).toHaveValue('');
  });
});
