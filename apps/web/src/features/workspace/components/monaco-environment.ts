import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: (moduleId: string, label: string) => Worker;
  };
};

const monacoGlobal = globalThis as MonacoGlobal;

if (typeof Worker !== 'undefined') {
  monacoGlobal.MonacoEnvironment = {
    getWorker: (_moduleId, label) => {
      if (label === 'json') {
        return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url), {
          type: 'module',
        });
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url), {
          type: 'module',
        });
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new Worker(new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url), {
          type: 'module',
        });
      }
      if (label === 'typescript' || label === 'javascript') {
        return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url), {
          type: 'module',
        });
      }
      return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), {
        type: 'module',
      });
    },
  };
}

loader.config({ monaco });

let configured = false;

export function configureMonaco(instance: typeof monaco): void {
  if (configured) return;
  configured = true;

  instance.editor.defineTheme('a3s-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#24262b',
      'editorLineNumber.foreground': '#a3a7af',
      'editorLineNumber.activeForeground': '#4e535c',
      'editorCursor.foreground': '#1677ff',
      'editor.selectionBackground': '#dcecff',
      'editor.inactiveSelectionBackground': '#edf4fc',
      'editor.lineHighlightBackground': '#f7f8fa',
      'editorIndentGuide.background1': '#eceef2',
      'editorIndentGuide.activeBackground1': '#c7cbd3',
      'editorGutter.background': '#ffffff',
      'editorWidget.background': '#ffffff',
      'editorWidget.border': '#dfe2e7',
      'editorSuggestWidget.selectedBackground': '#eef5ff',
      'diffEditor.insertedTextBackground': '#b7ebc633',
      'diffEditor.removedTextBackground': '#ffb8b833',
      'diffEditor.insertedLineBackground': '#eaf8ee',
      'diffEditor.removedLineBackground': '#fff0f0',
    },
  });
  instance.editor.defineTheme('a3s-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#17181b',
      'editor.foreground': '#e7e9ed',
      'editorLineNumber.foreground': '#666b75',
      'editorLineNumber.activeForeground': '#b7bbc3',
      'editorCursor.foreground': '#5aa2ff',
      'editor.selectionBackground': '#204f7d',
      'editor.inactiveSelectionBackground': '#25384d',
      'editor.lineHighlightBackground': '#1e2024',
      'editorIndentGuide.background1': '#2b2e34',
      'editorIndentGuide.activeBackground1': '#4b505a',
      'editorGutter.background': '#17181b',
      'editorWidget.background': '#202226',
      'editorWidget.border': '#363a42',
      'editorSuggestWidget.selectedBackground': '#25384d',
      'diffEditor.insertedTextBackground': '#2c7a4738',
      'diffEditor.removedTextBackground': '#a33d3d38',
      'diffEditor.insertedLineBackground': '#1d3024',
      'diffEditor.removedLineBackground': '#351f22',
    },
  });

  instance.languages.register({ id: 'a3s-acl', extensions: ['.acl', '.hcl'] });
  instance.languages.setMonarchTokensProvider('a3s-acl', {
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/\/\/.*$/, 'comment'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/\b(true|false|null)\b/, 'keyword'],
        [/\b(provider|model|default|mcp|server|allow|deny|rule|resource|action)\b/, 'keyword'],
        [/-?\d+(\.\d+)?/, 'number'],
        [/[{}[\]()]/, '@brackets'],
        [/[a-zA-Z_][\w-]*/, 'identifier'],
      ],
    },
  });
}

export function languageForPath(path: string): string | undefined {
  const extension = path.split('.').pop()?.toLowerCase();
  const languages: Record<string, string> = {
    acl: 'a3s-acl',
    bash: 'shell',
    c: 'c',
    cc: 'cpp',
    cpp: 'cpp',
    css: 'css',
    go: 'go',
    h: 'c',
    hcl: 'a3s-acl',
    html: 'html',
    js: 'javascript',
    json: 'json',
    jsx: 'javascript',
    md: 'markdown',
    mdx: 'markdown',
    py: 'python',
    rs: 'rust',
    sh: 'shell',
    sql: 'sql',
    toml: 'ini',
    ts: 'typescript',
    tsx: 'typescript',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return extension ? languages[extension] : undefined;
}

export function monacoTheme(dark: boolean): string {
  return dark ? 'a3s-dark' : 'a3s-light';
}
