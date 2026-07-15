import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../lib/api';
import { appState } from '../../state/app-state';
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
});
