import { FolderOpen, MessageSquarePlus, Sparkles, WandSparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, IconButton, SplitHandle, StateView } from '../../../design-system/primitives';
import { appState, formatApiError, sessionTitle, showToast } from '../../../state/app-state';
import type { CodeActions } from '../../code/use-code-controller';
import { ExecutionStream } from '../../tasks/components/execution-stream';
import { TaskComposer } from '../../tasks/components/task-composer';
import {
  type WorkAgentProposalMessage,
  type WorkAgentProposalRequest,
  workAgentProposalStatus,
} from '../work-agent-proposal';
import { bindWorkAgentWorkspace, type WorkAgentRequest } from '../work-agent-request';
import { localPathBasename, relativeLocalPath, sameLocalPath } from '../work-local-files';
import { WorkAgentProposalReview } from './work-agent-proposal-review';

const widthStorageKey = 'a3s-work.ai-assistant-width';
const legacyWidthStorageKey = 'a3s-work.copilot-width';
const defaultWidth = 460;
const minimumWidth = 360;
const maximumWidth = 680;
const compactOverlayBreakpoint = 960;
const splitPaneViewportReserve = 664;

export function WorkCopilot({
  actions,
  workspaceRoot,
  currentPath,
  onClose,
  onPickRoot,
  onAgentRequest,
  width,
  onWidthChange,
  proposal,
  onDismissProposal,
}: {
  actions: CodeActions;
  workspaceRoot: string;
  currentPath: string;
  onClose: () => void;
  onPickRoot: () => void | Promise<void>;
  onAgentRequest: (request: WorkAgentRequest) => void | Promise<void>;
  width: number;
  onWidthChange: (width: number) => void;
  proposal?: WorkAgentProposalRequest | null;
  onDismissProposal?: () => void;
}) {
  const state = useSnapshot(appState);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!workspaceRoot) return;
    void bindWorkAgentWorkspace(actionsRef.current, workspaceRoot).catch((error) => {
      showToast(formatApiError(error), 'error');
    });
  }, [workspaceRoot]);

  const activeSession = state.sessions.find((session) => session.sessionId === state.activeSessionId);
  const compatibleSession =
    activeSession?.agentId === 'work' && sameLocalPath(activeSession.workspace, workspaceRoot)
      ? activeSession
      : undefined;
  const messages = compatibleSession ? (state.messagesBySession[compatibleSession.sessionId] ?? []) : [];
  const proposalStatus = proposal
    ? workAgentProposalStatus(messages as unknown as readonly WorkAgentProposalMessage[], proposal)
    : null;
  const showExecution =
    Boolean(compatibleSession) &&
    (messages.length > 0 ||
      Boolean(state.messagesLoading[compatibleSession!.sessionId]) ||
      Boolean(state.messageErrors[compatibleSession!.sessionId]));
  const folderLabel = currentPath
    ? relativeLocalPath(currentPath, workspaceRoot) || localPathBasename(workspaceRoot)
    : localPathBasename(workspaceRoot);

  const viewportWidth = useViewportWidth();
  const availableMaximumWidth = workCopilotMaximumWidth(viewportWidth);
  const renderedWidth = clampWorkCopilotWidth(width, availableMaximumWidth);
  const updateWidth = (nextWidth: number, persist = false) => {
    const normalized = clampWorkCopilotWidth(nextWidth, availableMaximumWidth);
    onWidthChange(normalized);
    if (persist) persistCopilotWidth(normalized);
  };

  return (
    <aside
      className='work-copilot'
      aria-label='Work AI 助手'
      data-office-shortcuts='ignore'
      style={{ width: renderedWidth }}
    >
      <SplitHandle
        className='work-copilot-resizer'
        label='调整 Work AI 助手宽度'
        value={renderedWidth}
        min={minimumWidth}
        max={availableMaximumWidth}
        defaultValue={Math.min(defaultWidth, availableMaximumWidth)}
        direction='reverse'
        valueText={(value) => `${value} 像素`}
        onChange={updateWidth}
        onCommit={(value) => updateWidth(value, true)}
      />
      <header className='work-copilot-header'>
        <span className='work-copilot-mark'>
          <Sparkles size={15} />
        </span>
        <div>
          <strong>AI 助手</strong>
          <small title={compatibleSession?.workspace || currentPath}>
            {compatibleSession ? sessionTitle(compatibleSession, state.sessionTitles) : folderLabel || '等待选择文件夹'}
          </small>
        </div>
        <IconButton
          label='新建 Work AI 助手对话'
          disabled={!workspaceRoot}
          onClick={() => {
            actions.newConversation();
            void bindWorkAgentWorkspace(actions, workspaceRoot).catch((error) =>
              showToast(formatApiError(error), 'error')
            );
          }}
        >
          <MessageSquarePlus size={15} />
        </IconButton>
        <IconButton label='关闭 Work AI 助手' onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      {!workspaceRoot ? (
        <StateView
          className='work-copilot-no-workspace'
          size='compact'
          tone='info'
          icon={<FolderOpen size={22} />}
          title='先连接一个本地文件夹'
          description='AI 助手会读取这个文件夹，并只在你发送指令后开始工作。'
          actions={
            <Button tone='primary' onClick={() => void onPickRoot()}>
              选择文件夹
            </Button>
          }
        />
      ) : (
        <div className='work-copilot-thread'>
          {proposal && proposalStatus && (
            <WorkAgentProposalReview
              request={proposal}
              status={proposalStatus}
              onDismiss={() => onDismissProposal?.()}
            />
          )}
          {showExecution ? (
            <ExecutionStream actions={actions} assistantLabel='AI 助手' />
          ) : (
            <WorkCopilotWelcome
              folderLabel={folderLabel}
              onRequest={(instruction) =>
                onAgentRequest({
                  workspaceRoot,
                  paths: currentPath ? [currentPath] : [],
                  instruction,
                })
              }
            />
          )}
          <TaskComposer actions={actions} variant={compatibleSession ? 'active' : 'preparation'} />
        </div>
      )}
    </aside>
  );
}

function WorkCopilotWelcome({
  folderLabel,
  onRequest,
}: {
  folderLabel: string;
  onRequest: (instruction: string) => void | Promise<void>;
}) {
  return (
    <section className='work-copilot-welcome'>
      <span>
        <WandSparkles size={20} />
      </span>
      <h2>和当前文件一起工作</h2>
      <p>
        已连接 <strong>{folderLabel}</strong>。从文件右键菜单加入上下文，或先选择一个常用任务。
      </p>
      <div>
        <button
          type='button'
          onClick={() =>
            void onRequest('请概览当前文件夹的内容，说明主要文件、用途和最近值得关注的变化。不要修改文件。')
          }
        >
          概览当前文件夹
        </button>
        <button
          type='button'
          onClick={() =>
            void onRequest(
              '请分析当前文件夹的组织方式，提出更清晰的归档和命名建议。先只给出方案，不要移动、重命名或删除文件。'
            )
          }
        >
          提出整理建议
        </button>
        <button
          type='button'
          onClick={() =>
            void onRequest('请找出当前文件夹中可能重复、过期或命名含糊的文件，并说明判断依据。不要修改文件。')
          }
        >
          查找重复与过期内容
        </button>
      </div>
    </section>
  );
}

export function readWorkCopilotWidth(): number {
  try {
    const value = Number(localStorage.getItem(widthStorageKey) ?? localStorage.getItem(legacyWidthStorageKey));
    return Number.isFinite(value) && value >= minimumWidth ? value : defaultWidth;
  } catch {
    return defaultWidth;
  }
}

function workCopilotMaximumWidth(viewportWidth: number): number {
  const viewportMaximum = Math.min(maximumWidth, viewportWidth * 0.58);
  if (viewportWidth <= compactOverlayBreakpoint) return minimumWidth;
  return Math.round(Math.max(minimumWidth, Math.min(viewportMaximum, viewportWidth - splitPaneViewportReserve)));
}

function clampWorkCopilotWidth(width: number, availableMaximumWidth: number): number {
  return Math.round(Math.max(minimumWidth, Math.min(availableMaximumWidth, width)));
}

function useViewportWidth(): number {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return viewportWidth;
}

function persistCopilotWidth(width: number): void {
  try {
    localStorage.setItem(widthStorageKey, String(width));
  } catch {
    // Resizing remains available for the current page when storage is unavailable.
  }
}
