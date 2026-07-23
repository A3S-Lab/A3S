import type { RemoteTargetSnapshot, WeixinAccount, WeixinCapability, WeixinLoginAttempt } from '../../types/api';

export type WeixinCapabilityLoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
export type WeixinAccountLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type WeixinTargetsLoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
export type WeixinRemoteOperation =
  | 'idle'
  | 'startingLogin'
  | 'submittingVerification'
  | 'cancellingLogin'
  | 'pausing'
  | 'resuming'
  | 'disconnecting';

export interface WeixinRemoteState {
  weixinCapability: WeixinCapability | null;
  weixinCapabilityStatus: WeixinCapabilityLoadStatus;
  weixinCapabilityError: string | null;
  weixinAccount: WeixinAccount | null;
  weixinAccountStatus: WeixinAccountLoadStatus;
  weixinAccountError: string | null;
  weixinTargets: RemoteTargetSnapshot | null;
  weixinTargetsStatus: WeixinTargetsLoadStatus;
  weixinTargetsError: string | null;
  weixinLoginAttempt: WeixinLoginAttempt | null;
  weixinLoginPolling: boolean;
  weixinLoginError: string | null;
  weixinOperation: WeixinRemoteOperation;
}

export function createWeixinRemoteState(): WeixinRemoteState {
  return {
    weixinCapability: null,
    weixinCapabilityStatus: 'idle',
    weixinCapabilityError: null,
    weixinAccount: null,
    weixinAccountStatus: 'idle',
    weixinAccountError: null,
    weixinTargets: null,
    weixinTargetsStatus: 'idle',
    weixinTargetsError: null,
    weixinLoginAttempt: null,
    weixinLoginPolling: false,
    weixinLoginError: null,
    weixinOperation: 'idle',
  };
}
