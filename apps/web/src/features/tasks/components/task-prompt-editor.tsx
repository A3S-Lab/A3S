import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { findComposerInputTrigger, type ComposerInputTrigger } from './composer-input-trigger';
import { SlashCommandHighlight } from './slash-command-highlight';

export interface TaskPromptEditorHandle {
  focus: () => void;
  replaceTrigger: (trigger: ComposerInputTrigger, replacement?: string) => void;
}

export const TaskPromptEditor = forwardRef<
  TaskPromptEditorHandle,
  {
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onTriggerChange?: (trigger: ComposerInputTrigger | null) => void;
    onTriggerKeyDown?: (event: KeyboardEvent) => boolean;
    suggestionsOpen?: boolean;
    suggestionsId?: string;
    activeSuggestionId?: string;
  }
>(function TaskPromptEditor(
  {
    value,
    disabled = false,
    onChange,
    onSubmit,
    onTriggerChange,
    onTriggerKeyDown,
    suggestionsOpen = false,
    suggestionsId,
    activeSuggestionId,
  },
  ref
) {
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  const onTriggerChangeRef = useRef(onTriggerChange);
  const onTriggerKeyDownRef = useRef(onTriggerKeyDown);
  onChangeRef.current = onChange;
  onSubmitRef.current = onSubmit;
  onTriggerChangeRef.current = onTriggerChange;
  onTriggerKeyDownRef.current = onTriggerKeyDown;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: '描述任务；输入 @ 或直接拖入文件，/ 使用 Skill 或设置 /goal…' }),
      Markdown,
      SlashCommandHighlight,
    ],
    content: value,
    contentType: 'markdown',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'task-prompt-editor-content',
        role: 'textbox',
        'aria-label': '任务指令',
        'aria-multiline': 'true',
      },
      handleKeyDown: (_view, event) => {
        if (onTriggerKeyDownRef.current?.(event)) return true;
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return false;
        event.preventDefault();
        onSubmitRef.current();
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(current.getMarkdown());
      onTriggerChangeRef.current?.(activeComposerTrigger(current));
    },
    onSelectionUpdate: ({ editor: current }) => {
      onTriggerChangeRef.current?.(activeComposerTrigger(current));
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus(),
      replaceTrigger: (trigger, replacement = '') => {
        if (!editor) return;
        const chain = editor.chain().focus().deleteRange({ from: trigger.from, to: trigger.to });
        if (replacement) chain.insertContent(replacement);
        chain.run();
      },
    }),
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
    editor.view.dom.setAttribute('aria-disabled', String(disabled));
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const input = editor.view.dom;
    input.setAttribute('aria-expanded', String(suggestionsOpen));
    if (suggestionsOpen && suggestionsId) input.setAttribute('aria-controls', suggestionsId);
    else input.removeAttribute('aria-controls');
    if (suggestionsOpen && activeSuggestionId) input.setAttribute('aria-activedescendant', activeSuggestionId);
    else input.removeAttribute('aria-activedescendant');
  }, [activeSuggestionId, editor, suggestionsId, suggestionsOpen]);

  useEffect(() => {
    if (!editor || editor.getMarkdown() === value) return;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  if (!editor) return <output className='task-prompt-editor-loading' aria-label='正在准备任务编辑器' />;
  return (
    <section className='task-prompt-editor' aria-label='任务指令编辑器'>
      <EditorContent editor={editor} />
    </section>
  );
});

function activeComposerTrigger(editor: NonNullable<ReturnType<typeof useEditor>>): ComposerInputTrigger | null {
  const { selection } = editor.state;
  if (!selection.empty || !selection.$from.parent.isTextblock) return null;
  if (selection.$from.marks().some((mark) => mark.type.name === 'code')) return null;
  const textBeforeCursor = selection.$from.parent.textBetween(0, selection.$from.parentOffset, '\n', '\n');
  return findComposerInputTrigger(textBeforeCursor, selection.from);
}
