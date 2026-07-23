import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';
import {
  acceptDocumentChange,
  collectDocumentChanges,
  DocumentChange,
  rejectDocumentChange,
} from './work-document-changes';

const editors: Editor[] = [];

describe('Work document tracked changes', () => {
  afterEach(() => {
    for (const editor of editors.splice(0)) editor.destroy();
  });

  it('tracks a replacement as a deletion followed by an insertion', () => {
    const editor = createEditor('<p>Base</p>');

    const handled = editor.view.someProp('handleTextInput', (handler) =>
      handler(editor.view, 1, 5, 'New', () => editor.state.tr)
    );

    expect(handled).toBe(true);
    expect(editor.getHTML()).toContain('data-change-kind="deletion"');
    expect(editor.getHTML()).toContain('>Base</del>');
    expect(editor.getHTML()).toContain('data-change-kind="insertion"');
    expect(editor.getHTML()).toContain('>New</ins>');
    expect(collectDocumentChanges(editor.state.doc)).toMatchObject([
      { kind: 'deletion', author: 'A3S Reviewer', text: 'Base' },
      { kind: 'insertion', author: 'A3S Reviewer', text: 'New' },
    ]);
  });

  it('tracks a Unicode-aware Backspace deletion without removing the source character', () => {
    const editor = createEditor('<p>A文</p>');
    editor.commands.setTextSelection(3);
    const event = new KeyboardEvent('keydown', { key: 'Backspace' });

    const handled = editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event));

    expect(handled).toBe(true);
    expect(editor.getText()).toBe('A文');
    expect(collectDocumentChanges(editor.state.doc)).toMatchObject([{ kind: 'deletion', text: '文', from: 2, to: 3 }]);
  });

  it('groups consecutive formatted typing into one revision and one undo history step', () => {
    const editor = createEditor('<p></p>');
    editor.chain().focus().toggleBold().run();

    typeTrackedText(editor, '快捷键加粗');

    expect(collectDocumentChanges(editor.state.doc)).toMatchObject([
      { kind: 'insertion', author: 'A3S Reviewer', text: '快捷键加粗' },
    ]);
    expect(editor.getHTML()).toContain('<strong>快捷键加粗</strong>');
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getText()).toBe('');
    expect(editor.commands.redo()).toBe(true);
    expect(editor.getText()).toBe('快捷键加粗');
  });

  it('accepts and rejects individual imported changes without affecting unrelated text', () => {
    const editor = createEditor(
      [
        '<p>Keep ',
        '<ins data-document-change="true" data-change-kind="insertion" data-change-id="add-1"',
        ' data-change-author="Alice" data-change-date="2026-07-20T00:00:00.000Z">added</ins>',
        ' and ',
        '<del data-document-change="true" data-change-kind="deletion" data-change-id="del-1"',
        ' data-change-author="Bob" data-change-date="2026-07-19T00:00:00.000Z">removed</del>',
        '.</p>',
      ].join('')
    );

    expect(acceptDocumentChange(editor, 'add-1')).toBe(true);
    expect(rejectDocumentChange(editor, 'del-1')).toBe(true);

    expect(editor.getText()).toBe('Keep added and removed.');
    expect(editor.getHTML()).not.toContain('data-document-change');
  });

  it('rejects inserted text and accepts deleted text', () => {
    const editor = createEditor(
      [
        '<p>',
        '<ins data-document-change="true" data-change-kind="insertion" data-change-id="add-2"',
        ' data-change-author="Alice" data-change-date="2026-07-20T00:00:00.000Z">draft</ins>',
        '<del data-document-change="true" data-change-kind="deletion" data-change-id="del-2"',
        ' data-change-author="Bob" data-change-date="2026-07-19T00:00:00.000Z">obsolete</del>',
        '</p>',
      ].join('')
    );

    expect(rejectDocumentChange(editor, 'add-2')).toBe(true);
    expect(acceptDocumentChange(editor, 'del-2')).toBe(true);

    expect(editor.getText()).toBe('');
    expect(collectDocumentChanges(editor.state.doc)).toEqual([]);
  });
});

function createEditor(content: string): Editor {
  let sequence = 0;
  const editor = new Editor({
    extensions: [
      StarterKit,
      DocumentChange.configure({
        isTracking: () => true,
        createChange: (kind) => ({
          id: `${kind}-${++sequence}`,
          author: 'A3S Reviewer',
          date: '2026-07-20T00:00:00.000Z',
        }),
      }),
    ],
    content,
  });
  editors.push(editor);
  return editor;
}

function typeTrackedText(editor: Editor, text: string): void {
  for (const character of Array.from(text)) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp('handleTextInput', (handler) =>
      handler(editor.view, from, to, character, () => editor.state.tr)
    );
    expect(handled).toBe(true);
  }
}
