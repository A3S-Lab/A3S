import { Sparkles } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { appendTaskInstruction, appState } from '../../../state/app-state';
import type { ChatMessage } from '../../../types/api';
import type { InstructionResources } from './conversation-projection';
import { ConversationMessageActions } from './conversation-message-actions';
import { WorkspaceEntryIcon } from './workspace-entry-icon';

const StreamingMarkdown = lazy(() => import('./streaming-markdown'));

export function InstructionMessage({
  message,
  resources,
  runtimeAnchor,
}: {
  message: ChatMessage;
  resources: InstructionResources;
  runtimeAnchor: boolean;
}) {
  const hasResources = resources.skillNames.length > 0 || resources.contextFiles.length > 0;
  const continueEditing = () => {
    appendTaskInstruction(message.content);
    appState.composerContextFiles = unique([...appState.composerContextFiles, ...resources.contextFiles]);
    appState.composerSkills = unique([...appState.composerSkills, ...resources.skillNames]);
    window.requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLElement>('[contenteditable="true"][aria-label="任务指令"]');
      editor?.focus();
    });
  };

  return (
    <article
      className='execution-instruction'
      aria-label='你的任务指令'
      data-task-runtime-anchor={runtimeAnchor ? 'latest-instruction' : undefined}
    >
      <div className='execution-markdown execution-instruction-body'>
        <Suspense fallback={<p className='execution-markdown-fallback'>{message.content}</p>}>
          <StreamingMarkdown content={message.content} streaming={false} />
        </Suspense>
      </div>
      {hasResources && <InstructionResourceStrip resources={resources} />}
      <ConversationMessageActions
        content={message.content}
        createdAt={message.createdAt}
        onContinueEditing={continueEditing}
      />
    </article>
  );
}

function InstructionResourceStrip({ resources }: { resources: InstructionResources }) {
  return (
    <section className='instruction-resource-strip' aria-label='指令上下文'>
      {resources.skillNames.map((name) => (
        <span key={`skill-${name}`} className='instruction-resource skill' title={`Skill · ${name}`}>
          <Sparkles size={13} />
          <span>{name}</span>
        </span>
      ))}
      {resources.contextFiles.map((path) => {
        const name = fileName(path);
        return (
          <span key={`file-${path}`} className='instruction-resource file' title={path}>
            <WorkspaceEntryIcon name={name} isDirectory={false} size={14} />
            <span>{path}</span>
          </span>
        );
      })}
    </section>
  );
}

function fileName(path: string): string {
  return path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? path;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
