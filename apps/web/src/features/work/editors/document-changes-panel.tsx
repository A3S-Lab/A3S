import type { Editor } from '@tiptap/core';
import { Check, CheckCheck, Undo2, X, XCircle } from 'lucide-react';
import { Button, CollectionState, IconButton } from '../../../design-system/primitives';
import {
  acceptAllDocumentChanges,
  acceptDocumentChange,
  rejectAllDocumentChanges,
  rejectDocumentChange,
  type WorkDocumentChange,
} from '../work-document-changes';

export function DocumentChangesPanel({
  editor,
  changes,
  onClose,
}: {
  editor: Editor;
  changes: WorkDocumentChange[];
  onClose: () => void;
}) {
  return (
    <section className='work-document-changes-panel' aria-label='修订审阅'>
      <header>
        <div>
          <strong>修订审阅</strong>
          <span>{changes.length ? `${changes.length} 项待处理的文字修订` : '没有待处理的文字修订'}</span>
        </div>
        <div className='work-document-changes-bulk-actions'>
          <Button tone='quiet' disabled={!changes.length} onClick={() => acceptAllDocumentChanges(editor)}>
            <CheckCheck size={13} />
            全部接受
          </Button>
          <Button tone='quiet' disabled={!changes.length} onClick={() => rejectAllDocumentChanges(editor)}>
            <Undo2 size={13} />
            全部拒绝
          </Button>
          <IconButton className='close' label='关闭修订审阅' onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
      </header>
      <div className='work-document-change-list'>
        {changes.map((change, index) => (
          <article className={change.kind} key={`${change.kind}-${change.id}`}>
            <button
              type='button'
              className='work-document-change-summary'
              aria-label={`定位修订 ${index + 1}`}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .setTextSelection({
                    from: Math.min(change.from, editor.state.doc.content.size),
                    to: Math.min(change.to, editor.state.doc.content.size),
                  })
                  .run()
              }
            >
              <span>{change.kind === 'insertion' ? '插入' : '删除'}</span>
              <strong>{change.text.trim() || '（空白字符）'}</strong>
              <small>
                {change.author}
                {change.date ? ` · ${formatChangeDate(change.date)}` : ''}
              </small>
            </button>
            <div>
              <Button
                tone='quiet'
                aria-label={`接受修订 ${index + 1}`}
                onClick={() => acceptDocumentChange(editor, change.id)}
              >
                <Check size={13} />
                接受
              </Button>
              <Button
                tone='quiet'
                aria-label={`拒绝修订 ${index + 1}`}
                onClick={() => rejectDocumentChange(editor, change.id)}
              >
                <XCircle size={13} />
                拒绝
              </Button>
            </div>
          </article>
        ))}
        {!changes.length && (
          <CollectionState className='work-document-changes-empty' role='status'>
            开启修订后，新增和删除的文字会显示在这里，并保留到 DOCX。
          </CollectionState>
        )}
      </div>
    </section>
  );
}

function formatChangeDate(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(time);
}
