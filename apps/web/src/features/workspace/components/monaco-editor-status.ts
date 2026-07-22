import type { editor, IDisposable } from 'monaco-editor';

export type MonacoLineEnding = 'LF' | 'CRLF';

export interface MonacoEditorStatus {
  lineNumber: number;
  column: number;
  selectedCharacters: number;
  selectionCount: number;
  lineEnding: MonacoLineEnding;
}

export function observeMonacoEditorStatus(
  source: editor.IStandaloneCodeEditor,
  onChange: (status: MonacoEditorStatus | null) => void
): IDisposable {
  let previous: string | null = null;
  let disposed = false;
  const publish = () => {
    const status = readMonacoEditorStatus(source);
    const next = status ? JSON.stringify(status) : '';
    if (next === previous) return;
    previous = next;
    onChange(status);
  };
  const subscriptions = [
    source.onDidChangeCursorSelection(publish),
    source.onDidChangeModelContent(publish),
    source.onDidChangeModel(publish),
  ];
  publish();

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const subscription of subscriptions) subscription.dispose();
    },
  };
}

function readMonacoEditorStatus(source: editor.IStandaloneCodeEditor): MonacoEditorStatus | null {
  const model = source.getModel();
  const position = source.getPosition();
  if (!model || !position) return null;
  const selections = source.getSelections();
  const selectedCharacters = (selections ?? []).reduce(
    (total, selection) => total + model.getValueLengthInRange(selection),
    0
  );

  return {
    lineNumber: position.lineNumber,
    column: position.column,
    selectedCharacters,
    selectionCount: selections?.length || 1,
    lineEnding: model.getEOL() === '\r\n' ? 'CRLF' : 'LF',
  };
}
