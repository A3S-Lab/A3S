import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { IntegrationsSettings } from '../../../types/settings';
import type { SettingsActions } from '../settings-actions';
import { IntegrationsSettingsView } from './integrations-settings';

const source: IntegrationsSettings = {
  category: 'integrations',
  effect: { scope: 'restartRequired', label: 'Restart', description: 'Restart required' },
  configPath: '/repo/.a3s/config.acl',
  os: { address: 'https://os.example.com' },
  search: null,
  documentParser: {
    enabled: true,
    maxFileSizeMb: 80,
    cache: { enabled: true, directory: './cache' },
    ocr: {
      enabled: true,
      model: 'openai/gpt-vision',
      prompt: null,
      maxImages: 8,
      dpi: 144,
      provider: 'vision',
      baseUrl: null,
      apiKey: '[configured]',
    },
  },
  mcpServers: [
    {
      name: 'filesystem',
      transport: { type: 'stdio', command: 'npx', args: ['-y', 'server-filesystem'] },
      enabled: true,
      env: { MCP_TOKEN: '[configured]' },
      oauth: null,
      tool_timeout_secs: 60,
    },
  ],
};

describe('IntegrationsSettingsView', () => {
  let saveIntegrationsSettings: SettingsActions['saveIntegrationsSettings'];
  let actions: SettingsActions;

  beforeEach(() => {
    appState.integrationsSettings = structuredClone(source);
    appState.settingsCategoryLoading.integrations = false;
    appState.settingsCategorySaving.integrations = false;
    appState.settingsCategoryErrors.integrations = null;
    appState.settingsCategorySavedAt.integrations = null;
    saveIntegrationsSettings = vi.fn(async (patch) => ({ ...structuredClone(source), ...patch }));
    actions = {
      loadSettingsCategory: vi.fn(async () => undefined),
      saveIntegrationsSettings,
    } as unknown as SettingsActions;
  });

  afterEach(() => cleanup());

  it('keeps configured secrets masked and saves one coherent integrations draft', async () => {
    render(<IntegrationsSettingsView actions={actions} />);

    expect(screen.getByLabelText('OCR 视觉 API Key')).toHaveValue('');
    expect(screen.queryByDisplayValue('ocr-secret')).not.toBeInTheDocument();
    expect(screen.getAllByText('已配置').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '保存更改' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('A3S OS 平台地址'), {
      target: { value: 'https://new-os.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加 Server' }));
    fireEvent.click(screen.getByRole('button', { name: '保存更改' }));

    await waitFor(() => expect(saveIntegrationsSettings).toHaveBeenCalledTimes(1));
    expect(saveIntegrationsSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        os: { address: 'https://new-os.example.com' },
        mcpServers: expect.arrayContaining([
          expect.objectContaining({ name: 'filesystem' }),
          expect.objectContaining({ name: 'new-server' }),
        ]),
      })
    );
  });

  it('switches an MCP server transport without exposing fields from the previous transport', () => {
    render(<IntegrationsSettingsView actions={actions} />);

    fireEvent.change(screen.getByLabelText('filesystem Transport'), { target: { value: 'streamable-http' } });

    expect(screen.getByLabelText('filesystem 服务地址')).toBeInTheDocument();
    expect(screen.queryByLabelText('filesystem 启动命令')).not.toBeInTheDocument();
  });
});
