import { CheckCircle2, ChevronRight, CirclePause, CircleStop, LoaderCircle, UsersRound } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { SubagentProjection, SubagentState } from './task-runtime-projection';
import { formatElapsedDuration, formatSubagentIdentity, formatSubagentStatus } from './task-runtime-projection';
import { formatSubagentCountSummary, prioritizeSubagents } from './task-runtime-presentation';
import { TaskRuntimeSubagentEvidence } from './task-runtime-subagent-evidence';

const defaultVisibleAgentCount = 4;

export function TaskRuntimeSubagentList({
  agents,
  now,
  fallbackStartedAt,
}: {
  agents: readonly SubagentProjection[];
  now: number;
  fallbackStartedAt?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const orderedAgents = useMemo(() => prioritizeSubagents(agents), [agents]);
  const hiddenCount = Math.max(0, orderedAgents.length - defaultVisibleAgentCount);
  const visibleAgents = showAll ? orderedAgents : orderedAgents.slice(0, defaultVisibleAgentCount);

  return (
    <section className='task-runtime-section task-runtime-agents' aria-label='并行子智能体'>
      <header>
        <strong>
          <UsersRound size={13} /> 并行子智能体
        </strong>
        <span>{formatSubagentCountSummary(agents)}</span>
      </header>
      <ul aria-label='子智能体列表'>
        {visibleAgents.map((agent) => (
          <SubagentRow agent={agent} now={now} fallbackStartedAt={fallbackStartedAt} key={agent.id} />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type='button'
          className='task-runtime-agents-more'
          aria-label={showAll ? `收起其余 ${hiddenCount} 个子智能体` : `查看其余 ${hiddenCount} 个子智能体`}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? '收起其他任务' : `查看其余 ${hiddenCount} 个`}
          <ChevronRight size={12} />
        </button>
      )}
    </section>
  );
}

function SubagentRow({
  agent,
  now,
  fallbackStartedAt,
}: {
  agent: SubagentProjection;
  now: number;
  fallbackStartedAt?: number;
}) {
  const startedAt = agent.startedAt ?? fallbackStartedAt;
  const elapsed = startedAt ? formatElapsedDuration((agent.completedAt ?? now) - startedAt) : '--:--';
  const hasEvidence = Boolean(agent.output || agent.progress.length > 0);
  const identity = formatSubagentIdentity(agent);
  const status = formatSubagentStatus(agent);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceId = useId();
  const summary = <SubagentRowSummary agent={agent} elapsed={elapsed} hasEvidence={hasEvidence} />;

  return (
    <li className={`task-runtime-agent-row ${agent.state}`}>
      {hasEvidence ? (
        <div className={`task-runtime-agent-evidence ${evidenceOpen ? 'open' : ''}`}>
          <button
            type='button'
            className='task-runtime-agent-trigger'
            aria-label={`${agent.description || identity}，${status}，查看结果与记录`}
            aria-expanded={evidenceOpen}
            aria-controls={evidenceId}
            onClick={() => setEvidenceOpen((value) => !value)}
          >
            {summary}
          </button>
          {evidenceOpen && <TaskRuntimeSubagentEvidence agent={agent} id={evidenceId} />}
        </div>
      ) : (
        <div className='task-runtime-agent-static'>{summary}</div>
      )}
    </li>
  );
}

function SubagentRowSummary({
  agent,
  elapsed,
  hasEvidence,
}: {
  agent: SubagentProjection;
  elapsed: string;
  hasEvidence: boolean;
}) {
  const identity = formatSubagentIdentity(agent);
  const status = formatSubagentStatus(agent);
  return (
    <>
      <span className={`task-runtime-agent-state ${agent.state}`} aria-hidden='true'>
        <SubagentStateIcon state={agent.state} />
      </span>
      <span className='task-runtime-agent-copy'>
        <strong>{agent.description || identity}</strong>
        <small>
          <span>
            {identity} · {status}
          </span>
          {hasEvidence && (
            <span className='task-runtime-agent-disclosure'>
              {agent.state === 'failed' ? '查看失败详情' : '查看结果与记录'}
            </span>
          )}
        </small>
      </span>
      <span className='task-runtime-agent-metrics'>
        <time>{elapsed}</time>
        {agent.completionTokens > 0 && <small>{formatTokenCount(agent.completionTokens)} tokens</small>}
      </span>
      {hasEvidence && <ChevronRight className='task-runtime-agent-chevron' size={13} />}
    </>
  );
}

function SubagentStateIcon({ state }: { state: SubagentState }) {
  if (state === 'running') return <LoaderCircle className='spin' size={12} />;
  if (state === 'completed') return <CheckCircle2 size={12} />;
  if (state === 'failed') return <CircleStop size={12} />;
  return <CirclePause size={12} />;
}

function formatTokenCount(value: number): string {
  if (value < 1_000) return String(value);
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
