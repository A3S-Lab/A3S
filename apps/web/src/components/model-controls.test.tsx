import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CodeActions } from '../features/code/use-code-controller';
import { appState } from '../state/app-state';
import { SettingsDialog } from '../features/settings/components/settings-dialog';
import { useSettingsController } from '../features/settings/use-settings-controller';
import { ModelCombobox } from '../design-system/primitives';

function modelState() {
  appState.settingsTab = 'general';
  appState.activeSessionId = null;
  appState.streamingSessionId = null;
  appState.selectedModel = 'codex/gpt-5.6-sol';
  appState.defaultModelSaving = false;
  appState.updateStatus = null;
  appState.updateChecking = false;
  appState.updateInstalling = false;
  appState.updateCheckError = null;
  appState.updateInstallError = null;
  appState.updateInstalledVersion = null;
  appState.sessions = [];
  appState.modelCatalog = {
    defaultModel: 'codex/gpt-5.6-sol',
    warnings: [],
    items: [
      { id: 'codex/gpt-5.6-sol', name: 'gpt-5.6-sol', source: 'Codex', reasoning: true, toolCall: true },
      { id: 'openai/glm-5.2', name: 'glm-5.2', source: 'config.acl', reasoning: true, toolCall: true },
    ],
  };
  appState.llm = {
    defaultModel: 'codex/gpt-5.6-sol',
    providers: [
      { name: 'codex', models: [{ id: 'gpt-5.6-sol', name: 'gpt-5.6-sol', reasoning: true, toolCall: true }] },
      { name: 'openai', models: [{ id: 'glm-5.2', name: 'glm-5.2', reasoning: true, toolCall: true }] },
    ],
  };
  appState.serviceStatus = 'connected';
  appState.health = {
    ok: true,
    app: 'A3S Code',
    version: '0.7.7',
    configPath: '/repo/config.acl',
    workspace: '/repo',
  };
}

function SettingsHarness() {
  return <SettingsDialog actions={useSettingsController()} />;
}

describe('model controls', () => {
  afterEach(() => {
    cleanup();
    appState.settingsOpen = false;
    vi.unstubAllGlobals();
  });
  it('provides an actual default-model control in settings', async () => {
    modelState();
    appState.settingsOpen = true;
    const saveLlmSettings = vi.fn(async (patch) => ({ ...appState.llm!, ...patch }));
    const actions = { saveLlmSettings } as unknown as CodeActions;
    render(<SettingsDialog actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: '模型与 Provider' }));
    fireEvent.click(await screen.findByRole('button', { name: '设置默认模型' }));
    fireEvent.click(screen.getByRole('option', { name: /glm-5\.2/ }));
    expect(saveLlmSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '保存更改' }));
    await waitFor(() =>
      expect(saveLlmSettings).toHaveBeenCalledWith(expect.objectContaining({ defaultModel: 'openai/glm-5.2' }))
    );
  });

  it('presents updates as a settings workflow with explicit confirmation', async () => {
    modelState();
    appState.settingsOpen = true;
    appState.settingsTab = 'general';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 200,
              data: {
                currentVersion: '0.7.7',
                latestVersion: '0.7.8',
                updateAvailable: true,
                canSelfUpdate: true,
                checkedAt: '2026-07-12T00:00:00Z',
              },
            }),
            { status: 200 }
          )
      )
    );
    render(<SettingsHarness />);
    fireEvent.click(screen.getByRole('button', { name: '关于与更新' }));
    expect(await screen.findByText('发现 0.7.8')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '安装更新' }));
    expect(screen.getByRole('button', { name: '确认安装 0.7.8' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps a retryable update error instead of claiming the app is current', async () => {
    modelState();
    appState.settingsOpen = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Failed to fetch');
      })
    );
    render(<SettingsHarness />);
    fireEvent.click(screen.getByRole('button', { name: '关于与更新' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('无法访问本地 A3S Code 服务');
    expect(screen.getByText('无法检查更新')).toBeInTheDocument();
    expect(screen.queryByText('当前已是最新版本')).not.toBeInTheDocument();
  });

  it('supports focused keyboard model selection without duplicate updates', () => {
    modelState();
    const onChange = vi.fn();
    const models = appState.modelCatalog?.items ?? [];
    render(
      <ModelCombobox
        models={models}
        value='codex/gpt-5.6-sol'
        defaultModel='codex/gpt-5.6-sol'
        label='任务模型'
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '任务模型' }));
    const search = screen.getByRole('combobox', { name: '搜索模型' });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: 'glm' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('openai/glm-5.2');

    fireEvent.click(screen.getByRole('button', { name: '任务模型' }));
    fireEvent.click(screen.getByRole('option', { name: /gpt-5\.6-sol/ }));
    expect(onChange).toHaveBeenCalledTimes(1);

    const trigger = screen.getByRole('button', { name: '任务模型' });
    fireEvent.click(trigger);
    const option = screen.getByRole('option', { name: /gpt-5\.6-sol/ });
    option.focus();
    fireEvent.keyDown(option, { key: 'Escape' });
    expect(screen.queryByRole('combobox', { name: '搜索模型' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('renders and selects the WorkBuddy account source returned by the runtime catalog', () => {
    const onChange = vi.fn();
    render(
      <ModelCombobox
        models={[
          { id: 'codex/gpt-5.6-sol', name: 'gpt-5.6-sol', source: 'Codex', reasoning: true, toolCall: true },
          { id: 'workbuddy/glm-5.1', name: 'glm-5.1', source: 'WorkBuddy', reasoning: true, toolCall: true },
        ]}
        value='codex/gpt-5.6-sol'
        label='任务模型'
        sourceTabs
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '任务模型' }));
    expect(screen.getByRole('listbox', { name: '可用模型' }).closest('section')).toHaveClass('has-source-tabs');
    fireEvent.click(screen.getByRole('tab', { name: 'WorkBuddy' }));
    fireEvent.click(screen.getByRole('option', { name: /glm-5\.1/ }));

    expect(onChange).toHaveBeenCalledWith('workbuddy/glm-5.1');
  });

  it('keeps update confirmation and a retryable error when installation fails', async () => {
    modelState();
    appState.settingsOpen = true;
    appState.settingsTab = 'general';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).includes('/install')) throw new Error('installer failed');
        return new Response(
          JSON.stringify({
            code: 200,
            data: {
              currentVersion: '0.7.7',
              latestVersion: '0.7.8',
              updateAvailable: true,
              canSelfUpdate: true,
              checkedAt: '2026-07-12T00:00:00Z',
            },
          }),
          { status: 200 }
        );
      })
    );
    render(<SettingsHarness />);
    fireEvent.click(screen.getByRole('button', { name: '关于与更新' }));
    expect(await screen.findByText('发现 0.7.8')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '安装更新' }));
    fireEvent.click(screen.getByRole('button', { name: '确认安装 0.7.8' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('安装失败：installer failed');
    expect(screen.getByRole('button', { name: '确认安装 0.7.8' })).toBeInTheDocument();
  });

  it('reports the actual local API connection state', async () => {
    modelState();
    appState.settingsOpen = true;
    appState.serviceStatus = 'disconnected';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 200,
              data: {
                currentVersion: '0.7.7',
                latestVersion: '0.7.7',
                updateAvailable: false,
                canSelfUpdate: true,
                checkedAt: '2026-07-12T00:00:00Z',
              },
            }),
            { status: 200 }
          )
      )
    );
    render(<SettingsHarness />);
    fireEvent.click(screen.getByRole('button', { name: '关于与更新' }));
    expect(await screen.findByText('连接中断')).toBeInTheDocument();
  });
});
