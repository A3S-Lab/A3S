import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../lib/api';
import { appState } from '../../state/app-state';
import { useTaskController } from '../tasks/use-task-controller';
import { fallbackModelCatalog, useAppBootstrap } from './use-app-bootstrap';

describe('app bootstrap authority', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not start OS authorization without an explicit user action', async () => {
    appState.activeSessionId = null;
    appState.bootPhase = 'loading';
    vi.spyOn(codeApi, 'health').mockResolvedValue({
      ok: true,
      app: 'A3S Code',
      version: '0.7.7',
      configPath: '/repo/config.acl',
      workspace: '/repo',
    });
    vi.spyOn(codeApi, 'osAccount').mockResolvedValue({
      configured: true,
      signedIn: false,
      needsRefresh: false,
      capabilitySkillActive: false,
      builtinSkillActive: false,
      runtimeToolActive: false,
    });
    vi.spyOn(codeApi, 'llmSettings').mockResolvedValue({ defaultModel: 'model-a', providers: [] });
    vi.spyOn(codeApi, 'modelCatalog').mockResolvedValue({
      items: [],
      warnings: [],
      defaultModel: 'model-a',
    });
    vi.spyOn(codeApi, 'refreshModelCatalog').mockResolvedValue({
      items: [],
      warnings: [],
      defaultModel: 'model-a',
    });
    vi.spyOn(codeApi, 'sessions').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(codeApi, 'effortLevels').mockResolvedValue({ items: [] });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const login = vi.spyOn(codeApi, 'osLogin');

    const hook = renderHook(() => useAppBootstrap());
    await waitFor(() => expect(appState.bootPhase).toBe('ready'));
    expect(login).not.toHaveBeenCalled();
    expect(appState.osAccount?.signedIn).toBe(false);
    hook.unmount();
  });

  it('reloads authoritative shell data before reporting reconnection', async () => {
    appState.activeSessionId = null;
    appState.bootPhase = 'loading';
    vi.spyOn(codeApi, 'health').mockResolvedValue({
      ok: true,
      app: 'A3S Code',
      version: '0.7.7',
      configPath: '/repo/config.acl',
      workspace: '/repo',
    });
    vi.spyOn(codeApi, 'osAccount').mockResolvedValue({
      configured: false,
      signedIn: false,
      needsRefresh: false,
      capabilitySkillActive: false,
      builtinSkillActive: false,
      runtimeToolActive: false,
    });
    vi.spyOn(codeApi, 'llmSettings').mockResolvedValue({ defaultModel: 'model-a', providers: [] });
    vi.spyOn(codeApi, 'modelCatalog').mockResolvedValue({
      items: [],
      warnings: [],
      defaultModel: 'model-a',
    });
    vi.spyOn(codeApi, 'refreshModelCatalog').mockResolvedValue({
      items: [],
      warnings: [],
      defaultModel: 'model-a',
    });
    const sessions = vi
      .spyOn(codeApi, 'sessions')
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({
        items: [
          {
            sessionId: 'task-after-reconnect',
            workspace: '/repo',
            cwd: '/repo',
            followDefaultModel: true,
            permissionMode: 'default',
            state: 'idle',
            createdAt: 1,
          },
        ],
        total: 1,
      });
    vi.spyOn(codeApi, 'effortLevels').mockResolvedValue({ items: [] });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);

    const hook = renderHook(() => useAppBootstrap());
    await waitFor(() => expect(appState.bootPhase).toBe('ready'));
    appState.serviceStatus = 'disconnected';
    await act(() => hook.result.current.retryConnection());
    expect(sessions).toHaveBeenCalledTimes(2);
    expect(appState.sessions[0].sessionId).toBe('task-after-reconnect');
    expect(appState.serviceStatus).toBe('connected');
    hook.unmount();
  });

  it('keeps startup usable when an older service has no model catalog route', async () => {
    appState.activeSessionId = null;
    appState.bootPhase = 'loading';
    vi.spyOn(codeApi, 'health').mockResolvedValue({
      ok: true,
      app: 'A3S Code',
      version: '0.7.7',
      configPath: '/repo/config.acl',
      workspace: '/repo',
    });
    vi.spyOn(codeApi, 'osAccount').mockResolvedValue({
      configured: false,
      signedIn: false,
      needsRefresh: false,
      capabilitySkillActive: false,
      builtinSkillActive: false,
      runtimeToolActive: false,
    });
    const llm = {
      defaultModel: 'openai/model-a',
      providers: [{ name: 'openai', models: [{ id: 'model-a', name: 'Model A', reasoning: true }] }],
    };
    vi.spyOn(codeApi, 'llmSettings').mockResolvedValue(llm);
    vi.spyOn(codeApi, 'modelCatalog').mockRejectedValue(new Error('GET /api/v1/config/llm/models'));
    vi.spyOn(codeApi, 'refreshModelCatalog').mockRejectedValue(new Error('GET /api/v1/config/llm/models/refresh'));
    vi.spyOn(codeApi, 'sessions').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(codeApi, 'effortLevels').mockResolvedValue({ items: [] });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);

    const hook = renderHook(() => useAppBootstrap());
    await waitFor(() => expect(appState.bootPhase).toBe('ready'));
    expect(appState.modelCatalog).toEqual(fallbackModelCatalog(llm));
    expect(appState.modelCatalog?.items[0].id).toBe('openai/model-a');
    hook.unmount();
  });

  it('becomes ready from the fast catalog before account entitlement refresh completes', async () => {
    appState.activeSessionId = null;
    appState.bootPhase = 'loading';
    vi.spyOn(codeApi, 'health').mockResolvedValue({
      ok: true,
      app: 'A3S Code',
      version: '0.7.9',
      configPath: '/repo/config.acl',
      workspace: '/repo',
    });
    vi.spyOn(codeApi, 'osAccount').mockResolvedValue({
      configured: false,
      signedIn: false,
      needsRefresh: false,
      capabilitySkillActive: false,
      builtinSkillActive: false,
      runtimeToolActive: false,
    });
    vi.spyOn(codeApi, 'llmSettings').mockResolvedValue({ defaultModel: 'openai/model-a', providers: [] });
    vi.spyOn(codeApi, 'modelCatalog').mockResolvedValue({
      items: [{ id: 'workbuddy/auto', name: 'auto', source: 'WorkBuddy', reasoning: true, toolCall: true }],
      warnings: [],
      defaultModel: 'openai/model-a',
    });
    const refresh = vi.spyOn(codeApi, 'refreshModelCatalog').mockReturnValue(new Promise(() => {}));
    vi.spyOn(codeApi, 'sessions').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(codeApi, 'effortLevels').mockResolvedValue({ items: [] });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);

    const hook = renderHook(() => useAppBootstrap());

    await waitFor(() => expect(appState.bootPhase).toBe('ready'));
    expect(appState.modelCatalog?.items[0].id).toBe('workbuddy/auto');
    expect(refresh).toHaveBeenCalledTimes(1);
    hook.unmount();
  });

  it('publishes delayed bootstrap messages and controls only to the session that requested them', async () => {
    const taskA = codeSession('task-a');
    const taskB = codeSession('task-b');
    const messagesA = deferred<Awaited<ReturnType<typeof codeApi.messages>>>();
    const controlsA = deferred<Awaited<ReturnType<typeof codeApi.sessionControls>>>();
    appState.activeSessionId = taskA.sessionId;
    appState.messagesBySession = {
      [taskB.sessionId]: [
        {
          id: 'message-b',
          sessionId: taskB.sessionId,
          role: 'assistant',
          content: 'keep B',
          createdAt: new Date(0).toISOString(),
          events: [],
        },
      ],
    };
    appState.sessionControls = {
      [taskB.sessionId]: {
        sessionId: taskB.sessionId,
        effort: 'high',
        planningMode: 'disabled',
        goalTracking: false,
      },
    };
    appState.bootPhase = 'loading';
    vi.spyOn(codeApi, 'health').mockResolvedValue({
      ok: true,
      app: 'A3S Code',
      version: '0.7.9',
      configPath: '/repo/config.acl',
      workspace: '/repo',
    });
    vi.spyOn(codeApi, 'osAccount').mockResolvedValue({
      configured: false,
      signedIn: false,
      needsRefresh: false,
      capabilitySkillActive: false,
      builtinSkillActive: false,
      runtimeToolActive: false,
    });
    vi.spyOn(codeApi, 'llmSettings').mockResolvedValue({ defaultModel: 'model-a', providers: [] });
    vi.spyOn(codeApi, 'modelCatalog').mockResolvedValue({ items: [], warnings: [], defaultModel: 'model-a' });
    vi.spyOn(codeApi, 'refreshModelCatalog').mockResolvedValue({ items: [], warnings: [], defaultModel: 'model-a' });
    vi.spyOn(codeApi, 'sessions').mockResolvedValue({ items: [taskA, taskB], total: 2 });
    vi.spyOn(codeApi, 'effortLevels').mockResolvedValue({ items: [] });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const messages = vi.spyOn(codeApi, 'messages').mockReturnValue(messagesA.promise);
    vi.spyOn(codeApi, 'sessionControls').mockReturnValue(controlsA.promise);
    const hook = renderHook(() => useAppBootstrap());
    await waitFor(() => expect(messages).toHaveBeenCalledWith(taskA.sessionId));

    act(() => {
      appState.activeSessionId = taskB.sessionId;
    });
    await act(async () => {
      messagesA.resolve({
        items: [
          {
            id: 'message-a',
            sessionId: taskA.sessionId,
            role: 'assistant',
            content: 'A response',
            createdAt: new Date(0).toISOString(),
            events: [],
          },
        ],
        total: 1,
        page: 1,
        limit: 100,
      });
      controlsA.resolve({
        sessionId: taskA.sessionId,
        effort: 'low',
        planningMode: 'disabled',
        goalTracking: false,
      });
    });
    await waitFor(() => expect(appState.bootPhase).toBe('ready'));

    expect(appState.activeSessionId).toBe(taskB.sessionId);
    expect(appState.messagesBySession[taskA.sessionId]?.[0].content).toBe('A response');
    expect(appState.messagesBySession[taskB.sessionId]?.[0].content).toBe('keep B');
    expect(appState.sessionControls[taskA.sessionId]?.effort).toBe('low');
    expect(appState.sessionControls[taskB.sessionId]?.effort).toBe('high');
    hook.unmount();
  });

  it('does not let an older bootstrap controls response overwrite a successful task update', async () => {
    const task = codeSession('task-a');
    const bootstrapControls = deferred<Awaited<ReturnType<typeof codeApi.sessionControls>>>();
    appState.activeSessionId = task.sessionId;
    appState.sessions = [task];
    appState.messagesBySession = { [task.sessionId]: [] };
    appState.sessionControls = {};
    appState.sessionControlsErrors = {};
    appState.sessionControlsLoading = {};
    appState.taskConfigSaving = null;
    appState.bootPhase = 'loading';
    vi.spyOn(codeApi, 'health').mockResolvedValue({
      ok: true,
      app: 'A3S Code',
      version: '0.7.9',
      configPath: '/repo/config.acl',
      workspace: '/repo',
    });
    vi.spyOn(codeApi, 'osAccount').mockResolvedValue({
      configured: false,
      signedIn: false,
      needsRefresh: false,
      capabilitySkillActive: false,
      builtinSkillActive: false,
      runtimeToolActive: false,
    });
    vi.spyOn(codeApi, 'llmSettings').mockResolvedValue({ defaultModel: 'model-a', providers: [] });
    vi.spyOn(codeApi, 'modelCatalog').mockResolvedValue({ items: [], warnings: [], defaultModel: 'model-a' });
    vi.spyOn(codeApi, 'refreshModelCatalog').mockResolvedValue({ items: [], warnings: [], defaultModel: 'model-a' });
    vi.spyOn(codeApi, 'sessions').mockResolvedValue({ items: [task], total: 1 });
    vi.spyOn(codeApi, 'effortLevels').mockResolvedValue({ items: [] });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    vi.spyOn(codeApi, 'messages').mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });
    const controls = vi.spyOn(codeApi, 'sessionControls').mockReturnValue(bootstrapControls.promise);
    vi.spyOn(codeApi, 'updateSessionControls').mockResolvedValue({
      sessionId: task.sessionId,
      effort: 'high',
      planningMode: 'disabled',
      goalTracking: false,
    });
    const bootstrapHook = renderHook(() => useAppBootstrap());
    await waitFor(() => expect(controls).toHaveBeenCalledWith(task.sessionId));
    const taskHook = renderHook(() => useTaskController());

    await act(() => taskHook.result.current.updateEffort('high'));
    expect(appState.sessionControls[task.sessionId]?.effort).toBe('high');
    await act(async () => {
      bootstrapControls.resolve({
        sessionId: task.sessionId,
        effort: 'low',
        planningMode: 'disabled',
        goalTracking: false,
      });
    });
    await waitFor(() => expect(appState.bootPhase).toBe('ready'));

    expect(appState.sessionControls[task.sessionId]?.effort).toBe('high');
    taskHook.unmount();
    bootstrapHook.unmount();
  });
});

function codeSession(sessionId: string) {
  return {
    sessionId,
    workspace: '/repo',
    cwd: '/repo',
    model: 'codex/gpt',
    followDefaultModel: false,
    permissionMode: 'default',
    state: 'idle',
    createdAt: 1,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
