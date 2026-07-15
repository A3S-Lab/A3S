import type { AgentEvent, ExecutionPlanTask } from '../../../types/api';

export interface TaskPlanProjection {
  goal: string;
  planning: boolean;
  steps: ExecutionPlanTask[];
}

export type SubagentState = 'running' | 'completed' | 'failed' | 'interrupted';

export interface SubagentProgressProjection {
  id: string;
  status: string;
  label: string;
  metadata: Record<string, unknown>;
  completionTokens: number;
}

export interface SubagentProjection {
  id: string;
  sessionId?: string;
  parentSessionId?: string;
  agent: string;
  description: string;
  status: string;
  state: SubagentState;
  output?: string;
  completionTokens: number;
  progress: SubagentProgressProjection[];
  startedAt?: number;
  completedAt?: number;
}

export interface ProjectSubagentsOptions {
  settleOpen?: boolean;
  completedAt?: number;
}

export interface TaskPlanCounts {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  interrupted: number;
}

export interface SubagentCounts {
  total: number;
  running: number;
  completed: number;
  failed: number;
  interrupted: number;
}

export function projectTaskPlan(events: readonly AgentEvent[]): TaskPlanProjection {
  let goal = '';
  let planning = false;
  let steps: ExecutionPlanTask[] = [];

  for (const event of events) {
    if (event.type === 'planning_start') {
      planning = true;
      continue;
    }
    if (event.type === 'planning_end' && event.plan) {
      goal = event.plan.goal;
      planning = false;
      steps = event.plan.steps.map((step) => ({ ...step }));
      continue;
    }
    if (event.type === 'task_updated' && event.tasks) {
      planning = false;
      steps = event.tasks.map((step) => ({ ...step }));
      continue;
    }
    if (event.type === 'step_start' || event.type === 'step_end') {
      const step = steps.find((item) => item.id === event.step_id) ?? steps[(event.step_number ?? 1) - 1];
      if (!step) continue;
      if (event.description) step.content = event.description;
      step.status = event.type === 'step_start' ? 'in_progress' : normalizeStepStatus(event.status);
    }
  }

  if (events.some((event) => ['agent_end', 'error', 'cancelled'].includes(event.type))) {
    planning = false;
    steps = steps.map((step) =>
      ['pending', 'in_progress'].includes(normalizeStepStatus(step.status)) ? { ...step, status: 'cancelled' } : step
    );
  }

  return { goal, planning, steps };
}

export function projectSubagents(
  events: readonly AgentEvent[],
  options: ProjectSubagentsOptions = {}
): SubagentProjection[] {
  const agents = new Map<string, SubagentProjection>();
  const order: string[] = [];

  const ensure = (event: AgentEvent, index: number) => {
    const id = text(event.task_id) ?? text(event.session_id) ?? `subagent-${index}`;
    let agent = agents.get(id);
    if (!agent) {
      agent = {
        id,
        sessionId: text(event.session_id),
        parentSessionId: text(event.parent_session_id),
        agent: text(event.agent) ?? '子智能体',
        description: text(event.description) ?? '',
        status: '等待状态',
        state: 'running',
        completionTokens: 0,
        progress: [],
      };
      agents.set(id, agent);
      order.push(id);
    }
    return agent;
  };

  events.forEach((event, index) => {
    if (!['subagent_start', 'subagent_progress', 'subagent_end'].includes(event.type)) return;
    const agent = ensure(event, index);
    agent.sessionId = text(event.session_id) ?? agent.sessionId;
    agent.parentSessionId = text(event.parent_session_id) ?? agent.parentSessionId;
    agent.agent = text(event.agent) ?? agent.agent;
    agent.description = text(event.description) ?? agent.description;

    if (event.type === 'subagent_start') {
      if (agent.state !== 'running') {
        agent.output = undefined;
        agent.completionTokens = 0;
        agent.progress = [];
      }
      agent.status = '执行中';
      agent.state = 'running';
      agent.startedAt = timestamp(event.started_ms) ?? agent.startedAt;
      agent.completedAt = undefined;
    } else if (event.type === 'subagent_progress') {
      const metadata = record(event.metadata);
      const status = text(event.status) ?? '执行中';
      const completionTokens = positiveInteger(metadata.completion_tokens);
      agent.progress.push({
        id: `${agent.id}-progress-${agent.progress.length + 1}`,
        status,
        label: subagentProgressLabel(status, metadata),
        metadata,
        completionTokens,
      });
      agent.completionTokens += completionTokens;
      if (agent.state === 'running') agent.status = subagentProgressLabel(status, metadata);
    } else {
      agent.status = event.success ? '已完成' : '执行失败';
      agent.state = event.success ? 'completed' : 'failed';
      agent.output = rawText(event.output) ?? agent.output;
      agent.completedAt = timestamp(event.finished_ms) ?? agent.completedAt;
    }
  });

  const parentSettled =
    options.settleOpen || events.some((event) => ['agent_end', 'error', 'cancelled'].includes(event.type));
  const observedCompletedAt = events.reduce<number | undefined>((latest, event) => {
    const completedAt = timestamp(event.finished_ms);
    if (completedAt === undefined) return latest;
    return latest === undefined ? completedAt : Math.max(latest, completedAt);
  }, undefined);
  if (parentSettled) {
    for (const agent of agents.values()) {
      if (agent.state !== 'running') continue;
      agent.state = 'interrupted';
      agent.status = '已中断';
      agent.completedAt = options.completedAt ?? observedCompletedAt ?? agent.startedAt;
    }
  }

  return order.map((id) => agents.get(id)).filter((agent): agent is SubagentProjection => Boolean(agent));
}

export function completedStepCount(steps: readonly ExecutionPlanTask[]): number {
  return steps.filter((step) => normalizeStepStatus(step.status) === 'completed').length;
}

export function countTaskPlan(steps: readonly ExecutionPlanTask[]): TaskPlanCounts {
  const counts: TaskPlanCounts = {
    total: steps.length,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    interrupted: 0,
  };
  for (const step of steps) {
    const status = normalizeStepStatus(step.status);
    if (status === 'completed') counts.completed += 1;
    else if (status === 'in_progress') counts.running += 1;
    else if (status === 'failed') counts.failed += 1;
    else if (status === 'cancelled' || status === 'skipped') counts.interrupted += 1;
    else counts.pending += 1;
  }
  return counts;
}

export function countSubagents(agents: readonly SubagentProjection[]): SubagentCounts {
  const counts: SubagentCounts = {
    total: agents.length,
    running: 0,
    completed: 0,
    failed: 0,
    interrupted: 0,
  };
  for (const agent of agents) counts[agent.state] += 1;
  return counts;
}

export function formatElapsedDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(totalMinutes)}:${pad(seconds)}`;
}

function normalizeStepStatus(status?: string) {
  return status === 'done' || status === 'completed'
    ? 'completed'
    : status === 'failed'
      ? 'failed'
      : status || 'pending';
}

function subagentProgressLabel(status: string, metadata: Record<string, unknown>): string {
  if (status === 'turn_completed') {
    const turn = positiveInteger(metadata.turn);
    return turn > 0 ? `第 ${turn} 轮完成` : '完成一轮处理';
  }
  if (status === 'tool_completed') {
    const tool = text(metadata.tool) ?? '工具';
    const exitCode = finiteNumber(metadata.exit_code);
    return exitCode !== undefined && exitCode !== 0 ? `${tool} 执行失败` : `${tool} 已完成`;
  }
  return status;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function rawText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function positiveInteger(value: unknown): number {
  const number = finiteNumber(value);
  return number && number > 0 ? Math.floor(number) : 0;
}

function timestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}
