import { describe, expect, it } from 'vitest';
import {
  completedStepCount,
  formatElapsedDuration,
  projectSubagents,
  projectTaskPlan,
} from './task-runtime-projection';

describe('task runtime projection', () => {
  it('projects semantic plan step updates without inventing progress', () => {
    const plan = projectTaskPlan([
      {
        type: 'planning_end',
        plan: {
          goal: 'Ship the Web flow',
          steps: [
            { id: 'audit', content: 'Audit', status: 'pending' },
            { id: 'build', content: 'Build', status: 'pending' },
          ],
          complexity: 'medium',
          required_tools: [],
          estimated_steps: 2,
        },
      },
      { type: 'step_end', step_id: 'audit', status: 'completed' },
      { type: 'step_start', step_id: 'build', description: 'Build the status panel' },
    ]);

    expect(plan.goal).toBe('Ship the Web flow');
    expect(completedStepCount(plan.steps)).toBe(1);
    expect(plan.steps[1]).toMatchObject({ content: 'Build the status panel', status: 'in_progress' });
  });

  it('does not create task rows while planning has only started', () => {
    const plan = projectTaskPlan([{ type: 'planning_start' }]);

    expect(plan.planning).toBe(true);
    expect(plan.steps).toEqual([]);
  });

  it('applies replacements and step updates in runtime event order', () => {
    const plan = projectTaskPlan([
      {
        type: 'planning_end',
        plan: {
          goal: 'Old plan',
          steps: [{ id: 'old', content: 'Old task', status: 'pending' }],
          complexity: 'low',
          required_tools: [],
          estimated_steps: 1,
        },
      },
      { type: 'step_end', step_id: 'old', status: 'completed' },
      { type: 'task_updated', tasks: [{ id: 'new', content: 'Current task', status: 'pending' }] },
      { type: 'step_start', step_id: 'new' },
    ]);

    expect(plan.steps).toEqual([{ id: 'new', content: 'Current task', status: 'in_progress' }]);
  });

  it('settles every unfinished plan row when its parent turn has ended', () => {
    const plan = projectTaskPlan([
      {
        type: 'task_updated',
        tasks: [
          { id: 'done', content: 'Completed work', status: 'completed' },
          { id: 'active', content: 'Active work', status: 'in_progress' },
          { id: 'pending', content: 'Pending work', status: 'pending' },
        ],
      },
      { type: 'agent_end', text: 'The parent turn ended early.' },
    ]);

    expect(plan.steps).toEqual([
      { id: 'done', content: 'Completed work', status: 'completed' },
      { id: 'active', content: 'Active work', status: 'cancelled' },
      { id: 'pending', content: 'Pending work', status: 'cancelled' },
    ]);
  });

  it('tracks parallel subagent lifecycle by task id', () => {
    const agents = projectSubagents([
      {
        type: 'subagent_start',
        task_id: 'agent-1',
        session_id: 'child-1',
        parent_session_id: 'parent-1',
        agent: 'explore',
        description: 'Inspect the workspace',
        started_ms: 1_000,
      },
      {
        type: 'subagent_progress',
        task_id: 'agent-1',
        session_id: 'child-1',
        status: 'turn_completed',
        metadata: { turn: 1, completion_tokens: 18 },
      },
      {
        type: 'subagent_progress',
        task_id: 'agent-1',
        session_id: 'child-1',
        status: 'turn_completed',
        metadata: { turn: 2, completion_tokens: 12 },
      },
      {
        type: 'subagent_end',
        task_id: 'agent-1',
        session_id: 'child-1',
        agent: 'explore',
        output: 'Found the runtime projection and its tests.',
        success: true,
        finished_ms: 6_000,
      },
    ]);

    expect(agents).toEqual([
      expect.objectContaining({
        id: 'agent-1',
        sessionId: 'child-1',
        parentSessionId: 'parent-1',
        description: 'Inspect the workspace',
        status: '已完成',
        state: 'completed',
        output: 'Found the runtime projection and its tests.',
        completionTokens: 30,
        startedAt: 1_000,
        completedAt: 6_000,
      }),
    ]);
    expect(agents[0]?.progress).toHaveLength(2);
    expect(agents[0]?.progress[1]?.label).toBe('第 2 轮完成');
  });

  it('settles an unclosed subagent as interrupted when its parent turn ends', () => {
    const agents = projectSubagents(
      [
        {
          type: 'subagent_start',
          task_id: 'agent-1',
          session_id: 'child-1',
          agent: 'explore',
          description: 'Inspect the workspace',
          started_ms: 1_000,
        },
        { type: 'error', message: 'connection closed' },
      ],
      { completedAt: 7_000 }
    );

    expect(agents[0]).toMatchObject({
      state: 'interrupted',
      status: '已中断',
      completedAt: 7_000,
    });
  });

  it('uses the latest observed child completion when a restored parent has no timing record', () => {
    const agents = projectSubagents([
      {
        type: 'subagent_start',
        task_id: 'completed',
        session_id: 'completed-session',
        agent: 'review',
        description: 'Completed branch',
        started_ms: 1_000,
      },
      {
        type: 'subagent_end',
        task_id: 'completed',
        session_id: 'completed-session',
        agent: 'review',
        output: 'Done',
        success: true,
        finished_ms: 6_000,
      },
      {
        type: 'subagent_start',
        task_id: 'orphaned',
        session_id: 'orphaned-session',
        agent: 'explore',
        description: 'Interrupted branch',
        started_ms: 2_000,
      },
      { type: 'agent_end', text: 'Parent settled' },
    ]);

    expect(agents[1]).toMatchObject({
      state: 'interrupted',
      completedAt: 6_000,
    });
  });

  it('formats short and long live durations compactly', () => {
    expect(formatElapsedDuration(65_000)).toBe('01:05');
    expect(formatElapsedDuration(3_725_000)).toBe('1:02:05');
  });
});
