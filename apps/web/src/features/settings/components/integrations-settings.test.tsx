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

    expect(screen.getByRole('heading', { name: '连接器' })).toBeInTheDocument();
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

  it('preserves a conflicting stdio MCP server until the user renames or removes it', () => {
    appState.integrationsSettings = {
      ...structuredClone(source),
      mcpServers: [
        {
          name: 'oomol-connector',
          transport: { type: 'stdio', command: 'custom-connector', args: ['serve'] },
          enabled: true,
          env: {},
          oauth: null,
          tool_timeout_secs: 60,
        },
      ],
    };

    render(<IntegrationsSettingsView actions={actions} />);

    expect(screen.getByText(/现有 MCP Server 不是 streamable-http 服务/)).toBeInTheDocument();
    expect(screen.getByLabelText('oomol-connector 启动命令')).toHaveValue('custom-connector');
    expect(screen.queryByRole('button', { name: '接入 OOMOL 托管版' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('oomol-connector 名称'), { target: { value: 'custom-connector' } });

    expect(screen.queryByText(/现有 MCP Server 不是 streamable-http 服务/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '接入 OOMOL 托管版' })).toBeInTheDocument();
    expect(screen.getByLabelText('custom-connector 启动命令')).toHaveValue('custom-connector');
  });

  it('keeps a conflicting legacy HTTP MCP server in the advanced editor', () => {
    appState.integrationsSettings = {
      ...structuredClone(source),
      mcpServers: [
        {
          name: 'oomol-connector',
          transport: { type: 'http', url: 'https://example.com/custom', headers: {} },
          enabled: true,
          env: {},
          oauth: null,
          tool_timeout_secs: 60,
        },
      ],
    };

    render(<IntegrationsSettingsView actions={actions} />);

    expect(screen.getByText(/现有 MCP Server 不是 streamable-http 服务/)).toBeInTheDocument();
    expect(screen.getByLabelText('oomol-connector 服务地址')).toHaveValue('https://example.com/custom');
    expect(screen.queryByRole('button', { name: '接入 OOMOL 托管版' })).not.toBeInTheDocument();
  });

  it('adds the hosted connector MCP endpoint with its raw API key authorization', async () => {
    render(<IntegrationsSettingsView actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: '接入 OOMOL 托管版' }));
    expect(screen.getByLabelText('OOMOL MCP 地址')).toHaveValue('https://connector.oomol.com/mcp');
    expect(screen.getByLabelText('OOMOL MCP 地址')).toBeDisabled();
    const authorizationError = screen.getByText('启用 OOMOL 托管版前必须配置 API Key。');
    expect(screen.getByLabelText('OOMOL API Key')).toHaveAttribute('aria-describedby', authorizationError.id);
    expect(screen.getByLabelText('OOMOL API Key')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: '保存更改' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('OOMOL API Key'), { target: { value: 'oomol-api-key' } });
    expect(screen.getByLabelText('OOMOL API Key')).toHaveAttribute('type', 'password');
    expect(screen.queryByLabelText(/oomol-connector HTTP Header值/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存更改' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '保存更改' }));

    await waitFor(() => expect(saveIntegrationsSettings).toHaveBeenCalledTimes(1));
    expect(saveIntegrationsSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mcpServers: expect.arrayContaining([
          expect.objectContaining({
            name: 'oomol-connector',
            enabled: true,
            transport: {
              type: 'streamable-http',
              url: 'https://connector.oomol.com/mcp',
              headers: { Authorization: 'oomol-api-key' },
            },
          }),
        ]),
      })
    );
  });

  it('adds Bearer authorization for a self-hosted OpenConnector runtime', async () => {
    render(<IntegrationsSettingsView actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: '接入自部署版' }));
    fireEvent.change(screen.getByLabelText('OOMOL MCP 地址'), { target: { value: 'not-an-endpoint' } });
    const endpointError = screen.getByText(/请输入以 http:\/\/ 或 https:\/\/ 开头并以 \/mcp 结尾/);
    expect(screen.getByLabelText('OOMOL MCP 地址')).toHaveAttribute('aria-describedby', endpointError.id);
    expect(screen.getByLabelText('OOMOL MCP 地址')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: '保存更改' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('OOMOL MCP 地址'), {
      target: { value: 'https://connect.example.com/mcp' },
    });
    expect(screen.queryByText(/请输入以 http:\/\/ 或 https:\/\/ 开头并以 \/mcp 结尾/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('OOMOL Runtime Token'), { target: { value: 'Bearer oct_runtime' } });
    fireEvent.click(screen.getByRole('button', { name: '保存更改' }));

    await waitFor(() => expect(saveIntegrationsSettings).toHaveBeenCalledTimes(1));
    expect(saveIntegrationsSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mcpServers: expect.arrayContaining([
          expect.objectContaining({
            name: 'oomol-connector',
            transport: {
              type: 'streamable-http',
              url: 'https://connect.example.com/mcp',
              headers: { Authorization: 'Bearer oct_runtime' },
            },
          }),
        ]),
      })
    );
  });

  it('keeps a saved OOMOL key masked and clears it when the authentication mode changes', () => {
    appState.integrationsSettings = {
      ...structuredClone(source),
      mcpServers: [
        ...structuredClone(source.mcpServers),
        {
          name: 'oomol-connector',
          transport: {
            type: 'streamable-http',
            url: 'https://connector.oomol.com/mcp',
            headers: { Authorization: '[configured]' },
          },
          enabled: true,
          env: {},
          oauth: null,
          tool_timeout_secs: 60,
        },
      ],
    };

    render(<IntegrationsSettingsView actions={actions} />);

    expect(screen.getByLabelText('OOMOL API Key')).toHaveValue('');
    expect(screen.getByLabelText('OOMOL API Key')).toHaveAttribute('placeholder', '已配置；输入新值可替换');

    fireEvent.change(screen.getByLabelText('OOMOL 部署方式'), { target: { value: 'self-hosted' } });

    expect(screen.getByLabelText('OOMOL Runtime Token')).toHaveValue('');
    expect(screen.getByLabelText('OOMOL Runtime Token')).toHaveAttribute('placeholder', '未配置');
    expect(screen.getByLabelText('OOMOL MCP 地址')).toHaveValue('http://localhost:3000/mcp');
  });
});
