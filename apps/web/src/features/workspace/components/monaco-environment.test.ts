import * as monaco from 'monaco-editor';
import { describe, expect, it } from 'vitest';
import { configureMonaco, languageForPath } from './monaco-environment';

describe('Monaco environment', () => {
  it('loads the Chinese message catalog used by the native editor context menu', () => {
    const messages = (globalThis as typeof globalThis & { _VSCODE_NLS_MESSAGES?: string[] })._VSCODE_NLS_MESSAGES;

    expect(messages).toEqual(expect.arrayContaining(['剪切', '复制', '粘贴', '命令面板']));
  });

  it('keeps native document symbols as the single outline source', () => {
    configureMonaco(monaco);

    expect(monaco.typescript.typescriptDefaults.setModeConfiguration).toHaveBeenCalledWith({
      documentSymbols: false,
      definitions: true,
      references: true,
    });
    expect(monaco.typescript.javascriptDefaults.setModeConfiguration).toHaveBeenCalledWith({
      documentSymbols: false,
      definitions: true,
      references: true,
    });
  });

  it.each([
    ['config.acl', 'a3s-acl'],
    ['main.hcl', 'a3s-acl'],
    ['script.sh', 'shell'],
    ['script.bash', 'shell'],
    ['native.c', 'c'],
    ['native.h', 'c'],
    ['native.cc', 'cpp'],
    ['native.cpp', 'cpp'],
    ['next.config.mjs', 'javascript'],
    ['tool.cjs', 'javascript'],
    ['component.jsx', 'javascript'],
    ['module.mts', 'typescript'],
    ['module.cts', 'typescript'],
    ['component.tsx', 'typescript'],
    ['styles.css', 'css'],
    ['main.go', 'go'],
    ['index.html', 'html'],
    ['package.json', 'json'],
    ['README.md', 'markdown'],
    ['guide.mdx', 'markdown'],
    ['worker.py', 'python'],
    ['lib.rs', 'rust'],
    ['query.sql', 'sql'],
    ['settings.toml', 'ini'],
    ['layout.xml', 'xml'],
    ['workflow.yaml', 'yaml'],
    ['workflow.yml', 'yaml'],
  ])('maps %s to %s', (path, language) => {
    expect(languageForPath(`/repo/${path}`)).toBe(language);
  });

  it('leaves unsupported and extensionless files in plain text mode', () => {
    expect(languageForPath('/repo/image.png')).toBeUndefined();
    expect(languageForPath('/repo/Makefile')).toBeUndefined();
  });
});
