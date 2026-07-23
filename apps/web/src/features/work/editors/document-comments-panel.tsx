import type { Editor } from '@tiptap/core';
import { CheckCircle2, MessageSquareReply, RotateCcw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button, CollectionState, IconButton } from '../../../design-system/primitives';
import type { WorkDocumentCommentView } from '../work-document-comments';
import { OfficeTextArea } from './office-controls';

export function DocumentCommentsPanel({
  editor,
  comments,
  onReply,
  onToggleResolved,
  onDelete,
  onClose,
}: {
  editor: Editor;
  comments: WorkDocumentCommentView[];
  onReply: (id: string, text: string) => void;
  onToggleResolved: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const unresolved = comments.filter((comment) => !comment.resolved).length;
  return (
    <section className='work-document-comments-panel' aria-label='批注审阅'>
      <header>
        <div>
          <strong>批注审阅</strong>
          <span>{comments.length ? `${unresolved} 条未解决 · ${comments.length} 条全部批注` : '没有批注'}</span>
        </div>
        <IconButton className='close' label='关闭批注审阅' onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>
      <div className='work-document-comment-list'>
        {comments.map((comment, index) => (
          <article className={comment.resolved ? 'resolved' : ''} key={comment.id}>
            <button
              type='button'
              className='work-document-comment-anchor'
              aria-label={`定位批注 ${index + 1}`}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .setTextSelection({
                    from: Math.min(comment.from, editor.state.doc.content.size),
                    to: Math.min(comment.to, editor.state.doc.content.size),
                  })
                  .run()
              }
            >
              <span>{comment.resolved ? '已解决' : '待处理'}</span>
              <strong>{comment.anchorText.trim() || '（空白字符）'}</strong>
            </button>
            <section className='work-document-comment-thread'>
              <article>
                <header>
                  <strong>{comment.author}</strong>
                  <time dateTime={comment.date}>{formatCommentDate(comment.date)}</time>
                </header>
                <p>{comment.text}</p>
              </article>
              {comment.replies?.map((reply) => (
                <article className='reply' key={reply.id}>
                  <header>
                    <strong>{reply.author}</strong>
                    <time dateTime={reply.date}>{formatCommentDate(reply.date)}</time>
                  </header>
                  <p>{reply.text}</p>
                </article>
              ))}
            </section>
            <div className='work-document-comment-reply'>
              <OfficeTextArea
                aria-label={`回复批注 ${index + 1}`}
                value={drafts[comment.id] ?? ''}
                placeholder='回复此批注…'
                onChange={(event) => setDrafts((current) => ({ ...current, [comment.id]: event.target.value }))}
              />
              <Button
                tone='quiet'
                aria-label={`发送回复 ${index + 1}`}
                disabled={!drafts[comment.id]?.trim()}
                onClick={() => {
                  const text = drafts[comment.id]?.trim();
                  if (!text) return;
                  onReply(comment.id, text);
                  setDrafts((current) => ({ ...current, [comment.id]: '' }));
                }}
              >
                <MessageSquareReply size={13} />
                回复
              </Button>
            </div>
            <footer>
              <Button
                tone='quiet'
                aria-label={`${comment.resolved ? '重新打开' : '解决'}批注 ${index + 1}`}
                onClick={() => onToggleResolved(comment.id)}
              >
                {comment.resolved ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
                {comment.resolved ? '重新打开' : '解决'}
              </Button>
              <Button tone='quiet' aria-label={`删除批注 ${index + 1}`} onClick={() => onDelete(comment.id)}>
                <Trash2 size={13} />
                删除
              </Button>
            </footer>
          </article>
        ))}
        {!comments.length && (
          <CollectionState className='work-document-comments-empty' role='status'>
            选择文字并添加批注后，可以在这里回复、解决或删除。
          </CollectionState>
        )}
      </div>
    </section>
  );
}

function formatCommentDate(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(time);
}
