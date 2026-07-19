import {
  Activity,
  ArrowDown,
  Braces,
  CheckCircle2,
  ChevronDown,
  CircleX,
  Clock3,
  FileDiff,
  FilePenLine,
  FileText,
  FolderSearch2,
  GitBranch,
  Globe2,
  LoaderCircle,
  Network,
  Search,
  ShieldAlert,
  Sparkles,
  SquareTerminal,
  Wrench,
} from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button } from '../../../design-system/primitives';
import { appendTaskInstruction, appState, navigateTask } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { CopyButton } from './conversation-message-actions';
import { PermissionDecision, type ToolDecisionState } from './permission-decision';
import {
  outputLineCount,
  ToolCollapsedOutputPreview,
  ToolCommandPreview,
  ToolInvocationInline,
} from './tool-command-preview';
import {
  isFileEditCall,
  selectToolCallsForDisplay,
  summarizeToolCalls,
  type ToolCallProjection,
  type ToolTimelineTone,
  toolActionLabel,
  toolArgumentSummary,
  toolFilePath,
} from './tool-call-projection';

export function ToolCallTimeline({
  calls,
  sessionId,
  actions,
}: {
  calls: ToolCallProjection[];
  sessionId: string;
  actions: TaskActions;
}) {
  const state = useSnapshot(appState);
  const [showAll, setShowAll] = useState(false);
  if (!calls.length) return null;
  const summary = summarizeToolCalls(calls);
  const compact = selectToolCallsForDisplay(calls);
  const visibleCalls = showAll ? calls : compact.calls;
  return (
    <section className={`tool-call-timeline ${summary.tone}`} aria-label='执行过程'>
      <header className='tool-call-timeline-header'>
        <span className='tool-call-timeline-icon' aria-hidden='true'>
          <Activity size={14} />
        </span>
        <strong>执行过程</strong>
        <output className='tool-call-timeline-summary' aria-live='polite'>
          <TimelineStateIcon tone={summary.tone} />
          {summary.label}
        </output>
      </header>
      <div className='tool-call-list'>
        {compact.hiddenCount > 0 && (
          <button
            type='button'
            className='tool-call-history-toggle'
            aria-expanded={showAll}
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? '收起较早的已完成操作' : `查看之前 ${compact.hiddenCount} 项已完成操作`}
            <ChevronDown size={13} />
          </button>
        )}
        {visibleCalls.map((call) => (
          <ToolCallItem
            key={call.id}
            call={call}
            sessionId={sessionId}
            decision={state.toolDecisionState[`${sessionId}:${call.id}`] as ToolDecisionState | undefined}
            decisionError={state.toolDecisionErrors[`${sessionId}:${call.id}`]}
            actions={actions}
          />
        ))}
      </div>
    </section>
  );
}

function ToolCallItem({
  call,
  sessionId,
  decision,
  decisionError,
  actions,
}: {
  call: ToolCallProjection;
  sessionId: string;
  decision?: ToolDecisionState;
  decisionError?: string;
  actions: TaskActions;
}) {
  const shouldOpen = call.state !== 'succeeded';
  const [open, setOpen] = useState(shouldOpen);
  const bodyId = useId();
  const previousState = useRef(call.state);
  const target = toolArgumentSummary(call);
  const argumentsText =
    call.args && Object.keys(call.args).length ? JSON.stringify(call.args, null, 2) : call.inputText;
  const fileEdit = isFileEditCall(call);
  const reviewAvailable = fileEdit && call.state === 'succeeded';
  const filePath = toolFilePath(call);

  useEffect(() => {
    if (call.state === 'succeeded' && previousState.current !== 'succeeded') setOpen(false);
    else if (call.state !== 'succeeded' && previousState.current !== call.state) setOpen(true);
    previousState.current = call.state;
  }, [call.state]);

  const openReview = () => {
    appState.reviewSourceTaskId = sessionId;
    appState.reviewIntent = 'review';
    navigateTask('review');
  };

  return (
    <section className={`tool-call-item ${call.state} ${open ? 'open' : ''}`}>
      <button
        type='button'
        className='tool-call-summary'
        aria-label={`${toolActionLabel(call)}${target ? `，${target}` : ''}，${stateLabel(call.state)}`}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className='tool-call-icon'>
          <ToolIcon name={call.name} />
        </span>
        <span className='tool-call-title'>
          <strong>{toolActionLabel(call)}</strong>
          {target && (
            <small>
              <ToolInvocationInline call={call} fallback={target} />
            </small>
          )}
        </span>
        <span className='tool-call-state'>
          <StateIcon state={call.state} />
          {call.state === 'succeeded'
            ? call.durationMs !== undefined && formatDuration(call.durationMs)
            : stateLabel(call.state)}
        </span>
        <ChevronDown className='tool-call-chevron' size={14} />
      </button>
      {!open && call.output && <ToolCollapsedOutputPreview output={call.output} />}
      <div className='tool-call-body' id={bodyId} hidden={!open}>
        {open && (
          <>
            {call.state === 'awaiting' && (
              <PermissionDecision
                call={call}
                sessionId={sessionId}
                decision={decision}
                error={decisionError}
                actions={actions}
              />
            )}
            {call.state === 'denied' && call.reason && <p className='tool-call-message denied'>{call.reason}</p>}
            {call.state === 'timed-out' && call.reason && <p className='tool-call-message timed-out'>{call.reason}</p>}
            {call.state === 'interrupted' && call.reason && (
              <p className='tool-call-message interrupted'>{call.reason}</p>
            )}
            <ToolCommandPreview call={call} />
            <ToolExecutionMeta call={call} />
            {argumentsText && (
              <ToolInlineDisclosure className='tool-call-arguments' label='调用参数' icon={<Braces size={12} />}>
                <pre>{argumentsText}</pre>
              </ToolInlineDisclosure>
            )}
            {reviewAvailable ? (
              <div className='tool-call-review'>
                <span>
                  <FileDiff size={15} />
                  <span>
                    <strong>{filePath || '工作区文件已变更'}</strong>
                    <small>在工作区中查看完整 Diff，并决定是否保留变更。</small>
                  </span>
                </span>
                <Button tone='secondary' onClick={openReview}>
                  审阅变更
                </Button>
              </div>
            ) : (
              call.output && <ToolCallResult call={call} />
            )}
            {reviewAvailable && call.output && (
              <ToolInlineDisclosure className='tool-call-raw-output' label='查看原始工具输出'>
                <pre>{call.output}</pre>
              </ToolInlineDisclosure>
            )}
            {!call.output && call.state === 'running' && (
              <p className='tool-call-message running'>工具正在执行，输出会在这里持续更新。</p>
            )}
            {call.state === 'failed' && !call.output && (
              <p className='tool-call-message failed'>{call.reason || call.errorKind || '工具没有返回可用结果。'}</p>
            )}
            {['failed', 'denied', 'timed-out'].includes(call.state) && <ToolCallRecovery call={call} />}
          </>
        )}
      </div>
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
        {label}
        <ChevronDown size={12} />
      </button>
      <div className='tool-call-inline-content' id={contentId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}

function ToolExecutionMeta({ call }: { call: ToolCallProjection }) {
  return (
    <section className='tool-call-metadata' aria-label='执行信息'>
      <span>
        <Wrench size={11} />
        <code>{call.name}</code>
      </span>
      {call.durationMs !== undefined && (
        <span>
          <Clock3 size={11} />
          {formatDuration(call.durationMs)}
        </span>
      )}
      {call.exitCode !== undefined && (
        <span>
          <SquareTerminal size={11} />
          退出码 {call.exitCode}
        </span>
      )}
    </section>
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

function ToolIcon({ name }: { name: string }) {
  const normalized = name.trim().toLowerCase().split(/[.:/]/).at(-1);
  switch (normalized) {
    case 'bash':
    case 'execute':
    case 'execute_command':
    case 'run_command':
    case 'shell':
    case 'shell_command':
    case 'run':
    case 'exec':
    case 'terminal':
      return <SquareTerminal size={15} />;
    case 'read':
    case 'cat':
      return <FileText size={15} />;
    case 'write':
    case 'create':
    case 'edit':
    case 'patch':
    case 'apply_patch':
      return <FilePenLine size={15} />;
    case 'grep':
    case 'search':
    case 'search_skills':
      return <Search size={15} />;
    case 'ls':
    case 'glob':
    case 'find':
      return <FolderSearch2 size={15} />;
    case 'web_search':
      return <Globe2 size={15} />;
    case 'web_fetch':
      return <Network size={15} />;
    case 'task':
    case 'parallel_task':
      return <Sparkles size={15} />;
    case 'git':
      return <GitBranch size={15} />;
    default:
      return <Wrench size={15} />;
  }
}

function StateIcon({ state }: { state: ToolCallProjection['state'] }) {
  if (state === 'preparing' || state === 'running') return <LoaderCircle className='spin' size={12} />;
  if (state === 'awaiting') return <ShieldAlert size={12} />;
  if (state === 'succeeded') return <CheckCircle2 size={12} />;
  if (state === 'timed-out') return <Clock3 size={12} />;
  return <CircleX size={12} />;
}

function TimelineStateIcon({ tone }: { tone: ToolTimelineTone }) {
  if (tone === 'running') return <LoaderCircle className='spin' size={12} />;
  if (tone === 'attention') return <ShieldAlert size={12} />;
  if (tone === 'problem') return <CircleX size={12} />;
  if (tone === 'complete') return <CheckCircle2 size={12} />;
  return null;
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
