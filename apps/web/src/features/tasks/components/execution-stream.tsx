import { ArrowDown, CircleStop, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, StateView } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { ChatMessage } from '../../../types/api';
import type { TaskActions } from '../task-actions';
import { projectConversation } from './conversation-projection';
import { ConversationTurnView } from './conversation-turn';

export function ExecutionStream({
  actions,
  assistantLabel = 'Code',
}: {
  actions: TaskActions;
  assistantLabel?: string;
}) {
  const state = useSnapshot(appState);
  const sessionId = state.activeSessionId;
  const messages = (sessionId ? (state.messagesBySession[sessionId] ?? []) : []) as unknown as readonly ChatMessage[];
  const turns = projectConversation(messages, { running: state.streamingSessionId === sessionId });
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const streamRevision = messageRevision(messages, state.streamEvents as unknown as readonly Record<string, unknown>[]);

  useEffect(() => {
    stickToBottomRef.current = true;
    setShowLatest(false);
  }, [sessionId]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (stickToBottomRef.current && typeof element.scrollTo === 'function') {
      element.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
      setShowLatest(false);
    } else {
      setShowLatest(true);
    }
  }, [streamRevision]);
  if (sessionId && state.taskSubmissionState && !messages.length)
    return <TaskLoadState title='正在启动任务' description='正在创建会话、应用运行参数并准备首次执行。' loading />;
  if (sessionId && state.messagesLoading[sessionId] && !messages.length)
    return <TaskLoadState title='正在加载任务记录' description='正在恢复该任务的对话和执行上下文。' loading />;
  if (sessionId && state.messageErrors[sessionId] && !messages.length)
    return (
      <TaskLoadState
        title='无法加载任务记录'
        description={`${state.messageErrors[sessionId]} 当前任务仍被保留，可以重新加载。`}
        onRetry={() => {
          void actions.reloadActiveTask();
        }}
      />
    );
  if (!messages.length) return <TaskWelcome />;
  return (
    <div className='execution-scroll-shell'>
      <div
        className='execution-scroll'
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
          stickToBottomRef.current = nearBottom;
          setShowLatest(!nearBottom);
        }}
      >
        <div className='execution-column'>
          {turns.map((turn, index) => (
            <ConversationTurnView
              key={turn.id}
              turn={turn}
              actions={actions}
              assistantLabel={assistantLabel}
              isLatestTurn={index === turns.length - 1}
            />
          ))}
        </div>
      </div>
      {showLatest && (
        <Button
          tone='secondary'
          className='execution-jump-latest'
          onClick={() => {
            const element = scrollRef.current;
            if (!element || typeof element.scrollTo !== 'function') return;
            stickToBottomRef.current = true;
            element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
            setShowLatest(false);
          }}
        >
          <ArrowDown size={14} />
          查看最新内容
        </Button>
      )}
    </div>
  );
}

function messageRevision(messages: readonly ChatMessage[], liveEvents: readonly Record<string, unknown>[]): string {
  const messageState = messages
    .slice(-4)
    .map((message) => {
      const eventSize = (message.events ?? []).reduce((total, event) => total + eventPayloadSize(event), 0);
      return `${message.id}:${message.content.length}:${message.reasoning?.length ?? 0}:${eventSize}:${message.pending ? 1 : 0}`;
    })
    .join('|');
  const liveState = liveEvents.slice(-8).reduce((total, event) => total + eventPayloadSize(event), 0);
  return `${messageState}:${liveEvents.length}:${liveState}`;
}

function eventPayloadSize(event: Record<string, unknown>): number {
  return ['text', 'delta', 'output', 'message', 'reason'].reduce(
    (total, key) => total + (typeof event[key] === 'string' ? event[key].length : 0),
    0
  );
}

function TaskLoadState({
  title,
  description,
  loading = false,
  onRetry,
}: {
  title: string;
  description: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <StateView
      className='task-load-state'
      tone={loading ? 'info' : 'danger'}
      role={loading ? 'status' : 'alert'}
      icon={loading ? <LoaderCircle className='spin' size={24} /> : <CircleStop size={24} />}
      title={title}
      description={description}
      actions={
        onRetry ? (
          <Button tone='primary' onClick={onRetry}>
            重新加载任务
          </Button>
        ) : undefined
      }
    />
  );
}

function TaskWelcome() {
  return (
    <section className='task-welcome'>
      <img src='/logo.png' alt='' />
      <span className='eyebrow'>A3S CODE</span>
      <h1>交给 Code 一个明确任务</h1>
      <p>描述目标、约束和验收条件。执行计划、工具调用、权限和交付结果会在同一条工作流中持续更新。</p>
    </section>
  );
}
