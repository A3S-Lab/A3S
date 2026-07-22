import { describe, expect, it } from 'vitest';
import { workspaceEditorTabLabels } from './workspace-editor-tab-label';

describe('workspace editor tab labels', () => {
  it('keeps unique filenames compact', () => {
    const labels = workspaceEditorTabLabels(
      [
        { id: 'app', kind: 'file', path: '/repo/src/app.ts' },
        { id: 'readme', kind: 'file', path: '/repo/README.md' },
      ],
      '/repo'
    );

    expect(labels.get('app')).toMatchObject({ name: 'app.ts', detail: null, ariaLabel: 'app.ts' });
    expect(labels.get('readme')).toMatchObject({ name: 'README.md', detail: null, ariaLabel: 'README.md' });
  });

  it('uses the shortest unique parent suffix for duplicate filenames', () => {
    const labels = workspaceEditorTabLabels(
      [
        { id: 'acl', kind: 'file', path: '/repo/crates/acl/src/lib.rs' },
        { id: 'code', kind: 'file', path: '/repo/crates/code/src/lib.rs' },
        { id: 'root', kind: 'file', path: '/repo/lib.rs' },
      ],
      '/repo'
    );

    expect(labels.get('acl')).toMatchObject({ name: 'lib.rs', detail: 'acl/src', ariaLabel: 'lib.rs，acl/src' });
    expect(labels.get('code')).toMatchObject({ name: 'lib.rs', detail: 'code/src', ariaLabel: 'lib.rs，code/src' });
    expect(labels.get('root')).toMatchObject({ name: 'lib.rs', detail: '.', ariaLabel: 'lib.rs，.' });
  });

  it('distinguishes working and staged diffs without expanding their file labels', () => {
    const labels = workspaceEditorTabLabels(
      [
        { id: 'file', kind: 'file', path: '/repo/src/app.ts' },
        { id: 'working', kind: 'diff', path: 'src/app.ts', staged: false },
        { id: 'staged', kind: 'diff', path: 'src/app.ts', staged: true },
      ],
      '/repo'
    );

    expect(labels.get('file')).toMatchObject({ name: 'app.ts', detail: null });
    expect(labels.get('working')).toMatchObject({ name: 'app.ts（工作树）', detail: null });
    expect(labels.get('staged')).toMatchObject({ name: 'app.ts（已暂存）', detail: null });
  });

  it('normalizes Windows paths before comparing parent suffixes', () => {
    const labels = workspaceEditorTabLabels(
      [
        { id: 'client', kind: 'file', path: 'C:\\repo\\client\\src\\index.ts' },
        { id: 'server', kind: 'file', path: 'C:\\repo\\server\\src\\index.ts' },
      ],
      'C:\\repo'
    );

    expect(labels.get('client')?.detail).toBe('client/src');
    expect(labels.get('server')?.detail).toBe('server/src');
  });
});
