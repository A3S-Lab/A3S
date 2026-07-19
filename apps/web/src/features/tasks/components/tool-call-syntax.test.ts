import { describe, expect, it } from 'vitest';
import { shellSyntaxTokens, toolInvocationPresentation, toolOutputExcerpt } from './tool-call-syntax';

describe('tool call syntax presentation', () => {
  it('preserves a shell command while assigning TUI-compatible syntax roles', () => {
    const command = `cd '../work tree'&&cargo test -p a3s|rg "tool call"`;
    const tokens = shellSyntaxTokens(command);

    expect(tokens.map((token) => token.text).join('')).toBe(command);
    expect(tokens).toEqual(
      expect.arrayContaining([
        { text: 'cd', role: 'program' },
        { text: "'../work tree'", role: 'string' },
        { text: '&&', role: 'operator' },
        { text: 'cargo', role: 'program' },
        { text: '-p', role: 'flag' },
        { text: '|', role: 'operator' },
        { text: '"tool call"', role: 'string' },
      ])
    );
  });

  it('builds a readable generic invocation instead of exposing only raw JSON', () => {
    const presentation = toolInvocationPresentation({
      name: 'read',
      args: { path: 'src/app.ts', line: 12, optional: true },
      inputText: '',
    });

    expect(presentation).toMatchObject({
      kind: 'tool',
      text: 'read(path=src/app.ts, line=12, optional=true)',
    });
    expect(presentation?.tokens).toEqual(
      expect.arrayContaining([
        { text: 'read', role: 'program' },
        { text: 'path', role: 'key' },
        { text: 'src/app.ts', role: 'path' },
        { text: '12', role: 'number' },
        { text: 'true', role: 'keyword' },
      ])
    );
  });

  it('previews a command while its streamed JSON argument is still incomplete', () => {
    const presentation = toolInvocationPresentation({
      name: 'bash',
      inputText: '{"command":"cargo test --workspace',
    });

    expect(presentation).toMatchObject({
      kind: 'shell',
      text: 'cargo test --workspace',
    });
  });

  it('recognizes namespaced command tools used by other agent providers', () => {
    const presentation = toolInvocationPresentation({
      name: 'functions.shell_command',
      args: { command: 'rg --files', workdir: '/repo' },
      inputText: '',
    });

    expect(presentation).toMatchObject({
      kind: 'shell',
      text: 'rg --files',
      cwd: '/repo',
    });
  });

  it('keeps the latest output lines and reports how much earlier evidence was folded', () => {
    expect(toolOutputExcerpt('one\ntwo\nthree\nfour\n', 2)).toEqual({
      lines: ['three', 'four'],
      omittedLines: 2,
      truncated: false,
    });
  });
});
