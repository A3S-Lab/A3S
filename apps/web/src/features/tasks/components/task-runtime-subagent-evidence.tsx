import { lazy, Suspense } from 'react';
import type { SubagentProjection } from './task-runtime-projection';

const StreamingMarkdown = lazy(() => import('./streaming-markdown'));

export function TaskRuntimeSubagentEvidence({ agent, id }: { agent: SubagentProjection; id: string }) {
  const output = agent.output ? formatSubagentOutput(agent.output) : '';

  return (
    <div className='task-runtime-agent-evidence-content' id={id}>
      {agent.progress.length > 0 && (
        <section aria-label='执行记录'>
          <strong>执行记录</strong>
          <ol>
            {agent.progress.map((entry) => (
              <li key={entry.id}>
                <span>{entry.label}</span>
                {entry.completionTokens > 0 && <small>+{formatTokenCount(entry.completionTokens)} tokens</small>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {output && (
        <section aria-label={agent.state === 'failed' ? '失败详情' : '执行结果'}>
          <strong>{agent.state === 'failed' ? '失败详情' : '执行结果'}</strong>
          <div className='execution-markdown task-runtime-agent-output'>
            <Suspense fallback={<pre className='task-runtime-agent-output-fallback'>{agent.output}</pre>}>
              <StreamingMarkdown content={output} streaming={false} />
            </Suspense>
          </div>
        </section>
      )}
    </div>
  );
}

export function formatSubagentOutput(output: string): string {
  const trimmed = output.trim();
  if (!trimmed || !['{', '['].includes(trimmed[0] ?? '')) return output;

  try {
    const value: unknown = JSON.parse(trimmed);
    if (value === null || typeof value !== 'object') return output;
    const formatted = JSON.stringify(value, null, 2);
    const fence = formatted.includes('```') ? '````' : '```';
    return `${fence}json\n${formatted}\n${fence}`;
  } catch {
    return output;
  }
}

function formatTokenCount(value: number): string {
  if (value < 1_000) return String(value);
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
