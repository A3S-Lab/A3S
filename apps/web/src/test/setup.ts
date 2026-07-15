import '@testing-library/jest-dom/vitest';
import { createElement, useEffect, useRef } from 'react';
import { vi } from 'vitest';

const monacoMock = vi.hoisted(() => ({
  editor: {
    defineTheme: vi.fn(),
    setModelMarkers: vi.fn(),
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
  MarkerSeverity: { Hint: 1, Info: 2, Warning: 4, Error: 8 },
  KeyMod: { CtrlCmd: 1, Shift: 16 },
  KeyCode: { KeyS: 2, KeyW: 3, F12: 4 },
  __actions: [] as MonacoAction[],
  __documentSymbolProviders: [] as MonacoDocumentSymbolRegistration[],
  __position: { lineNumber: 1, column: 1 },
  __model: { uri: { toString: () => 'file:///workspace/file.ts' } },
}));

vi.mock('monaco-editor', () => monacoMock);

vi.mock('@monaco-editor/react', () => {
  const Editor = ({ value = '', onChange, onMount, beforeMount, options = {} }: MonacoEditorMockProps) => {
    const ref = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
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
          getModel: () => monacoMock.__model,
          getPosition: () => monacoMock.__position,
          revealPositionInCenterIfOutsideViewport: vi.fn(),
          setPosition: ({ lineNumber, column }: { lineNumber: number; column: number }) => {
            const offset = textOffset(value, lineNumber, column);
            ref.current?.setSelectionRange(offset, offset);
          },
        },
        monacoMock
      );
    }, []);
    return createElement('textarea', {
      ref,
      'aria-label': options.ariaLabel,
      readOnly: options.readOnly,
      value,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value),
    });
  };
  const DiffEditor = ({ original = '', modified = '', beforeMount, onMount, options = {} }: MonacoDiffMockProps) => {
    useEffect(() => {
      beforeMount?.(monacoMock);
      onMount?.({ getModifiedEditor: () => ({ focus: vi.fn() }) }, monacoMock);
    }, []);
    return createElement(
      'div',
      { role: 'region', 'aria-label': options.ariaLabel },
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

interface MonacoEditorMockProps {
  value?: string;
  onChange?: (value: string) => void;
  onMount?: (editor: unknown, monaco: typeof monacoMock) => void;
  beforeMount?: (monaco: typeof monacoMock) => void;
  options?: { ariaLabel?: string; readOnly?: boolean };
}

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
