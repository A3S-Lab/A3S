import {
  AlertTriangle,
  Bot,
  CirclePause,
  CirclePlay,
  Clock3,
  Eye,
  Link2,
  LoaderCircle,
  MessageCircleMore,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Trash2,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, Dialog, InlineNotice, PageHeader, StateView, StatusBadge } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type {
  RemoteEvidenceConfidence,
  RemoteTarget,
  RemoteTargetKind,
  RemoteTargetSnapshot,
  RemoteTargetState,
  WeixinAccount,
  WeixinMonitorState,
  WeixinProtocolMode,
  WeixinRemoteScope,
} from '../../../types/api';
import { WeixinLoginDialog } from '../components/weixin-login-dialog';
import type { WeixinRemoteActions } from '../use-weixin-remote-controller';
import type { WeixinRemoteOperation, WeixinTargetsLoadStatus } from '../weixin-remote-state';

export function WeixinRemotePage({ actions, embedded = false }: { actions: WeixinRemoteActions; embedded?: boolean }) {
  const state = useSnapshot(appState);
  const [disconnectReviewOpen, setDisconnectReviewOpen] = useState(false);
  const capability = state.weixinCapability;
  const account = state.weixinAccount;
  const busy = state.weixinOperation !== 'idle';

  return (
    <section className={`weixin-remote-page${embedded ? ' is-settings' : ''}`} aria-label='微信远程管理'>
      {!embedded && (
        <PageHeader
          className='weixin-page-header'
          accent='green'
          icon={<MessageCircleMore size={18} />}
          title='微信远程管理'
          description='在微信私聊中安全了解 A3S 智能体状态，并逐步开放受控操作。'
          status={capability && <ProtocolBadge mode={capability.protocolMode} />}
        />
      )}

      <div className={embedded ? 'weixin-settings-body' : 'weixin-page-scroll'}>
        {state.weixinCapabilityStatus === 'loading' && !capability ? (
          <PageState
            icon={<LoaderCircle className='spin' size={24} />}
            title='正在检查微信能力'
            message='A3S 正在读取本机 Boot 的 iLink 能力与安全门禁。'
          />
        ) : state.weixinCapabilityStatus === 'error' ? (
          <PageState
            tone='danger'
            icon={<AlertTriangle size={24} />}
            title='无法读取微信能力'
            message={state.weixinCapabilityError ?? '微信远程管理接口暂时不可用。'}
            action={
              <Button tone='primary' onClick={() => void actions.refresh()}>
                <RefreshCw size={14} />
                重新检查
              </Button>
            }
          />
        ) : state.weixinCapabilityStatus === 'unavailable' || capability?.state === 'unavailable' ? (
          <UnavailableState
            error={state.weixinCapabilityError}
            blockers={capability?.releaseBlockers ?? []}
            onRefresh={actions.refresh}
          />
        ) : state.weixinAccountStatus === 'loading' && !account ? (
          <PageState
            icon={<LoaderCircle className='spin' size={24} />}
            title='正在读取绑定状态'
            message='正在确认本机是否已有微信绑定以及消息监控状态。'
          />
        ) : account ? (
          <div className='weixin-page-grid'>
            <AccountCard
              account={account}
              protocolMode={capability?.protocolMode ?? account.protocolMode}
              operation={state.weixinOperation}
              error={state.weixinAccountError}
              onBind={() => void actions.startLogin()}
              onPause={() => void actions.pause()}
              onResume={() => void actions.resume()}
              onDisconnect={() => setDisconnectReviewOpen(true)}
            />
            <TargetPreviewCard
              snapshot={state.weixinTargets as RemoteTargetSnapshot | null}
              status={state.weixinTargetsStatus}
              error={state.weixinTargetsError}
              onRefresh={actions.refreshTargets}
            />
            <SafetyCard scopes={[...(capability?.supportedScopes ?? [])]} mutationsEnabled={account.mutationsEnabled} />
            <ReleaseCard mode={capability?.protocolMode ?? account.protocolMode} />
          </div>
        ) : (
          <PageState
            tone='danger'
            icon={<AlertTriangle size={24} />}
            title='无法读取微信账户状态'
            message={state.weixinAccountError ?? '本机微信账户接口没有返回状态。'}
            action={
              <Button tone='primary' onClick={() => void actions.refresh()}>
                <RefreshCw size={14} />
                重试
              </Button>
            }
          />
        )}
      </div>

      <WeixinLoginDialog actions={actions} />
      {disconnectReviewOpen && account?.bound && (
        <Dialog
          title='删除本机微信绑定？'
          description='这是本机清理操作，不会宣称撤销微信服务端的授权。'
          className='weixin-disconnect-dialog'
          closeDisabled={state.weixinOperation === 'disconnecting'}
          onClose={() => setDisconnectReviewOpen(false)}
          footer={
            <>
              <Button disabled={busy} onClick={() => setDisconnectReviewOpen(false)}>
                取消
              </Button>
              <Button
                tone='danger'
                loading={state.weixinOperation === 'disconnecting'}
                onClick={async () => {
                  await actions.disconnect();
                  if (!appState.weixinAccount?.bound) setDisconnectReviewOpen(false);
                }}
              >
                <Trash2 size={14} />
                删除本机绑定
              </Button>
            </>
          }
        >
          <div className='weixin-disconnect-review'>
            <ShieldX size={22} />
            <div>
              <strong>消息监控会立即停止</strong>
              <p>本机保存的凭据和运行游标将被清除。再次使用时需要重新扫码绑定。</p>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

const TARGET_PREVIEW_LIMIT = 12;

function TargetPreviewCard({
  snapshot,
  status,
  error,
  onRefresh,
}: {
  snapshot: RemoteTargetSnapshot | null;
  status: WeixinTargetsLoadStatus;
  error: string | null;
  onRefresh: () => Promise<void>;
}) {
  const targets = snapshot?.items.slice(0, TARGET_PREVIEW_LIMIT) ?? [];
  const staleWithError = Boolean(snapshot && status === 'error');

  return (
    <article className='weixin-card weixin-targets-card'>
      <header>
        <div>
          <span className='connected'>
            <Bot size={18} />
          </span>
          <div>
            <h2>远程可见目标</h2>
            <p>微信“智能体”指令只会看到以下脱敏投影，不会暴露会话 ID、PID 或完整路径。</p>
          </div>
        </div>
        <Button loading={status === 'loading'} aria-label='刷新远程目标' onClick={() => void onRefresh()}>
          <RefreshCw size={13} />
          刷新
        </Button>
      </header>

      {status === 'loading' && !snapshot ? (
        <StateView
          className='weixin-targets-state'
          size='compact'
          role='status'
          icon={<LoaderCircle className='spin' size={18} />}
          title='正在汇总管理会话、精确心跳和进程证据…'
        />
      ) : (status === 'error' || status === 'unavailable') && !snapshot ? (
        <StateView
          className='weixin-targets-state'
          size='compact'
          tone='warning'
          role={status === 'error' ? 'alert' : 'status'}
          icon={<AlertTriangle size={18} />}
          title={status === 'unavailable' ? '当前 Boot 暂不支持目标预览' : '目标预览暂时不可用'}
          description={error ?? 'A3S 无法读取远程可见目标。'}
        />
      ) : snapshot ? (
        <>
          <section className='weixin-target-summary' aria-label='远程目标统计'>
            <span>
              管理会话 <strong>{snapshot.totals.managed}</strong>
            </span>
            <span>
              协作智能体 <strong>{snapshot.totals.cooperative}</strong>
            </span>
            <span>
              观察进程 <strong>{snapshot.totals.observed}</strong>
            </span>
            <time dateTime={epochDateTime(snapshot.generatedAtMs)}>{formatEpochTimestamp(snapshot.generatedAtMs)}</time>
          </section>
          {(snapshot.degraded || staleWithError) && (
            <InlineNotice
              className='weixin-targets-warning'
              tone='warning'
              role='status'
              icon={<AlertTriangle size={15} />}
            >
              {staleWithError
                ? `刷新失败，当前显示上次快照。${error ? ` ${error}` : ''}`
                : snapshot.warnings.map(remoteWarningLabel).join('；') || '部分目标证据暂时不可用。'}
            </InlineNotice>
          )}
          {targets.length ? (
            <div className='weixin-target-list'>
              {targets.map((target) => (
                <RemoteTargetRow key={target.id} target={target} isChild={Boolean(target.parentId)} />
              ))}
            </div>
          ) : (
            <StateView
              className='weixin-targets-state'
              size='compact'
              icon={<Bot size={18} />}
              title='当前没有远程可见的 A3S 会话、协作智能体或观察进程。'
            />
          )}
          {snapshot.items.length > TARGET_PREVIEW_LIMIT && (
            <p className='weixin-target-limit'>仅显示前 {TARGET_PREVIEW_LIMIT} 个目标；微信端同样使用有界列表。</p>
          )}
        </>
      ) : (
        <StateView
          className='weixin-targets-state'
          size='compact'
          icon={<Bot size={18} />}
          title='打开此页面后将读取本机的远程可见目标'
        />
      )}
    </article>
  );
}

function RemoteTargetRow({ target, isChild }: { target: RemoteTarget; isChild: boolean }) {
  const presentation = remoteStatePresentation(target.state, target.attention);
  const Icon = target.kind === 'observedProcess' ? Eye : Bot;
  const progress = target.progress;

  return (
    <article className={`weixin-target-row ${target.kind}${isChild ? ' child' : ''}`}>
      <span className='weixin-target-kind-icon'>
        <Icon size={16} />
      </span>
      <div className='weixin-target-main'>
        <header>
          <strong>{target.displayName}</strong>
          <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>
        </header>
        <div className='weixin-target-evidence'>
          <span>{isChild ? '托管子智能体' : remoteKindLabel(target.kind)}</span>
          <span>{remoteConfidenceLabel(target.confidence)}</span>
          {target.workspaceAlias && <span>工作区：{target.workspaceAlias}</span>}
          {target.kind === 'observedProcess' && <span className='read-only'>只读 · 执行状态未知</span>}
        </div>
        {progress?.goalSummary && <p>{progress.goalSummary}</p>}
        {progress && (
          <div className='weixin-target-progress'>
            {progress.percent !== undefined && (
              <span>
                进度 {progress.percent}%
                {progress.totalSteps > 0 ? ` · ${progress.completedSteps}/${progress.totalSteps} 步` : ''}
              </span>
            )}
            <span>
              {progress.activeTurn ? '正在执行' : '当前无活动回合'} · 待处理 {progress.pendingTurns}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

function AccountCard({
  account,
  protocolMode,
  operation,
  error,
  onBind,
  onPause,
  onResume,
  onDisconnect,
}: {
  account: WeixinAccount;
  protocolMode: WeixinProtocolMode;
  operation: WeixinRemoteOperation;
  error: string | null;
  onBind: () => void;
  onPause: () => void;
  onResume: () => void;
  onDisconnect: () => void;
}) {
  const monitor = monitorPresentation(account.monitorState);
  const busy = operation !== 'idle';

  return (
    <article className='weixin-card weixin-account-card'>
      <header>
        <div>
          <span className={account.bound ? 'connected' : undefined}>
            {account.bound ? <ShieldCheck size={18} /> : <Link2 size={18} />}
          </span>
          <div>
            <h2>{account.bound ? '已绑定微信' : '尚未绑定微信'}</h2>
            <p>
              {account.bound ? account.ownerLabel || '已绑定的微信 Owner' : '扫码后仅允许一个 Owner 私聊本机 A3S。'}
            </p>
          </div>
        </div>
        <StatusBadge tone={account.bound ? monitor.tone : 'neutral'}>
          {account.bound ? monitor.label : '未连接'}
        </StatusBadge>
      </header>

      {account.bound ? (
        <>
          <dl className='weixin-account-facts'>
            <div>
              <dt>消息监控</dt>
              <dd>{monitor.description}</dd>
            </div>
            <div>
              <dt>最近更新</dt>
              <dd>
                <Clock3 size={13} />
                {formatTimestamp(account.lastUpdateAt)}
              </dd>
            </div>
            <div>
              <dt>运行模式</dt>
              <dd>{protocolModeLabel(protocolMode)}</dd>
            </div>
          </dl>
          {account.lastError && (
            <InlineNotice
              className='weixin-inline-notice'
              tone='danger'
              role='alert'
              icon={<AlertTriangle size={16} />}
              title='消息监控需要处理'
            >
              {safeBlockerMessage(account.lastError.code, account.lastError.message)}
            </InlineNotice>
          )}
          {error && (
            <InlineNotice
              className='weixin-inline-notice'
              tone='danger'
              role='alert'
              icon={<AlertTriangle size={16} />}
              title='操作失败'
            >
              {error}
            </InlineNotice>
          )}
          <div className='weixin-card-actions'>
            {account.monitorState === 'paused' || account.monitorState === 'stopped' ? (
              <Button tone='primary' loading={operation === 'resuming'} disabled={busy} onClick={onResume}>
                <CirclePlay size={14} />
                恢复监控
              </Button>
            ) : account.monitorState !== 'staleCredential' && account.monitorState !== 'disabled' ? (
              <Button loading={operation === 'pausing'} disabled={busy} onClick={onPause}>
                <CirclePause size={14} />
                暂停监控
              </Button>
            ) : null}
            <Button tone='danger' disabled={busy} onClick={onDisconnect}>
              <Trash2 size={14} />
              删除本机绑定
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className='weixin-unbound-copy'>
            <p>绑定凭据只保存在当前机器。二维码过期、验证码失败或页面关闭都不会留下半完成授权。</p>
          </div>
          {error && (
            <InlineNotice className='weixin-inline-notice' tone='danger' role='alert' title='操作失败'>
              {error}
            </InlineNotice>
          )}
          <div className='weixin-card-actions'>
            <Button tone='primary' loading={operation === 'startingLogin'} disabled={busy} onClick={onBind}>
              <MessageCircleMore size={14} />
              扫码绑定
            </Button>
          </div>
        </>
      )}
    </article>
  );
}

function SafetyCard({ scopes, mutationsEnabled }: { scopes: WeixinRemoteScope[]; mutationsEnabled: boolean }) {
  return (
    <article className='weixin-card weixin-safety-card'>
      <header>
        <div>
          <span className='connected'>
            <ShieldCheck size={18} />
          </span>
          <div>
            <h2>当前安全边界</h2>
            <p>远程能力按类型开放，不接收任意命令或进程信号。</p>
          </div>
        </div>
      </header>
      <ul>
        <li>
          <CheckLine />
          仅接受绑定 Owner 的一对一文字消息
        </li>
        <li>
          <CheckLine />
          进程观察始终只读，不提供 Shell、PID 信号或群聊控制
        </li>
        <li>
          <CheckLine />
          令牌、游标、Owner 原始 ID 和 iLink 地址不会进入 Web
        </li>
      </ul>
      <div className='weixin-scope-summary'>
        <span>已开放远程范围</span>
        <strong>{scopes.length ? scopes.map(scopeLabel).join('、') : '暂无'}</strong>
        <StatusBadge tone={mutationsEnabled ? 'warning' : 'neutral'}>
          {mutationsEnabled ? '变更已启用' : '变更未启用'}
        </StatusBadge>
      </div>
    </article>
  );
}

function ReleaseCard({ mode }: { mode: WeixinProtocolMode }) {
  return (
    <article className='weixin-card weixin-release-card'>
      <header>
        <div>
          <span>
            <MessageCircleMore size={18} />
          </span>
          <div>
            <h2>{mode === 'mock' ? '本地联调只读 Beta' : '分阶段开放'}</h2>
            <p>{mode === 'mock' ? 'Mock 模式不会向腾讯发起网络请求。' : '当前版本先验证绑定与消息链路。'}</p>
          </div>
        </div>
      </header>
      <ol>
        <li>
          <strong>当前</strong>
          <span>扫码绑定、监控启停、智能体与会话状态查询</span>
        </li>
        <li>
          <strong>下一阶段</strong>
          <span>本机范围策略、二次确认与可审计的会话操作</span>
        </li>
        <li>
          <strong>确认后</strong>
          <span>回复消息、创建会话及可恢复归档</span>
        </li>
      </ol>
    </article>
  );
}

function UnavailableState({
  error,
  blockers,
  onRefresh,
}: {
  error: string | null;
  blockers: readonly { code: string; message: string }[];
  onRefresh: () => Promise<void>;
}) {
  return (
    <StateView
      className='weixin-page-state weixin-unavailable'
      tone='warning'
      role='status'
      icon={<ShieldX size={28} />}
      title='微信渠道尚未就绪'
      description={error ?? '内置 iLink 渠道被显式关闭，或本机安全存储与运行时初始化失败。'}
      actions={
        <Button onClick={() => void onRefresh()}>
          <RefreshCw size={14} />
          重新检查
        </Button>
      }
    >
      {blockers.length > 0 && (
        <ul className='weixin-unavailable-blockers'>
          {blockers.map((blocker) => (
            <li key={blocker.code}>{safeBlockerMessage(blocker.code, blocker.message)}</li>
          ))}
        </ul>
      )}
      <InlineNotice className='weixin-unavailable-note' tone='success' role='note' icon={<ShieldCheck size={16} />}>
        未就绪状态不会创建二维码、保存凭据、启动监控或连接腾讯。
      </InlineNotice>
    </StateView>
  );
}

function PageState({
  icon,
  title,
  message,
  action,
  tone = 'info',
}: {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
  tone?: 'info' | 'danger';
}) {
  return (
    <StateView
      className='weixin-page-state'
      tone={tone}
      role={tone === 'danger' ? 'alert' : 'status'}
      icon={icon}
      title={title}
      description={message}
      actions={action}
    />
  );
}

function ProtocolBadge({ mode }: { mode: WeixinProtocolMode }) {
  return (
    <StatusBadge tone={mode === 'mock' ? 'warning' : mode === 'tencent' ? 'success' : 'neutral'}>
      {protocolModeLabel(mode)}
    </StatusBadge>
  );
}

function CheckLine() {
  return <ShieldCheck size={14} aria-hidden='true' />;
}

function monitorPresentation(state: WeixinMonitorState): {
  label: string;
  description: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
} {
  switch (state) {
    case 'running':
      return { label: '运行中', description: '正在等待绑定 Owner 的私聊消息', tone: 'success' };
    case 'starting':
      return { label: '启动中', description: '正在建立安全的消息长轮询', tone: 'info' };
    case 'paused':
      return { label: '已暂停', description: '不会接收或回复新的微信消息', tone: 'neutral' };
    case 'degraded':
      return { label: '服务降级', description: '链路异常，需检查错误后再继续', tone: 'warning' };
    case 'staleCredential':
      return { label: '凭据失效', description: '需要删除本机绑定并重新扫码', tone: 'danger' };
    case 'disabled':
      return { label: '未启用', description: '当前运行时没有消息监控能力', tone: 'neutral' };
    case 'stopped':
      return { label: '已停止', description: '消息监控尚未启动', tone: 'neutral' };
  }
}

function protocolModeLabel(mode: WeixinProtocolMode): string {
  if (mode === 'mock') return '本地 Mock';
  if (mode === 'tencent') return '腾讯 iLink';
  return '已禁用';
}

function formatTimestamp(value?: string | null): string {
  if (!value) return '尚未收到更新';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatEpochTimestamp(value: number): string {
  const date = new Date(value);
  if (!Number.isFinite(value) || Number.isNaN(date.getTime())) return '快照时间未知';
  return `更新于 ${new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)}`;
}

function epochDateTime(value: number): string {
  const date = new Date(value);
  return !Number.isFinite(value) || Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function remoteKindLabel(kind: RemoteTargetKind): string {
  const labels: Record<RemoteTargetKind, string> = {
    managedSession: 'A3S 管理会话',
    cooperativeAgent: '协作智能体',
    observedProcess: '观察进程',
  };
  return labels[kind];
}

function remoteConfidenceLabel(confidence: RemoteEvidenceConfidence): string {
  const labels: Record<RemoteEvidenceConfidence, string> = {
    authoritative: 'A3S 管理状态',
    exact: 'A3S 精确心跳',
    process: '进程推断',
  };
  return labels[confidence];
}

function remoteStatePresentation(
  state: RemoteTargetState,
  attention: RemoteTarget['attention']
): {
  label: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
} {
  const labels: Record<RemoteTargetState, string> = {
    planning: '规划中',
    working: '执行中',
    waitingApproval: '等待批准',
    waitingInput: '等待输入',
    queued: '排队中',
    paused: '已暂停',
    idle: '空闲',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    detected: '已检测',
    unknown: '未知',
  };
  const tone =
    attention === 'error'
      ? 'danger'
      : attention === 'actionRequired'
        ? 'warning'
        : state === 'working' || state === 'planning'
          ? 'info'
          : state === 'completed'
            ? 'success'
            : 'neutral';
  return { label: labels[state], tone };
}

function remoteWarningLabel(warning: string): string {
  const labels: Record<string, string> = {
    system_agent_evidence_degraded: '部分协作智能体或进程证据暂时不可用。',
    remote_target_limit_reached: '目标数量超过安全上限，仅显示有界快照。',
    remote_read_disabled: '远程目标读取当前已关闭。',
  };
  return labels[warning] ?? '部分远程目标证据已降级。';
}

function safeBlockerMessage(code: string, fallback: string): string {
  const known: Record<string, string> = {
    ilink_channel_unavailable: '当前运行时未启用内置微信 iLink 渠道。',
    ilink_channel_disabled: '微信渠道已在本机配置中显式关闭。',
    ilink_configuration_invalid: '本机微信渠道开关配置无效。',
    ilink_configuration_unreadable: '无法读取本机微信渠道配置。',
    ilink_state_path_unavailable: '无法安全解析微信渠道状态目录。',
    ilink_runtime_storage_unavailable: '无法安全打开微信渠道运行状态。',
    ilink_credential_storage_unavailable: '无法安全打开微信渠道凭据存储。',
    mock_runtime_only: '当前仅启用本地 Mock 运行时。',
    network: '无法连接微信服务，请检查网络后重试。',
    upstream: '微信上游服务暂时不可用。',
    protocol: '微信协议响应发生变化，A3S 已停止处理。',
    storage: '本机安全存储发生错误。',
    stale_credential: '微信凭据已经失效，请重新绑定。',
    shutdown: '消息监控未能正常停止。',
  };
  return known[code] ?? fallback;
}

function scopeLabel(scope: WeixinRemoteScope): string {
  const labels: Record<WeixinRemoteScope, string> = {
    'agents.read': '智能体状态',
    'sessions.read': '会话列表',
    'sessions.content.read': '会话内容',
    'sessions.message.write': '回复消息',
    'sessions.create': '创建会话',
    'sessions.archive': '归档会话',
  };
  return labels[scope];
}
