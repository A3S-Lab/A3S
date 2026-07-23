import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectDocumentCommentAnchors, DocumentComment, documentCommentViews } from '../work-document-comments';
import type { WorkDocumentComment } from '../work-types';
import { DocumentCommentsPanel } from './document-comments-panel';

describe('Work document comment review', () => {
  let editor: Editor | null = null;

  afterEach(() => {
    cleanup();
    editor?.destroy();
    editor = null;
  });

  it('locates a thread and exposes reply, resolve, delete, and close actions', () => {
    editor = new Editor({
      extensions: [StarterKit, DocumentComment],
      content: '<p><span data-document-comment="true" data-comment-id="comment-1">reviewed text</span></p>',
    });
    const comments: WorkDocumentComment[] = [
      {
        id: 'comment-1',
        author: 'Alice',
        date: '2026-07-20T00:00:00.000Z',
        text: 'Please verify this.',
        resolved: false,
        replies: [
          {
            id: 'reply-1',
            author: 'Bob',
            date: '2026-07-20T01:00:00.000Z',
            text: 'Verified.',
          },
        ],
      },
    ];
    const onReply = vi.fn();
    const onToggleResolved = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();

    render(
      <DocumentCommentsPanel
        editor={editor}
        comments={documentCommentViews(comments, collectDocumentCommentAnchors(editor.state.doc))}
        onReply={onReply}
        onToggleResolved={onToggleResolved}
        onDelete={onDelete}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('region', { name: '批注审阅' })).toHaveTextContent('Please verify this.');
    expect(screen.getByRole('region', { name: '批注审阅' })).toHaveTextContent('Verified.');
    fireEvent.click(screen.getByRole('button', { name: '定位批注 1' }));
    expect(editor.state.selection).toMatchObject({ from: 1, to: 14 });

    fireEvent.change(screen.getByLabelText('回复批注 1'), { target: { value: 'Looks good now.' } });
    fireEvent.click(screen.getByRole('button', { name: '发送回复 1' }));
    expect(onReply).toHaveBeenCalledWith('comment-1', 'Looks good now.');

    fireEvent.click(screen.getByRole('button', { name: '解决批注 1' }));
    expect(onToggleResolved).toHaveBeenCalledWith('comment-1');
    fireEvent.click(screen.getByRole('button', { name: '删除批注 1' }));
    expect(onDelete).toHaveBeenCalledWith('comment-1');
    fireEvent.click(screen.getByRole('button', { name: '关闭批注审阅' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('uses the shared collection state for an empty comment list', () => {
    editor = new Editor({ extensions: [StarterKit, DocumentComment], content: '<p>No comments</p>' });

    render(
      <DocumentCommentsPanel
        editor={editor}
        comments={[]}
        onReply={vi.fn()}
        onToggleResolved={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText('选择文字并添加批注后，可以在这里回复、解决或删除。').closest('.ds-collection-state')
    ).toBeInTheDocument();
  });
});
