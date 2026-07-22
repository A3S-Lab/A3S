import '@testing-library/jest-dom/vitest';
import { createElement, useEffect, useRef } from 'react';
import { afterEach, vi } from 'vitest';
import { clearWorkspaceEditorModels } from '../features/workspace/components/monaco-editor-model-store';

if (!Range.prototype.getClientRects) {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [] as unknown as DOMRectList,
  });
}

if (!Range.prototype.getBoundingClientRect) {
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  });
}

const monacoMock = vi.hoisted(() => ({
  editor: {
    defineTheme: vi.fn(),
    setModelMarkers: vi.fn(),
    EndOfLineSequence: { LF: 0, CRLF: 1 },
  },
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    registerDocumentSymbolProvider: vi.fn(
      (languageSelector: string, provider: MonacoDocumentSymbolProvider): MonacoDisposable => {
        const registration = { languageSelector, provider };
        monacoMock.__documentSymbolProviders.push(registration);
        return {
          dispose: () => {
            const index = monacoMock.__documentSymbolProviders.indexOf(registration);
            if (index >= 0) monacoMock.__documentSymbolProviders.splice(index, 1);
          },
        };
      }
    ),
    SymbolKind: {
      File: 0,
      Module: 1,
      Namespace: 2,
      Package: 3,
      Class: 4,
      Method: 5,
      Property: 6,
      Field: 7,
      Constructor: 8,
      Enum: 9,
      Interface: 10,
      Function: 11,
      Variable: 12,
      Constant: 13,
      String: 14,
      Number: 15,
      Boolean: 16,
      Array: 17,
      Object: 18,
      Key: 19,
      Null: 20,
      EnumMember: 21,
      Struct: 22,
      Event: 23,
      Operator: 24,
      TypeParameter: 25,
    },
  },
  typescript: {
    typescriptDefaults: {
      modeConfiguration: { documentSymbols: true, definitions: true, references: true },
      setModeConfiguration: vi.fn(),
    },
    javascriptDefaults: {
      modeConfiguration: { documentSymbols: true, definitions: true, references: true },
      setModeConfiguration: vi.fn(),
    },
  },
  MarkerSeverity: { Hint: 1, Info: 2, Warning: 4, Error: 8 },
  KeyMod: { CtrlCmd: 1, Shift: 16 },
  KeyCode: { KeyS: 2, KeyW: 3, F12: 4 },
  __actions: [] as MonacoAction[],
  __editorActionRuns: [] as string[],
  __documentSymbolProviders: [] as MonacoDocumentSymbolRegistration[],
  __cursorSelectionListeners: [] as Array<() => void>,
  __modelContentListeners: [] as Array<() => void>,
  __modelChangeListeners: [] as Array<() => void>,
  __editorMountCount: 0,
  __editorUnmountCount: 0,
  __currentEditorPath: '',
  __savedViewStates: [] as unknown[],
  __restoredViewStates: [] as unknown[],
  __pushEolCalls: [] as number[],
  __position: { lineNumber: 1, column: 1 },
  __selections: [{ selectedText: '', isEmpty: () => true }] as MonacoSelection[],
  __eol: '\n' as '\n' | '\r\n',
  __language: 'plaintext',
  __value: '',
  __onChange: null as ((value: string) => void) | null,
  __modelDisposed: false,
  __model: {
    uri: { toString: () => 'file:///workspace/file.ts' },
    getLanguageId: () => monacoMock.__language,
    getEOL: () => monacoMock.__eol,
    getEndOfLineSequence: () => (monacoMock.__eol === '\r\n' ? 1 : 0),
    getValueInRange: (selection: MonacoSelection) => selection.selectedText,
    getValueLengthInRange: (selection: MonacoSelection) => selection.selectedText.length,
    pushEOL: (sequence: number) => {
      monacoMock.__pushEolCalls.push(sequence);
      const eol = sequence === monacoMock.editor.EndOfLineSequence.CRLF ? '\r\n' : '\n';
      const value = monacoMock.__value.replace(/\r\n|\r|\n/g, eol);
      monacoMock.__eol = eol;
      monacoMock.__value = value;
      monacoMock.__onChange?.(value);
      for (const listener of monacoMock.__modelContentListeners) listener();
    },
    isDisposed: () => monacoMock.__modelDisposed,
    dispose: () => {
      monacoMock.__modelDisposed = true;
    },
  },
}));

vi.mock('monaco-editor', () => monacoMock);
vi.mock('../features/workspace/components/monaco-runtime', () => ({ monaco: monacoMock }));

vi.mock('@monaco-editor/react', () => {
  const Editor = ({
    value = '',
    language = 'plaintext',
    path = '',
    onChange,
    onMount,
    beforeMount,
    options = {},
  }: MonacoEditorMockProps) => {
    const ref = useRef<HTMLTextAreaElement>(null);
    const mountedPathRef = useRef(path);
    useEffect(() => {
      monacoMock.__editorMountCount += 1;
      monacoMock.__currentEditorPath = path;
      mountedPathRef.current = path;
      monacoMock.__eol = value.includes('\r\n') ? '\r\n' : '\n';
      monacoMock.__language = language;
      monacoMock.__value = value;
      monacoMock.__onChange = onChange ?? null;
      monacoMock.__position = { lineNumber: 1, column: 1 };
      monacoMock.__selections = [{ selectedText: '', isEmpty: () => true }];
      beforeMount?.(monacoMock);
      onMount?.(
        {
          addCommand: vi.fn(),
          addAction: (action: MonacoAction) => {
            monacoMock.__actions.push(action);
            return {
              dispose: () => {
                const index = monacoMock.__actions.indexOf(action);
                if (index >= 0) monacoMock.__actions.splice(index, 1);
              },
            };
          },
          focus: () => ref.current?.focus(),
          saveViewState: () => {
            const state = {
              path: monacoMock.__currentEditorPath,
              position: { ...monacoMock.__position },
              selections: [...monacoMock.__selections],
            };
            monacoMock.__savedViewStates.push(state);
            return state;
          },
          restoreViewState: (state: unknown) => {
            monacoMock.__restoredViewStates.push(state);
            const restored = state as { position?: { lineNumber: number; column: number } } | null;
            if (restored?.position) monacoMock.__position = { ...restored.position };
          },
          getModel: () => monacoMock.__model,
          getPosition: () => monacoMock.__position,
          getSelection: () => monacoMock.__selections[0] ?? null,
          getSelections: () => monacoMock.__selections,
          onDidChangeCursorSelection: (listener: () => void) =>
            mockRegistration(monacoMock.__cursorSelectionListeners, listener),
          onDidChangeModelContent: (listener: () => void) =>
            mockRegistration(monacoMock.__modelContentListeners, listener),
          onDidChangeModel: (listener: () => void) => mockRegistration(monacoMock.__modelChangeListeners, listener),
          getAction: (id: string) => ({
            run: async () => {
              monacoMock.__editorActionRuns.push(id);
            },
          }),
          revealPositionInCenterIfOutsideViewport: vi.fn(),
          setPosition: ({ lineNumber, column }: { lineNumber: number; column: number }) => {
            monacoMock.__position = { lineNumber, column };
            monacoMock.__selections = [{ selectedText: '', isEmpty: () => true }];
            const offset = textOffset(value, lineNumber, column);
            ref.current?.setSelectionRange(offset, offset);
            for (const listener of monacoMock.__cursorSelectionListeners) listener();
          },
        },
        monacoMock
      );
      return () => {
        monacoMock.__editorUnmountCount += 1;
      };
    }, []);
    useEffect(() => {
      const pathChanged = mountedPathRef.current !== path;
      monacoMock.__language = language;
      if (!pathChanged) return;
      mountedPathRef.current = path;
      monacoMock.__currentEditorPath = path;
      for (const listener of [...monacoMock.__modelChangeListeners]) listener();
    }, [language, path]);
    return createElement('textarea', {
      ref,
      'aria-label': options.ariaLabel,
      readOnly: options.readOnly,
      value,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value),
    });
  };
  const DiffEditor = ({ original = '', modified = '', beforeMount, onMount, options = {} }: MonacoDiffMockProps) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      beforeMount?.(monacoMock);
      onMount?.({ getModifiedEditor: () => ({ focus: () => ref.current?.focus() }) }, monacoMock);
    }, []);
    return createElement(
      'div',
      { ref, role: 'region', tabIndex: -1, 'aria-label': options.ariaLabel, 'data-testid': 'monaco-diff-editor' },
      createElement('pre', { 'data-side': 'original' }, original),
      createElement('pre', { 'data-side': 'modified' }, modified)
    );
  };
  return {
    default: Editor,
    Editor,
    DiffEditor,
    loader: { config: vi.fn() },
  };
});

vi.mock('../features/memory/components/memory-graph-3d', () => ({
  default: () => createElement('div', { 'data-testid': 'memory-graph-3d-scene' }),
}));

interface MonacoEditorMockProps {
  value?: string;
  language?: string;
  path?: string;
  onChange?: (value: string) => void;
  onMount?: (editor: unknown, monaco: typeof monacoMock) => void;
  beforeMount?: (monaco: typeof monacoMock) => void;
  options?: { ariaLabel?: string; readOnly?: boolean };
}

afterEach(() => {
  clearWorkspaceEditorModels();
  monacoMock.__modelDisposed = false;
  monacoMock.__savedViewStates.splice(0);
  monacoMock.__restoredViewStates.splice(0);
  monacoMock.__currentEditorPath = '';
});

interface MonacoAction {
  id: string;
  run: () => void | Promise<void>;
}

interface MonacoDisposable {
  dispose: () => void;
}

interface MonacoCancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested: (listener: () => void) => MonacoDisposable;
}

interface MonacoDocumentSymbolProvider {
  displayName?: string;
  provideDocumentSymbols: (model: unknown, token: MonacoCancellationToken) => unknown;
}

interface MonacoDocumentSymbolRegistration {
  languageSelector: string;
  provider: MonacoDocumentSymbolProvider;
}

interface MonacoSelection {
  selectedText: string;
  isEmpty: () => boolean;
}

interface MonacoDiffMockProps {
  original?: string;
  modified?: string;
  onMount?: (editor: unknown, monaco: typeof monacoMock) => void;
  beforeMount?: (monaco: typeof monacoMock) => void;
  options?: { ariaLabel?: string };
}

function textOffset(content: string, line: number, column: number): number {
  const lines = content.split('\n');
  const lineIndex = Math.min(Math.max(0, line - 1), Math.max(0, lines.length - 1));
  const lineOffset = lines.slice(0, lineIndex).reduce((total, value) => total + value.length + 1, 0);
  return lineOffset + Math.min(Math.max(0, column - 1), lines[lineIndex]?.length ?? 0);
}

function mockRegistration(listeners: Array<() => void>, listener: () => void): MonacoDisposable {
  listeners.push(listener);
  return {
    dispose: () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
}
