import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useSnapshot } from 'valtio';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../../components/app-shell';
import { appState, navigateSettings } from '../../../state/app-state';
import type { LlmSettings } from '../../../types/api';
import type { CodeActions } from '../../code/use-code-controller';
import type { WeixinRemoteActions } from '../../weixin-remote/use-weixin-remote-controller';
import { createWeixinRemoteState } from '../../weixin-remote/weixin-remote-state';
import type { SettingsActions } from '../settings-actions';
import { SettingsDialog } from './settings-dialog';

const actions: SettingsActions = {
  loadSettingsCategory: vi.fn(async () => undefined),
  updateDefaultModel: vi.fn(async () => undefined),
  saveLlmSettings: vi.fn(async () => {
    throw new Error('not used in this test');
  }),
  saveAgentSettings: vi.fn(async () => {
    throw new Error('not used in this test');
  }),
  saveContextSettings: vi.fn(async () => {
    throw new Error('not used in this test');
  }),
  saveIntegrationsSettings: vi.fn(async () => {
    throw new Error('not used in this test');
  }),
  refreshModelCatalog: vi.fn(async () => undefined),
  loginWithOs: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
  checkForUpdates: vi.fn(async () => undefined),
  installUpdate: vi.fn(async () => undefined),
};

const weixinActions: WeixinRemoteActions = {
  refresh: vi.fn(async () => undefined),
  refreshTargets: vi.fn(async () => undefined),
  startLogin: vi.fn(async () => true),
  submitVerification: vi.fn(async () => true),
  retryLoginPolling: vi.fn(),
  cancelLogin: vi.fn(async () => undefined),
  dismissLogin: vi.fn(),
  pause: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  disconnect: vi.fn(async () => undefined),
};

function SettingsInvoker() {
  const state = useSnapshot(appState);
  return (
    <>
      <button type='button' onClick={() => navigateSettings('general')}>
        打开设置
      </button>
      {state.settingsOpen && <SettingsDialog actions={actions} />}
    </>
  );
}

describe('SettingsDialog', () => {
  beforeEach(() => {
    Object.assign(appState, createWeixinRemoteState());
    appState.settingsOpen = false;
    appState.settingsTab = 'general';
    appState.settingsChannel = 'weixin';
    appState.taskView = 'conversation';
    appState.sidebarOpen = true;
    appState.commandPaletteOpen = false;
    appState.updateInstalling = false;
    appState.updateChecking = false;
    appState.updateStatus = null;
    appState.activeSessionId = null;
    appState.sessions = [];
    appState.serviceStatus = 'connected';
    appState.serviceError = null;
    appState.workspaceRoot = '/repo';
    appState.llm = null;
    appState.health = {
      ok: true,
      app: 'A3S Code',
      version: '0.7.7',
      configPath: '/repo/config.acl',
      workspace: '/repo',
    };
    window.history.replaceState(null, '', '#code/conversation');
  });

  afterEach(() => {
    cleanup();
    Object.assign(appState, createWeixinRemoteState());
    appState.settingsOpen = false;
    appState.updateInstalling = false;
    window.history.replaceState(null, '', '#code/conversation');
  });

  it('keeps the current Code workspace mounted beneath the modal', () => {
    appState.settingsOpen = true;

    render(<AppShell actions={actions as unknown as CodeActions} />);

    expect(screen.getByRole('heading', { name: '让 Code 完成一项工作' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '通用' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Code 任务' })).toBeInTheDocument();
  });

  it('closes back to the current Code route and restores focus to the invoker', async () => {
    appState.taskView = 'activity';
    window.history.replaceState(null, '', '#code/activity');
    render(<SettingsInvoker />);
    const invoker = screen.getByRole('button', { name: '打开设置' });
    invoker.focus();
    fireEvent.click(invoker);

    const closeButton = await screen.findByRole('button', { name: '关闭设置' });
    expect(closeButton).toHaveFocus();
    fireEvent.click(closeButton);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(appState.settingsOpen).toBe(false);
    expect(window.location.hash).toBe('#code/activity');
    expect(invoker).toHaveFocus();
  });

  it('closes Help with Escape and returns to the unchanged Code route', async () => {
    appState.taskView = 'activity';
    window.history.replaceState(null, '', '#code/activity');
    render(<SettingsInvoker />);
    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.click(await screen.findByRole('button', { name: '帮助' }));

    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(appState.settingsOpen).toBe(false);
    expect(appState.taskView).toBe('activity');
    expect(window.location.hash).toBe('#code/activity');
  });

  it('opens Help as a searchable Settings tab without unmounting Code', async () => {
    render(<SettingsInvoker />);
    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));

    fireEvent.click(await screen.findByRole('button', { name: '帮助' }));

    await waitFor(() => expect(screen.getByRole('dialog', { name: '帮助' })).toBeInTheDocument());
    expect(appState.settingsOpen).toBe(true);
    expect(appState.settingsTab).toBe('help');
    expect(window.location.hash).toBe('#settings/help');
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索帮助' }), { target: { value: 'Git' } });
    expect(screen.getByText('Git 工作流')).toBeInTheDocument();
  });

  it('keeps advanced configuration categories inside the same Settings dialog', () => {
    appState.settingsOpen = true;
    render(<SettingsDialog actions={actions} />);

    for (const [label, tab] of [
      ['Agent 与执行', 'agent'],
      ['上下文与存储', 'context'],
      ['集成', 'integrations'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(appState.settingsOpen).toBe(true);
      expect(appState.settingsTab).toBe(tab);
      expect(window.location.hash).toBe(`#settings/${tab}`);
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    }
  });

  it('hosts Weixin and Feishu as tabs inside the Channels page', async () => {
    appState.settingsOpen = true;
    appState.weixinCapabilityStatus = 'unavailable';
    appState.weixinCapability = {
      schemaVersion: 2,
      state: 'unavailable',
      protocolMode: 'disabled',
      supportedScopes: [],
      releaseBlockers: [{ code: 'ilink_channel_disabled', message: 'Channel disabled.' }],
    };
    render(<SettingsDialog actions={actions} weixinActions={weixinActions} />);

    const settingsNavigation = screen.getByRole('navigation', { name: '设置分类' });
    expect(within(settingsNavigation).queryByRole('button', { name: '微信' })).not.toBeInTheDocument();
    expect(within(settingsNavigation).queryByRole('button', { name: '飞书' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '渠道' }));

    expect(appState.settingsTab).toBe('channels');
    expect(appState.settingsChannel).toBe('weixin');
    expect(window.location.hash).toBe('#settings/channels/weixin');
    expect(screen.getByRole('dialog', { name: '渠道' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '微信' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '飞书' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('heading', { name: '微信渠道尚未就绪' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '扫码绑定' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '飞书' }));

    expect(appState.settingsTab).toBe('channels');
    expect(appState.settingsChannel).toBe('feishu');
    expect(window.location.hash).toBe('#settings/channels/feishu');
    expect(screen.getByRole('dialog', { name: '渠道' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('tab', { name: '飞书' })).toHaveAttribute('aria-selected', 'true'));
    expect(await screen.findByRole('heading', { name: '飞书渠道' })).toBeInTheDocument();
    expect(screen.getByText('敬请期待')).toBeInTheDocument();
  });

  it('returns the content pane to the top when a different category opens', () => {
    appState.settingsOpen = true;
    const { container } = render(<SettingsDialog actions={actions} />);
    const content = container.querySelector<HTMLElement>('.settings-content-body');
    expect(content).not.toBeNull();
    if (!content) return;
    content.scrollTop = 240;

    fireEvent.click(screen.getByRole('button', { name: '帮助' }));

    expect(content.scrollTop).toBe(0);
  });

  it('preserves an unsaved category draft while the user checks another tab', async () => {
    appState.settingsOpen = true;
    appState.llm = createLlmSettings();
    render(<SettingsDialog actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: '模型与 Provider' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'openai 名称' }), {
      target: { value: 'renamed-provider' },
    });

    fireEvent.click(screen.getByRole('button', { name: '通用' }));
    fireEvent.click(screen.getByRole('button', { name: '模型与 Provider' }));

    expect(screen.getByRole('textbox', { name: 'renamed-provider 名称' })).toHaveValue('renamed-provider');
    expect(screen.getByRole('button', { name: '撤销' })).toBeInTheDocument();
  });

  it('asks before closing settings with an unsaved category draft', async () => {
    appState.llm = createLlmSettings();
    render(<SettingsInvoker />);
    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.click(await screen.findByRole('button', { name: '模型与 Provider' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'openai 名称' }), {
      target: { value: 'renamed-provider' },
    });

    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }));

    expect(screen.getByRole('alertdialog', { name: '还有未保存的更改' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续编辑' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }));
    fireEvent.click(screen.getByRole('button', { name: '放弃并关闭' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('contains focus inside the unsaved-changes confirmation', async () => {
    appState.llm = createLlmSettings();
    render(<SettingsInvoker />);
    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.click(await screen.findByRole('button', { name: '模型与 Provider' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'openai 名称' }), {
      target: { value: 'renamed-provider' },
    });
    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }));

    const dialog = screen.getByRole('dialog', { name: '模型与 Provider' });
    const continueButton = screen.getByRole('button', { name: '继续编辑' });
    const discardButton = screen.getByRole('button', { name: '放弃并关闭' });
    expect(continueButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(discardButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(continueButton).toHaveFocus();
  });

  it('cannot be dismissed while an update installation is active', () => {
    appState.settingsOpen = true;
    appState.updateInstalling = true;
    render(<SettingsDialog actions={actions} />);

    expect(screen.getByRole('button', { name: '关闭设置' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(appState.settingsOpen).toBe(true);
  });
});

function createLlmSettings(): LlmSettings {
  return {
    category: 'llm',
    effect: { scope: 'newTasks', label: 'New tasks', description: 'Applies to new tasks' },
    configPath: '/repo/config.acl',
    defaultModel: 'openai/model-a',
    providers: [
      {
        name: 'openai',
        apiKey: null,
        baseUrl: null,
        headers: {},
        sessionIdHeader: null,
        models: [{ id: 'model-a', name: 'Model A' }],
      },
    ],
  };
}
