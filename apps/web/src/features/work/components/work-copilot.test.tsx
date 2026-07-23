import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ComponentProps, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { CodeActions } from '../../code/use-code-controller';
import { createWorkAgentProposalRequest, WORK_AGENT_PROPOSAL_PROTOCOL } from '../work-agent-proposal';
import { readWorkCopilotWidth, WorkCopilot } from './work-copilot';

describe('Work Copilot panel', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440, writable: true });
    localStorage.removeItem('a3s-work.copilot-width');
    localStorage.removeItem('a3s-work.ai-assistant-width');
    appState.sessions = [];
    appState.activeSessionId = null;
    appState.streamingSessionId = null;
    appState.messagesBySession = {};
    appState.messagesLoading = {};
    appState.messageErrors = {};
    appState.turnQueues = {};
    appState.composerValue = '';
    appState.composerContextFiles = [];
    appState.composerSkills = [];
    appState.workspaceRoot = '/docs';
    appState.filesByDirectory = { '/docs': [] };
    appState.newTaskConfig = {
      workspace: '/docs',
      model: '',
      effort: 'medium',
      permissionMode: 'default',
      goal: '',
    };
    appState.modelCatalog = { defaultModel: '', warnings: [], items: [] };
    appState.effortLevels = [{ id: 'medium', label: 'Medium' }];
    appState.taskConfigSaving = null;
    appState.modelChangeNotice = null;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('prefills a folder task and leaves sending under user control', () => {
    const onAgentRequest = vi.fn();
    const sendMessage = vi.fn();
    render(
      <TestWorkCopilot
        actions={{ sendMessage } as unknown as CodeActions}
        workspaceRoot='/docs'
        currentPath='/docs/Reports'
        onClose={vi.fn()}
        onPickRoot={vi.fn()}
        onAgentRequest={onAgentRequest}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '概览当前文件夹' }));
    expect(onAgentRequest).toHaveBeenCalledWith({
      workspaceRoot: '/docs',
      paths: ['/docs/Reports'],
      instruction: expect.stringContaining('概览'),
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(screen.getByRole('complementary', { name: 'Work AI 助手' })).toHaveAttribute(
      'data-office-shortcuts',
      'ignore'
    );
  });

  it('starts wider, supports keyboard resizing, and persists the chosen width', () => {
    render(
      <TestWorkCopilot
        actions={{} as CodeActions}
        workspaceRoot='/docs'
        currentPath='/docs'
        onClose={vi.fn()}
        onPickRoot={vi.fn()}
        onAgentRequest={vi.fn()}
      />
    );

    const separator = screen.getByRole('separator', { name: '调整 Work AI 助手宽度' });
    expect(separator).toHaveAttribute('aria-valuenow', '460');
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(separator).toHaveAttribute('aria-valuenow', '480');
    expect(localStorage.getItem('a3s-work.ai-assistant-width')).toBe('480');
  });

  it('resizes by dragging the panel border', () => {
    render(
      <TestWorkCopilot
        actions={{} as CodeActions}
        workspaceRoot='/docs'
        currentPath='/docs'
        onClose={vi.fn()}
        onPickRoot={vi.fn()}
        onAgentRequest={vi.fn()}
      />
    );

    const separator = screen.getByRole('separator', { name: '调整 Work AI 助手宽度' });
    fireEvent.pointerDown(separator, { button: 0, pointerId: 7, clientX: window.innerWidth - 460 });
    expect(document.documentElement).toHaveAttribute('data-ds-resizing', 'vertical');
    fireEvent.pointerMove(window, { pointerId: 7, clientX: window.innerWidth - 520 });
    fireEvent.pointerUp(window, { pointerId: 7, clientX: window.innerWidth - 520 });
    expect(separator).toHaveAttribute('aria-valuenow', '520');
    expect(document.documentElement).not.toHaveAttribute('data-ds-resizing');
    expect(localStorage.getItem('a3s-work.ai-assistant-width')).toBe('520');
  });

  it('keeps the Office pane usable when the viewport becomes narrower', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024, writable: true });
    render(
      <TestWorkCopilot
        actions={{} as CodeActions}
        workspaceRoot='/docs'
        currentPath='/docs'
        onClose={vi.fn()}
        onPickRoot={vi.fn()}
        onAgentRequest={vi.fn()}
      />
    );

    const panel = screen.getByRole('complementary', { name: 'Work AI 助手' });
    const separator = screen.getByRole('separator', { name: '调整 Work AI 助手宽度' });
    expect(panel).toHaveStyle({ width: '360px' });
    expect(separator).toHaveAttribute('aria-valuemax', '360');
    expect(separator).toHaveAttribute('aria-valuenow', '360');

    window.innerWidth = 1280;
    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(panel).toHaveStyle({ width: '460px' });
      expect(separator).toHaveAttribute('aria-valuemax', '616');
      expect(separator).toHaveAttribute('aria-valuenow', '460');
    });
  });

  it('uses the compact assistant width throughout overlay layouts', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768, writable: true });
    render(
      <TestWorkCopilot
        actions={{} as CodeActions}
        workspaceRoot='/docs'
        currentPath='/docs'
        onClose={vi.fn()}
        onPickRoot={vi.fn()}
        onAgentRequest={vi.fn()}
      />
    );

    const panel = screen.getByRole('complementary', { name: 'Work AI 助手' });
    const separator = screen.getByRole('separator', { name: '调整 Work AI 助手宽度' });
    expect(panel).toHaveStyle({ width: '360px' });
    expect(separator).toHaveAttribute('aria-valuemax', '360');
  });

  it('projects a matching assistant proposal into an explicit review surface', () => {
    const apply = vi.fn(() => ({ appliedTargetIds: ['selection'], conflicts: [] }));
    const proposal = createWorkAgentProposalRequest({
      id: 'proposal-copilot-test',
      title: '审阅文字改写',
      description: '选中文本',
      targets: [{ id: 'selection', label: '选中文本', before: '原文' }],
      apply,
    });
    appState.sessions = [
      {
        sessionId: 'work-session',
        workspace: '/docs',
        cwd: '/docs',
        model: 'codex/gpt',
        followDefaultModel: false,
        permissionMode: 'default',
        state: 'connected',
        title: 'Work',
        agentId: 'work',
        createdAt: 1,
      },
    ];
    appState.activeSessionId = 'work-session';
    appState.messagesBySession['work-session'] = [
      {
        id: 'user-1',
        sessionId: 'work-session',
        role: 'user',
        content: `请求 ID：${proposal.id}`,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'assistant-1',
        sessionId: 'work-session',
        role: 'assistant',
        content: JSON.stringify({
          protocol: WORK_AGENT_PROPOSAL_PROTOCOL,
          requestId: proposal.id,
          summary: '建议精简表达',
          changes: [{ targetId: 'selection', after: '新文', reason: '更简洁' }],
        }),
        createdAt: new Date().toISOString(),
      },
    ];

    render(
      <TestWorkCopilot
        actions={{} as CodeActions}
        workspaceRoot='/docs'
        currentPath='/docs'
        onClose={vi.fn()}
        onPickRoot={vi.fn()}
        onAgentRequest={vi.fn()}
        proposal={proposal}
        onDismissProposal={vi.fn()}
      />
    );

    expect(screen.getByRole('region', { name: 'AI 修改建议审阅' })).toHaveTextContent('原文');
    expect(screen.getByRole('region', { name: 'AI 修改建议审阅' })).toHaveTextContent('新文');
    fireEvent.click(screen.getByRole('button', { name: '应用 1 项' }));
    expect(apply).toHaveBeenCalledTimes(1);
  });
});

function TestWorkCopilot(props: Omit<ComponentProps<typeof WorkCopilot>, 'width' | 'onWidthChange'>) {
  const [width, setWidth] = useState(readWorkCopilotWidth);
  return <WorkCopilot {...props} width={width} onWidthChange={setWidth} />;
}
