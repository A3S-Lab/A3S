import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, codeApi } from '../../lib/api';
import { appState } from '../../state/app-state';
import type { RemoteTargetSnapshot, WeixinAccount, WeixinCapability, WeixinLoginAttempt } from '../../types/api';
import { useWeixinRemoteController } from './use-weixin-remote-controller';
import { createWeixinRemoteState } from './weixin-remote-state';

const capability: WeixinCapability = {
  schemaVersion: 2,
  state: 'unbound',
  protocolMode: 'mock',
  supportedScopes: [],
  releaseBlockers: [{ code: 'mock_runtime_only', message: 'Mock runtime only.' }],
};

const unboundAccount: WeixinAccount = {
  schemaVersion: 1,
  state: 'unbound',
  protocolMode: 'mock',
  bound: false,
  monitorState: 'stopped',
  mutationsEnabled: false,
};

const boundAccount: WeixinAccount = {
  ...unboundAccount,
  state: 'active',
  bound: true,
  ownerLabel: 'WeChat owner • a1b2',
  monitorState: 'running',
};

const targets: RemoteTargetSnapshot = {
  schemaVersion: 1,
  generatedAtMs: 1_784_710_000_000,
  degraded: false,
  warnings: [],
  totals: { managed: 0, cooperative: 0, observed: 0 },
  items: [],
};

function attempt(state: WeixinLoginAttempt['state']): WeixinLoginAttempt {
  return {
    schemaVersion: 1,
    attemptId: 'attempt/a',
    state,
    qrContent: state === 'connected' ? null : 'weixin://qr-canary',
    expiresInSeconds: state === 'connected' ? 0 : 300,
    verifySubmissions: state === 'verificationSubmitted' ? 1 : 0,
  };
}

describe('useWeixinRemoteController', () => {
  beforeEach(() => {
    Object.assign(appState, createWeixinRemoteState(), {
      activeProduct: 'code',
      bootPhase: 'ready',
      serviceStatus: 'connected',
      serviceError: null,
      toast: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.assign(appState, createWeixinRemoteState());
  });

  it('treats a missing capability route as feature-unavailable without disconnecting A3S', async () => {
    vi.spyOn(codeApi, 'weixinCapability').mockRejectedValue(new ApiError('Not found', 404));
    const accountRequest = vi.spyOn(codeApi, 'weixinAccount');
    const hook = renderHook(() => useWeixinRemoteController());

    await act(() => hook.result.current.refresh());

    expect(appState.weixinCapabilityStatus).toBe('unavailable');
    expect(appState.weixinCapabilityError).toContain('未提供微信远程管理接口');
    expect(appState.serviceStatus).toBe('connected');
    expect(accountRequest).not.toHaveBeenCalled();
  });

  it('loads capability and sanitized account state without browser persistence', async () => {
    vi.spyOn(codeApi, 'weixinCapability').mockResolvedValue(capability);
    vi.spyOn(codeApi, 'weixinAccount').mockResolvedValue(unboundAccount);
    vi.spyOn(codeApi, 'weixinTargets').mockResolvedValue(targets);
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const hook = renderHook(() => useWeixinRemoteController());

    await act(() => hook.result.current.refresh());

    expect(appState.weixinCapability).toEqual(capability);
    expect(appState.weixinAccount).toEqual(unboundAccount);
    expect(appState.weixinTargets).toEqual(targets);
    expect(appState.weixinTargetsStatus).toBe('ready');
    expect(appState.weixinCapabilityStatus).toBe('ready');
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it('degrades only target preview when the preceding Boot version returns 404', async () => {
    vi.spyOn(codeApi, 'weixinCapability').mockResolvedValue(capability);
    vi.spyOn(codeApi, 'weixinAccount').mockResolvedValue(unboundAccount);
    vi.spyOn(codeApi, 'weixinTargets').mockRejectedValue(new ApiError('Not found', 404));
    const hook = renderHook(() => useWeixinRemoteController());

    await act(() => hook.result.current.refresh());

    expect(appState.weixinCapabilityStatus).toBe('ready');
    expect(appState.weixinAccountStatus).toBe('ready');
    expect(appState.weixinTargetsStatus).toBe('unavailable');
    expect(appState.weixinTargetsError).toContain('尚未提供远程目标预览');
    expect(appState.serviceStatus).toBe('connected');
  });

  it('runs verification and closes the ephemeral attempt after binding', async () => {
    vi.spyOn(codeApi, 'startWeixinLogin').mockResolvedValue(attempt('waitingForScan'));
    vi.spyOn(codeApi, 'pollWeixinLogin')
      .mockResolvedValueOnce(attempt('verificationRequired'))
      .mockResolvedValueOnce(attempt('connected'));
    const submit = vi.spyOn(codeApi, 'submitWeixinVerification').mockResolvedValue(attempt('verificationSubmitted'));
    vi.spyOn(codeApi, 'weixinAccount').mockResolvedValue(boundAccount);
    const hook = renderHook(() => useWeixinRemoteController());

    await act(() => hook.result.current.startLogin());
    await waitFor(() => expect(appState.weixinLoginAttempt?.state).toBe('verificationRequired'));

    await act(() => hook.result.current.submitVerification('123456'));
    await waitFor(() => expect(appState.weixinLoginAttempt).toBeNull());

    expect(submit).toHaveBeenCalledWith('attempt/a', '123456', expect.any(AbortSignal));
    expect(appState.weixinAccount?.bound).toBe(true);
    expect(appState.toast?.message).toBe('微信绑定成功。');
  });

  it('rejects non-numeric verification locally', async () => {
    appState.weixinLoginAttempt = attempt('verificationRequired');
    const submit = vi.spyOn(codeApi, 'submitWeixinVerification');
    const hook = renderHook(() => useWeixinRemoteController());

    await act(() => hook.result.current.submitVerification('12ab'));

    expect(submit).not.toHaveBeenCalled();
    expect(appState.weixinLoginError).toContain('1–12 位数字');
  });

  it('applies pause, resume, and local disconnect responses', async () => {
    appState.weixinAccount = boundAccount;
    vi.spyOn(codeApi, 'pauseWeixinAccount').mockResolvedValue({
      ...boundAccount,
      state: 'paused',
      monitorState: 'paused',
    });
    vi.spyOn(codeApi, 'resumeWeixinAccount').mockResolvedValue(boundAccount);
    vi.spyOn(codeApi, 'disconnectWeixinAccount').mockResolvedValue(unboundAccount);
    const hook = renderHook(() => useWeixinRemoteController());

    await act(() => hook.result.current.pause());
    expect(appState.weixinAccount?.monitorState).toBe('paused');
    await act(() => hook.result.current.resume());
    expect(appState.weixinAccount?.monitorState).toBe('running');
    await act(() => hook.result.current.disconnect());
    expect(appState.weixinAccount?.bound).toBe(false);
  });
});
