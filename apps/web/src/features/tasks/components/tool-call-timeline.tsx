import { ArrowDown, Braces, FileDiff } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button } from '../../../design-system/primitives';
import { appendTaskInstruction, appState, navigateTask } from '../../../state/app-state';
import { workspaceAbsolutePath } from '../../workspace/workspace-state';
import type { TaskActions } from '../task-actions';
import { CopyButton } from './conversation-message-actions';
import { PermissionDecision, type ToolDecisionState } from './permission-decision';
import {
  isFileEditCall,
  type ToolCallProjection,
  toolActionLabel,
  toolArgumentSummary,
  toolFilePath,
} from './tool-call-projection';
import {
  outputLineCount,
  ToolInvocationInline,
  ToolJsonPreview,
  ToolOutputPreview,
  toolOutputNeedsDisclosure,
} from './tool-command-preview';

export function ToolCallTimeline({
  calls,
  sessionId,
  actions,
}: {
  calls: ToolCallProjection[];
  sessionId: string;
  actions: TaskActions;
}) {
  if (!calls.length) return null;
  return (
    <section className='tool-call-stream' aria-label='工具调用'>
      {calls.map((call) => (
        <ToolCallItem key={call.id} call={call} sessionId={sessionId} actions={actions} />
      ))}
    </section>
  );
}

export function ToolCallItem({
  call,
  sessionId,
  actions,
}: {
  call: ToolCallProjection;
  sessionId: string;
  actions: TaskActions;
}) {
  const state = useSnapshot(appState);
  const decision = state.toolDecisionState[`${sessionId}:${call.id}`] as ToolDecisionState | undefined;
  const decisionError = state.toolDecisionErrors[`${sessionId}:${call.id}`];
  const target = toolArgumentSummary(call);
  const argumentsText =
    call.args && Object.keys(call.args).length ? JSON.stringify(call.args, null, 2) : call.inputText;
  const argumentDetailsAvailable = shouldShowArgumentDetails(call, argumentsText, target);
  const fileEdit = isFileEditCall(call);
  const cancelled = call.state === 'interrupted' && call.metadata?.cancelled === true;
  const reviewAvailable = fileEdit && call.state === 'succeeded';
  const filePath = toolFilePath(call);
  const running = call.state === 'preparing' || call.state === 'running';
  const outputNeedsDisclosure = Boolean(call.output && toolOutputNeedsDisclosure(call.output));
  const outcomeMessage = terminalOutcomeMessage(call);
  const showBody = Boolean(
    call.state === 'awaiting' ||
      call.output ||
      call.state === 'succeeded' ||
      outcomeMessage ||
      argumentDetailsAvailable ||
      reviewAvailable ||
      ['failed', 'denied', 'timed-out'].includes(call.state)
  );
  const eventMeta =
    call.state === 'succeeded'
      ? call.durationMs !== undefined
        ? formatDuration(call.durationMs)
        : null
      : call.state === 'awaiting'
        ? stateLabel(call.state)
        : null;

  const openReview = () => {
    appState.reviewSourceTaskId = sessionId;
    appState.reviewIntent = 'review';
    appState.gitStatus = null;
    if (!filePath) {
      navigateTask('review');
      return;
    }
    void actions.selectFile({
      path: workspaceAbsolutePath(filePath, appState.workspaceRoot),
      isBinary: false,
    });
  };

  return (
    <section
      className={`tool-call-item ${call.state}`}
      data-outcome={cancelled ? 'cancelled' : undefined}
      aria-label={`${toolActionLabel(call)}${target ? `，${target}` : ''}，${stateLabel(call.state)}`}
    >
      <header className='tool-call-event'>
        <span className='tool-call-status-dot' aria-hidden='true' />
        <span className='tool-call-title'>
          <strong>{toolActionLabel(call)}</strong>
          {target && (
            <small>
              <ToolInvocationInline call={call} fallback={target} />
            </small>
          )}
        </span>
        {eventMeta && <span className='tool-call-event-meta'>{eventMeta}</span>}
      </header>
      {showBody && (
        <div className='tool-call-body'>
          {call.state === 'awaiting' && (
            <PermissionDecision
              call={call}
              sessionId={sessionId}
              decision={decision}
              error={decisionError}
              actions={actions}
            />
          )}
          {call.output &&
            (running ? (
              <ToolCallResult call={call} />
            ) : (
              <ToolOutputPreview output={call.output} error={call.state === 'failed'} />
            ))}
          {!call.output && call.state === 'succeeded' && <ToolEmptyOutput />}
          {outcomeMessage && <p className={`tool-call-message ${call.state}`}>{outcomeMessage}</p>}
          {(argumentDetailsAvailable || outputNeedsDisclosure || reviewAvailable) && (
            <div className='tool-call-detail-actions'>
              {argumentDetailsAvailable && (
                <ToolInlineDisclosure className='tool-call-arguments' label='参数' icon={<Braces size={12} />}>
                  <ToolJsonPreview content={argumentsText} />
                </ToolInlineDisclosure>
              )}
              {outputNeedsDisclosure && (
                <ToolInlineDisclosure
                  className='tool-call-raw-output'
                  label={`完整输出 · ${outputLineCount(call.output)} 行`}
                >
                  <pre className={`tool-call-output ${call.state === 'failed' ? 'error' : ''}`}>{call.output}</pre>
                </ToolInlineDisclosure>
              )}
              {reviewAvailable && (
                <Button tone='secondary' onClick={openReview}>
                  <FileDiff size={14} />
                  打开文件
                </Button>
              )}
            </div>
          )}
          {['failed', 'denied', 'timed-out'].includes(call.state) && <ToolCallRecovery call={call} />}
        </div>
      )}
    </section>
  );
}

function ToolEmptyOutput() {
  return (
    <section className='tool-call-empty-output' aria-label='工具输出'>
      <span className='tool-output-connector' aria-hidden='true'>
        └
      </span>
      <span>(无输出)</span>
    </section>
  );
}

function ToolInlineDisclosure({
  className,
  label,
  icon,
  defaultOpen = false,
  children,
}: {
  className: string;
  label: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const previousDefaultOpen = useRef(defaultOpen);

  useEffect(() => {
    if (previousDefaultOpen.current !== defaultOpen) setOpen(defaultOpen);
    previousDefaultOpen.current = defaultOpen;
  }, [defaultOpen]);

  return (
    <div className={`${className} ${open ? 'open' : ''}`}>
      <button type='button' aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>
        {icon}
        {open ? `收起${label}` : label}
      </button>
      <div className='tool-call-inline-content' id={contentId} hidden={!open}>
        {open && children}
      </div>
    </div>
  );
}

function ToolCallResult({ call }: { call: ToolCallProjection }) {
  const outputRef = useRef<HTMLPreElement>(null);
  const [following, setFollowing] = useState(true);
  const running = call.state === 'running' || call.state === 'preparing';
  const lines = outputLineCount(call.output);

  useEffect(() => {
    const output = outputRef.current;
    if (running && following && output) output.scrollTop = output.scrollHeight;
  }, [call.output, following, running]);

  return (
    <section className='tool-call-result' aria-label='工具输出'>
      <header>
        <span>
          {running ? '实时输出' : '输出'} · {lines} 行
        </span>
        <span className='tool-call-result-actions'>
          {running && !following && (
            <button
              type='button'
              onClick={() => {
                setFollowing(true);
                const output = outputRef.current;
                if (output) output.scrollTop = output.scrollHeight;
              }}
            >
              <ArrowDown size={12} />
              继续跟随
            </button>
          )}
          <CopyButton content={call.output} label='复制工具输出' />
        </span>
      </header>
      <div role='log' aria-label={running ? '实时工具输出' : '工具输出记录'} aria-live={running ? 'polite' : 'off'}>
        <pre
          ref={outputRef}
          className={`tool-call-output ${call.state === 'failed' ? 'error' : ''}`}
          onScroll={(event) => {
            if (!running) return;
            const output = event.currentTarget;
            setFollowing(output.scrollHeight - output.scrollTop - output.clientHeight < 24);
          }}
        >
          {call.output}
        </pre>
      </div>
    </section>
  );
}

function ToolCallRecovery({ call }: { call: ToolCallProjection }) {
  const permissionOutcome = call.state === 'denied' || call.state === 'timed-out';
  const continueSafely = () => {
    const evidence = call.reason || call.output || call.errorKind || '工具调用没有返回更多信息。';
    appendTaskInstruction(
      permissionOutcome
        ? `请在不执行被拒绝或超时操作的前提下继续任务，并在需要时提出更安全的替代方案。\n\n操作结果：${truncateEvidence(evidence)}`
        : `请分析 ${call.name} 工具调用失败的原因，采用安全且范围最小的方式修复后继续。\n\n失败信息：${truncateEvidence(evidence)}`
    );
  };

  return (
    <div className={`tool-call-recovery ${permissionOutcome ? 'permission' : 'failure'}`}>
      <span>
        {permissionOutcome
          ? '本次操作未执行；你可以让 Code 改用不需要该权限的方案。'
          : '已保留失败输出，便于继续定位。'}
      </span>
      <Button tone='quiet' onClick={continueSafely}>
        {permissionOutcome ? '改用安全方案继续' : '让 Code 分析并修复'}
      </Button>
    </div>
  );
}

function truncateEvidence(value: string): string {
  return value.length > 1200 ? `${value.slice(0, 1200)}\n…` : value;
}

function terminalOutcomeMessage(call: ToolCallProjection): string | null {
  if (call.state === 'failed' && !call.output) return call.reason || call.errorKind || '工具没有返回可用结果。';
  if (['denied', 'timed-out', 'interrupted'].includes(call.state)) return call.reason || stateLabel(call.state);
  return null;
}

function shouldShowArgumentDetails(call: ToolCallProjection, argumentsText: string, target: string): boolean {
  if (!argumentsText) return false;
  const entries = Object.entries(call.args ?? {});
  if (entries.length > 1 || argumentsText.length > 220 || !target) return true;
  const primaryKeys = new Set(['command', 'cmd', 'file_path', 'path', 'pattern', 'query', 'url']);
  return entries.length === 1 && !primaryKeys.has(entries[0][0]);
}

function stateLabel(state: ToolCallProjection['state']): string {
  switch (state) {
    case 'preparing':
      return '准备中';
    case 'awaiting':
      return '待确认';
    case 'running':
      return '执行中';
    case 'succeeded':
      return '已完成';
    case 'failed':
      return '失败';
    case 'denied':
      return '已拒绝';
    case 'timed-out':
      return '已超时';
    case 'interrupted':
      return '已中断';
  }
}

function formatDuration(durationMs: number): string {
  return durationMs < 1000 ? `${Math.round(durationMs)} ms` : `${(durationMs / 1000).toFixed(1)} s`;
}
