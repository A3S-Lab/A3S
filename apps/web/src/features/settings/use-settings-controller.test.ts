import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../state/app-state';
import { codeApi } from '../../lib/api';
import { useSettingsController } from './use-settings-controller';

describe('settings context boundaries', () => {
  beforeEach(() => {
    appState.agentSettings = null;
    appState.contextSettings = null;
    appState.integrationsSettings = null;
    appState.settingsCategoryLoading = { llm: false, agent: false, context: false, integrations: false };
    appState.settingsCategorySaving = { llm: false, agent: false, context: false, integrations: false };
    appState.settingsCategoryErrors = { llm: null, agent: null, context: null, integrations: null };
    appState.settingsCategorySavedAt = { llm: null, agent: null, context: null, integrations: null };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not close the current local task when signing out of A3S OS', async () => {
    appState.activeSessionId = 'local-task';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 200,
              data: {
                configured: true,
                signedIn: false,
                needsRefresh: false,
                capabilitySkillActive: false,
                builtinSkillActive: false,
                runtimeToolActive: false,
              },
            }),
            { status: 200 }
          )
      )
    );
    const hook = renderHook(() => useSettingsController());
    await act(() => hook.result.current.logout());
    expect(appState.activeSessionId).toBe('local-task');
    expect(appState.osAccount?.signedIn).toBe(false);
  });

  it('keeps the authoritative default model when saving fails', async () => {
    appState.defaultModelSaving = false;
    appState.llm = { defaultModel: 'model-a', providers: [] };
    appState.selectedModel = 'model-a';
    vi.spyOn(codeApi, 'updateLlmSettings').mockRejectedValue(new Error('save failed'));
    const hook = renderHook(() => useSettingsController());
    await act(() => hook.result.current.updateDefaultModel('model-b'));
    expect(appState.llm.defaultModel).toBe('model-a');
    expect(appState.selectedModel).toBe('model-a');
    expect(appState.defaultModelSaving).toBe(false);
  });

  it('keeps update-check failure inline and retryable', async () => {
    appState.updateStatus = {
      currentVersion: '0.7.7',
      latestVersion: '0.7.8',
      updateAvailable: true,
      canSelfUpdate: true,
      checkedAt: 'now',
    };
    appState.updateChecking = false;
    appState.updateInstalling = false;
    appState.updateCheckError = null;
    vi.spyOn(codeApi, 'updateStatus').mockRejectedValue(new Error('update service unavailable'));
    const hook = renderHook(() => useSettingsController());

    await act(() => hook.result.current.checkForUpdates());

    expect(appState.updateStatus).toBeNull();
    expect(appState.updateCheckError).toBe('update service unavailable');
    expect(appState.updateChecking).toBe(false);
    hook.unmount();
  });

  it('preserves the reviewed update after installation fails', async () => {
    appState.updateInstalling = false;
    appState.updateInstallError = null;
    appState.updateInstalledVersion = null;
    vi.spyOn(codeApi, 'installUpdate').mockRejectedValue(new Error('installer failed'));
    const hook = renderHook(() => useSettingsController());

    await expect(act(() => hook.result.current.installUpdate('0.7.8'))).rejects.toThrow('installer failed');

    expect(appState.updateInstallError).toBe('installer failed');
    expect(appState.updateInstalledVersion).toBeNull();
    expect(appState.updateInstalling).toBe(false);
    hook.unmount();
  });

  it('never offers a second install when installation succeeded but status refresh failed', async () => {
    appState.updateInstalling = false;
    appState.updateInstallError = null;
    appState.updateCheckError = null;
    appState.updateInstalledVersion = null;
    vi.spyOn(codeApi, 'installUpdate').mockResolvedValue({ restartRequired: true, message: 'installed' });
    vi.spyOn(codeApi, 'updateStatus').mockRejectedValue(new Error('status refresh failed'));
    const hook = renderHook(() => useSettingsController());

    await act(() => hook.result.current.installUpdate('0.7.8'));

    expect(appState.updateInstalledVersion).toBe('0.7.8');
    expect(appState.updateCheckError).toContain('更新已安装');
    expect(appState.updateInstalling).toBe(false);
    hook.unmount();
  });

  it('loads each configuration category lazily and records the authoritative result', async () => {
    const integrations = {
      category: 'integrations' as const,
      effect: { scope: 'restartRequired' as const, label: 'Restart', description: 'Restart required' },
      configPath: '/repo/.a3s/config.acl',
      os: null,
      search: null,
      documentParser: null,
      mcpServers: [],
    };
    vi.spyOn(codeApi, 'integrationsSettings').mockResolvedValue(integrations);
    const hook = renderHook(() => useSettingsController());

    await act(() => hook.result.current.loadSettingsCategory('integrations'));

    expect(appState.integrationsSettings).toEqual(integrations);
    expect(appState.settingsCategoryErrors.integrations).toBeNull();
    expect(appState.settingsCategoryLoading.integrations).toBe(false);
    hook.unmount();
  });

  it('keeps a category load failure retryable and clears it after a forced retry', async () => {
    const request = vi.spyOn(codeApi, 'agentSettings').mockRejectedValueOnce(new Error('config unavailable'));
    const hook = renderHook(() => useSettingsController());

    await act(() => hook.result.current.loadSettingsCategory('agent'));
    expect(appState.agentSettings).toBeNull();
    expect(appState.settingsCategoryErrors.agent).toBe('config unavailable');

    request.mockResolvedValueOnce({
      category: 'agent',
      effect: { scope: 'restartRequired', label: 'Restart', description: 'Restart required' },
      configPath: '/repo/.a3s/config.acl',
      skillDirs: [],
      agentDirs: [],
      autoDelegation: {
        enabled: false,
        autoParallel: true,
        allowManualDelegation: true,
        minConfidence: 0.72,
        maxTasks: 4,
      },
      queue: null,
    });
    await act(() => hook.result.current.loadSettingsCategory('agent', true));

    expect(appState.agentSettings?.autoDelegation.maxTasks).toBe(4);
    expect(appState.settingsCategoryErrors.agent).toBeNull();
    hook.unmount();
  });

  it('does not replace saved integration settings when persistence fails', async () => {
    const current = {
      category: 'integrations' as const,
      effect: { scope: 'restartRequired' as const, label: 'Restart', description: 'Restart required' },
      configPath: '/repo/.a3s/config.acl',
      os: { address: 'https://old.example.com' },
      search: null,
      documentParser: null,
      mcpServers: [],
    };
    appState.integrationsSettings = current;
    vi.spyOn(codeApi, 'updateIntegrationsSettings').mockRejectedValue(new Error('write failed'));
    const hook = renderHook(() => useSettingsController());

    await expect(
      act(() => hook.result.current.saveIntegrationsSettings({ os: { address: 'https://new.example.com' } }))
    ).rejects.toThrow('write failed');

    expect(appState.integrationsSettings.os?.address).toBe('https://old.example.com');
    expect(appState.settingsCategoryErrors.integrations).toBe('write failed');
    expect(appState.settingsCategorySaving.integrations).toBe(false);
    hook.unmount();
  });
});
