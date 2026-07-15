import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodeActions } from '../features/code/use-code-controller';
import { HelpSettings } from '../features/settings/components/help-settings';
import { codeApi } from '../lib/api';
import { appState } from '../state/app-state';
import { TaskHeader } from '../features/tasks/components/task-header';
import { TaskComposer } from '../features/tasks/components/task-composer';
import { TasksPage } from '../features/tasks/pages/tasks-page';
import { RunsPage } from '../features/runs/pages/runs-page';
import { AppShell } from './app-shell';

const session = {
  sessionId: 'session-1',
  workspace: '/repo',
  cwd: '/repo',
  model: 'codex/gpt',
  followDefaultModel: false,
  permissionMode: 'default',
  state: 'connected',
  title: 'Main task',
  createdAt: 1,
};

describe('Web-native session experiences', () => {
  beforeEach(() => {
    appState.sessions = [session];
    appState.sessionTitles = {};
    appState.activeSessionId = session.sessionId;
    appState.streamingSessionId = null;
    appState.sessionControls = {
      'session-1': {
        sessionId: 'session-1',
        effort: 'medium',
        planningMode: 'disabled',
        goalTracking: false,
        context: {
          estimatedTokens: 1200,
          limitTokens: 10000,
          percent: 0.12,
          historyMessages: 8,
          compacted: true,
          compactSummary: 'Earlier work summary',
        },
      },
    };
    appState.sessionControlsLoading = {};
    appState.sessionControlsErrors = {};
    appState.contextCompacting = {};
    appState.messagesLoading = {};
    appState.messageErrors = {};
    appState.modelCatalog = {
      defaultModel: 'codex/gpt',
      warnings: [],
      items: [{ id: 'codex/gpt', name: 'gpt', source: 'Codex', reasoning: true, toolCall: true }],
    };
    appState.effortLevels = [{ id: 'medium', label: 'Medium' }];
    appState.activeEffort = 'medium';
    appState.newTaskConfig = {
      workspace: '/repo',
      model: 'codex/gpt',
      effort: 'medium',
      permissionMode: 'default',
      goal: '',
    };
    appState.taskView = 'conversation';
    appState.sidebarOpen = true;
    appState.settingsOpen = false;
    appState.settingsTab = 'general';
    appState.serviceStatus = 'connected';
    appState.serviceError = null;
    appState.composerValue = '';
    appState.composerContextFiles = [];
    appState.composerSkills = [];
    appState.queuedPrompts = {};
    appState.pausedQueues = {};
    appState.sessionOutputError = null;
    appState.sessionOutputErrorSessionId = null;
    appState.workspaceRoot = '/repo';
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    appState.gitStatus = null;
    Reflect.set(appState, 'modelChangeNotice', null);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps context usage and manual compaction together in the composer footer', () => {
    const compactSession = vi.fn(async () => undefined);
    render(<TaskComposer actions={{ compactSession } as unknown as CodeActions} />);
    expect(screen.queryByRole('button', { name: '任务参数' })).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: '上下文用量 12%' });
    expect(trigger).toHaveTextContent('上下文 12%');
    fireEvent.click(screen.getByRole('button', { name: '压缩上下文' }));
    expect(compactSession).toHaveBeenCalledTimes(1);
    fireEvent.click(trigger);
    expect(screen.getByText(/1,200 \/ 10,000 tokens/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(/1,200 \/ 10,000 tokens/)).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('uses TipTap for task instructions and preserves the Enter contract', () => {
    appState.composerValue = 'Run the focused test';
    const sendMessage = vi.fn(async () => undefined);
    render(<TaskComposer actions={{ sendMessage } as unknown as CodeActions} />);

    const editor = screen.getByRole('textbox', { name: '任务指令' });
    expect(editor).toHaveAttribute('contenteditable', 'true');
    expect(editor).toHaveTextContent('Run the focused test');
    expect(screen.queryByRole('toolbar', { name: '文本格式' })).not.toBeInTheDocument();

    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(editor, { key: 'Enter', shiftKey: true });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('copies a dropped file into the workspace and adds it to task context', async () => {
    vi.spyOn(codeApi, 'pathExists').mockResolvedValue({ exists: false });
    const writeBinaryFile = vi.spyOn(codeApi, 'writeBinaryFile').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const file = {
      name: 'notes.txt',
      size: 3,
      webkitRelativePath: '',
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    } as File;
    const dataTransfer = { types: ['Files'], items: [], files: [file], dropEffect: 'none' } as unknown as DataTransfer;
    const { container } = render(<TaskComposer actions={{} as CodeActions} />);
    const input = container.querySelector('.task-composer-input');
    expect(input).not.toBeNull();

    fireEvent.dragEnter(input!, { dataTransfer });
    expect(screen.getByRole('status')).toHaveTextContent('松开放入工作区');
    fireEvent.drop(input!, { dataTransfer });

    await waitFor(() => expect(screen.getByRole('button', { name: '移除上下文 notes.txt' })).toBeInTheDocument());
    expect(writeBinaryFile).toHaveBeenCalledWith('/repo/notes.txt', Uint8Array.from([1, 2, 3]), false);
    expect(appState.toast?.message).toContain('已将 1 个文件放入工作区');
  });

  it('prevents browser navigation when a file is dropped while the composer is disabled', () => {
    appState.streamingSessionId = 'session-2';
    const writeBinaryFile = vi.spyOn(codeApi, 'writeBinaryFile');
    const dataTransfer = { types: ['Files'], items: [], files: [], dropEffect: 'none' } as unknown as DataTransfer;
    const { container } = render(<TaskComposer actions={{} as CodeActions} />);
    const input = container.querySelector('.task-composer-input');

    expect(input).not.toBeNull();
    expect(fireEvent.drop(input!, { dataTransfer })).toBe(false);
    expect(writeBinaryFile).not.toHaveBeenCalled();
  });

  it('edits task run parameters through separate upward controls', () => {
    appState.effortLevels = [
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' },
    ];
    appState.modelCatalog?.items.push({
      id: 'anthropic/claude',
      name: 'claude',
      source: 'Anthropic',
      reasoning: true,
      toolCall: true,
    });
    const updateEffort = vi.fn(async () => undefined);
    const updatePermissionMode = vi.fn(async () => undefined);
    render(<TaskComposer actions={{ updateEffort, updatePermissionMode } as unknown as CodeActions} />);

    const effortTrigger = screen.getByRole('button', { name: 'Effort：Medium' });
    expect(effortTrigger).toHaveTextContent('Effort · Medium');
    fireEvent.click(effortTrigger);
    const effortSlider = screen.getByRole('slider', { name: 'Effort' });
    fireEvent.change(effortSlider, { target: { value: '1' } });
    fireEvent.pointerUp(effortSlider, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /任务模型/ }));
    expect(screen.getByRole('tablist', { name: '模型 Provider' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Anthropic' }));
    expect(screen.getByRole('option', { name: /claude/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /gpt/ })).not.toBeInTheDocument();
    const modeTrigger = screen.getByRole('button', { name: '执行模式：按需确认' });
    expect(modeTrigger).toHaveTextContent('按需确认');
    fireEvent.click(modeTrigger);
    fireEvent.click(screen.getByRole('option', { name: /只读规划/ }));

    expect(updateEffort).toHaveBeenCalledWith('high');
    expect(updatePermissionMode).toHaveBeenCalledWith('plan');
    expect(screen.queryByRole('button', { name: '任务目标' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '选择执行模式' })).not.toBeInTheDocument();
    expect(modeTrigger).toHaveFocus();
  });

  it('keeps new-task parameters in the composer before a session exists', () => {
    appState.activeSessionId = null;
    appState.newTaskConfig = {
      workspace: '/repo',
      model: 'codex/gpt',
      effort: 'medium',
      permissionMode: 'default',
      goal: '',
    };
    render(<TaskComposer actions={{} as CodeActions} />);

    expect(screen.getByRole('button', { name: /新任务模型/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Effort：Medium' }));
    expect(screen.getByRole('slider', { name: 'Effort' })).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: '执行模式：按需确认' }));
    fireEvent.click(screen.getByRole('option', { name: /自动执行/ }));

    expect(appState.newTaskConfig.permissionMode).toBe('auto');
    expect(screen.queryByRole('button', { name: '任务目标' })).not.toBeInTheDocument();
  });

  it('shows a quiet inline notice after selecting a different new-task model', async () => {
    appState.activeSessionId = null;
    appState.modelCatalog?.items.push({
      id: 'anthropic/claude',
      name: 'Claude Sonnet',
      source: 'Anthropic',
      reasoning: true,
      toolCall: true,
    });
    render(<TaskComposer actions={{} as CodeActions} />);

    const trigger = screen.getByRole('button', { name: '新任务模型' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: /Claude Sonnet/ }));

    await waitFor(() =>
      expect(screen.getByRole('status', { name: '模型切换提示' })).toHaveTextContent(
        '模型已从 gpt 更改为 Claude Sonnet'
      )
    );
    expect(appState.newTaskConfig.model).toBe('anthropic/claude');
    expect(screen.getByRole('button', { name: '新任务模型' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('uses a focused preparation surface before the first task instruction', async () => {
    appState.activeSessionId = null;
    render(<TasksPage actions={{} as CodeActions} />);

    expect(screen.getByRole('heading', { name: '让 Code 完成一项工作' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '任务阶段' })).not.toBeInTheDocument();
    expect(screen.queryByText('交给 Code 一个明确任务')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '实现功能' }));
    expect(appState.composerValue).toContain('请实现以下功能');
    await waitFor(() => expect(screen.getByRole('textbox', { name: '任务指令' })).toHaveTextContent('请实现以下功能'));
  });

  it('opens task context panels without changing task identity', () => {
    appState.reviewSourceTaskId = 'older-task';
    render(<TaskHeader />);
    expect(screen.queryByRole('button', { name: '任务详情' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开工作区' }));
    expect(appState.taskView).toBe('review');
    expect(appState.activeSessionId).toBe('session-1');
    expect(appState.reviewSourceTaskId).toBe('session-1');
    expect(screen.getByText('Main task')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开任务活动' }));
    expect(appState.taskView).toBe('activity');
    expect(appState.activeSessionId).toBe('session-1');
  });

  it('keeps the active header synchronized with an inline task rename', async () => {
    render(<TaskHeader />);
    expect(screen.getByText('Main task')).toBeInTheDocument();

    act(() => {
      appState.sessionTitles['session-1'] = 'Renamed task';
    });

    expect(await screen.findByText('Renamed task')).toBeInTheDocument();
  });

  it('keeps conversation continuous while workspace and activity provide context', async () => {
    appState.filesByDirectory = { '/repo': [] };
    appState.gitStatus = { isGitRepo: true, branch: 'main', files: [] };
    const actions = {
      refreshGitStatus: vi.fn(),
      openSessionOutput: vi.fn(async () => undefined),
    } as unknown as CodeActions;

    render(<TasksPage actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: '打开工作区' }));

    expect(screen.getByRole('textbox', { name: '任务指令' })).toBeInTheDocument();
    expect(await screen.findByRole('navigation', { name: '任务上下文面板' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '工作区变更' }));
    expect(screen.getByRole('complementary', { name: '变更与 Git' })).toHaveClass('compact-open');
    fireEvent.click(screen.getByRole('button', { name: '全局搜索' }));
    expect(screen.getByRole('complementary', { name: '变更与 Git' })).not.toHaveClass('compact-open');
    expect(screen.getByRole('complementary', { name: '全局搜索与替换' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭全局搜索' }));
    fireEvent.click(screen.getByRole('button', { name: '工作区变更' }));
    fireEvent.click(screen.getByRole('button', { name: '关闭工作区变更' }));

    fireEvent.click(screen.getByRole('button', { name: '活动' }));
    expect(screen.getByRole('textbox', { name: '任务指令' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: '当前任务活动' })).toBeInTheDocument();
  });

  it('keeps follow-up instructions visible and editable inside the running task', async () => {
    appState.streamingSessionId = 'session-1';
    appState.composerValue = 'Keep this unsent draft';
    appState.composerContextFiles = ['draft.ts'];
    appState.queuedPrompts = {
      'session-1': [{ id: 'queued-1', content: 'Run the focused tests next', contextFiles: ['src/app.ts'] }],
    };
    render(<TaskComposer actions={{} as CodeActions} />);
    expect(screen.getByText('执行中')).toBeInTheDocument();
    expect(screen.queryByText('任务执行中，可输入后续指令加入队列')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '后续指令队列' })).toHaveTextContent('Run the focused tests next');
    expect(screen.getByText('1 个文件上下文')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '编辑第 1 条指令' }));
    fireEvent.change(screen.getByRole('textbox', { name: '编辑后续指令内容' }), {
      target: { value: 'Run the focused tests and typecheck' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存队列指令' }));

    expect(appState.composerValue).toBe('Keep this unsent draft');
    expect(appState.composerContextFiles).toEqual(['draft.ts']);
    expect(appState.queuedPrompts['session-1']).toEqual([
      { id: 'queued-1', content: 'Run the focused tests and typecheck', contextFiles: ['src/app.ts'] },
    ]);
    await waitFor(() => expect(screen.getByRole('button', { name: '停止任务' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '发送任务' })).not.toBeInTheDocument();
  });

  it('morphs the send action into stop while Enter still queues a follow-up', () => {
    appState.streamingSessionId = 'session-1';
    appState.composerValue = 'Run the focused test next';
    const cancelMessage = vi.fn(async () => undefined);
    const sendMessage = vi.fn(async () => undefined);

    render(<TaskComposer actions={{ cancelMessage, sendMessage } as unknown as CodeActions} />);
    expect(screen.queryByRole('button', { name: '发送任务' })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('textbox', { name: '任务指令' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '停止任务' }));

    expect(cancelMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit action before a stopped queue resumes', () => {
    appState.streamingSessionId = null;
    appState.queuedPrompts = {
      'session-1': [{ id: 'queued-paused', content: 'Run after approval', contextFiles: [] }],
    };
    appState.pausedQueues = { 'session-1': true };
    const resumeQueue = vi.fn(async () => undefined);

    render(<TaskComposer actions={{ resumeQueue } as unknown as CodeActions} />);
    expect(screen.getByText('队列已暂停，只有主动恢复才会继续')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '恢复队列' }));
    expect(resumeQueue).toHaveBeenCalledWith('session-1');
  });

  it('preserves the draft and returns to the actually running task', () => {
    appState.streamingSessionId = 'session-2';
    appState.composerValue = 'Draft for the current task';
    const selectSession = vi.fn(async () => undefined);

    render(<TaskComposer actions={{ selectSession } as unknown as CodeActions} />);
    expect(screen.queryByRole('button', { name: '停止任务' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送任务' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '返回正在执行的任务' }));

    expect(selectSession).toHaveBeenCalledWith('session-2');
    expect(appState.composerValue).toBe('Draft for the current task');
  });

  it('uses the plus control for execution mode instead of a file dialog', () => {
    render(<TaskComposer actions={{} as CodeActions} />);
    fireEvent.click(screen.getByRole('button', { name: '执行模式：按需确认' }));

    expect(screen.getByRole('region', { name: '选择执行模式' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.queryByRole('dialog', { name: '添加工作区文件' })).not.toBeInTheDocument();
  });

  it('does not expose task activity before a task exists', () => {
    appState.activeSessionId = null;
    render(<TasksPage actions={{} as CodeActions} />);
    expect(screen.queryByRole('button', { name: '打开任务活动' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打开工作区' })).not.toBeInTheDocument();
  });

  it('gives deep-linked activity a useful way back when no task exists', () => {
    appState.activeSessionId = null;
    render(<RunsPage actions={{} as CodeActions} />);
    expect(screen.getByText('开始任务后查看活动')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回对话' }));
    expect(appState.taskView).toBe('conversation');
  });

  it('never shows tool output from a different task', () => {
    appState.activeSessionId = 'session-1';
    appState.sessionOutputSessionId = 'session-2';
    appState.sessionOutputLoading = false;
    appState.sessionOutput = {
      sessionId: 'session-2',
      total: 1,
      format: 'structured',
      items: [
        {
          id: 'old-output',
          index: 0,
          toolUseId: 'tool-old',
          toolName: 'Old task tool',
          input: '',
          output: 'must not leak',
          isError: false,
        },
      ],
    };
    render(<RunsPage actions={{ openSessionOutput: vi.fn() } as unknown as CodeActions} />);
    expect(screen.queryByText('Old task tool')).not.toBeInTheDocument();
    expect(screen.getByText('当前任务还没有工具活动')).toBeInTheDocument();
  });

  it('shows task activity failures inline and keeps retry in the same stage', () => {
    appState.sessionOutputLoading = false;
    appState.sessionOutputError = 'Output service unavailable';
    appState.sessionOutputErrorSessionId = 'session-1';
    const openSessionOutput = vi.fn(async () => undefined);
    render(<RunsPage actions={{ openSessionOutput } as unknown as CodeActions} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无法加载当前任务活动');
    fireEvent.click(screen.getByRole('button', { name: '重新加载活动' }));
    expect(openSessionOutput).toHaveBeenCalled();
  });

  it('offers searchable help as pages and workflows, not slash commands', () => {
    render(<HelpSettings />);
    fireEvent.change(screen.getByRole('textbox', { name: '搜索帮助' }), { target: { value: 'Git' } });
    expect(screen.getByText('Git 工作流')).toBeInTheDocument();
    expect(screen.queryByText('/help')).not.toBeInTheDocument();
  });

  it('keeps the workspace visible and offers recovery when the local service disconnects', () => {
    appState.settingsOpen = true;
    appState.settingsTab = 'help';
    appState.serviceStatus = 'disconnected';
    appState.serviceError = 'Connection refused';
    const retryConnection = vi.fn(async () => undefined);
    render(<AppShell actions={{ retryConnection } as unknown as CodeActions} />);
    expect(screen.getByRole('status')).toHaveTextContent('本地服务连接已中断');
    expect(screen.getByRole('status')).toHaveTextContent('未保存的编辑仍保留在浏览器中');
    expect(screen.getByRole('dialog', { name: '帮助' })).toBeInTheDocument();
    expect(screen.getAllByText('Main task').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '重新连接' }));
    expect(retryConnection).toHaveBeenCalledTimes(1);
  });
});
