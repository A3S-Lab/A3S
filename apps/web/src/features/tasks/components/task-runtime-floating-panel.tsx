import { ChevronDown, ChevronUp, CircleAlert, CirclePause, ListChecks, LoaderCircle, UsersRound } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { AgentEvent, ChatMessage } from '../../../types/api';
import { useTaskRuntimeFloatingPlacement } from './task-runtime-floating-placement';
import { TaskRuntimePlanList } from './task-runtime-plan-list';
import { presentTaskRuntime } from './task-runtime-presentation';
import { formatElapsedDuration, projectSubagents, projectTaskPlan } from './task-runtime-projection';
import { TaskRuntimeSubagentList } from './task-runtime-subagent-list';
import { useLiveNow } from './use-live-now';

export function TaskRuntimeFloatingPanel() {
  const state = useSnapshot(appState);
  const sessionId = state.activeSessionId;
  const messages = sessionId ? (state.messagesBySession[sessionId] ?? []) : [];
  const streamOpen = Boolean(sessionId && state.streamingSessionId === sessionId);
  const preparing = Boolean(state.taskSubmissionState);
  const starting = state.taskSubmissionState === 'creating';
  const runtime = latestRuntimeContext(
    messages as unknown as readonly ChatMessage[],
    state.streamEvents as unknown as readonly AgentEvent[],
    streamOpen
  );
  const events = runtime.events;
  const turnRunning = streamOpen && !events.some((event) => ['agent_end', 'error', 'cancelled'].includes(event.type));
  const plan = useMemo(() => projectTaskPlan(events), [events]);
  const execution = sessionId ? state.executionTimings[sessionId] : undefined;
  const agents = useMemo(
    () =>
      projectSubagents(events, {
        settleOpen: !turnRunning,
        completedAt: execution?.completedAt ?? runtime.completedAt,
      }),
    [events, execution?.completedAt, runtime.completedAt, turnRunning]
  );
  const [expanded, setExpanded] = useState(true);
  const turnIdentity = `${sessionId ?? ''}:${runtime.turnIdentity}:${execution?.startedAt ?? ''}`;
  const previousAttention = useRef<RuntimeAttentionSnapshot | undefined>(undefined);
  const presentation = presentTaskRuntime({
    steps: plan.steps,
    agents,
    running: turnRunning || preparing,
    planning: plan.planning,
    starting,
    executionStatus: execution?.status,
  });
  const now = useLiveNow(presentation.live);
  const elapsedStartedAt = execution?.startedAt ?? runtime.startedAt;
  const elapsedCompletedAt =
    execution?.completedAt ?? runtime.completedAt ?? (execution?.startedAt || presentation.live ? now : undefined);
  const elapsed =
    elapsedStartedAt && elapsedCompletedAt && elapsedCompletedAt >= elapsedStartedAt
      ? formatElapsedDuration(elapsedCompletedAt - elapsedStartedAt)
      : null;
  const completedSteps = plan.steps.filter((step) => step.status === 'completed' || step.status === 'done').length;
  const progress = plan.steps.length ? Math.round((completedSteps / plan.steps.length) * 100) : 0;
  const hasPlan = plan.steps.length > 0;
  const hasAgents = agents.length > 0;
  const tracksTask = hasPlan || plan.planning || preparing || (turnRunning && !hasAgents);
  const visible = preparing || streamOpen || hasPlan || hasAgents;
  const attentionIdentity = runtimeAttentionIdentity(plan.steps, agents);
  const { layout, panelRef, style } = useTaskRuntimeFloatingPlacement(turnIdentity, expanded, visible);

  useLayoutEffect(() => {
    if (layout === 'compact') setExpanded(false);
  }, [layout, turnIdentity]);

  useEffect(() => {
    const previous = previousAttention.current;
    const shouldExpand =
      visible &&
      (!previous?.visible ||
        previous.turnIdentity !== turnIdentity ||
        (!previous.hasPlan && hasPlan) ||
        (attentionIdentity.length > 0 && previous.attentionIdentity !== attentionIdentity));

    previousAttention.current = {
      attentionIdentity,
      hasPlan,
      turnIdentity,
      visible,
    };
    if (shouldExpand && layout === 'wide') setExpanded(true);
  }, [attentionIdentity, hasPlan, layout, turnIdentity, visible]);

  if (!visible) return null;

  return (
    <aside
      ref={panelRef}
      style={style}
      className={`task-runtime-floating-panel ${layout} ${expanded ? 'expanded' : 'collapsed'} ${hasPlan ? 'with-plan' : 'agent-only'} ${presentation.tone}`}
      data-layout={layout}
      aria-label={tracksTask ? '任务进度浮窗' : '并行子智能体浮窗'}
    >
      <button
        type='button'
        className='task-runtime-floating-trigger'
        aria-expanded={expanded}
        aria-controls='task-runtime-floating-content'
        aria-label={`${expanded ? '收起' : '展开'}${presentation.title}`}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className={`task-runtime-floating-icon ${presentation.tone}`}>
          <RuntimeStatusIcon tone={presentation.tone} hasPlan={hasPlan} />
        </span>
        <span className='task-runtime-floating-title'>
          <strong>{presentation.title}</strong>
          <small aria-live='polite'>{presentation.summary}</small>
        </span>
        <span className='task-runtime-floating-summary'>
          <strong>{presentation.metric}</strong>
          {elapsed && <time>{elapsed}</time>}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <section
          id='task-runtime-floating-content'
          className='task-runtime-floating-content'
          aria-label={tracksTask ? '任务规划与执行' : '并行执行详情'}
        >
          {hasPlan && (
            <div
              className='task-runtime-progress'
              role='progressbar'
              aria-label='任务完成度'
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-valuetext={`${completedSteps}/${plan.steps.length} 项完成`}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          {hasPlan && <TaskRuntimePlanList steps={plan.steps} />}
          {!hasPlan && !hasAgents && <RuntimeAwaitingState starting={starting} planning={plan.planning} />}
          {agents.length > 0 && (
            <TaskRuntimeSubagentList
              agents={agents}
              now={now}
              fallbackStartedAt={execution?.startedAt ?? runtime.startedAt}
              key={turnIdentity}
            />
          )}
        </section>
      )}
    </aside>
  );
}

function RuntimeAwaitingState({ starting, planning }: { starting: boolean; planning: boolean }) {
  const title = starting ? '正在启动任务会话' : planning ? '正在生成执行计划' : '正在分析任务';
  const description = planning
    ? '计划生成后会在这里持续更新任务进度和并行子智能体。'
    : '任务计划和并行子智能体开始后会在这里实时更新。';
  return (
    <output className='task-runtime-awaiting'>
      <LoaderCircle className='spin' size={15} />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </output>
  );
}

interface RuntimeAttentionSnapshot {
  attentionIdentity: string;
  hasPlan: boolean;
  turnIdentity: string;
  visible: boolean;
}

function runtimeAttentionIdentity(
  steps: readonly { id: string; status: string }[],
  agents: readonly { id: string; state: string }[]
): string {
  const stepAttention = steps
    .filter((step) => ['failed', 'cancelled', 'skipped'].includes(step.status))
    .map((step) => `step:${step.id}:${step.status}`);
  const agentAttention = agents
    .filter((agent) => agent.state === 'failed' || agent.state === 'interrupted')
    .map((agent) => `agent:${agent.id}:${agent.state}`);
  return [...stepAttention, ...agentAttention].join('|');
}

function RuntimeStatusIcon({
  tone,
  hasPlan,
}: {
  tone: ReturnType<typeof presentTaskRuntime>['tone'];
  hasPlan: boolean;
}) {
  if (tone === 'running') return <LoaderCircle className='spin' size={15} />;
  if (tone === 'failed') return <CircleAlert size={15} />;
  if (tone === 'interrupted') return <CirclePause size={15} />;
  if (hasPlan) return <ListChecks size={15} />;
  return <UsersRound size={15} />;
}

function latestRuntimeContext(
  messages: readonly ChatMessage[],
  liveEvents: readonly AgentEvent[],
  running: boolean
): { completedAt?: number; events: readonly AgentEvent[]; startedAt?: number; turnIdentity: string } {
  if (running) {
    let latestAssistant: ChatMessage | undefined;
    let latestAssistantIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === 'assistant' && message.pending) {
        latestAssistant = message;
        latestAssistantIndex = index;
        break;
      }
    }
    return {
      events: liveEvents.length ? liveEvents : (latestAssistant?.events ?? []),
      startedAt: precedingUserTimestamp(messages, latestAssistantIndex),
      turnIdentity: latestAssistant?.id ?? 'live-turn',
    };
  }

  let latestUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      latestUserIndex = index;
      break;
    }
  }
  for (let index = messages.length - 1; index > latestUserIndex; index -= 1) {
    const message = messages[index];
    if (message?.role === 'assistant') {
      return {
        completedAt: messageTimestamp(message.createdAt),
        events: message.events ?? [],
        startedAt: messageTimestamp(messages[latestUserIndex]?.createdAt),
        turnIdentity: message.id,
      };
    }
  }
  return { events: [], turnIdentity: '' };
}

function messageTimestamp(createdAt: string): number | undefined {
  const value = Date.parse(createdAt);
  return Number.isFinite(value) ? value : undefined;
}

function precedingUserTimestamp(messages: readonly ChatMessage[], beforeIndex: number): number | undefined {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') return messageTimestamp(message.createdAt);
  }
  return undefined;
}
