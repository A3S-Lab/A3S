import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../lib/api';
import { appState, reportTaskPersistenceResult, setTheme } from '../../state/app-state';
import { createTaskState, persistQueuedPrompts, persistTaskDrafts } from './task-state';
import { applyAssistantStreamEvent, composeTaskPrompt, useTaskController } from './use-task-controller';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.removeItem('a3s-code-web.active-task');
  localStorage.removeItem('a3s-code-web.task-drafts');
  localStorage.removeItem('a3s-code-web.queued-prompts');
  localStorage.removeItem('a3s-code-web.paused-queues');
  localStorage.removeItem('a3s-code-web.new-task-config');
  localStorage.removeItem('a3s-code-web.goal-timings');
});

describe('task file context protocol', () => {
  it('keeps the instruction intact and wraps explicit workspace references', () => {
    expect(composeTaskPrompt('Fix the parser', ['src/parser.ts', 'tests/parser.test.ts'])).toBe(
      '[Workspace context files]\n- src/parser.ts\n- tests/parser.test.ts\n[/Workspace context files]\n\nFix the parser'
    );
  });

  it('does not modify instructions without file context', () => {
    expect(composeTaskPrompt('Explain the architecture', [])).toBe('Explain the architecture');
  });

  it('adds explicit Skill directives without leaking the picker query', () => {
    expect(composeTaskPrompt('Review this change', ['src/app.ts'], ['report-master'])).toBe(
      '[Selected skills]\n- Use your `report-master` skill.\n[/Selected skills]\n\n[Workspace context files]\n- src/app.ts\n[/Workspace context files]\n\nReview this change'
    );
  });
});

describe('assistant stream lifecycle', () => {
  it('keeps failure and cancellation as semantic events instead of duplicate answer text', () => {
    const failed = {
      id: 'assistant-failed',
      sessionId: 'task-a',
      role: 'assistant' as const,
      content: '',
      createdAt: new Date().toISOString(),
      pending: true,
      events: [],
    };
    const cancelled = { ...failed, id: 'assistant-cancelled', events: [] };

    applyAssistantStreamEvent(failed, { type: 'error', message: 'upstream disconnected' });
    applyAssistantStreamEvent(cancelled, { type: 'cancelled', message: 'stopped by user' });

    expect(failed).toMatchObject({ content: '', pending: false });
    expect(cancelled).toMatchObject({ content: '', pending: false });
    expect(failed.events).toEqual([{ type: 'error', message: 'upstream disconnected' }]);
    expect(cancelled.events).toEqual([{ type: 'cancelled', message: 'stopped by user' }]);
  });
});

describe('task-scoped draft recovery', () => {
  it('keeps drafts isolated when switching tasks', async () => {
    appState.activeSessionId = 'task-a';
    appState.composerValue = 'draft for A';
    appState.composerContextFiles = ['a.ts'];
    appState.composerSkills = ['review'];
    appState.draftsByTask = { 'task-b': { content: 'draft for B', contextFiles: ['b.ts'] } };
    appState.messagesBySession = { 'task-a': [], 'task-b': [] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('controls unavailable');
      })
    );
    const hook = renderHook(() => useTaskController());
    await act(() => hook.result.current.selectSession('task-b'));
    expect(appState.draftsByTask['task-a']).toEqual({
      content: 'draft for A',
      contextFiles: ['a.ts'],
      skillNames: ['review'],
    });
    expect(appState.composerValue).toBe('draft for B');
    expect(appState.composerContextFiles).toEqual(['b.ts']);
    expect(appState.composerSkills).toEqual([]);
    hook.unmount();
  });

  it('restores the active draft and follow-up queue after refresh', () => {
    localStorage.setItem('a3s-code-web.active-task', 'task-a');
    localStorage.setItem(
      'a3s-code-web.task-drafts',
      JSON.stringify({ 'task-a': { content: 'continue after refresh', contextFiles: ['src/app.ts'] } })
    );
    localStorage.setItem(
      'a3s-code-web.queued-prompts',
      JSON.stringify({ 'task-a': [{ id: 'q1', content: 'run tests', contextFiles: [] }] })
    );
    localStorage.setItem('a3s-code-web.paused-queues', JSON.stringify({ 'task-a': false }));
    const restored = createTaskState();
    expect(restored.composerValue).toBe('continue after refresh');
    expect(restored.composerContextFiles).toEqual(['src/app.ts']);
    expect(restored.composerSkills).toEqual([]);
    expect(restored.queuedPrompts['task-a'][0].content).toBe('run tests');
    expect(restored.pausedQueues['task-a']).toBe(true);
  });

  it('keeps in-memory drafts and warns once when browser persistence fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    appState.taskPersistenceWarningShown = false;
    Reflect.set(appState, 'toast', null);

    const draftPersisted = persistTaskDrafts({
      'task-a': { content: 'important draft', contextFiles: ['src/app.ts'] },
    });
    const queuePersisted = persistQueuedPrompts({
      'task-a': [{ id: 'q1', content: 'run tests', contextFiles: [] }],
    });
    reportTaskPersistenceResult(draftPersisted);
    const warningId = appState.toast?.id;
    reportTaskPersistenceResult(queuePersisted);

    expect(draftPersisted).toBe(false);
    expect(queuePersisted).toBe(false);
    expect(appState.taskPersistenceWarningShown).toBe(true);
    expect(appState.toast?.message).toContain('刷新前请复制重要草稿');
    expect(appState.toast?.id).toBe(warningId);
  });

  it('still applies a theme when browser persistence is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    appState.taskPersistenceWarningShown = false;
    setTheme('dark');
    expect(appState.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(appState.toast?.message).toContain('浏览器无法保存本地状态');
    appState.theme = 'system';
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.theme = 'light';
  });
});

describe('task configuration', () => {
  it('switches the new-task workspace and removes context owned by the previous workspace', async () => {
    appState.activeSessionId = null;
    appState.workspaceRoot = '/repo';
    appState.composerContextFiles = ['src/app.ts'];
    appState.composerSkills = ['review'];
    appState.newTaskConfig = {
      workspace: '/repo',
      model: '',
      effort: 'medium',
      permissionMode: 'default',
      goal: '',
    };
    const readDir = vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.selectNewTaskWorkspace('/clients/acme'));

    expect(readDir).toHaveBeenCalledWith('/clients/acme');
    expect(appState.newTaskConfig.workspace).toBe('/clients/acme');
    expect(appState.workspaceRoot).toBe('/clients/acme');
    expect(appState.composerContextFiles).toEqual([]);
    expect(appState.composerSkills).toEqual([]);
    expect(JSON.parse(localStorage.getItem('a3s-code-web.new-task-config') ?? '{}')).toMatchObject({
      workspace: '/clients/acme',
    });
    hook.unmount();
  });

  it('opens a native folder picker and applies the returned directory', async () => {
    appState.activeSessionId = null;
    appState.newTaskConfig.workspace = '/repo';
    vi.spyOn(codeApi, 'pickWorkspaceDirectory').mockResolvedValue({
      cancelled: false,
      path: '/local/design-system',
    });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useTaskController());

    await expect(act(() => hook.result.current.pickNewTaskWorkspace())).resolves.toBe('/local/design-system');

    expect(appState.newTaskConfig.workspace).toBe('/local/design-system');
    hook.unmount();
  });

  it('uses /goal to configure a new task without creating or messaging a session', async () => {
    appState.activeSessionId = null;
    appState.streamingSessionId = null;
    appState.taskConfigSaving = null;
    appState.composerValue = '/goal All focused tests pass';
    appState.composerContextFiles = ['src/app.ts'];
    appState.composerSkills = ['review'];
    appState.newTaskConfig = { workspace: '/repo', model: '', effort: 'medium', permissionMode: 'default', goal: '' };
    const createSession = vi.spyOn(codeApi, 'createSession');
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.sendMessage());

    expect(createSession).not.toHaveBeenCalled();
    expect(appState.newTaskConfig.goal).toBe('All focused tests pass');
    expect(appState.composerValue).toBe('');
    expect(appState.composerContextFiles).toEqual([]);
    expect(appState.composerSkills).toEqual([]);
    expect(appState.goalTimings.__new_task__).toMatchObject({ goal: 'All focused tests pass' });
    expect(appState.goalTimings.__new_task__.startedAt).toBeGreaterThan(0);
    hook.unmount();
  });

  it('updates an existing task goal without queuing /goal as an instruction', async () => {
    appState.activeSessionId = 'task-a';
    appState.streamingSessionId = 'task-a';
    appState.taskConfigSaving = null;
    appState.composerValue = '/goal clear';
    appState.composerContextFiles = [];
    appState.composerSkills = [];
    appState.queuedPrompts = {};
    appState.goalTimings['task-a'] = { goal: 'Previous goal', startedAt: Date.now() - 1_000 };
    const updateControls = vi.spyOn(codeApi, 'updateSessionControls').mockResolvedValue({
      sessionId: 'task-a',
      effort: 'medium',
      goal: null,
      planningMode: 'disabled',
      goalTracking: false,
    });
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.sendMessage());

    expect(updateControls).toHaveBeenCalledWith('task-a', { goal: null });
    expect(appState.queuedPrompts['task-a']).toBeUndefined();
    expect(appState.composerValue).toBe('');
    expect(appState.goalTimings['task-a']).toBeUndefined();
    hook.unmount();
  });

  it('retains an incomplete /goal command so the user can add a target', async () => {
    appState.activeSessionId = null;
    appState.streamingSessionId = null;
    appState.composerValue = '/goal';
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.sendMessage());

    expect(appState.composerValue).toBe('/goal');
    expect(appState.toast?.message).toContain('/goal 所有重点测试通过');
    hook.unmount();
  });

  it('applies composer parameters before the first instruction starts', async () => {
    appState.activeSessionId = null;
    appState.workspaceRoot = '/repo';
    appState.sessions = [];
    appState.messagesBySession = {};
    appState.newTaskConfig = {
      workspace: '/selected-workspace',
      model: 'codex/gpt-5.6-sol',
      effort: 'high',
      permissionMode: 'plan',
      goal: 'Focused tests pass',
    };
    const session = {
      sessionId: 'task-new',
      workspace: '/repo',
      cwd: '/repo',
      model: 'codex/gpt-5.6-sol',
      followDefaultModel: false,
      permissionMode: 'plan',
      state: 'idle',
      createdAt: 1,
    };
    vi.spyOn(codeApi, 'createSession').mockResolvedValue({ success: true, session });
    const updateControls = vi.spyOn(codeApi, 'updateSessionControls').mockResolvedValue({
      sessionId: 'task-new',
      effort: 'high',
      goal: 'Focused tests pass',
      planningMode: 'disabled',
      goalTracking: true,
    });
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.createSession('New task'));

    expect(codeApi.createSession).toHaveBeenCalledWith({
      workspace: '/selected-workspace',
      cwd: '/selected-workspace',
      model: 'codex/gpt-5.6-sol',
      title: 'New task',
      permissionMode: 'plan',
    });
    expect(updateControls).toHaveBeenCalledWith('task-new', {
      effort: 'high',
      goal: 'Focused tests pass',
    });
    expect(appState.sessionControls['task-new']?.effort).toBe('high');
    expect(appState.newTaskConfig.goal).toBe('');
    hook.unmount();
  });

  it('keeps the task and global default model unchanged when a task model update fails', async () => {
    appState.activeSessionId = 'task-a';
    appState.taskConfigSaving = null;
    appState.selectedModel = 'global-default';
    appState.sessions = [
      {
        sessionId: 'task-a',
        workspace: '/repo',
        cwd: '/repo',
        model: 'task-model',
        followDefaultModel: false,
        permissionMode: 'default',
        state: 'idle',
        createdAt: 1,
      },
    ];
    vi.spyOn(codeApi, 'updateSession').mockRejectedValue(new Error('model update failed'));

    const hook = renderHook(() => useTaskController());
    await act(async () => {
      await hook.result.current.updateSessionModel('replacement-model');
    });

    expect(appState.sessions[0].model).toBe('task-model');
    expect(appState.selectedModel).toBe('global-default');
    expect(appState.taskConfigSaving).toBeNull();
    expect(appState.toast?.message).toBe('model update failed');
    hook.unmount();
  });

  it('announces a successful model change next to the composer instead of using a global success toast', async () => {
    appState.activeSessionId = 'task-a';
    appState.taskConfigSaving = null;
    appState.selectedModel = 'codex/gpt';
    appState.sessions = [
      {
        sessionId: 'task-a',
        workspace: '/repo',
        cwd: '/repo',
        model: 'codex/gpt',
        followDefaultModel: false,
        permissionMode: 'default',
        state: 'idle',
        createdAt: 1,
      },
    ];
    Reflect.set(appState, 'modelChangeNotice', null);
    appState.toast = null;
    vi.spyOn(codeApi, 'updateSession').mockResolvedValue({
      ...appState.sessions[0],
      model: 'anthropic/claude',
    });

    const hook = renderHook(() => useTaskController());
    await act(async () => {
      await hook.result.current.updateSessionModel('anthropic/claude');
    });

    expect(Reflect.get(appState, 'modelChangeNotice')).toMatchObject({
      sessionId: 'task-a',
      previousModel: 'codex/gpt',
      currentModel: 'anthropic/claude',
    });
    expect(appState.toast).toBeNull();
    hook.unmount();
  });

  it('compacts the active context, refreshes messages and controls, and reports progress inline', async () => {
    appState.activeSessionId = 'task-a';
    appState.streamingSessionId = null;
    appState.contextCompacting = {};
    appState.sessionControls = {
      'task-a': {
        sessionId: 'task-a',
        effort: 'medium',
        planningMode: 'disabled',
        goalTracking: false,
        context: {
          estimatedTokens: 9000,
          limitTokens: 10000,
          percent: 0.9,
          historyMessages: 12,
          compacted: false,
        },
      },
    };
    appState.toast = null;
    const compact = vi.spyOn(codeApi, 'compactSession').mockResolvedValue({
      sessionId: 'task-a',
      compacted: true,
      summary: 'Earlier work summary',
      historyMessages: 12,
      completedAt: new Date().toISOString(),
    });
    const messages = vi.spyOn(codeApi, 'messages').mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });
    const controls = vi.spyOn(codeApi, 'sessionControls').mockResolvedValue({
      sessionId: 'task-a',
      effort: 'medium',
      planningMode: 'disabled',
      goalTracking: false,
      context: {
        estimatedTokens: 1800,
        limitTokens: 10000,
        percent: 0.18,
        historyMessages: 3,
        compacted: true,
        compactSummary: 'Earlier work summary',
      },
    });
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.compactSession());

    expect(compact).toHaveBeenCalledWith('task-a');
    expect(messages).toHaveBeenCalledWith('task-a');
    expect(controls).toHaveBeenCalledWith('task-a');
    expect(appState.sessionControls['task-a']?.context?.percent).toBe(0.18);
    expect(appState.contextCompacting['task-a']).toBeUndefined();
    expect(appState.toast).toBeNull();
    hook.unmount();
  });

  it('keeps effort, execution mode, and HITL success feedback local to their controls', async () => {
    const task = {
      sessionId: 'task-a',
      workspace: '/repo',
      cwd: '/repo',
      model: 'codex/gpt',
      followDefaultModel: false,
      permissionMode: 'default',
      state: 'idle',
      createdAt: 1,
    };
    appState.activeSessionId = 'task-a';
    appState.streamingSessionId = null;
    appState.taskConfigSaving = null;
    appState.sessions = [task];
    appState.toolDecisionState = {};
    appState.toast = null;
    vi.spyOn(codeApi, 'updateSessionControls').mockResolvedValue({
      sessionId: 'task-a',
      effort: 'high',
      planningMode: 'disabled',
      goalTracking: false,
    });
    vi.spyOn(codeApi, 'updateSession').mockResolvedValue({ ...task, permissionMode: 'plan' });
    vi.spyOn(codeApi, 'confirmToolUse').mockResolvedValue({ confirmed: true, approved: true });
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.updateEffort('high'));
    await act(() => hook.result.current.updatePermissionMode('plan'));
    await act(() => hook.result.current.confirmToolUse('task-a', 'tool-1', true));

    expect(appState.sessionControls['task-a']?.effort).toBe('high');
    expect(appState.sessions[0].permissionMode).toBe('plan');
    expect(appState.toolDecisionState['task-a:tool-1']).toBe('approved');
    expect(appState.toast).toBeNull();
    hook.unmount();
  });

  it('keeps a failed HITL decision retryable and does not restore stale state after an event wins the race', async () => {
    appState.toolDecisionState = {};
    appState.toolDecisionErrors = {};
    appState.toast = null;
    const confirm = vi
      .spyOn(codeApi, 'confirmToolUse')
      .mockRejectedValueOnce(new Error('confirmation service unavailable'))
      .mockImplementationOnce(async () => {
        delete appState.toolDecisionState['task-a:tool-race'];
        return { confirmed: true, approved: true };
      });
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.confirmToolUse('task-a', 'tool-retry', true));

    expect(appState.toolDecisionState['task-a:tool-retry']).toBeUndefined();
    expect(appState.toolDecisionErrors['task-a:tool-retry']).toBe('confirmation service unavailable');

    await act(() => hook.result.current.confirmToolUse('task-a', 'tool-race', true));

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(appState.toolDecisionState['task-a:tool-race']).toBeUndefined();
    hook.unmount();
  });
});
