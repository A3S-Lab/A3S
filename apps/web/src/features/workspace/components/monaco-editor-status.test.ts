import type { editor, IDisposable } from 'monaco-editor';
import { describe, expect, it, vi } from 'vitest';
import { observeMonacoEditorStatus } from './monaco-editor-status';

describe('Monaco editor status', () => {
  it('reports cursor, model-native selection lengths, multiple cursors, and the line ending', () => {
    let position = { lineNumber: 1, column: 1 };
    let selections = [selection('')];
    let eol = '\n';
    const cursorListeners: Array<() => void> = [];
    const contentListeners: Array<() => void> = [];
    const modelListeners: Array<() => void> = [];
    const dispose = vi.fn();
    const source = {
      getModel: () => ({
        getEOL: () => eol,
        getValueLengthInRange: (range: { selectedText: string }) => range.selectedText.length,
      }),
      getPosition: () => position,
      getSelections: () => selections,
      onDidChangeCursorSelection: (listener: () => void) => registration(cursorListeners, listener, dispose),
      onDidChangeModelContent: (listener: () => void) => registration(contentListeners, listener, dispose),
      onDidChangeModel: (listener: () => void) => registration(modelListeners, listener, dispose),
    } as unknown as editor.IStandaloneCodeEditor;
    const onChange = vi.fn();

    const subscription = observeMonacoEditorStatus(source, onChange);

    expect(onChange).toHaveBeenLastCalledWith({
      lineNumber: 1,
      column: 1,
      selectedCharacters: 0,
      selectionCount: 1,
      lineEnding: 'LF',
    });

    position = { lineNumber: 3, column: 7 };
    selections = [selection('A😀'), selection('two')];
    cursorListeners[0]();
    expect(onChange).toHaveBeenLastCalledWith({
      lineNumber: 3,
      column: 7,
      selectedCharacters: 6,
      selectionCount: 2,
      lineEnding: 'LF',
    });

    eol = '\r\n';
    contentListeners[0]();
    expect(onChange).toHaveBeenLastCalledWith({
      lineNumber: 3,
      column: 7,
      selectedCharacters: 6,
      selectionCount: 2,
      lineEnding: 'CRLF',
    });

    const callCount = onChange.mock.calls.length;
    modelListeners[0]();
    expect(onChange).toHaveBeenCalledTimes(callCount);

    subscription.dispose();
    expect(dispose).toHaveBeenCalledTimes(3);
  });
});

function selection(selectedText: string): { selectedText: string; isEmpty: () => boolean } {
  return { selectedText, isEmpty: () => selectedText.length === 0 };
}

function registration(listeners: Array<() => void>, listener: () => void, dispose: () => void): IDisposable {
  listeners.push(listener);
  return { dispose };
}
