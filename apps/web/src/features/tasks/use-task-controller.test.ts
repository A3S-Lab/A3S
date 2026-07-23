import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../lib/api';
import { appState, reportTaskPersistenceResult, setTheme } from '../../state/app-state';
import { fileEditorTabId, type WorkspaceFileEditorTab } from '../workspace/workspace-state';
import { createTaskState, newTaskDraftKey, persistTaskDrafts } from './task-state';
import { applyAssistantStreamEvent, composeTaskPrompt, useTaskController } from './use-task-controller';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  appState.workspaceSnapshotsByTask = {};
  appState.workspaceGeneration = 0;
  appState.editorTabs = [];
  appState.activeEditorTabId = null;
  appState.workspaceSearchResults = [];
  appState.workspaceSearchQuery = '';
  appState.gitStatus = null;
  appState.taskView = 'conversation';
  localStorage.removeItem('a3s-code-web.active-task');
  localStorage.removeItem('a3s-work.ai-assistant.active-session');
  localStorage.removeItem('a3s-code-web.task-drafts');
  localStorage.removeItem('a3s-code-web.queued-prompts');
  localStorage.removeItem('a3s-code-web.paused-queues');
  localStorage.removeItem('a3s-code-web.new-task-config');
  localStorage.removeItem('a3s-code-web.goal-timings');
  appState.activeProduct = 'code';
  appState.taskSubmissionState = null;
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

  it('ignores a late controls response from the previously selected task', async () => {
    const taskA = codeSession('task-a', '/repo');
    const taskB = codeSession('task-b', '/repo');
    const controlsA = deferred<Awaited<ReturnType<typeof codeApi.sessionControls>>>();
    const controlsB = deferred<Awaited<ReturnType<typeof codeApi.sessionControls>>>();
    appState.sessions = [taskA, taskB];
    appState.activeSessionId = taskA.sessionId;
    appState.messagesBySession = { 'task-a': [], 'task-b': [] };
    appState.filesByDirectory = { '/repo': [] };
    vi.spyOn(codeApi, 'sessionControls').mockImplementation((sessionId) =>
      sessionId === taskA.sessionId ? controlsA.promise : controlsB.promise
    );
    const hook = renderHook(() => useTaskController());
    let pendingA!: Promise<void>;
    let pendingB!: Promise<void>;

    act(() => {
      pendingA = hook.result.current.selectSession(taskA.sessionId);
    });
    act(() => {
      pendingB = hook.result.current.selectSession(taskB.sessionId);
    });
    await act(async () => {
      controlsB.resolve({
        sessionId: taskB.sessionId,
        effort: 'high',
        planningMode: 'disabled',
        goalTracking: false,
      });
      await pendingB;
    });

    expect(appState.activeSessionId).toBe(taskB.sessionId);

    await act(async () => {
      controlsA.resolve({
        sessionId: taskA.sessionId,
        effort: 'low',
        planningMode: 'disabled',
        goalTracking: false,
      });
      await pendingA;
    });

    expect(appState.sessionControls[taskA.sessionId]?.effort).toBe('low');
    expect(appState.sessionControls[taskB.sessionId]?.effort).toBe('high');
    expect(appState.activeSessionId).toBe(taskB.sessionId);
    hook.unmount();
  });

  it('keeps the newest message load when the same task is selected twice', async () => {
    const task = codeSession('task-a', '/repo');
    const firstMessages = deferred<Awaited<ReturnType<typeof codeApi.messages>>>();
    const secondMessages = deferred<Awaited<ReturnType<typeof codeApi.messages>>>();
    appState.sessions = [task];
    appState.activeSessionId = task.sessionId;
    appState.messagesBySession = {};
    appState.filesByDirectory = { '/repo': [] };
    vi.spyOn(codeApi, 'messages')
      .mockReturnValueOnce(firstMessages.promise)
      .mockReturnValueOnce(secondMessages.promise);
    vi.spyOn(codeApi, 'sessionControls').mockResolvedValue({
      sessionId: task.sessionId,
      effort: 'medium',
      planningMode: 'disabled',
      goalTracking: false,
    });
    const hook = renderHook(() => useTaskController());
    let firstSelection!: Promise<void>;
    let secondSelection!: Promise<void>;

    act(() => {
      firstSelection = hook.result.current.selectSession(task.sessionId);
      secondSelection = hook.result.current.selectSession(task.sessionId);
    });
    await act(async () => {
      secondMessages.resolve({ items: [chatMessage(task.sessionId, 'newest')], total: 1, page: 1, limit: 100 });
      await secondSelection;
    });
    await act(async () => {
      firstMessages.resolve({ items: [chatMessage(task.sessionId, 'stale')], total: 1, page: 1, limit: 100 });
      await firstSelection;
    });

    expect(appState.messagesBySession[task.sessionId]?.map((message) => message.content)).toEqual(['newest']);
    expect(appState.messagesLoading[task.sessionId]).toBe(false);
    hook.unmount();
  });

  it('does not let an older controls load overwrite a successful effort update', async () => {
    const task = codeSession('task-a', '/repo');
    const staleControls = deferred<Awaited<ReturnType<typeof codeApi.sessionControls>>>();
    appState.sessions = [task];
    appState.activeSessionId = task.sessionId;
    appState.messagesBySession = { [task.sessionId]: [] };
    appState.filesByDirectory = { '/repo': [] };
    appState.taskConfigSaving = null;
    vi.spyOn(codeApi, 'sessionControls').mockReturnValue(staleControls.promise);
    vi.spyOn(codeApi, 'updateSessionControls').mockResolvedValue({
      sessionId: task.sessionId,
      effort: 'high',
      planningMode: 'disabled',
      goalTracking: false,
    });
    const hook = renderHook(() => useTaskController());
    let pendingSelection!: Promise<void>;

    act(() => {
      pendingSelection = hook.result.current.selectSession(task.sessionId);
    });
    await act(() => hook.result.current.updateEffort('high'));
    expect(appState.sessionControls[task.sessionId]?.effort).toBe('high');

    await act(async () => {
      staleControls.resolve({
        sessionId: task.sessionId,
        effort: 'low',
        planningMode: 'disabled',
        goalTracking: false,
      });
      await pendingSelection;
    });

    expect(appState.sessionControls[task.sessionId]?.effort).toBe('high');
    expect(appState.sessionControlsLoading[task.sessionId]).toBe(false);
    hook.unmount();
  });

  it('restores editor tabs, dirty drafts, selection, and view per task even when tasks share a workspace', async () => {
    const taskA = codeSession('task-a', '/repo');
    const taskB = codeSession('task-b', '/repo');
    const tabA = fileTab('/repo/a.ts', 'saved A', 'draft A');
    appState.sessions = [taskA, taskB];
    appState.activeSessionId = taskA.sessionId;
    appState.workspaceRoot = taskA.workspace;
    appState.taskView = 'review';
    appState.editorTabs = [tabA];
    appState.activeEditorTabId = tabA.id;
    appState.messagesBySession = { 'task-a': [], 'task-b': [] };
    appState.draftsByTask = {};
    vi.spyOn(codeApi, 'sessionControls').mockImplementation(async (sessionId) => ({
      sessionId,
      effort: 'medium',
      planningMode: 'disabled',
      goalTracking: false,
    }));
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.selectSession('task-b'));

    expect(appState.activeSessionId).toBe('task-b');
    expect(appState.workspaceRoot).toBe('/repo');
    expect(appState.editorTabs).toEqual([]);
    expect(appState.activeEditorTabId).toBeNull();
    expect(appState.taskView).toBe('conversation');

    const tabB = fileTab('/repo/b.ts', 'saved B');
    appState.editorTabs = [tabB];
    appState.activeEditorTabId = tabB.id;
    appState.taskView = 'activity';

    await act(() => hook.result.current.selectSession('task-a'));

    expect(appState.editorTabs).toHaveLength(1);
    expect(appState.editorTabs[0]).toMatchObject({
      id: tabA.id,
      content: 'saved A',
      draft: 'draft A',
    });
    expect(appState.activeEditorTabId).toBe(tabA.id);
    expect(appState.taskView).toBe('review');

    await act(() => hook.result.current.selectSession('task-b'));

    expect(appState.editorTabs).toHaveLength(1);
    expect(appState.editorTabs[0]).toMatchObject({ id: tabB.id, content: 'saved B' });
    expect(appState.activeEditorTabId).toBe(tabB.id);
    expect(appState.taskView).toBe('activity');
    hook.unmount();
  });

  it('restores drafts but leaves execution queues to the service after refresh', () => {
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
    expect(restored.composerMode).toBe('standard');
  });

  it('removes the legacy editor-injected CLAUDE.md prompt instead of restoring it forever', () => {
    localStorage.setItem('a3s-code-web.active-task', 'task-a');
    localStorage.setItem(
      'a3s-code-web.task-drafts',
      JSON.stringify({
        'task-a': {
          content: '请查看当前代码文件，并回答我的问题：',
          contextFiles: ['CLAUDE.md'],
          skillNames: [],
        },
      })
    );

    const restored = createTaskState();

    expect(restored.composerValue).toBe('');
    expect(restored.composerContextFiles).toEqual([]);
    expect(restored.draftsByTask['task-a']).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('a3s-code-web.task-drafts') ?? '{}')['task-a']).toBeUndefined();
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
    reportTaskPersistenceResult(draftPersisted);
    const warningId = appState.toast?.id;
    reportTaskPersistenceResult(false);

    expect(draftPersisted).toBe(false);
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

function codeSession(sessionId: string, workspace: string) {
  return {
    sessionId,
    workspace,
    cwd: workspace,
    model: 'codex/gpt',
    followDefaultModel: false,
    permissionMode: 'default',
    state: 'idle',
    createdAt: 1,
  };
}

function fileTab(path: string, content: string, draft = content): WorkspaceFileEditorTab {
  return {
    id: fileEditorTabId(path),
    kind: 'file',
    path,
    content,
    draft,
    revision: null,
    isBinary: false,
    location: null,
    loading: false,
    loadError: null,
    saving: false,
    configValidation: null,
  };
}

function chatMessage(sessionId: string, content: string) {
  return {
    id: `${sessionId}-${content}`,
    sessionId,
    role: 'assistant' as const,
    content,
    createdAt: new Date(0).toISOString(),
    pending: false,
    events: [],
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('task configuration', () => {
  it('switches the new-task workspace and removes context owned by the previous workspace', async () => {
    appState.activeSessionId = null;
    appState.workspaceRoot = '/repo';
    appState.editorTabs = [fileTab('/repo/old.ts', 'saved', 'draft')];
    appState.activeEditorTabId = fileEditorTabId('/repo/old.ts');
    appState.workspaceSearchQuery = 'old query';
    appState.gitStatus = { isGitRepo: true, branch: 'main', files: [] };
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
    expect(appState.editorTabs).toEqual([]);
    expect(appState.activeEditorTabId).toBeNull();
    expect(appState.workspaceSearchQuery).toBe('');
    expect(appState.gitStatus).toBeNull();
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
    const pickWorkspaceDirectory = vi.spyOn(codeApi, 'pickWorkspaceDirectory').mockResolvedValue({
      cancelled: false,
      path: '/local/design-system',
    });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useTaskController());

    await expect(act(() => hook.result.current.pickNewTaskWorkspace())).resolves.toBe('/local/design-system');

    expect(pickWorkspaceDirectory).toHaveBeenCalledWith('/repo');
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

  it('exposes an immediate starting state while the first task session is being created', async () => {
    appState.activeSessionId = null;
    appState.streamingSessionId = null;
    appState.taskSubmissionState = null;
    appState.workspaceRoot = '/repo';
    appState.sessions = [];
    appState.messagesBySession = {};
    appState.composerValue = 'Inspect the release workflow';
    appState.composerContextFiles = [];
    appState.composerSkills = [];
    appState.composerMode = 'deepResearch';
    appState.draftsByTask = {
      [newTaskDraftKey]: {
        content: 'Inspect the release workflow',
        contextFiles: [],
        skillNames: [],
      },
    };
    appState.newTaskConfig = {
      workspace: '/repo',
      model: 'codex/gpt-5.6-sol',
      effort: 'medium',
      permissionMode: 'default',
      goal: '',
    };
    const session = {
      sessionId: 'task-new',
      workspace: '/repo',
      cwd: '/repo',
      model: 'codex/gpt-5.6-sol',
      followDefaultModel: false,
      permissionMode: 'default',
      state: 'idle',
      createdAt: 1,
    };
    let resolveCreate!: (value: Awaited<ReturnType<typeof codeApi.createSession>>) => void;
    vi.spyOn(codeApi, 'createSession').mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );
    vi.spyOn(codeApi, 'updateSessionControls').mockResolvedValue({
      sessionId: 'task-new',
      effort: 'medium',
      goal: null,
      planningMode: 'enabled',
      goalTracking: true,
    });
    vi.spyOn(codeApi, 'enqueueTurn').mockResolvedValue({
      sessionId: 'task-new',
      status: 'paused',
      paused: true,
      active: null,
      items: [
        {
          id: 'turn-new',
          kind: 'user',
          content: 'Inspect the release workflow',
          contextFiles: [],
          skillNames: [],
          mode: 'deepResearch',
          priority: 0,
          enqueuedAt: 1,
        },
      ],
      total: 1,
      nextItemId: 'turn-new',
      acceptedItemId: 'turn-new',
    });
    const hook = renderHook(() => useTaskController());
    let submission!: Promise<void>;

    act(() => {
      submission = hook.result.current.sendMessage();
    });

    expect(appState.taskSubmissionState).toBe('creating');
    expect(appState.activeSessionId).toBeNull();

    await act(async () => {
      resolveCreate({ success: true, session });
      await submission;
    });

    expect(appState.taskSubmissionState).toBeNull();
    expect(appState.activeSessionId).toBe('task-new');
    expect(appState.composerValue).toBe('');
    expect(appState.composerMode).toBe('standard');
    expect(codeApi.enqueueTurn).toHaveBeenCalledWith('task-new', {
      content: 'Inspect the release workflow',
      contextFiles: [],
      skillNames: [],
      mode: 'deepResearch',
    });
    expect(appState.draftsByTask[newTaskDraftKey]).toEqual({ content: '', contextFiles: [], skillNames: [] });
    expect(JSON.parse(localStorage.getItem('a3s-code-web.task-drafts') ?? '{}')[newTaskDraftKey]).toEqual({
      content: '',
      contextFiles: [],
      skillNames: [],
    });
    hook.unmount();
  });

  it('submits follow-up instructions to the authoritative service queue', async () => {
    appState.activeSessionId = 'task-a';
    appState.streamingSessionId = 'task-a';
    appState.composerValue = 'Run the focused tests next';
    appState.composerContextFiles = ['src/app.ts'];
    appState.composerSkills = ['review'];
    appState.turnQueues = {};
    const enqueue = vi.spyOn(codeApi, 'enqueueTurn').mockResolvedValue({
      sessionId: 'task-a',
      status: 'running',
      paused: false,
      active: null,
      items: [
        {
          id: 'turn-1',
          kind: 'user',
          content: 'Run the focused tests next',
          contextFiles: ['src/app.ts'],
          skillNames: ['review'],
          priority: 0,
          enqueuedAt: 1,
        },
      ],
      total: 1,
      nextItemId: 'turn-1',
      acceptedItemId: 'turn-1',
    });
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.sendMessage());

    expect(enqueue).toHaveBeenCalledWith('task-a', {
      content: 'Run the focused tests next',
      contextFiles: ['src/app.ts'],
      skillNames: ['review'],
      mode: 'standard',
    });
    expect(appState.turnQueues['task-a'].items[0].id).toBe('turn-1');
    expect(appState.composerValue).toBe('');
    expect(appState.composerContextFiles).toEqual([]);
    expect(appState.composerSkills).toEqual([]);
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
      agentId: 'default',
    });
    expect(updateControls).toHaveBeenCalledWith('task-new', {
      effort: 'high',
      goal: 'Focused tests pass',
    });
    expect(appState.sessionControls['task-new']?.effort).toBe('high');
    expect(appState.newTaskConfig.goal).toBe('');
    hook.unmount();
  });

  it('creates Work AI assistant sessions without reusing the Code workspace or goal', async () => {
    appState.activeProduct = 'work';
    appState.activeSessionId = null;
    appState.workspaceRoot = '/work-documents';
    appState.sessions = [];
    appState.messagesBySession = {};
    appState.newTaskConfig = {
      workspace: '/code-project',
      model: 'codex/gpt-5.6-sol',
      effort: 'medium',
      permissionMode: 'default',
      goal: 'Keep the Code goal',
    };
    const session = {
      sessionId: 'work-assistant',
      workspace: '/work-documents',
      cwd: '/work-documents',
      model: 'codex/gpt-5.6-sol',
      followDefaultModel: false,
      permissionMode: 'default',
      state: 'idle',
      agentId: 'work',
      createdAt: 1,
    };
    vi.spyOn(codeApi, 'createSession').mockResolvedValue({ success: true, session });
    vi.spyOn(codeApi, 'updateSessionControls').mockResolvedValue({
      sessionId: 'work-assistant',
      effort: 'medium',
      goal: null,
      planningMode: 'disabled',
      goalTracking: true,
    });
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.createSession('整理文档'));

    expect(codeApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: '/work-documents',
        cwd: '/work-documents',
        agentId: 'work',
      })
    );
    expect(localStorage.getItem('a3s-work.ai-assistant.active-session')).toBe('work-assistant');
    expect(localStorage.getItem('a3s-code-web.active-task')).toBeNull();
    expect(appState.newTaskConfig.workspace).toBe('/code-project');
    expect(appState.newTaskConfig.goal).toBe('Keep the Code goal');
    hook.unmount();
  });

  it('promotes prepared editor and composer state without leaking it into the next new task', async () => {
    appState.activeSessionId = null;
    appState.workspaceRoot = '/repo';
    appState.sessions = [];
    appState.messagesBySession = {};
    appState.newTaskConfig = {
      workspace: '/repo',
      model: 'codex/gpt',
      effort: 'medium',
      permissionMode: 'default',
      goal: '',
    };
    const tab = fileTab('/repo/src/prepared.ts', 'saved', 'prepared draft');
    appState.editorTabs = [tab];
    appState.activeEditorTabId = tab.id;
    appState.taskView = 'review';
    appState.composerValue = 'Review the prepared draft';
    appState.composerContextFiles = ['src/prepared.ts'];
    appState.composerSkills = ['review'];
    appState.draftsByTask = {
      [newTaskDraftKey]: {
        content: 'Review the prepared draft',
        contextFiles: ['src/prepared.ts'],
        skillNames: ['review'],
      },
    };
    const session = codeSession('task-created', '/repo');
    vi.spyOn(codeApi, 'createSession').mockResolvedValue({ success: true, session });
    vi.spyOn(codeApi, 'updateSessionControls').mockResolvedValue({
      sessionId: session.sessionId,
      effort: 'medium',
      planningMode: 'disabled',
      goalTracking: false,
    });
    const hook = renderHook(() => useTaskController());

    await act(() => hook.result.current.createSession('Prepared task'));

    expect(appState.activeSessionId).toBe(session.sessionId);
    expect(appState.workspaceRoot).toBe('/repo');
    expect(appState.editorTabs).toHaveLength(1);
    expect(appState.editorTabs[0]).toMatchObject({
      id: tab.id,
      content: 'saved',
      draft: 'prepared draft',
    });
    expect(appState.activeEditorTabId).toBe(tab.id);
    expect(appState.taskView).toBe('review');
    expect(appState.draftsByTask[newTaskDraftKey]).toBeUndefined();
    expect(appState.draftsByTask[session.sessionId]).toEqual({
      content: 'Review the prepared draft',
      contextFiles: ['src/prepared.ts'],
      skillNames: ['review'],
    });
    expect(JSON.parse(localStorage.getItem('a3s-code-web.task-drafts') ?? '{}')).toEqual({
      [session.sessionId]: {
        content: 'Review the prepared draft',
        contextFiles: ['src/prepared.ts'],
        skillNames: ['review'],
      },
    });
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
