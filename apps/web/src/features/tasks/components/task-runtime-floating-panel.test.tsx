import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { AgentEvent } from '../../../types/api';
import { TaskComposerGoalTiming } from './task-composer-goal-timing';
import { TaskRuntimeFloatingPanel } from './task-runtime-floating-panel';

describe('TaskRuntimeFloatingPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(11_000);
    appState.activeSessionId = 'task-1';
    appState.streamingSessionId = 'task-1';
    appState.goalTimings = { 'task-1': { goal: '完成运行态体验', startedAt: 1_000 } };
    appState.executionTimings = { 'task-1': { startedAt: 5_000, status: 'running' } };
    appState.sessionControls = {
      'task-1': {
        sessionId: 'task-1',
        effort: 'medium',
        goal: '完成运行态体验',
        planningMode: 'enabled',
        goalTracking: true,
      },
    };
    appState.messagesBySession = {
      'task-1': [
        {
          id: 'assistant-1',
          sessionId: 'task-1',
          role: 'assistant',
          content: '',
          createdAt: new Date(5_000).toISOString(),
          pending: true,
          events: [],
        },
      ],
    };
    appState.streamEvents = [];
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stays hidden while planning has not emitted tasks or parallel work', () => {
    setEvents([{ type: 'planning_start' }]);

    render(<TaskRuntimeFloatingPanel />);

    expect(screen.queryByLabelText('任务进度浮窗')).not.toBeInTheDocument();
  });

  it('shows real parallel subagents without manufacturing a plan', () => {
    setEvents([
      {
        type: 'subagent_start',
        task_id: 'child-1',
        session_id: 'child-session-1',
        agent: 'explore',
        description: '检查组件边界',
        started_ms: 7_000,
      },
    ]);

    render(<TaskRuntimeFloatingPanel />);

    expect(screen.getByLabelText('并行子智能体浮窗')).toHaveTextContent('并行执行');
    expect(screen.getByRole('region', { name: '并行执行详情' })).toHaveTextContent('检查组件边界');
    expect(screen.queryByRole('progressbar', { name: '任务完成度' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '任务列表' })).not.toBeInTheDocument();
  });

  it('docks a compact summary instead of auto-covering the transcript in a narrow conversation pane', () => {
    setEvents([
      {
        type: 'subagent_start',
        task_id: 'child-1',
        session_id: 'child-session-1',
        agent: 'explore',
        description: '检查窄对话区布局',
        started_ms: 7_000,
      },
    ]);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('task-conversation-pane')) return runtimeRect(0, 0, 640, 900);
      if (this.classList.contains('task-runtime-floating-panel')) return runtimeRect(264, 52, 360, 48);
      if (this.classList.contains('task-runtime-floating-trigger')) return runtimeRect(264, 52, 360, 48);
      return runtimeRect(0, 0, 0, 0);
    });

    render(
      <section className='task-conversation-pane'>
        <TaskRuntimeFloatingPanel />
      </section>
    );

    expect(screen.getByLabelText('并行子智能体浮窗')).toHaveAttribute('data-layout', 'compact');
    expect(screen.getByRole('button', { name: '展开并行执行' })).toBeInTheDocument();
    expect(document.querySelector('.task-conversation-pane')).toHaveAttribute('data-task-runtime-layout', 'compact');

    fireEvent.click(screen.getByRole('button', { name: '展开并行执行' }));
    expect(screen.getByRole('region', { name: '并行执行详情' })).toHaveTextContent('检查窄对话区布局');
  });

  it('measures the pane when the first runtime evidence mounts after planning started', () => {
    setEvents([{ type: 'planning_start' }]);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('task-conversation-pane')) return runtimeRect(0, 0, 640, 900);
      if (this.classList.contains('task-runtime-floating-panel')) return runtimeRect(264, 52, 360, 48);
      if (this.classList.contains('task-runtime-floating-trigger')) return runtimeRect(264, 52, 360, 48);
      return runtimeRect(0, 0, 0, 0);
    });
    const view = render(
      <section className='task-conversation-pane'>
        <TaskRuntimeFloatingPanel />
      </section>
    );
    expect(screen.queryByLabelText('并行子智能体浮窗')).not.toBeInTheDocument();

    act(() => {
      setEvents([
        {
          type: 'subagent_start',
          task_id: 'late-child',
          session_id: 'late-child-session',
          agent: 'review',
          description: '复核首次证据布局',
          started_ms: 8_000,
        },
      ]);
    });
    view.rerender(
      <section className='task-conversation-pane'>
        <TaskRuntimeFloatingPanel />
      </section>
    );

    expect(screen.getByLabelText('并行子智能体浮窗')).toHaveAttribute('data-layout', 'compact');
    expect(document.querySelector('.task-conversation-pane')).toHaveAttribute('data-task-runtime-layout', 'compact');
  });

  it('keeps goal elapsed time separate from task tracking', () => {
    render(
      <>
        <TaskComposerGoalTiming />
        <TaskRuntimeFloatingPanel />
      </>
    );

    expect(screen.getByLabelText('目标执行耗时 00:10')).toHaveTextContent('目标00:10');
    expect(screen.queryByLabelText('任务进度浮窗')).not.toBeInTheDocument();
  });

  it('appears after PlanningEnd and shows the task list and completion', () => {
    setEvents([
      {
        type: 'planning_end',
        plan: {
          goal: '完成运行态体验',
          steps: [
            { id: 'one', content: '梳理状态', status: 'pending' },
            { id: 'two', content: '实现面板', status: 'pending' },
          ],
          complexity: 'medium',
          required_tools: [],
          estimated_steps: 2,
        },
      },
      { type: 'step_end', step_id: 'one', status: 'completed' },
      {
        type: 'subagent_start',
        task_id: 'child-1',
        session_id: 'child-session-1',
        agent: 'explore',
        description: '检查组件边界',
        started_ms: 7_000,
      },
    ]);
    render(<TaskRuntimeFloatingPanel />);

    const panel = screen.getByRole('region', { name: '任务规划与执行' });
    expect(screen.getByRole('button', { name: '收起任务进度' })).toHaveTextContent('1/2');
    expect(panel).toHaveTextContent('梳理状态');
    expect(panel).toHaveTextContent('实现面板');
    expect(panel).toHaveTextContent('1 项完成');
    expect(panel).toHaveTextContent('检查组件边界');
    expect(panel).toHaveTextContent('00:04');
    expect(panel).not.toHaveTextContent('等待计划');

    fireEvent.click(screen.getByRole('button', { name: '收起任务进度' }));
    expect(screen.queryByRole('region', { name: '任务规划与执行' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展开任务进度' })).toBeInTheDocument();
  });

  it('keeps the completed task list after a turn finishes', () => {
    appState.streamingSessionId = null;
    setEvents([
      {
        type: 'task_updated',
        tasks: [
          { id: 'one', content: '梳理状态', status: 'completed' },
          { id: 'two', content: '实现面板', status: 'completed' },
        ],
      },
    ]);

    render(<TaskRuntimeFloatingPanel />);

    expect(screen.getByRole('button', { name: '收起任务进度' })).toHaveTextContent('2/2');
  });

  it('restores plan and subagent evidence from a persisted completed turn', () => {
    appState.streamingSessionId = null;
    appState.executionTimings = {};
    appState.messagesBySession = {
      'task-1': [
        {
          id: 'persisted-user',
          sessionId: 'task-1',
          role: 'user',
          content: '验证持久化运行证据',
          createdAt: new Date(4_000).toISOString(),
        },
        {
          id: 'persisted-assistant',
          sessionId: 'task-1',
          role: 'assistant',
          content: '验证完成。',
          createdAt: new Date(5_000).toISOString(),
          events: [
            {
              type: 'task_updated',
              tasks: [{ id: 'persist', content: '恢复任务与子智能体证据', status: 'completed' }],
            },
            {
              type: 'subagent_start',
              task_id: 'persisted-child',
              session_id: 'persisted-child-session',
              agent: 'review',
              description: '复核持久化记录',
              started_ms: 5_000,
            },
            {
              type: 'subagent_end',
              task_id: 'persisted-child',
              session_id: 'persisted-child-session',
              agent: 'review',
              output: '刷新后仍可查看完整证据。',
              success: true,
              finished_ms: 9_000,
            },
            { type: 'agent_end', text: '验证完成。' },
          ],
        },
      ],
    };

    render(<TaskRuntimeFloatingPanel />);

    expect(screen.getByRole('button', { name: '收起任务进度' })).toHaveTextContent('1/1');
    expect(screen.getByRole('button', { name: '收起任务进度' })).toHaveTextContent('00:01');
    expect(screen.getByRole('region', { name: '任务规划与执行' })).toHaveTextContent('复核持久化记录');
    fireEvent.click(screen.getByRole('button', { name: '复核持久化记录，已完成，查看结果与记录' }));
    expect(screen.getByText('刷新后仍可查看完整证据。')).toBeInTheDocument();
  });

  it('uses the persisted assistant timestamp for an interrupted child duration', () => {
    appState.streamingSessionId = null;
    appState.executionTimings = {};
    appState.messagesBySession = {
      'task-1': [
        {
          id: 'persisted-user',
          sessionId: 'task-1',
          role: 'user',
          content: '验证中断耗时',
          createdAt: new Date(4_000).toISOString(),
        },
        {
          id: 'persisted-assistant',
          sessionId: 'task-1',
          role: 'assistant',
          content: '',
          createdAt: new Date(9_000).toISOString(),
          events: [
            {
              type: 'subagent_start',
              task_id: 'orphaned-child',
              session_id: 'orphaned-child-session',
              agent: 'trace',
              description: '追踪断流恢复',
              started_ms: 5_000,
            },
            { type: 'agent_end', text: '父回合结束' },
          ],
        },
      ],
    };

    render(<TaskRuntimeFloatingPanel />);

    expect(screen.getByRole('region', { name: '并行执行详情' })).toHaveTextContent('00:04');
  });

  it('treats the protocol terminal event as settled before the stream transport closes', () => {
    setEvents([
      {
        type: 'task_updated',
        tasks: [{ id: 'one', content: '完成验证', status: 'completed' }],
      },
      { type: 'agent_end', text: '验证完成' },
    ]);

    render(<TaskRuntimeFloatingPanel />);

    const trigger = screen.getByRole('button', { name: '收起任务进度' });
    expect(trigger).toHaveTextContent('本轮任务已完成');
    expect(trigger).not.toHaveTextContent('正在准备下一项');
  });

  it('does not leave unfinished plan rows running after a persisted terminal event', () => {
    appState.streamingSessionId = null;
    setEvents([
      {
        type: 'task_updated',
        tasks: [
          { id: 'one', content: '完成状态映射', status: 'completed' },
          { id: 'two', content: '验证历史消息', status: 'in_progress' },
          { id: 'three', content: '整理交付证据', status: 'pending' },
        ],
      },
      { type: 'agent_end', text: '回合已结束' },
    ]);

    render(<TaskRuntimeFloatingPanel />);

    const trigger = screen.getByRole('button', { name: '收起任务进度' });
    expect(trigger).toHaveTextContent('2 项已中断');
    expect(trigger).not.toHaveTextContent('正在');
    expect(screen.getByRole('region', { name: '任务规划与执行' })).toHaveTextContent('2 项中断');
  });

  it('surfaces a failed plan before pending work instead of claiming it is waiting', () => {
    setEvents([
      {
        type: 'task_updated',
        tasks: [
          { id: 'one', content: '检查状态投影', status: 'completed' },
          { id: 'two', content: '验证运行面板', status: 'failed' },
          { id: 'three', content: '完成交付', status: 'pending' },
        ],
      },
    ]);

    render(<TaskRuntimeFloatingPanel />);

    const trigger = screen.getByRole('button', { name: '收起任务进度' });
    expect(trigger).toHaveTextContent('1 项失败');
    expect(trigger).not.toHaveTextContent('等待下一步');
    expect(screen.getByRole('region', { name: '任务规划与执行' })).toHaveTextContent('1 项失败');
  });

  it('keeps completed and failed subagents distinct and discloses their evidence', () => {
    setEvents([
      {
        type: 'subagent_start',
        task_id: 'child-1',
        session_id: 'child-session-1',
        parent_session_id: 'task-1',
        agent: 'explore',
        description: '检查组件边界',
        started_ms: 7_000,
      },
      {
        type: 'subagent_progress',
        task_id: 'child-1',
        session_id: 'child-session-1',
        status: 'turn_completed',
        metadata: { turn: 1, completion_tokens: 30 },
      },
      {
        type: 'subagent_end',
        task_id: 'child-1',
        session_id: 'child-session-1',
        agent: 'explore',
        output: '确认组件边界清晰。',
        success: true,
        finished_ms: 9_000,
      },
      {
        type: 'subagent_start',
        task_id: 'child-2',
        session_id: 'child-session-2',
        agent: 'review',
        description: '检查失败恢复',
        started_ms: 7_500,
      },
      {
        type: 'subagent_end',
        task_id: 'child-2',
        session_id: 'child-session-2',
        agent: 'review',
        output: '连接在验证前中断。',
        success: false,
        finished_ms: 10_000,
      },
    ]);

    render(<TaskRuntimeFloatingPanel />);

    const trigger = screen.getByRole('button', { name: '收起并行执行' });
    expect(trigger).toHaveTextContent('1 个子智能体失败');
    expect(trigger).toHaveTextContent('1 失败');
    expect(trigger).not.toHaveTextContent('2/2');
    expect(screen.getByText('30 tokens')).toBeInTheDocument();

    const resultControl = screen.getByText('查看结果与记录');
    const evidenceButton = resultControl.closest('button');
    expect(evidenceButton).not.toBeNull();
    expect(evidenceButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '检查组件边界，已完成，查看结果与记录' })).toBeInTheDocument();
    fireEvent.click(resultControl);
    expect(evidenceButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('确认组件边界清晰。')).toBeInTheDocument();
  });

  it('settles an orphaned subagent when the parent execution fails', () => {
    setEvents([
      {
        type: 'subagent_start',
        task_id: 'child-1',
        session_id: 'child-session-1',
        agent: 'explore',
        description: '检查连接状态',
        started_ms: 7_000,
      },
      { type: 'error', message: 'stream disconnected' },
    ]);
    appState.executionTimings['task-1'] = { startedAt: 5_000, completedAt: 10_000, status: 'failed' };

    render(<TaskRuntimeFloatingPanel />);

    expect(screen.getByRole('button', { name: '收起并行执行' })).toHaveTextContent('执行已中断');
    expect(screen.getByRole('region', { name: '并行执行详情' })).toHaveTextContent('已中断');
  });

  it('prioritizes four parallel runs and progressively reveals the remainder', () => {
    setEvents(
      Array.from({ length: 6 }, (_, index) => ({
        type: 'subagent_start',
        task_id: `child-${index + 1}`,
        session_id: `child-session-${index + 1}`,
        agent: 'explore',
        description: `并行检查 ${index + 1}`,
        started_ms: 7_000 + index,
      }))
    );

    render(<TaskRuntimeFloatingPanel />);

    expect(screen.getByText('并行检查 1')).toBeInTheDocument();
    expect(screen.getByText('并行检查 4')).toBeInTheDocument();
    expect(screen.queryByText('并行检查 5')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看其余 2 个子智能体' }));
    expect(screen.getByText('并行检查 5')).toBeInTheDocument();
    expect(screen.getByText('并行检查 6')).toBeInTheDocument();
  });

  it('respects a manual collapse when another healthy parallel branch starts', () => {
    const events: AgentEvent[] = [
      {
        type: 'subagent_start',
        task_id: 'child-1',
        session_id: 'child-session-1',
        agent: 'explore',
        description: '检查消息结构',
        started_ms: 7_000,
      },
    ];
    setEvents(events);
    const view = render(<TaskRuntimeFloatingPanel />);
    fireEvent.click(screen.getByRole('button', { name: '收起并行执行' }));

    act(() => {
      setEvents([
        ...events,
        {
          type: 'subagent_start',
          task_id: 'child-2',
          session_id: 'child-session-2',
          agent: 'review',
          description: '复核视觉层级',
          started_ms: 8_000,
        },
      ]);
    });
    view.rerender(<TaskRuntimeFloatingPanel />);

    expect(screen.getByRole('button', { name: '展开并行执行' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '并行执行详情' })).not.toBeInTheDocument();
  });

  it('reopens a manually collapsed panel when a branch needs attention', () => {
    const events: AgentEvent[] = [
      {
        type: 'subagent_start',
        task_id: 'child-1',
        session_id: 'child-session-1',
        agent: 'review',
        description: '检查异常恢复',
        started_ms: 7_000,
      },
    ];
    setEvents(events);
    const view = render(<TaskRuntimeFloatingPanel />);
    fireEvent.click(screen.getByRole('button', { name: '收起并行执行' }));

    act(() => {
      setEvents([
        ...events,
        {
          type: 'subagent_end',
          task_id: 'child-1',
          session_id: 'child-session-1',
          agent: 'review',
          output: '连接中断，未能完成验证。',
          success: false,
          finished_ms: 10_000,
        },
      ]);
    });
    view.rerender(<TaskRuntimeFloatingPanel />);

    expect(screen.getByRole('button', { name: '收起并行执行' })).toHaveTextContent('1 个子智能体失败');
    expect(screen.getByRole('region', { name: '并行执行详情' })).toHaveTextContent('检查异常恢复');
  });

  it('keeps expanded subagent evidence open while healthy siblings arrive', () => {
    const events: AgentEvent[] = [
      {
        type: 'subagent_start',
        task_id: 'child-1',
        session_id: 'child-session-1',
        agent: 'explore',
        description: '检查状态投影',
        started_ms: 7_000,
      },
      {
        type: 'subagent_end',
        task_id: 'child-1',
        session_id: 'child-session-1',
        agent: 'explore',
        output: '状态投影符合事件顺序。',
        success: true,
        finished_ms: 8_000,
      },
    ];
    setEvents(events);
    const view = render(<TaskRuntimeFloatingPanel />);
    fireEvent.click(screen.getByRole('button', { name: '检查状态投影，已完成，查看结果与记录' }));
    expect(screen.getByText('状态投影符合事件顺序。')).toBeInTheDocument();

    act(() => {
      setEvents([
        ...events,
        {
          type: 'subagent_start',
          task_id: 'child-2',
          session_id: 'child-session-2',
          agent: 'test',
          description: '运行回归测试',
          started_ms: 8_500,
        },
      ]);
    });
    view.rerender(<TaskRuntimeFloatingPanel />);

    expect(screen.getByRole('button', { name: '检查状态投影，已完成，查看结果与记录' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('状态投影符合事件顺序。')).toBeInTheDocument();
  });

  it('exposes the complete text for dense plan rows', () => {
    const content = '检查长任务描述在窄浮窗中不会只剩下无法理解的省略片段，并保留完整可读内容';
    setEvents([{ type: 'task_updated', tasks: [{ id: 'long-step', content, status: 'pending' }] }]);

    render(<TaskRuntimeFloatingPanel />);

    expect(screen.getByText(content)).toHaveAttribute('title', content);
  });

  it('reopens for a new turn even when the plan reuses the same step ids', () => {
    const repeatedPlan: AgentEvent[] = [
      {
        type: 'task_updated',
        tasks: [{ id: 'step-1', content: '复核实现', status: 'in_progress' }],
      },
    ];
    setEvents(repeatedPlan);
    const view = render(<TaskRuntimeFloatingPanel />);
    fireEvent.click(screen.getByRole('button', { name: '收起任务进度' }));
    expect(screen.getByRole('button', { name: '展开任务进度' })).toBeInTheDocument();

    act(() => {
      appState.executionTimings['task-1'] = { startedAt: 12_000, status: 'running' };
      appState.messagesBySession['task-1'] = [
        {
          id: 'user-2',
          sessionId: 'task-1',
          role: 'user',
          content: '继续复核',
          createdAt: new Date(11_000).toISOString(),
        },
        {
          id: 'assistant-2',
          sessionId: 'task-1',
          role: 'assistant',
          content: '',
          createdAt: new Date(12_000).toISOString(),
          pending: true,
          events: repeatedPlan,
        },
      ];
    });
    view.rerender(<TaskRuntimeFloatingPanel />);

    expect(screen.getByRole('button', { name: '收起任务进度' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '任务规划与执行' })).toBeInTheDocument();
  });

  it('clears the previous task list when the next user turn starts', () => {
    appState.streamingSessionId = null;
    setEvents([
      {
        type: 'task_updated',
        tasks: [{ id: 'old', content: '上一轮任务', status: 'completed' }],
      },
    ]);
    appState.messagesBySession['task-1']?.push({
      id: 'user-2',
      sessionId: 'task-1',
      role: 'user',
      content: '开始下一轮',
      createdAt: new Date(10_000).toISOString(),
    });

    render(<TaskRuntimeFloatingPanel />);

    expect(screen.queryByLabelText('任务进度浮窗')).not.toBeInTheDocument();
  });
});

function setEvents(events: AgentEvent[]) {
  const message = appState.messagesBySession['task-1']?.[0];
  if (message) message.events = events;
}

function runtimeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}
