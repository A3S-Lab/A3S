import type { ExecutionPlanTask } from '../../../types/api';
import { countSubagents, countTaskPlan, type SubagentProjection, type SubagentState } from './task-runtime-projection';

export type RuntimeTone = 'running' | 'completed' | 'failed' | 'interrupted' | 'pending';
export type RuntimeExecutionStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export interface TaskRuntimePresentation {
  tone: RuntimeTone;
  live: boolean;
  title: string;
  summary: string;
  metric: string;
}

export function presentTaskRuntime({
  steps,
  agents,
  running,
  planning = false,
  starting = false,
  executionStatus,
}: {
  steps: readonly ExecutionPlanTask[];
  agents: readonly SubagentProjection[];
  running: boolean;
  planning?: boolean;
  starting?: boolean;
  executionStatus?: RuntimeExecutionStatus;
}): TaskRuntimePresentation {
  const plan = countTaskPlan(steps);
  const subagents = countSubagents(agents);
  const hasPlan = plan.total > 0;
  const currentStep = steps.find((step) => step.status === 'in_progress');
  const tracksTask = hasPlan || planning || starting || (running && subagents.total === 0);
  const title = tracksTask ? '任务进度' : '并行执行';
  const metric = hasPlan
    ? `${plan.completed}/${plan.total}`
    : subagents.total > 0 && subagents.failed > 0
      ? `${subagents.failed} 失败`
      : subagents.total > 0 && subagents.interrupted > 0
        ? `${subagents.interrupted} 中断`
        : subagents.total > 0 && subagents.running > 0
          ? `${subagents.running}/${subagents.total} 运行`
          : subagents.total > 0
            ? `${subagents.completed}/${subagents.total}`
            : starting
              ? '准备中'
              : planning
                ? '规划中'
                : running
                  ? '运行中'
                  : '0/0';

  if (plan.failed > 0) {
    return settled('failed', title, `${plan.failed} 项失败`, metric);
  }
  if (subagents.failed > 0) {
    return settled('failed', title, `${subagents.failed} 个子智能体失败`, metric);
  }
  if (executionStatus === 'failed') {
    return settled('interrupted', title, '执行已中断', metric);
  }
  if (executionStatus === 'cancelled') {
    return settled('interrupted', title, '任务已停止', metric);
  }
  if (plan.interrupted > 0) {
    return settled('interrupted', title, `${plan.interrupted} 项已中断`, metric);
  }
  if (subagents.interrupted > 0) {
    return settled('interrupted', title, `${subagents.interrupted} 个子智能体中断`, metric);
  }
  if (starting && !hasPlan && subagents.total === 0) {
    return { tone: 'running', live: true, title, summary: '正在创建任务', metric };
  }
  if (planning && !hasPlan && subagents.total === 0) {
    return { tone: 'running', live: true, title, summary: '正在制定执行计划', metric };
  }
  if (running || plan.running > 0 || subagents.running > 0) {
    const summary = currentStep?.content ?? runningSummary(hasPlan, subagents.running);
    return { tone: 'running', live: true, title, summary, metric };
  }
  if (hasPlan && plan.completed === plan.total) {
    return settled('completed', title, '本轮任务已完成', metric);
  }
  if (!hasPlan && subagents.total > 0 && subagents.completed === subagents.total) {
    return settled('completed', title, '并行任务已完成', metric);
  }
  if (hasPlan && executionStatus === 'completed') {
    return settled('interrupted', title, '任务未全部完成', metric);
  }
  return settled('pending', title, hasPlan ? '等待下一项执行' : '等待并行任务', metric);
}

export function formatPlanCountSummary(steps: readonly ExecutionPlanTask[]): string {
  const counts = countTaskPlan(steps);
  const parts = [
    countPart(counts.running, '项进行中'),
    countPart(counts.completed, '项完成'),
    countPart(counts.failed, '项失败'),
    countPart(counts.interrupted, '项中断'),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : `${counts.pending} 项待执行`;
}

export function formatSubagentCountSummary(agents: readonly SubagentProjection[]): string {
  const counts = countSubagents(agents);
  return [
    countPart(counts.running, '运行'),
    countPart(counts.completed, '完成'),
    countPart(counts.failed, '失败'),
    countPart(counts.interrupted, '中断'),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function prioritizeSubagents(agents: readonly SubagentProjection[]): SubagentProjection[] {
  const rank: Record<SubagentState, number> = {
    running: 0,
    failed: 1,
    interrupted: 2,
    completed: 3,
  };
  return agents
    .map((agent, index) => ({ agent, index }))
    .sort((left, right) => {
      const stateOrder = rank[left.agent.state] - rank[right.agent.state];
      if (stateOrder !== 0) return stateOrder;
      if (left.agent.state === 'completed' || left.agent.state === 'failed') {
        const timeOrder = (right.agent.completedAt ?? 0) - (left.agent.completedAt ?? 0);
        if (timeOrder !== 0) return timeOrder;
      }
      return left.index - right.index;
    })
    .map(({ agent }) => agent);
}

function runningSummary(hasPlan: boolean, runningAgents: number): string {
  if (runningAgents > 0) return `${runningAgents} 个子智能体运行中`;
  return hasPlan ? '正在准备下一项' : '正在分析任务';
}

function settled(
  tone: Exclude<RuntimeTone, 'running'>,
  title: string,
  summary: string,
  metric: string
): TaskRuntimePresentation {
  return { tone, live: false, title, summary, metric };
}

function countPart(value: number, label: string): string | null {
  return value > 0 ? `${value} ${label}` : null;
}
