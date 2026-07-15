import { describe, expect, it } from 'vitest';
import type { SubagentProjection, SubagentState } from './task-runtime-projection';
import { presentTaskRuntime, prioritizeSubagents } from './task-runtime-presentation';

describe('task runtime presentation', () => {
  it('prioritizes failed, interrupted, running, and completed states in that order', () => {
    const running = agent('running', 'running');
    const failed = agent('failed', 'failed');
    const interrupted = agent('interrupted', 'interrupted');
    const completed = agent('completed', 'completed');

    expect(presentTaskRuntime({ steps: [], agents: [running, failed], running: true }).tone).toBe('failed');
    expect(presentTaskRuntime({ steps: [], agents: [running, interrupted], running: true }).tone).toBe('interrupted');
    expect(presentTaskRuntime({ steps: [], agents: [running, completed], running: true }).tone).toBe('running');
    expect(presentTaskRuntime({ steps: [], agents: [completed], running: false }).tone).toBe('completed');
  });

  it('does not count a failed subagent as completed in the collapsed metric', () => {
    const presentation = presentTaskRuntime({
      steps: [],
      agents: [agent('completed', 'completed'), agent('failed', 'failed')],
      running: false,
    });

    expect(presentation.summary).toBe('1 个子智能体失败');
    expect(presentation.metric).toBe('1 失败');
  });

  it('orders dense parallel work by attention need and then recent completion', () => {
    const agents = [
      agent('completed-old', 'completed', 1_000),
      agent('failed', 'failed', 3_000),
      agent('completed-new', 'completed', 4_000),
      agent('interrupted', 'interrupted', 2_000),
      agent('running', 'running'),
    ];

    expect(prioritizeSubagents(agents).map((item) => item.id)).toEqual([
      'running',
      'failed',
      'interrupted',
      'completed-new',
      'completed-old',
    ]);
  });
});

function agent(id: string, state: SubagentState, completedAt?: number): SubagentProjection {
  return {
    id,
    agent: 'explore',
    description: id,
    status: state,
    state,
    completionTokens: 0,
    progress: [],
    completedAt,
  };
}
