import { describe, expect, it } from 'vitest';
import {
  projectToolCalls,
  selectToolCallsForDisplay,
  summarizeToolCalls,
  toolActionLabel,
  toolArgumentSummary,
  toolOperationLabel,
  toolRiskSummary,
} from './tool-call-projection';

describe('projectToolCalls', () => {
  it('merges streamed arguments and output into one completed tool call', () => {
    const calls = projectToolCalls([
      { type: 'tool_start', id: 'tool-1', name: 'bash' },
      { type: 'tool_input_delta', id: 'tool-1', delta: '{"command":"bun test"}' },
      { type: 'tool_execution_start', id: 'tool-1', name: 'bash', args: { command: 'bun test' } },
      { type: 'tool_output_delta', id: 'tool-1', name: 'bash', delta: 'first line\n' },
      { type: 'tool_output_delta', id: 'tool-1', name: 'bash', delta: 'second line\n' },
      {
        type: 'tool_end',
        id: 'tool-1',
        name: 'bash',
        args: { command: 'bun test' },
        output: 'first line\nsecond line\nall tests passed',
        exit_code: 0,
        duration_ms: 1250,
      },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      id: 'tool-1',
      name: 'bash',
      state: 'succeeded',
      args: { command: 'bun test' },
      output: 'first line\nsecond line\nall tests passed',
      durationMs: 1250,
    });
    expect(toolActionLabel(calls[0])).toBe('已执行命令');
    expect(toolArgumentSummary(calls[0])).toBe('bun test');
  });

  it('attaches argument deltas without an id to the latest open tool call', () => {
    const calls = projectToolCalls([
      { type: 'tool_start', id: 'tool-open', name: 'bash' },
      { type: 'tool_input_delta', delta: '{"command":"bun run test"}' },
      { type: 'tool_execution_start', id: 'tool-open', name: 'bash', args: { command: 'bun run test' } },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 'tool-open', args: { command: 'bun run test' } });
  });

  it('keeps HITL decisions and policy denials in the same semantic call', () => {
    const awaiting = projectToolCalls([
      { type: 'tool_start', id: 'tool-2', name: 'write' },
      {
        type: 'confirmation_required',
        tool_id: 'tool-2',
        tool_name: 'write',
        args: { path: 'src/app.ts' },
        timeout_ms: 30000,
      },
      { type: 'confirmation_received', tool_id: 'tool-2', approved: false, reason: 'User rejected it' },
    ]);
    const denied = projectToolCalls([
      {
        type: 'permission_denied',
        tool_id: 'tool-3',
        tool_name: 'bash',
        args: { command: 'sudo rm -rf /tmp/cache' },
        reason: 'Outside the workspace policy',
      },
    ]);

    expect(awaiting[0]).toMatchObject({ id: 'tool-2', name: 'write', state: 'denied', reason: 'User rejected it' });
    expect(denied[0]).toMatchObject({ state: 'denied', reason: 'Outside the workspace policy' });
  });

  it('settles stale confirmations when the parent turn ends', () => {
    const [call] = projectToolCalls([
      {
        type: 'confirmation_required',
        tool_id: 'tool-stale',
        tool_name: 'write',
        args: { path: 'src/app.ts' },
      },
      { type: 'error', message: 'stream disconnected' },
    ]);

    expect(call).toMatchObject({
      state: 'interrupted',
      reason: '任务已结束，这次确认不再有效。',
    });
    expect(toolOperationLabel(call)).toBe('写入工作区文件');
    expect(toolRiskSummary(call)).toContain('修改工作区文件');
  });

  it('settles open tools when persisted transport state says the response is no longer live', () => {
    const [call] = projectToolCalls(
      [
        {
          type: 'confirmation_required',
          tool_id: 'tool-persisted',
          tool_name: 'bash',
          args: { command: 'bun test' },
        },
      ],
      [],
      { settleOpen: true }
    );

    expect(call).toMatchObject({ state: 'interrupted', reason: '任务已结束，这次确认不再有效。' });
  });

  it('projects persisted content blocks when live events are unavailable', () => {
    const calls = projectToolCalls(
      [],
      [
        { type: 'tool_use', id: 'tool-4', name: 'read', input: { path: 'README.md' } },
        {
          type: 'tool_result',
          toolUseId: 'tool-4',
          name: 'read',
          content: 'complete persisted output',
          isError: false,
        },
      ]
    );

    expect(calls).toEqual([
      expect.objectContaining({
        id: 'tool-4',
        name: 'read',
        state: 'succeeded',
        args: { path: 'README.md' },
        output: 'complete persisted output',
      }),
    ]);
  });

  it('uses a product label for the Skill discovery tool', () => {
    const [call] = projectToolCalls([
      {
        type: 'tool_end',
        id: 'tool-search-skills',
        name: 'search_skills',
        args: { query: 'code review' },
        output: 'review-master',
        exit_code: 0,
      },
    ]);

    expect(toolActionLabel(call)).toBe('已搜索 Skill');
  });

  it('turns dot paths into a human workspace summary', () => {
    const [call] = projectToolCalls([
      {
        type: 'tool_end',
        id: 'tool-list',
        name: 'ls',
        args: { path: '.' },
        output: 'README.md',
        exit_code: 0,
      },
    ]);

    expect(toolArgumentSummary(call)).toBe('当前工作区');
  });

  it('summarizes a tool group by the state that needs the user most', () => {
    const calls = projectToolCalls([
      { type: 'tool_end', id: 'read', name: 'read', output: 'done', exit_code: 0 },
      { type: 'tool_execution_start', id: 'test', name: 'bash', args: { command: 'bun test' } },
      {
        type: 'confirmation_required',
        tool_id: 'write',
        tool_name: 'write',
        args: { path: 'src/app.ts' },
      },
    ]);

    expect(summarizeToolCalls(calls)).toEqual({
      tone: 'attention',
      label: '3 项操作 · 1 项等待确认',
      active: 1,
      attention: 1,
      problems: 0,
      completed: 1,
      total: 3,
    });
  });

  it('reports settled execution groups without exposing raw event names', () => {
    const calls = projectToolCalls([
      { type: 'tool_end', id: 'read', name: 'read', output: 'done', exit_code: 0 },
      { type: 'tool_end', id: 'test', name: 'bash', output: 'passed', exit_code: 0 },
    ]);

    expect(summarizeToolCalls(calls)).toMatchObject({ tone: 'complete', label: '2 项操作已完成' });
  });

  it('keeps attention states visible while compacting older successful calls', () => {
    const calls = projectToolCalls([
      ...Array.from({ length: 8 }, (_, index) => ({
        type: 'tool_end',
        id: `read-${index + 1}`,
        name: 'read',
        output: `file ${index + 1}`,
        exit_code: 0,
      })),
      { type: 'tool_execution_start', id: 'test', name: 'bash', args: { command: 'bun test' } },
      {
        type: 'confirmation_required',
        tool_id: 'write',
        tool_name: 'write',
        args: { path: 'src/app.ts' },
      },
    ]);

    const compact = selectToolCallsForDisplay(calls);

    expect(compact.hiddenCount).toBe(4);
    expect(compact.calls.map((call) => call.id)).toEqual(['read-5', 'read-6', 'read-7', 'read-8', 'test', 'write']);
  });
});
