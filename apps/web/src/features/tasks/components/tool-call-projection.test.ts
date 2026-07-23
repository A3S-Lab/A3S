import { describe, expect, it } from 'vitest';
import {
  canonicalToolName,
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

  it('preserves a rejected HITL decision when the runtime reports its synthetic non-zero tool result', () => {
    const [call] = projectToolCalls([
      { type: 'tool_start', id: 'tool-rejected', name: 'bash' },
      {
        type: 'confirmation_required',
        tool_id: 'tool-rejected',
        tool_name: 'bash',
        args: { command: 'rm generated.txt' },
      },
      {
        type: 'confirmation_received',
        tool_id: 'tool-rejected',
        approved: false,
        reason: 'User rejected it',
      },
      {
        type: 'tool_end',
        id: 'tool-rejected',
        name: 'bash',
        output: 'execution was REJECTED by the user',
        exit_code: 1,
        duration_ms: 42,
        metadata: { policy: 'hitl' },
      },
    ]);

    expect(call).toMatchObject({
      state: 'denied',
      reason: 'User rejected it',
      output: 'execution was REJECTED by the user',
      exitCode: 1,
      durationMs: 42,
      metadata: { policy: 'hitl' },
    });
    expect(toolActionLabel(call)).toBe('命令未执行');
  });

  it('projects a user-cancelled DeepResearch run as interrupted instead of failed', () => {
    const [call] = projectToolCalls([
      { type: 'tool_start', id: 'research-cancelled', name: 'deep_research' },
      {
        type: 'tool_end',
        id: 'research-cancelled',
        name: 'deep_research',
        output: 'DeepResearch was cancelled by the user.',
        exit_code: 1,
        metadata: { duration_ms: 240 },
      },
      { type: 'error', message: 'DeepResearch was cancelled by the user.' },
    ]);

    expect(call).toMatchObject({
      state: 'interrupted',
      output: '',
      reason: '用户已停止深度研究。',
      metadata: {
        cancelled: true,
        message: 'DeepResearch was cancelled by the user.',
      },
    });
    expect(toolActionLabel(call)).toBe('深度研究已停止');
  });

  it('recognizes the typed cancellation kind emitted by the DeepResearch runtime', () => {
    const message = 'DeepResearch was cancelled by the user.';
    const [call] = projectToolCalls([
      { type: 'tool_start', id: 'research-typed-cancellation', name: 'deep_research' },
      {
        type: 'tool_end',
        id: 'research-typed-cancellation',
        name: 'deep_research',
        output: message,
        exit_code: 1,
        error_kind: { type: 'cancelled', op: 'deep_research' },
        metadata: { duration_ms: 240, cancelled: true, message },
      },
      { type: 'agent_end', text: message },
    ]);

    expect(call).toMatchObject({
      state: 'interrupted',
      output: '',
      errorKind: 'cancelled',
      reason: '用户已停止深度研究。',
    });
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

  it('uses the same product semantics for Web API and namespaced tool aliases', () => {
    const calls = projectToolCalls(
      [],
      [
        {
          type: 'tool_use',
          id: 'shell-api',
          name: 'shell_command',
          input: { command: 'just web', cwd: '/workspace' },
        },
        {
          type: 'tool_result',
          toolUseId: 'shell-api',
          content: 'server started',
          isError: false,
          exitCode: 0,
        },
        {
          type: 'tool_use',
          id: 'read-api',
          name: 'functions.read_file',
          input: { path: 'README.md' },
        },
        {
          type: 'tool_result',
          toolUseId: 'read-api',
          content: '# A3S',
          isError: false,
        },
      ]
    );

    expect(canonicalToolName('functions.shell_command')).toBe('shell');
    expect(toolActionLabel(calls[0])).toBe('已执行命令');
    expect(toolOperationLabel(calls[0])).toBe('运行本地命令');
    expect(toolActionLabel(calls[1])).toBe('已读取文件');
    expect(toolArgumentSummary(calls[1])).toBe('README.md');
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
