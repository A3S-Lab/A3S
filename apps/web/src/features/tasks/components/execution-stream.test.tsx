import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { ExecutionStream } from './execution-stream';

describe('ExecutionStream permission decisions', () => {
  afterEach(() => {
    cleanup();
    appState.messagesLoading = {};
    appState.messageErrors = {};
    appState.streamingSessionId = null;
    appState.composerValue = '';
    appState.composerContextFiles = [];
    appState.composerSkills = [];
    appState.toolDecisionState = {};
    appState.toolDecisionErrors = {};
  });

  it('hides planner and synthesis messages while keeping the final response', () => {
    appState.activeSessionId = 'session-projection';
    appState.messagesBySession['session-projection'] = [
      {
        id: 'user-visible',
        sessionId: 'session-projection',
        role: 'user',
        content: '修改第2首诗歌的风格',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'assistant-old',
        sessionId: 'session-projection',
        role: 'assistant',
        content: '旧的阶段性回复',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'user-synthesis',
        sessionId: 'session-projection',
        role: 'user',
        content:
          '[synthesis]\nThe previous turn stopped without a final answer.\n\nOriginal user task:\n修改第2首诗歌的风格\n\nWrite the final answer now.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'assistant-final',
        sessionId: 'session-projection',
        role: 'assistant',
        content: '第2首诗歌已改为婉约风格。',
        createdAt: new Date().toISOString(),
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(screen.getByText('修改第2首诗歌的风格')).toBeInTheDocument();
    expect(screen.getByText('第2首诗歌已改为婉约风格。')).toBeInTheDocument();
    expect(screen.queryByText(/Original user task/)).not.toBeInTheDocument();
    expect(screen.queryByText('旧的阶段性回复')).not.toBeInTheDocument();
  });

  it('turns an unanswered persisted instruction into an editable recovery state', () => {
    appState.activeSessionId = 'session-interrupted';
    appState.messagesBySession['session-interrupted'] = [
      {
        id: 'user-interrupted',
        sessionId: 'session-interrupted',
        role: 'user',
        content: '运行重点测试',
        createdAt: new Date().toISOString(),
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(screen.getByRole('status', { name: '未完成的任务请求' })).toHaveTextContent('这次请求没有完成');
    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    expect(appState.composerValue).toContain('运行重点测试');
  });

  it('keeps instruction Skills and workspace files visible with local message actions', async () => {
    appState.activeSessionId = 'session-instruction-resources';
    appState.messagesBySession['session-instruction-resources'] = [
      {
        id: 'user-resources',
        sessionId: 'session-instruction-resources',
        role: 'user',
        content:
          '[Selected skills]\n- Use your `review-master` skill.\n[/Selected skills]\n\n[Workspace context files]\n- src/app.ts\n[/Workspace context files]\n\n审阅这次修改',
        createdAt: '2026-07-14T08:00:00.000Z',
      },
      {
        id: 'assistant-resources',
        sessionId: 'session-instruction-resources',
        role: 'assistant',
        content: '审阅完成。',
        createdAt: '2026-07-14T08:01:00.000Z',
      },
    ];
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(<ExecutionStream actions={{} as TaskActions} />);

    const instruction = screen.getByRole('article', { name: '你的任务指令' });
    expect(within(instruction).getByText('review-master')).toBeInTheDocument();
    expect(within(instruction).getByText('src/app.ts')).toBeInTheDocument();
    expect(instruction).not.toHaveTextContent('Selected skills');
    fireEvent.click(within(instruction).getByRole('button', { name: '复制消息' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('审阅这次修改'));
    fireEvent.click(within(instruction).getByRole('button', { name: '继续编辑这条指令' }));
    expect(appState.composerValue).toContain('审阅这次修改');
    expect(appState.composerContextFiles).toEqual(['src/app.ts']);
    expect(appState.composerSkills).toEqual(['review-master']);
  });

  it('anchors every assistant response with a stable Code header', () => {
    appState.activeSessionId = 'session-code-header';
    appState.messagesBySession['session-code-header'] = [
      {
        id: 'user-code-header',
        sessionId: 'session-code-header',
        role: 'user',
        content: '解释这个模块',
        createdAt: '2026-07-14T08:00:00.000Z',
      },
      {
        id: 'assistant-code-header',
        sessionId: 'session-code-header',
        role: 'assistant',
        content: '这是模块说明。',
        createdAt: '2026-07-14T08:01:00.000Z',
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    const response = screen.getByRole('article', { name: 'Code 回复' });
    expect(within(response).getByText('Code')).toBeInTheDocument();
    expect(within(response).getByRole('button', { name: '复制消息' })).toBeInTheDocument();
    expect(response.querySelector('time')).toHaveAttribute('datetime', '2026-07-14T08:01:00.000Z');
  });

  it('marks only the latest instruction as the runtime panel collision anchor', () => {
    appState.activeSessionId = 'session-runtime-anchor';
    appState.messagesBySession['session-runtime-anchor'] = [
      {
        id: 'user-runtime-anchor-1',
        sessionId: 'session-runtime-anchor',
        role: 'user',
        content: '先检查消息投影',
        createdAt: '2026-07-14T08:00:00.000Z',
      },
      {
        id: 'assistant-runtime-anchor-1',
        sessionId: 'session-runtime-anchor',
        role: 'assistant',
        content: '消息投影正常。',
        createdAt: '2026-07-14T08:01:00.000Z',
      },
      {
        id: 'user-runtime-anchor-2',
        sessionId: 'session-runtime-anchor',
        role: 'user',
        content: '继续检查运行面板',
        createdAt: '2026-07-14T08:02:00.000Z',
      },
      {
        id: 'assistant-runtime-anchor-2',
        sessionId: 'session-runtime-anchor',
        role: 'assistant',
        content: '运行面板正常。',
        createdAt: '2026-07-14T08:03:00.000Z',
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    const instructions = screen.getAllByRole('article', { name: '你的任务指令' });
    expect(instructions[0]).not.toHaveAttribute('data-task-runtime-anchor');
    expect(instructions[1]).toHaveAttribute('data-task-runtime-anchor', 'latest-instruction');
  });

  it('describes live parallel work in the assistant lifecycle instead of showing a generic pending state', () => {
    appState.activeSessionId = 'session-parallel-state';
    appState.messagesBySession['session-parallel-state'] = [
      {
        id: 'assistant-parallel-state',
        sessionId: 'session-parallel-state',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        pending: true,
        events: [
          {
            type: 'subagent_start',
            task_id: 'review',
            session_id: 'child-review',
            agent: 'review',
            description: '检查消息视图',
          },
        ],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(screen.getByText('正在并行执行')).toBeInTheDocument();
    expect(screen.queryByText('正在准备')).not.toBeInTheDocument();
  });

  it('distinguishes a task-load failure from an empty new task and offers retry', () => {
    appState.activeSessionId = 'session-load-error';
    appState.messagesBySession = {};
    appState.messagesLoading = { 'session-load-error': false };
    appState.messageErrors = { 'session-load-error': 'Connection refused' };
    const reloadActiveTask = vi.fn(async () => undefined);

    render(<ExecutionStream actions={{ reloadActiveTask } as unknown as TaskActions} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无法加载任务记录');
    expect(screen.queryByText('交给 Code 一个明确任务')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载任务' }));
    expect(reloadActiveTask).toHaveBeenCalledTimes(1);
  });

  it('renders a scoped approval card and confirms one tool call', () => {
    appState.activeSessionId = 'session-approval';
    appState.streamEvents = [];
    appState.toolDecisionState = {};
    appState.messagesBySession['session-approval'] = [
      {
        id: 'assistant-1',
        sessionId: 'session-approval',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        pending: true,
        events: [
          {
            type: 'confirmation_required',
            tool_id: 'tool-7',
            tool_name: 'Bash',
            args: { command: 'cargo test' },
            reason: 'Run the focused validation',
            scope: 'Current workspace',
            risk: 'Executes a local process',
            timeout_ms: 30000,
          },
        ],
      },
    ];
    const confirmToolUse = vi.fn(async () => undefined);
    render(<ExecutionStream actions={{ confirmToolUse } as unknown as TaskActions} />);
    expect(screen.getByText('需要你的确认')).toBeInTheDocument();
    expect(screen.getByText('Run the focused validation')).toBeInTheDocument();
    expect(screen.getByText('Current workspace')).toBeInTheDocument();
    expect(screen.getByText('Executes a local process')).toBeInTheDocument();
    expect(screen.getByText('30 秒')).toBeInTheDocument();
    const argumentsDisclosure = screen.getByRole('button', { name: '调用参数' });
    const rawArguments = screen.getByText(/"command": "cargo test"/);
    expect(argumentsDisclosure).toHaveAttribute('aria-expanded', 'false');
    expect(rawArguments).not.toBeVisible();
    fireEvent.click(argumentsDisclosure);
    expect(argumentsDisclosure).toHaveAttribute('aria-expanded', 'true');
    expect(rawArguments).toBeVisible();
    expect(screen.getByRole('region', { name: '命令预览' })).toHaveTextContent('cargo test');
    fireEvent.click(screen.getByRole('button', { name: '允许一次' }));
    expect(confirmToolUse).toHaveBeenCalledWith('session-approval', 'tool-7', true);
  });

  it('prevents duplicate permission decisions while one is submitting', () => {
    appState.activeSessionId = 'session-pending-approval';
    appState.toolDecisionState = { 'session-pending-approval:tool-8': 'approving' };
    appState.messagesBySession['session-pending-approval'] = [
      {
        id: 'assistant-pending-approval',
        sessionId: 'session-pending-approval',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        pending: true,
        events: [{ type: 'confirmation_required', tool_id: 'tool-8', tool_name: 'Bash' }],
      },
    ];
    render(<ExecutionStream actions={{} as TaskActions} />);
    expect(screen.getByRole('button', { name: '允许一次' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '拒绝' })).toBeDisabled();
  });

  it('keeps a failed HITL submission recoverable inside the owning tool card', () => {
    appState.activeSessionId = 'session-failed-approval';
    appState.toolDecisionState = {};
    appState.toolDecisionErrors = {
      'session-failed-approval:tool-9': '本地服务暂时无法提交确认',
    };
    appState.messagesBySession['session-failed-approval'] = [
      {
        id: 'assistant-failed-approval',
        sessionId: 'session-failed-approval',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        pending: true,
        events: [{ type: 'confirmation_required', tool_id: 'tool-9', tool_name: 'Bash' }],
      },
    ];

    render(<ExecutionStream actions={{ confirmToolUse: vi.fn() } as unknown as TaskActions} />);

    expect(screen.getByRole('alert')).toHaveTextContent('本地服务暂时无法提交确认');
    expect(screen.getByRole('button', { name: '允许一次' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '拒绝' })).toBeEnabled();
  });

  it('turns agent completion into a review handoff', () => {
    appState.activeSessionId = 'session-delivery';
    appState.reviewSourceTaskId = null;
    appState.messagesBySession['session-delivery'] = [
      {
        id: 'assistant-delivery',
        sessionId: 'session-delivery',
        role: 'assistant',
        content: 'Implementation complete.',
        createdAt: new Date().toISOString(),
        events: [
          {
            type: 'agent_end',
            verification_summary: {
              status: 'passed',
              report_count: 1,
              required_check_count: 2,
              pending_required_check_count: 0,
              failed_check_count: 0,
              residual_risk_count: 0,
            },
          },
        ],
      },
    ];
    render(<ExecutionStream actions={{} as TaskActions} />);
    expect(screen.getByText('任务已可审阅')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '交付检查完成度' })).toHaveAttribute('aria-valuenow', '100');
    fireEvent.click(screen.getByRole('button', { name: '审阅变更' }));
    expect(appState.reviewSourceTaskId).toBe('session-delivery');
    expect(appState.reviewIntent).toBe('review');
    expect(appState.taskView).toBe('review');
  });

  it('turns failed validation into a correction in the same task', () => {
    appState.activeSessionId = 'session-needs-fix';
    appState.composerValue = 'Preserve my draft';
    appState.messagesBySession['session-needs-fix'] = [
      {
        id: 'assistant-needs-fix',
        sessionId: 'session-needs-fix',
        role: 'assistant',
        content: 'Implementation complete with a failed check.',
        createdAt: new Date().toISOString(),
        events: [
          {
            type: 'agent_end',
            verification_summary: {
              status: 'failed',
              report_count: 1,
              required_check_count: 1,
              pending_required_check_count: 0,
              failed_check_count: 1,
              residual_risk_count: 0,
              failed_subjects: ['bun run test'],
            },
          },
        ],
      },
    ];
    render(<ExecutionStream actions={{} as TaskActions} />);
    expect(screen.getByText('任务完成，仍需验证')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '交付检查完成度' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('progressbar', { name: '交付检查完成度' })).toHaveAttribute(
      'aria-valuetext',
      '0/1 项必需检查已通过'
    );
    fireEvent.click(screen.getByRole('button', { name: '继续修正' }));
    expect(appState.activeSessionId).toBe('session-needs-fix');
    expect(appState.taskView).toBe('conversation');
    expect(appState.composerValue).toContain('Preserve my draft');
    expect(appState.composerValue).toContain('bun run test');
  });

  it('does not turn a conversational reply without verification evidence into a delivery', () => {
    appState.activeSessionId = 'session-chat';
    appState.messagesBySession['session-chat'] = [
      {
        id: 'assistant-chat',
        sessionId: 'session-chat',
        role: 'assistant',
        content: 'Hi! How can I help?',
        createdAt: new Date().toISOString(),
        events: [
          {
            type: 'agent_end',
            verification_summary: {
              status: 'skipped',
              report_count: 0,
              required_check_count: 0,
              pending_required_check_count: 0,
              failed_check_count: 0,
              residual_risk_count: 0,
            },
          },
        ],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);
    expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument();
    expect(screen.queryByLabelText('任务交付摘要')).not.toBeInTheDocument();
  });

  it('keeps planning details in the task runtime panel instead of duplicating them inline', () => {
    appState.activeSessionId = 'session-plan';
    appState.messagesBySession['session-plan'] = [
      {
        id: 'assistant-plan',
        sessionId: 'session-plan',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        pending: true,
        events: [
          {
            type: 'planning_end',
            plan: {
              goal: 'Rebuild Web',
              complexity: 'medium',
              required_tools: [],
              estimated_steps: 2,
              steps: [
                { id: 'one', content: 'Inspect architecture', status: 'pending' },
                { id: 'two', content: 'Implement shell', status: 'pending' },
              ],
            },
          },
          { type: 'step_start', step_id: 'two', description: 'Implement shell', step_number: 2, total_steps: 2 },
          { type: 'step_end', step_id: 'one', status: 'completed', step_number: 1, total_steps: 2 },
        ],
      },
    ];
    render(<ExecutionStream actions={{} as TaskActions} />);
    expect(screen.queryByLabelText('执行计划')).not.toBeInTheDocument();
  });

  it('does not repeat a tool result already represented in the semantic timeline', () => {
    appState.activeSessionId = 'session-tool-output';
    appState.messagesBySession['session-tool-output'] = [
      {
        id: 'assistant-tool-output',
        sessionId: 'session-tool-output',
        role: 'assistant',
        content: 'Done.',
        createdAt: new Date().toISOString(),
        events: [{ type: 'tool_end', tool_id: 'tool-1', tool_name: 'Bash', output: 'focused output' }],
        contentBlocks: [{ type: 'tool_result', toolUseId: 'tool-1', name: 'Bash', content: 'focused output' }],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);
    expect(screen.getAllByText('focused output')).toHaveLength(1);
  });

  it('exposes a completed file edit as a direct artifact entry', () => {
    appState.activeSessionId = 'session-artifact';
    appState.reviewSourceTaskId = null;
    appState.messagesBySession['session-artifact'] = [
      {
        id: 'assistant-artifact',
        sessionId: 'session-artifact',
        role: 'assistant',
        content: '已完成修改。',
        createdAt: new Date().toISOString(),
        events: [
          {
            type: 'tool_end',
            id: 'edit-1',
            name: 'edit',
            args: { path: 'src/app.ts' },
            output: 'updated',
            exit_code: 0,
          },
        ],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(screen.getByLabelText('任务产物')).toHaveTextContent('app.ts');
    expect(screen.getByLabelText('任务产物')).toHaveTextContent('src · 查看 Diff');
    fireEvent.click(screen.getByRole('button', { name: '查看 src/app.ts 的变更' }));
    expect(appState.reviewSourceTaskId).toBe('session-artifact');
    expect(appState.reviewIntent).toBe('review');
    expect(appState.taskView).toBe('review');
  });

  it('keeps successful tool output complete and collapsed until requested', () => {
    const completeOutput = `${'0123456789'.repeat(50)}\nfinal line must remain visible`;
    appState.activeSessionId = 'session-full-tool-output';
    appState.messagesBySession['session-full-tool-output'] = [
      {
        id: 'assistant-full-tool-output',
        sessionId: 'session-full-tool-output',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        events: [
          {
            type: 'tool_end',
            id: 'tool-full',
            name: 'bash',
            args: { command: 'bun test' },
            output: completeOutput,
            exit_code: 0,
          },
        ],
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);
    const details = container.querySelector('.tool-call-item');
    const disclosure = details?.querySelector('button[aria-expanded]');
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('输出预览')).toHaveTextContent('final line must remain visible');
    expect(container.querySelector('.tool-call-output')).not.toBeInTheDocument();
    fireEvent.click(disclosure!);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.tool-call-output')?.textContent).toBe(completeOutput);
    expect(screen.getByRole('region', { name: '执行过程' })).toHaveTextContent('1 项操作已完成');
    expect(screen.getByLabelText('执行信息')).toHaveTextContent('bash');
  });

  it('renders the shell command, parameters, cwd, and incremental output as the primary execution preview', () => {
    appState.activeSessionId = 'session-command-preview';
    appState.messagesBySession['session-command-preview'] = [
      {
        id: 'assistant-command-preview',
        sessionId: 'session-command-preview',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        pending: true,
        events: [
          {
            type: 'tool_execution_start',
            tool_id: 'tool-command-preview',
            tool_name: 'bash',
            args: {
              command: 'cargo test -p a3s-cli --test web_cli',
              cwd: '/repo/crates/cli',
            },
          },
          {
            type: 'tool_output_delta',
            tool_id: 'tool-command-preview',
            tool_name: 'bash',
            delta: 'running 13 tests\n',
          },
          {
            type: 'tool_output_delta',
            tool_id: 'tool-command-preview',
            tool_name: 'bash',
            delta: 'test result: ok\n',
          },
        ],
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);

    const command = screen.getByRole('region', { name: '命令预览' });
    expect(command).toHaveTextContent('cargo test -p a3s-cli --test web_cli');
    expect(command).toHaveTextContent('/repo/crates/cli');
    expect(command.querySelector('[data-syntax-role="program"]')).toHaveTextContent('cargo');
    expect(command.querySelectorAll('[data-syntax-role="flag"]')).toHaveLength(2);
    expect(screen.getByRole('log', { name: '实时工具输出' })).toHaveTextContent('test result: ok');
    expect(container.querySelector('.tool-call-result')).toHaveTextContent('实时输出 · 2 行');
  });

  it('compacts older successful tool calls without hiding active evidence', () => {
    appState.activeSessionId = 'session-tool-density';
    appState.messagesBySession['session-tool-density'] = [
      {
        id: 'assistant-tool-density',
        sessionId: 'session-tool-density',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        events: Array.from({ length: 8 }, (_, index) => ({
          type: 'tool_end',
          id: `read-${index + 1}`,
          name: 'read',
          args: { path: `src/file-${index + 1}.ts` },
          output: `file ${index + 1}`,
          exit_code: 0,
        })),
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);

    expect(container.querySelectorAll('.tool-call-item')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: '查看之前 4 项已完成操作' }));
    expect(container.querySelectorAll('.tool-call-item')).toHaveLength(8);
  });

  it('collapses a running tool in place when it succeeds', async () => {
    appState.activeSessionId = 'session-tool-transition';
    appState.messagesBySession['session-tool-transition'] = [
      {
        id: 'assistant-tool-transition',
        sessionId: 'session-tool-transition',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        pending: true,
        events: [
          {
            type: 'tool_execution_start',
            tool_id: 'tool-transition',
            tool_name: 'bash',
            args: { command: 'bun test' },
          },
        ],
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);
    const details = container.querySelector('.tool-call-item');
    const disclosure = details?.querySelector('button[aria-expanded]');
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');

    appState.messagesBySession['session-tool-transition'][0].pending = false;
    appState.messagesBySession['session-tool-transition'][0].events = [
      {
        type: 'tool_end',
        tool_id: 'tool-transition',
        tool_name: 'bash',
        output: 'passed',
        exit_code: 0,
      },
    ];

    await waitFor(() => expect(disclosure).toHaveAttribute('aria-expanded', 'false'));
  });

  it('offers a direct way back to the latest content after the user scrolls upward', () => {
    appState.activeSessionId = 'session-scroll-latest';
    appState.messagesBySession['session-scroll-latest'] = [
      {
        id: 'assistant-scroll-latest',
        sessionId: 'session-scroll-latest',
        role: 'assistant',
        content: 'A long response',
        createdAt: new Date().toISOString(),
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);
    const scroll = container.querySelector('.execution-scroll') as HTMLDivElement;
    Object.defineProperties(scroll, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 120 },
    });
    scroll.scrollTo = vi.fn();
    fireEvent.scroll(scroll);

    fireEvent.click(screen.getByRole('button', { name: '查看最新内容' }));
    expect(scroll.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'smooth' });
  });

  it('renders Markdown through Streamdown and highlights fenced code', async () => {
    appState.activeSessionId = 'session-markdown';
    appState.messagesBySession['session-markdown'] = [
      {
        id: 'assistant-markdown',
        sessionId: 'session-markdown',
        role: 'assistant',
        content: '# 构建结果\n\n```ts\nconst answer: number = 42;\n```',
        createdAt: new Date().toISOString(),
        pending: false,
        events: [],
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);
    expect(await screen.findByRole('heading', { name: '构建结果' }, { timeout: 10_000 })).toBeInTheDocument();
    expect(container.querySelector('.streaming-markdown')).toHaveClass('a3s-document-markdown');
    await waitFor(() => expect(container.querySelector('pre code span')).toBeInTheDocument());
    expect(container.querySelector('pre code')?.className).toContain('counter-reset');
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument();
  }, 20_000);

  it('renders refined GFM document elements with accessible semantics', async () => {
    appState.activeSessionId = 'session-refined-markdown';
    appState.messagesBySession['session-refined-markdown'] = [
      {
        id: 'assistant-refined-markdown',
        sessionId: 'session-refined-markdown',
        role: 'assistant',
        content: [
          '## 发布检查',
          '',
          '> 请先完成验证。',
          '',
          '- [x] 类型检查',
          '- [ ] 浏览器验收',
          '',
          '| 项目 | 状态 |',
          '| --- | --- |',
          '| 构建 | 通过 |',
          '',
          '---',
          '',
          '[查看文档](https://example.com/docs)',
        ].join('\n'),
        createdAt: new Date().toISOString(),
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);

    expect(await screen.findByRole('heading', { name: '发布检查' })).toBeInTheDocument();
    expect(container.querySelector('.streaming-markdown')).toHaveClass('a3s-document-markdown');
    expect(container.querySelector('blockquote')).toHaveTextContent('请先完成验证');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(screen.getByRole('table')).toHaveTextContent('构建');
    expect(container.querySelector('hr')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看文档' })).toHaveAttribute('data-streamdown', 'link');
  });

  it('renders completed reasoning as collapsed Markdown instead of plain preformatted text', async () => {
    appState.activeSessionId = 'session-reasoning-markdown';
    appState.messagesBySession['session-reasoning-markdown'] = [
      {
        id: 'assistant-reasoning-markdown',
        sessionId: 'session-reasoning-markdown',
        role: 'assistant',
        content: '结论。',
        reasoning: '## 检查路径\n\n```sh\nbun run test\n```',
        createdAt: new Date().toISOString(),
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);
    const reasoning = container.querySelector('.execution-reasoning');
    const disclosure = within(reasoning as HTMLElement).getByRole('button');
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(reasoning).toHaveTextContent('已完成');
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('heading', { name: '检查路径' })).toBeInTheDocument();
    await waitFor(() => expect(reasoning?.querySelector('pre code span')).toBeInTheDocument());
  });

  it('keeps live reasoning open and labels it as a real-time state', () => {
    appState.activeSessionId = 'session-live-reasoning';
    appState.messagesBySession['session-live-reasoning'] = [
      {
        id: 'assistant-live-reasoning',
        sessionId: 'session-live-reasoning',
        role: 'assistant',
        content: '',
        reasoning: '正在检查消息投影。',
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);
    const reasoning = container.querySelector('.execution-reasoning');
    const disclosure = within(reasoning as HTMLElement).getByRole('button');
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(reasoning).toHaveTextContent('正在思考');
    expect(reasoning).toHaveTextContent('实时更新');
    expect(screen.queryByText('正在分析任务…')).not.toBeInTheDocument();
  });

  it('lets the reader collapse live reasoning without reopening it on every delta', async () => {
    appState.activeSessionId = 'session-collapsed-live-reasoning';
    appState.messagesBySession['session-collapsed-live-reasoning'] = [
      {
        id: 'assistant-collapsed-live-reasoning',
        sessionId: 'session-collapsed-live-reasoning',
        role: 'assistant',
        content: '',
        reasoning: '第一段思考。',
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);
    const reasoning = container.querySelector('.execution-reasoning') as HTMLElement;
    const disclosure = within(reasoning).getByRole('button');
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      appState.messagesBySession['session-collapsed-live-reasoning'][0].reasoning = '第一段思考。第二段思考。';
    });

    await waitFor(() => expect(reasoning).toHaveTextContent('第二段思考'));
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  });

  it('offers a safer continuation after permission denial instead of treating it as a defect', () => {
    appState.activeSessionId = 'session-denied';
    appState.composerValue = 'Preserve my draft';
    appState.messagesBySession['session-denied'] = [
      {
        id: 'assistant-denied',
        sessionId: 'session-denied',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        events: [{ type: 'permission_denied', tool_id: 'tool-2', tool_name: 'Bash', reason: 'User denied access' }],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);
    expect(screen.queryByLabelText('任务恢复操作')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '改用安全方案继续' }));
    expect(appState.composerValue).toContain('Preserve my draft');
    expect(appState.composerValue).toContain('更安全的替代方案');
  });

  it('keeps a tool failure and its recovery action inside one execution block', () => {
    appState.activeSessionId = 'session-tool-failure';
    appState.messagesBySession['session-tool-failure'] = [
      {
        id: 'assistant-tool-failure',
        sessionId: 'session-tool-failure',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        events: [
          {
            type: 'tool_end',
            tool_id: 'tool-failure',
            tool_name: 'bash',
            output: 'command failed',
            exit_code: 1,
          },
          { type: 'error', message: 'Tool execution failed' },
        ],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(screen.queryByLabelText('任务恢复操作')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '让 Code 分析并修复' })).toBeInTheDocument();
  });

  it('keeps an independent turn failure visible after a tool has already failed', () => {
    appState.activeSessionId = 'session-tool-and-turn-failure';
    appState.composerValue = '保留现有草稿';
    appState.messagesBySession['session-tool-and-turn-failure'] = [
      {
        id: 'assistant-tool-and-turn-failure',
        sessionId: 'session-tool-and-turn-failure',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        events: [
          {
            type: 'tool_end',
            tool_id: 'tool-test-failure',
            tool_name: 'bash',
            output: 'FAIL src/runtime.test.ts\nAssertionError: interrupted state was not visible',
            exit_code: 1,
          },
          { type: 'error', message: '模型响应流已断开：upstream connection reset' },
        ],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(screen.getByRole('region', { name: '工具输出' })).toHaveTextContent('interrupted state was not visible');
    expect(screen.getByLabelText('任务恢复操作')).toHaveTextContent('模型响应流已断开');
    expect(screen.getByRole('button', { name: '让 Code 分析并修复' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '诊断并恢复' }));
    expect(appState.composerValue).toContain('保留现有草稿');
    expect(appState.composerValue).toContain('确认模型、连接与运行状态');
    expect(appState.composerValue).toContain('upstream connection reset');
  });

  it('deduplicates a turn error only when it repeats failed tool evidence', () => {
    appState.activeSessionId = 'session-matching-tool-failure';
    appState.messagesBySession['session-matching-tool-failure'] = [
      {
        id: 'assistant-matching-tool-failure',
        sessionId: 'session-matching-tool-failure',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        events: [
          {
            type: 'tool_end',
            tool_id: 'tool-matching-failure',
            tool_name: 'bash',
            output: 'Permission denied while writing apps/web/dist',
            exit_code: 1,
          },
          { type: 'error', message: 'Permission denied while writing apps/web/dist' },
        ],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(screen.queryByLabelText('任务恢复操作')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '工具输出' })).toHaveTextContent(
      'Permission denied while writing apps/web/dist'
    );
  });

  it('never lets a failed tool suppress an explicit turn cancellation', () => {
    appState.activeSessionId = 'session-tool-failure-cancelled';
    appState.messagesBySession['session-tool-failure-cancelled'] = [
      {
        id: 'assistant-tool-failure-cancelled',
        sessionId: 'session-tool-failure-cancelled',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        events: [
          {
            type: 'tool_end',
            tool_id: 'tool-before-cancel',
            tool_name: 'bash',
            output: 'command failed',
            exit_code: 1,
          },
          { type: 'cancelled', message: '用户停止了本轮任务' },
        ],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(screen.getByLabelText('任务恢复操作')).toHaveTextContent('任务已停止');
    expect(screen.getByLabelText('任务恢复操作')).toHaveTextContent('用户停止了本轮任务');
  });

  it('keeps exhausted retries distinct from an earlier tool failure', () => {
    appState.activeSessionId = 'session-tool-failure-dead-lettered';
    appState.messagesBySession['session-tool-failure-dead-lettered'] = [
      {
        id: 'assistant-tool-failure-dead-lettered',
        sessionId: 'session-tool-failure-dead-lettered',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        events: [
          {
            type: 'tool_end',
            tool_id: 'tool-before-dead-letter',
            tool_name: 'bash',
            output: 'command failed',
            exit_code: 1,
          },
          { type: 'command_dead_lettered', message: '三次重试后仍无法恢复模型请求' },
        ],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(screen.getByLabelText('任务恢复操作')).toHaveTextContent('任务重试已耗尽');
    expect(screen.getByLabelText('任务恢复操作')).toHaveTextContent('三次重试后仍无法恢复模型请求');
    expect(screen.getByRole('button', { name: '检查失败原因' })).toBeInTheDocument();
  });

  it('adds a failed instruction for review without sending or clearing the current draft', () => {
    appState.activeSessionId = 'session-retry';
    appState.composerValue = 'Unsent follow-up';
    appState.messagesBySession['session-retry'] = [
      {
        id: 'user-retry',
        sessionId: 'session-retry',
        role: 'user',
        content: 'Run the focused tests',
        createdAt: new Date().toISOString(),
        events: [],
      },
      {
        id: 'assistant-retry',
        sessionId: 'session-retry',
        role: 'assistant',
        content: 'The command failed.',
        createdAt: new Date().toISOString(),
        events: [{ type: 'error', message: 'Connection lost' }],
      },
    ];
    const sendMessage = vi.fn(async () => undefined);

    render(<ExecutionStream actions={{ sendMessage } as unknown as TaskActions} />);
    fireEvent.click(screen.getByRole('button', { name: '添加重试指令' }));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(screen.queryByText('查看技术详情')).not.toBeInTheDocument();
    expect(appState.composerValue).toContain('Unsent follow-up');
    expect(appState.composerValue).toContain('Run the focused tests');
  });

  it('keeps long turn-level failures concise while preserving full technical evidence', () => {
    const error = `连接中断：${'upstream transport unavailable; '.repeat(18)}\nrequest_id=trace-42`;
    appState.activeSessionId = 'session-long-error';
    appState.messagesBySession['session-long-error'] = [
      {
        id: 'assistant-long-error',
        sessionId: 'session-long-error',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        events: [{ type: 'error', message: error }],
      },
    ];

    const { container } = render(<ExecutionStream actions={{} as TaskActions} />);

    expect(screen.getByText('查看技术详情')).toBeInTheDocument();
    expect(container.querySelector('.recovery-notice > header p')?.textContent?.length).toBeLessThan(error.length);
    const technicalDetails = container.querySelector('.recovery-technical-details') as HTMLElement;
    const disclosure = within(technicalDetails).getByRole('button', { name: '查看技术详情' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.recovery-notice pre')).toHaveTextContent('request_id=trace-42');
  });
});
