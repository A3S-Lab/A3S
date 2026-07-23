import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { ExecutionStream } from './execution-stream';

describe('ExecutionStream rendering and recovery', () => {
  afterEach(() => {
    cleanup();
    appState.messagesLoading = {};
    appState.messageErrors = {};
    appState.streamingSessionId = null;
    appState.composerValue = '';
    appState.composerContextFiles = [];
    appState.composerSkills = [];
    appState.taskSubmissionState = null;
    appState.toolDecisionState = {};
    appState.toolDecisionErrors = {};
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
    expect(await screen.findByRole('heading', { name: '构建结果' })).toBeInTheDocument();
    expect(container.querySelector('.streaming-markdown')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('pre code span')).toBeInTheDocument());
    expect(container.querySelector('pre code')?.className).toContain('counter-reset');
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument();
  });

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

  it('renders a complete GFM table while the response is still streaming', async () => {
    appState.activeSessionId = 'session-streaming-table';
    appState.messagesBySession['session-streaming-table'] = [
      {
        id: 'assistant-streaming-table',
        sessionId: 'session-streaming-table',
        role: 'assistant',
        content: ['| 任务 | 验收 |', '| --- | --- |', '| workspace | CI 通过 |'].join('\n'),
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(await screen.findByRole('table')).toHaveTextContent('workspace');
  });

  it('repairs a table whose row boundaries were collapsed into one line', async () => {
    appState.activeSessionId = 'session-collapsed-table';
    appState.messagesBySession['session-collapsed-table'] = [
      {
        id: 'assistant-collapsed-table',
        sessionId: 'session-collapsed-table',
        role: 'assistant',
        content:
          '| # | 任务 | 验收 | 估时 | | --- | --- | --- | --- | | 0.1 | workspace | CI 通过 | 1d | | 0.2 | 日志 | 可检索 | 2d |',
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(await screen.findByRole('table')).toHaveTextContent('workspace');
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('keeps the research report actions while hiding its internal view marker', async () => {
    appState.activeSessionId = 'session-research-report';
    const report = '# 研究结论\n\n证据支持该结论。';
    appState.messagesBySession['session-research-report'] = [
      {
        id: 'assistant-research-report',
        sessionId: 'session-research-report',
        role: 'assistant',
        content: `${report}\n\nA3S_RESEARCH_VIEW: .a3s/research/topic/index.html`,
        createdAt: new Date().toISOString(),
        events: [
          { type: 'tool_start', tool_id: 'deep-research-1', tool_name: 'deep_research' },
          {
            type: 'tool_end',
            tool_id: 'deep-research-1',
            tool_name: 'deep_research',
            output: 'published',
            exit_code: 0,
            metadata: {
              report: {
                status: 'completed',
                htmlPath: '.a3s/research/topic/index.html',
                markdownPath: '.a3s/research/topic/report.md',
              },
            },
          },
        ],
      },
    ];
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(<ExecutionStream actions={{} as TaskActions} />);

    expect(await screen.findByRole('heading', { name: '研究结论' })).toBeInTheDocument();
    expect(screen.queryByText(/A3S_RESEARCH_VIEW/)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'DeepResearch 研究报告' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '复制消息' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(report));
  });

  it('renders persisted DeepResearch cancellation as stopped without failure recovery UI', () => {
    const cancellation = 'DeepResearch was cancelled by the user.';
    appState.activeSessionId = 'session-research-cancelled';
    appState.messagesBySession['session-research-cancelled'] = [
      {
        id: 'assistant-research-cancelled',
        sessionId: 'session-research-cancelled',
        role: 'assistant',
        content: cancellation,
        createdAt: new Date().toISOString(),
        events: [
          { type: 'tool_start', id: 'deep-research-cancelled', name: 'deep_research' },
          {
            type: 'tool_end',
            id: 'deep-research-cancelled',
            name: 'deep_research',
            output: cancellation,
            exit_code: 1,
            metadata: { duration_ms: 240 },
          },
          { type: 'error', message: cancellation },
        ],
      },
    ];

    render(<ExecutionStream actions={{} as TaskActions} />);

    const stoppedCall = screen.getByText('深度研究已停止').closest('.tool-call-item');
    expect(stoppedCall).toHaveAttribute('data-outcome', 'cancelled');
    expect(screen.getByText('用户已停止深度研究。')).toBeInTheDocument();
    expect(screen.queryByText(cancellation)).not.toBeInTheDocument();
    expect(screen.queryByText('深度研究失败')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '让 Code 分析并修复' })).not.toBeInTheDocument();
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
    expect(container.querySelector('.recovery-notice .ds-inline-notice-copy p')?.textContent?.length).toBeLessThan(
      error.length
    );
    const technicalDetails = container.querySelector('.recovery-technical-details') as HTMLElement;
    const disclosure = within(technicalDetails).getByRole('button', { name: '查看技术详情' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.recovery-notice pre')).toHaveTextContent('request_id=trace-42');
  });
});
