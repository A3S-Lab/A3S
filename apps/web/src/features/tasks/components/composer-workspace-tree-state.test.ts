import { describe, expect, it } from 'vitest';
import type { WorkspaceEntry } from '../../../types/api';
import { flattenComposerWorkspaceTree } from './composer-workspace-tree-state';

function entry(path: string, isDirectory = false): WorkspaceEntry {
  return {
    name: path.split('/').pop() ?? path,
    path,
    isDirectory,
    isFile: !isDirectory,
    size: 0,
    isBinary: false,
  };
}

describe('Composer workspace tree', () => {
  it('only exposes loaded children after their directory is expanded', () => {
    const entriesByDirectory = {
      '/repo': [entry('/repo/README.md'), entry('/repo/src', true)],
      '/repo/src': [entry('/repo/src/app.ts')],
    };
    expect(
      flattenComposerWorkspaceTree({
        workspaceRoot: '/repo',
        entriesByDirectory,
        expandedPaths: new Set(),
        selectedFiles: [],
      }).map((row) => row.relativePath)
    ).toEqual(['src', 'README.md']);
    expect(
      flattenComposerWorkspaceTree({
        workspaceRoot: '/repo',
        entriesByDirectory,
        expandedPaths: new Set(['/repo/src']),
        selectedFiles: [],
      }).map((row) => [row.relativePath, row.depth])
    ).toEqual([
      ['src', 0],
      ['src/app.ts', 1],
      ['README.md', 0],
    ]);
  });

  it('filters visible rows and omits files already attached to the Composer', () => {
    const rows = flattenComposerWorkspaceTree({
      workspaceRoot: '/repo',
      entriesByDirectory: {
        '/repo': [entry('/repo/src', true), entry('/repo/README.md')],
        '/repo/src': [entry('/repo/src/app.ts'), entry('/repo/src/app.test.ts')],
      },
      expandedPaths: new Set(['/repo/src']),
      selectedFiles: ['src/app.ts'],
      query: 'app',
    });
    expect(rows.map((row) => row.relativePath)).toEqual(['src/app.test.ts']);
  });
});
