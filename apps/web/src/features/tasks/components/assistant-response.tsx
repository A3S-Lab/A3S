import { LoaderCircle } from 'lucide-react';
import { lazy, Suspense } from 'react';
import type { ChatMessage } from '../../../types/api';
import type { TaskActions } from '../task-actions';
import { ArtifactEntries } from './artifact-entries';
import { ConversationMessageActions } from './conversation-message-actions';
import { DeliverySummary } from './delivery-summary';
import { ReasoningDisclosure } from './reasoning-disclosure';
import { RecoveryNotice } from './recovery-notice';
import { projectSubagents } from './task-runtime-projection';
import { projectToolCalls } from './tool-call-projection';
import { ToolCallTimeline } from './tool-call-timeline';

const StreamingMarkdown = lazy(() => import('./streaming-markdown'));

export function AssistantResponse({
  message,
  actions,
  retryContent,
}: {
  message: ChatMessage;
  actions: TaskActions;
  retryContent?: string;
}) {
  const toolCalls = projectToolCalls(message.events ?? [], message.contentBlocks ?? [], {
    settleOpen: !message.pending,
  });
  const stateLabel = pendingResponseState(message, toolCalls);

  return (
    <article
      className={`execution-response${message.pending ? ' pending' : ''}`}
      aria-label={message.pending ? 'Code 正在回复' : 'Code 回复'}
    >
      <header className='execution-response-header'>
        <span className='execution-agent-avatar' aria-hidden='true'>
          <img src='/logo.png' alt='' />
        </span>
        <strong>Code</strong>
        {stateLabel && (
          <output className='execution-agent-state' aria-live='polite'>
            <LoaderCircle className='spin' size={12} />
            {stateLabel}
          </output>
        )}
        <ConversationMessageActions content={message.content} createdAt={message.createdAt} />
      </header>
      {message.reasoning?.trim() && (
        <ReasoningDisclosure content={message.reasoning.trim()} pending={Boolean(message.pending)} />
      )}
      <ToolCallTimeline calls={toolCalls} sessionId={message.sessionId} actions={actions} />
      {message.content ? (
        <div className='execution-markdown execution-answer'>
          <Suspense fallback={<p className='execution-markdown-fallback'>{message.content}</p>}>
            <StreamingMarkdown content={message.content} streaming={Boolean(message.pending)} />
          </Suspense>
        </div>
      ) : null}
      <DeliverySummary sessionId={message.sessionId} events={message.events ?? []} />
      <ArtifactEntries calls={toolCalls} sessionId={message.sessionId} />
      <RecoveryNotice events={message.events ?? []} retryContent={retryContent} />
    </article>
  );
}

function pendingResponseState(message: ChatMessage, calls: ReturnType<typeof projectToolCalls>): string | null {
  if (!message.pending) return null;
  if (calls.some((call) => call.state === 'awaiting')) return '等待你的确认';
  if (calls.some((call) => call.state === 'running' || call.state === 'preparing')) return '正在执行';
  const agents = projectSubagents(message.events ?? [], { settleOpen: !message.pending });
  if (agents.some((agent) => agent.state === 'running')) return '正在并行执行';
  if (agents.length > 0) return '正在汇总结果';
  const eventTypes = new Set((message.events ?? []).map((event) => event.type));
  if (eventTypes.has('planning_start') && !eventTypes.has('planning_end')) return '正在规划';
  if (eventTypes.has('planning_end') || eventTypes.has('task_updated') || eventTypes.has('step_start'))
    return '正在执行计划';
  if (message.content.trim()) return '正在回答';
  if (message.reasoning?.trim()) return '正在思考';
  return '正在准备';
}
