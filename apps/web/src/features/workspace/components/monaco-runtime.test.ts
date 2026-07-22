import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const expectedBasicLanguages = [
  'cpp',
  'css',
  'go',
  'html',
  'ini',
  'javascript',
  'markdown',
  'python',
  'rust',
  'shell',
  'sql',
  'typescript',
  'xml',
  'yaml',
].sort();

const expectedLanguageServices = ['css', 'html', 'json', 'typescript'].sort();

describe('Monaco runtime import graph', () => {
  it('loads Simplified Chinese messages before Monaco evaluates editor actions', () => {
    const source = runtimeSource();
    const locale = source.indexOf('monaco-editor/esm/nls.messages.zh-cn.js');
    const editor = source.indexOf('monaco-editor/esm/vs/editor/editor.api.js');

    expect(locale).toBeGreaterThanOrEqual(0);
    expect(locale).toBeLessThan(editor);
  });

  it('starts from the editor API without importing the broad package entry', () => {
    const source = runtimeSource();

    expect(source).toContain('monaco-editor/esm/vs/editor/editor.api.js');
    expect(source).toContain('monaco-editor/esm/vs/editor/edcore.main.js');
    expect(source).not.toMatch(/^import\s+(?!type\b).*from\s+['"]monaco-editor['"];?$/m);
    expect(source).not.toContain('monaco-editor/esm/vs/editor/editor.main.js');
    expect(source).not.toContain('monaco-lsp-client');
  });

  it('loads only the language services and tokenizers supported by the editor', () => {
    const source = runtimeSource();
    const basicLanguages = [...source.matchAll(/monaco-editor\/esm\/vs\/basic-languages\/([^/'"]+)\//g)]
      .map((match) => match[1])
      .sort();
    const languageServices = [...source.matchAll(/monaco-editor\/esm\/vs\/language\/([^/'"]+)\//g)]
      .map((match) => match[1])
      .sort();

    expect(basicLanguages).toEqual(expectedBasicLanguages);
    expect(languageServices).toEqual(expectedLanguageServices);
  });
});

function runtimeSource(): string {
  return readFileSync(resolve(process.cwd(), 'src/features/workspace/components/monaco-runtime.ts'), 'utf8');
}
