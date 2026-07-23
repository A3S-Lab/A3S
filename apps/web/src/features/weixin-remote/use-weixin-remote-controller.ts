import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { ApiError, codeApi } from '../../lib/api';
import { appState, formatApiError, showToast } from '../../state/app-state';
import type { WeixinAccount, WeixinLoginState } from '../../types/api';

const ACCOUNT_REFRESH_INTERVAL_MS = 5_000;
const LOGIN_POLL_DELAY_MS = 350;
const TERMINAL_LOGIN_STATES: ReadonlySet<WeixinLoginState> = new Set([
  'connected',
  'alreadyBound',
  'expired',
  'verificationBlocked',
]);

export interface WeixinRemoteActions {
  refresh: () => Promise<void>;
  refreshTargets: () => Promise<void>;
  startLogin: (force?: boolean) => Promise<boolean>;
  submitVerification: (code: string) => Promise<boolean>;
  retryLoginPolling: () => void;
  cancelLogin: () => Promise<void>;
  dismissLogin: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useWeixinRemoteController(): WeixinRemoteActions {
  const shell = useSnapshot(appState);
  const refreshSequence = useRef(0);
  const refreshAbort = useRef<AbortController | null>(null);
  const pollSequence = useRef(0);
  const pollAbort = useRef<AbortController | null>(null);
  const mutationAbort = useRef<AbortController | null>(null);

  const applyAccount = useMemoizedFn((account: WeixinAccount) => {
    appState.weixinAccount = account;
    appState.weixinAccountStatus = 'ready';
    appState.weixinAccountError = null;
    if (appState.weixinCapability) {
      appState.weixinCapability = { ...appState.weixinCapability, state: account.state };
    }
  });

  const refreshAccount = useMemoizedFn(async (silent = false, signal?: AbortSignal) => {
    if (!silent || !appState.weixinAccount) appState.weixinAccountStatus = 'loading';
    appState.weixinAccountError = null;
    try {
      applyAccount(await codeApi.weixinAccount(signal));
    } catch (error) {
      if (isAbortError(error)) return;
      appState.weixinAccountStatus = 'error';
      appState.weixinAccountError = formatApiError(error);
    }
  });

  const refreshTargets = useMemoizedFn(async (silent = false, signal?: AbortSignal) => {
    if (!silent || !appState.weixinTargets) appState.weixinTargetsStatus = 'loading';
    appState.weixinTargetsError = null;
    try {
      appState.weixinTargets = await codeApi.weixinTargets(signal);
      appState.weixinTargetsStatus = 'ready';
    } catch (error) {
      if (isAbortError(error)) return;
      if (error instanceof ApiError && error.status === 404) {
        appState.weixinTargets = null;
        appState.weixinTargetsStatus = 'unavailable';
        appState.weixinTargetsError = '当前 A3S Boot 版本尚未提供远程目标预览。';
        return;
      }
      appState.weixinTargetsStatus = 'error';
      appState.weixinTargetsError = formatApiError(error);
    }
  });

  const refresh = useMemoizedFn(async () => {
    refreshAbort.current?.abort();
    const controller = new AbortController();
    refreshAbort.current = controller;
    const request = ++refreshSequence.current;
    appState.weixinCapabilityStatus = 'loading';
    appState.weixinCapabilityError = null;
    try {
      const capability = await codeApi.weixinCapability(controller.signal);
      if (controller.signal.aborted || request !== refreshSequence.current) return;
      appState.weixinCapability = capability;
      if (capability.state === 'unavailable' || capability.protocolMode === 'disabled') {
        appState.weixinCapabilityStatus = 'unavailable';
        appState.weixinAccount = null;
        appState.weixinAccountStatus = 'idle';
        appState.weixinAccountError = null;
        appState.weixinTargets = null;
        appState.weixinTargetsStatus = 'idle';
        appState.weixinTargetsError = null;
        return;
      }
      appState.weixinCapabilityStatus = 'ready';
      await Promise.all([refreshAccount(false, controller.signal), refreshTargets(false, controller.signal)]);
    } catch (error) {
      if (controller.signal.aborted || request !== refreshSequence.current || isAbortError(error)) return;
      appState.weixinAccount = null;
      appState.weixinAccountStatus = 'idle';
      appState.weixinAccountError = null;
      appState.weixinTargets = null;
      appState.weixinTargetsStatus = 'idle';
      appState.weixinTargetsError = null;
      if (error instanceof ApiError && error.status === 404) {
        appState.weixinCapability = null;
        appState.weixinCapabilityStatus = 'unavailable';
        appState.weixinCapabilityError = '当前 A3S Boot 版本未提供微信远程管理接口。';
        return;
      }
      appState.weixinCapabilityStatus = 'error';
      appState.weixinCapabilityError = formatApiError(error);
    }
  });

  const pollLogin = useMemoizedFn((attemptId: string) => {
    pollAbort.current?.abort();
    const controller = new AbortController();
    pollAbort.current = controller;
    const request = ++pollSequence.current;
    appState.weixinLoginPolling = true;
    appState.weixinLoginError = null;

    void (async () => {
      try {
        while (!controller.signal.aborted && request === pollSequence.current) {
          const attempt = await codeApi.pollWeixinLogin(attemptId, controller.signal);
          if (controller.signal.aborted || request !== pollSequence.current) return;
          if (appState.weixinLoginAttempt?.attemptId !== attemptId) return;
          appState.weixinLoginAttempt = attempt;

          if (attempt.state === 'connected' || attempt.state === 'alreadyBound') {
            appState.weixinLoginPolling = false;
            appState.weixinLoginAttempt = null;
            await refreshAccount(false, controller.signal);
            if (!controller.signal.aborted) {
              showToast(attempt.state === 'alreadyBound' ? '已恢复本机原有的微信绑定。' : '微信绑定成功。', 'success');
            }
            return;
          }
          if (attempt.state === 'verificationRequired' || TERMINAL_LOGIN_STATES.has(attempt.state)) {
            appState.weixinLoginPolling = false;
            return;
          }
          await pollDelay(controller.signal);
        }
      } catch (error) {
        if (controller.signal.aborted || request !== pollSequence.current || isAbortError(error)) return;
        appState.weixinLoginPolling = false;
        appState.weixinLoginError = formatApiError(error);
      }
    })();
  });

  const startLogin = useMemoizedFn(async (force = false): Promise<boolean> => {
    if (appState.weixinOperation !== 'idle') return false;
    pollAbort.current?.abort();
    pollSequence.current += 1;
    mutationAbort.current?.abort();
    const controller = new AbortController();
    mutationAbort.current = controller;
    appState.weixinOperation = 'startingLogin';
    appState.weixinLoginError = null;
    try {
      const attempt = await codeApi.startWeixinLogin(force, controller.signal);
      if (controller.signal.aborted) return false;
      appState.weixinLoginAttempt = attempt;
      appState.weixinOperation = 'idle';
      pollLogin(attempt.attemptId);
      return true;
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return false;
      appState.weixinOperation = 'idle';
      appState.weixinLoginError = formatApiError(error);
      return false;
    }
  });

  const submitVerification = useMemoizedFn(async (code: string): Promise<boolean> => {
    const attempt = appState.weixinLoginAttempt;
    if (!attempt || appState.weixinOperation !== 'idle') return false;
    if (!/^\d{1,12}$/.test(code)) {
      appState.weixinLoginError = '验证码只能包含 1–12 位数字。';
      return false;
    }
    mutationAbort.current?.abort();
    const controller = new AbortController();
    mutationAbort.current = controller;
    appState.weixinOperation = 'submittingVerification';
    appState.weixinLoginError = null;
    try {
      const updated = await codeApi.submitWeixinVerification(attempt.attemptId, code, controller.signal);
      if (controller.signal.aborted || appState.weixinLoginAttempt?.attemptId !== attempt.attemptId) return false;
      appState.weixinLoginAttempt = updated;
      appState.weixinOperation = 'idle';
      pollLogin(attempt.attemptId);
      return true;
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return false;
      appState.weixinOperation = 'idle';
      appState.weixinLoginError = formatApiError(error);
      return false;
    }
  });

  const dismissLogin = useMemoizedFn(() => {
    pollAbort.current?.abort();
    pollSequence.current += 1;
    appState.weixinLoginAttempt = null;
    appState.weixinLoginPolling = false;
    appState.weixinLoginError = null;
  });

  const cancelLogin = useMemoizedFn(async () => {
    const attempt = appState.weixinLoginAttempt;
    if (!attempt) return;
    if (TERMINAL_LOGIN_STATES.has(attempt.state)) {
      dismissLogin();
      return;
    }
    pollAbort.current?.abort();
    pollSequence.current += 1;
    mutationAbort.current?.abort();
    const controller = new AbortController();
    mutationAbort.current = controller;
    appState.weixinLoginPolling = false;
    appState.weixinOperation = 'cancellingLogin';
    appState.weixinLoginError = null;
    try {
      const account = await codeApi.cancelWeixinLogin(attempt.attemptId, controller.signal);
      if (controller.signal.aborted) return;
      applyAccount(account);
      appState.weixinLoginAttempt = null;
      appState.weixinOperation = 'idle';
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      if (error instanceof ApiError && error.status === 404) {
        appState.weixinLoginAttempt = null;
        appState.weixinOperation = 'idle';
        await refreshAccount(true);
        return;
      }
      appState.weixinOperation = 'idle';
      appState.weixinLoginError = formatApiError(error);
    }
  });

  const runAccountMutation = useMemoizedFn(
    async (
      operation: 'pausing' | 'resuming' | 'disconnecting',
      request: (signal: AbortSignal) => Promise<WeixinAccount>,
      successMessage: string
    ) => {
      if (appState.weixinOperation !== 'idle') return;
      mutationAbort.current?.abort();
      const controller = new AbortController();
      mutationAbort.current = controller;
      appState.weixinOperation = operation;
      appState.weixinAccountError = null;
      try {
        const account = await request(controller.signal);
        if (controller.signal.aborted) return;
        applyAccount(account);
        if (operation === 'disconnecting') dismissLogin();
        appState.weixinOperation = 'idle';
        showToast(successMessage, 'success');
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        appState.weixinOperation = 'idle';
        appState.weixinAccountError = formatApiError(error);
      }
    }
  );

  const pause = useMemoizedFn(async () => {
    await runAccountMutation('pausing', codeApi.pauseWeixinAccount, '微信消息监控已暂停。');
  });
  const resume = useMemoizedFn(async () => {
    await runAccountMutation('resuming', codeApi.resumeWeixinAccount, '微信消息监控已恢复。');
  });
  const disconnect = useMemoizedFn(async () => {
    await runAccountMutation('disconnecting', codeApi.disconnectWeixinAccount, '已删除本机保存的微信绑定。');
  });
  const retryLoginPolling = useMemoizedFn(() => {
    const attempt = appState.weixinLoginAttempt;
    if (attempt && !TERMINAL_LOGIN_STATES.has(attempt.state)) pollLogin(attempt.attemptId);
  });

  useEffect(() => {
    if (
      shell.bootPhase === 'ready' &&
      shell.settingsOpen &&
      shell.settingsTab === 'channels' &&
      shell.settingsChannel === 'weixin' &&
      appState.weixinCapabilityStatus === 'idle'
    ) {
      void refresh();
    }
  }, [refresh, shell.bootPhase, shell.settingsChannel, shell.settingsOpen, shell.settingsTab]);

  useEffect(() => {
    if (
      shell.bootPhase !== 'ready' ||
      !shell.settingsOpen ||
      shell.settingsTab !== 'channels' ||
      shell.settingsChannel !== 'weixin' ||
      appState.weixinCapabilityStatus !== 'ready' ||
      !appState.weixinAccount?.bound
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void Promise.all([refreshAccount(true), refreshTargets(true)]);
    }, ACCOUNT_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [
    refreshAccount,
    refreshTargets,
    shell.bootPhase,
    shell.settingsChannel,
    shell.settingsOpen,
    shell.settingsTab,
    shell.weixinAccount?.bound,
    shell.weixinCapabilityStatus,
  ]);

  useEffect(
    () => () => {
      refreshAbort.current?.abort();
      pollAbort.current?.abort();
      mutationAbort.current?.abort();
    },
    []
  );

  return {
    refresh,
    refreshTargets: async () => refreshTargets(false),
    startLogin,
    submitVerification,
    retryLoginPolling,
    cancelLogin,
    dismissLogin,
    pause,
    resume,
    disconnect,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function pollDelay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, LOGIN_POLL_DELAY_MS);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}
