import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { RemoteTargetSnapshot, WeixinAccount, WeixinCapability } from '../../../types/api';
import type { WeixinRemoteActions } from '../use-weixin-remote-controller';
import { createWeixinRemoteState } from '../weixin-remote-state';
import { WeixinRemotePage } from './weixin-remote-page';

const capability: WeixinCapability = {
  schemaVersion: 2,
  state: 'unbound',
  protocolMode: 'mock',
  supportedScopes: [],
  releaseBlockers: [{ code: 'mock_runtime_only', message: 'Mock runtime only.' }],
};

const account: WeixinAccount = {
  schemaVersion: 1,
  state: 'unbound',
  protocolMode: 'mock',
  bound: false,
  monitorState: 'stopped',
  mutationsEnabled: false,
};

function actions(): WeixinRemoteActions {
  return {
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
}

const targetSnapshot: RemoteTargetSnapshot = {
  schemaVersion: 1,
  generatedAtMs: 1_784_710_000_000,
  degraded: true,
  warnings: ['system_agent_evidence_degraded'],
  totals: { managed: 1, cooperative: 1, observed: 1 },
  items: [
    {
      id: 'rtm_0123456789abcdef01234567',
      kind: 'managedSession',
      displayName: 'Remote panel',
      workspaceAlias: 'web',
      state: 'working',
      stateDetail: 'A3S reports active managed work.',
      confidence: 'authoritative',
      attention: 'none',
      evidenceAtMs: 1_784_710_000_000,
      parentId: 'rtm_0123456789abcdef01234567',
      capabilities: ['readStatus', 'readChildren'],
      progress: {
        goalSummary: 'Finish the remote target card',
        percent: 60,
        completedSteps: 3,
        totalSteps: 5,
        pendingTurns: 1,
        activeTurn: true,
      },
    },
    {
      id: 'rtc_0123456789abcdef01234567',
      kind: 'cooperativeAgent',
      displayName: 'a3s-code',
      workspaceAlias: 'cli',
      state: 'waitingInput',
      stateDetail: 'The cooperative agent is waiting for input.',
      confidence: 'exact',
      attention: 'actionRequired',
      evidenceAtMs: 1_784_710_000_000,
      capabilities: ['readStatus', 'readChildren'],
    },
    {
      id: 'rto_0123456789abcdef01234567',
      kind: 'observedProcess',
      displayName: 'codex',
      workspaceAlias: 'repo',
      state: 'detected',
      stateDetail: 'Process detected; execution state is unknown.',
      confidence: 'process',
      attention: 'none',
      evidenceAtMs: 1_784_710_000_000,
      capabilities: ['readStatus'],
    },
  ],
};

describe('WeixinRemotePage', () => {
  beforeEach(() => {
    Object.assign(appState, createWeixinRemoteState());
  });

  afterEach(() => {
    cleanup();
    Object.assign(appState, createWeixinRemoteState());
  });

  it('explains an explicit local disable without offering a QR action', () => {
    appState.weixinCapabilityStatus = 'unavailable';
    appState.weixinCapability = {
      ...capability,
      state: 'unavailable',
      protocolMode: 'disabled',
      releaseBlockers: [{ code: 'ilink_channel_disabled', message: 'Channel disabled.' }],
    };

    render(<WeixinRemotePage actions={actions()} />);

    expect(screen.getByRole('heading', { name: '微信渠道尚未就绪' })).toBeInTheDocument();
    expect(screen.getByText('微信渠道已在本机配置中显式关闭。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '扫码绑定' })).not.toBeInTheDocument();
  });

  it('starts a production QR attempt from a configured unbound account', () => {
    const remoteActions = actions();
    Object.assign(appState, {
      weixinCapabilityStatus: 'ready',
      weixinCapability: {
        ...capability,
        protocolMode: 'tencent',
        supportedScopes: ['agents.read', 'sessions.read'],
        releaseBlockers: [],
      },
      weixinAccountStatus: 'ready',
      weixinAccount: { ...account, protocolMode: 'tencent' },
    });

    render(<WeixinRemotePage actions={remoteActions} />);
    fireEvent.click(screen.getByRole('button', { name: '扫码绑定' }));

    expect(remoteActions.startLogin).toHaveBeenCalledWith();
    expect(screen.getByText('腾讯 iLink')).toBeInTheDocument();
    expect(screen.getByText('当前版本先验证绑定与消息链路。')).toBeInTheDocument();
  });

  it('renders the sanitized degraded target preview and refreshes it independently', () => {
    const remoteActions = actions();
    Object.assign(appState, {
      weixinCapabilityStatus: 'ready',
      weixinCapability: { ...capability, supportedScopes: ['agents.read', 'sessions.read'] },
      weixinAccountStatus: 'ready',
      weixinAccount: account,
      weixinTargetsStatus: 'ready',
      weixinTargets: targetSnapshot,
    });

    render(<WeixinRemotePage actions={remoteActions} embedded />);

    expect(screen.queryByRole('heading', { name: '微信远程管理' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '远程可见目标' })).toBeInTheDocument();
    expect(screen.getByText('Remote panel')).toBeInTheDocument();
    expect(screen.getByText('A3S 管理状态')).toBeInTheDocument();
    expect(screen.getByText('工作区：web')).toBeInTheDocument();
    expect(screen.getByText('A3S 精确心跳')).toBeInTheDocument();
    expect(screen.getByText('托管子智能体')).toBeInTheDocument();
    expect(screen.getByText('只读 · 执行状态未知')).toBeInTheDocument();
    expect(screen.getByText('部分协作智能体或进程证据暂时不可用。')).toBeInTheDocument();
    expect(screen.getByText('进度 60% · 3/5 步')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刷新远程目标' }));
    expect(remoteActions.refreshTargets).toHaveBeenCalledOnce();
  });

  it('keeps account controls visible when an older Boot lacks target preview', () => {
    Object.assign(appState, {
      weixinCapabilityStatus: 'ready',
      weixinCapability: capability,
      weixinAccountStatus: 'ready',
      weixinAccount: account,
      weixinTargetsStatus: 'unavailable',
      weixinTargets: null,
      weixinTargetsError: '当前 A3S Boot 版本尚未提供远程目标预览。',
    });

    render(<WeixinRemotePage actions={actions()} embedded />);

    expect(screen.getByRole('button', { name: '扫码绑定' })).toBeInTheDocument();
    expect(screen.getByText('当前 Boot 暂不支持目标预览')).toBeInTheDocument();
    expect(screen.getByText('当前 A3S Boot 版本尚未提供远程目标预览。')).toBeInTheDocument();
  });

  it('renders the ephemeral QR challenge and submits only normalized digits', async () => {
    const remoteActions = actions();
    Object.assign(appState, {
      weixinCapabilityStatus: 'ready',
      weixinCapability: capability,
      weixinAccountStatus: 'ready',
      weixinAccount: account,
      weixinLoginAttempt: {
        schemaVersion: 1,
        attemptId: 'attempt/a',
        state: 'verificationRequired',
        qrContent: 'weixin://qr-canary',
        expiresInSeconds: 121,
        verifySubmissions: 1,
      },
    });

    render(<WeixinRemotePage actions={remoteActions} />);
    const input = screen.getByLabelText('微信要求输入配对验证码');
    const description = screen.getByText('请填写手机微信页面显示的数字验证码。本机最多允许提交 3 次。');
    expect(input).toHaveAttribute('aria-describedby', description.id);
    expect(screen.queryByTitle('微信绑定二维码')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: '12ab34' } });
    expect(input).toHaveValue('1234');
    expect(screen.getByText('本次绑定剩余 2:01')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '提交验证码' }));

    await waitFor(() => expect(remoteActions.submitVerification).toHaveBeenCalledWith('1234'));
    expect(document.body.innerHTML).not.toContain('bot-token-canary');
  });

  it('requires a local confirmation before deleting a bound account', async () => {
    const remoteActions = actions();
    Object.assign(appState, {
      weixinCapabilityStatus: 'ready',
      weixinCapability: { ...capability, state: 'active' },
      weixinAccountStatus: 'ready',
      weixinAccount: {
        ...account,
        state: 'active',
        bound: true,
        ownerLabel: 'WeChat owner • a1b2',
        monitorState: 'running',
      },
    });

    render(<WeixinRemotePage actions={remoteActions} />);
    fireEvent.click(screen.getByRole('button', { name: '删除本机绑定' }));

    const dialog = screen.getByRole('dialog', { name: '删除本机微信绑定？' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('本机保存的凭据和运行游标将被清除。再次使用时需要重新扫码绑定。')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '删除本机绑定' }));
    await waitFor(() => expect(remoteActions.disconnect).toHaveBeenCalled());
  });
});
