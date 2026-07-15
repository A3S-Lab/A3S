import { describe, expect, it } from 'vitest';
import type { CodeDiagnostic, CodeLocation } from '../../types/api';
import { diagnosticsForPath, monacoRange, workspaceCodePath, workspaceSelection } from './code-intelligence';

describe('workspace code-intelligence boundary', () => {
  it('normalizes editor paths to workspace-relative paths', () => {
    expect(workspaceCodePath('/repo/src/app.ts', '/repo')).toBe('src/app.ts');
    expect(workspaceCodePath('src/app.ts', '/repo')).toBe('src/app.ts');
    expect(workspaceCodePath('src\\app.ts', 'C:\\repo')).toBe('src/app.ts');
    expect(workspaceCodePath('C:\\Repo\\src\\app.ts', 'C:\\repo')).toBe('src/app.ts');
    expect(workspaceCodePath('/src/app.ts', '/')).toBe('src/app.ts');
  });

  it('rejects paths outside the served workspace', () => {
    expect(workspaceCodePath('/other/app.ts', '/repo')).toBeNull();
    expect(workspaceCodePath('../secret.ts', '/repo')).toBeNull();
    expect(workspaceCodePath('src/../secret.ts', '/repo')).toBeNull();
    expect(workspaceCodePath('src//app.ts', '/repo')).toBeNull();
  });

  it('converts a relative navigation target back into the existing editor selection shape', () => {
    const location: CodeLocation = {
      path: 'src/target.ts',
      range: {
        start: { line: 7, character: 2 },
        end: { line: 7, character: 8 },
      },
    };

    expect(workspaceSelection(location, '/repo')).toEqual({
      path: '/repo/src/target.ts',
      isBinary: false,
      line: 8,
      column: 3,
    });
    expect(workspaceSelection({ ...location, path: '/repo/src/target.ts' }, '/repo')).toBeNull();
  });

  it('uses Monaco one-based ranges and keeps diagnostics scoped to the open file', () => {
    const diagnostic: CodeDiagnostic = {
      location: {
        path: 'src/app.ts',
        range: {
          start: { line: 2, character: 4 },
          end: { line: 2, character: 9 },
        },
      },
      severity: 'warning',
      code: 'unused',
      source: 'typescript',
      message: 'Unused value',
    };

    expect(diagnosticsForPath([diagnostic], '/repo/src/app.ts', '/repo')).toEqual([diagnostic]);
    expect(diagnosticsForPath([diagnostic], '/repo/src/other.ts', '/repo')).toEqual([]);
    expect(monacoRange(diagnostic.location.range)).toEqual({
      startLineNumber: 3,
      startColumn: 5,
      endLineNumber: 3,
      endColumn: 10,
    });
  });
});
