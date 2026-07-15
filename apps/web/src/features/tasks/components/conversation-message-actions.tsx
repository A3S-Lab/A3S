import { Check, Clipboard, PencilLine, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

export function ConversationMessageActions({
  content,
  createdAt,
  onContinueEditing,
}: {
  content: string;
  createdAt: string;
  onContinueEditing?: () => void;
}) {
  return (
    <div className='conversation-message-actions'>
      <time dateTime={createdAt}>{formatMessageTime(createdAt)}</time>
      <span className='conversation-message-action-buttons'>
        {onContinueEditing && (
          <button type='button' aria-label='继续编辑这条指令' title='继续编辑' onClick={onContinueEditing}>
            <PencilLine size={13} />
          </button>
        )}
        {content.trim() && <CopyButton content={content} label='复制消息' />}
      </span>
    </div>
  );
}

export function CopyButton({
  content,
  label = '复制',
  showLabel = false,
}: {
  content: string;
  label?: string;
  showLabel?: boolean;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (resetTimer.current !== undefined) window.clearTimeout(resetTimer.current);
    },
    []
  );

  const copy = async () => {
    try {
      await copyText(content);
      setState('copied');
    } catch {
      setState('failed');
    }
    if (resetTimer.current !== undefined) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState('idle'), 1800);
  };

  const feedback = state === 'copied' ? '已复制' : state === 'failed' ? '复制失败' : label;
  return (
    <button
      type='button'
      className={`conversation-copy-action ${state}`}
      aria-label={feedback}
      title={feedback}
      onClick={() => void copy()}
    >
      {state === 'copied' ? (
        <Check size={13} />
      ) : state === 'failed' ? (
        <TriangleAlert size={13} />
      ) : (
        <Clipboard size={13} />
      )}
      {(showLabel || state !== 'idle') && <span>{feedback}</span>}
    </button>
  );
}

export function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function copyText(content: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand?.('copy') ?? false;
  textarea.remove();
  if (!copied) throw new Error('Clipboard is unavailable');
}
