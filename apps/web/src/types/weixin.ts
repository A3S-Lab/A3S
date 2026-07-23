export type WeixinCapabilityState =
  | 'unavailable'
  | 'unbound'
  | 'binding'
  | 'active'
  | 'paused'
  | 'degraded'
  | 'staleCredential';

export type WeixinProtocolMode = 'disabled' | 'mock' | 'tencent';

export type WeixinRemoteScope =
  | 'agents.read'
  | 'sessions.read'
  | 'sessions.content.read'
  | 'sessions.message.write'
  | 'sessions.create'
  | 'sessions.archive';

export interface WeixinSafeBlocker {
  code: string;
  message: string;
}

export interface WeixinCapability {
  schemaVersion: number;
  state: WeixinCapabilityState;
  protocolMode: WeixinProtocolMode;
  supportedScopes: WeixinRemoteScope[];
  releaseBlockers: WeixinSafeBlocker[];
}

export type WeixinMonitorState =
  | 'disabled'
  | 'stopped'
  | 'starting'
  | 'paused'
  | 'running'
  | 'degraded'
  | 'staleCredential';

export interface WeixinAccount {
  schemaVersion: number;
  state: WeixinCapabilityState;
  protocolMode: WeixinProtocolMode;
  bound: boolean;
  ownerLabel?: string | null;
  monitorState: WeixinMonitorState;
  mutationsEnabled: boolean;
  lastUpdateAt?: string | null;
  lastError?: WeixinSafeBlocker | null;
}

export type WeixinLoginState =
  | 'waitingForScan'
  | 'scanned'
  | 'verificationRequired'
  | 'verificationSubmitted'
  | 'redirected'
  | 'connected'
  | 'alreadyBound'
  | 'expired'
  | 'verificationBlocked';

/**
 * A sanitized, in-memory login snapshot. qrContent is the sole ephemeral
 * protocol value allowed across the local REST boundary and must not be
 * persisted in browser storage.
 */
export interface WeixinLoginAttempt {
  schemaVersion: number;
  attemptId: string;
  state: WeixinLoginState;
  qrContent?: string | null;
  expiresInSeconds: number;
  verifySubmissions: number;
}

export type RemoteTargetKind = 'managedSession' | 'cooperativeAgent' | 'observedProcess';

export type RemoteEvidenceConfidence = 'authoritative' | 'exact' | 'process';

export type RemoteTargetState =
  | 'planning'
  | 'working'
  | 'waitingApproval'
  | 'waitingInput'
  | 'queued'
  | 'paused'
  | 'idle'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'detected'
  | 'unknown';

export type RemoteAttention = 'none' | 'actionRequired' | 'error';

export type RemoteCapability =
  | 'readStatus'
  | 'readChildren'
  | 'readSafeReply'
  | 'sendMessage'
  | 'createSession'
  | 'archiveSession'
  | 'stop'
  | 'cancel'
  | 'reply'
  | 'approveOnce'
  | 'deny';

export interface RemoteProgress {
  goalSummary?: string;
  percent?: number;
  completedSteps: number;
  totalSteps: number;
  pendingTurns: number;
  activeTurn: boolean;
}

export interface RemoteTarget {
  id: string;
  kind: RemoteTargetKind;
  displayName: string;
  workspaceAlias?: string;
  state: RemoteTargetState;
  stateDetail: string;
  confidence: RemoteEvidenceConfidence;
  attention: RemoteAttention;
  evidenceAtMs: number;
  parentId?: string;
  capabilities: RemoteCapability[];
  progress?: RemoteProgress;
}

export interface RemoteTargetSnapshot {
  schemaVersion: number;
  generatedAtMs: number;
  degraded: boolean;
  warnings: string[];
  totals: {
    managed: number;
    cooperative: number;
    observed: number;
  };
  items: RemoteTarget[];
}
