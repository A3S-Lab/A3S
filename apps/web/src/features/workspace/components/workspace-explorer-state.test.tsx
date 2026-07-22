import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../../lib/api';
import { appState } from '../../../state/app-state';
import type { WorkspaceEntry } from '../../../types/api';
import { useWorkspaceController } from '../use-workspace-controller';

describe('Workspace Explorer cached state', () => {
  afterEach(() => {
    cleanup();
    appState.workspaceRoot = '';
    appState.filesByDirectory = {};
    appState.expandedDirectories = {};
    appState.directoryLoading = {};
    appState.directoryErrors = {};
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    vi.restoreAllMocks();
  });

  it('preserves an expanded cached subtree when its directory is renamed', async () => {
    appState.workspaceRoot = '/repo';
    appState.filesByDirectory = {
      '/repo': [directory('/repo/src')],
      '/repo/src': [directory('/repo/src/nested'), textFile('/repo/src/app.ts')],
      '/repo/src/nested': [textFile('/repo/src/nested/model.ts')],
    };
    appState.expandedDirectories = { '/repo/src': true, '/repo/src/nested': true };
    appState.directoryLoading = { '/repo/src': false };
    appState.directoryErrors = { '/repo/src/nested': 'retry child' };
    vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockRejectedValue(new Error('parent refresh failed'));
    const hook = renderHook(() => useWorkspaceController());

    await act(() => hook.result.current.renameWorkspaceEntry('/repo/src', 'lib'));

    expect(appState.filesByDirectory['/repo'].map((entry) => [entry.name, entry.path])).toEqual([['lib', '/repo/lib']]);
    expect(appState.filesByDirectory['/repo/lib'].map((entry) => entry.path)).toEqual([
      '/repo/lib/nested',
      '/repo/lib/app.ts',
    ]);
    expect(appState.filesByDirectory['/repo/lib/nested'].map((entry) => entry.path)).toEqual([
      '/repo/lib/nested/model.ts',
    ]);
    expect(appState.filesByDirectory['/repo/src']).toBeUndefined();
    expect(appState.expandedDirectories).toMatchObject({ '/repo/lib': true, '/repo/lib/nested': true });
    expect(appState.expandedDirectories['/repo/src']).toBeUndefined();
    expect(appState.directoryLoading['/repo/lib']).toBe(false);
    expect(appState.directoryErrors['/repo/lib/nested']).toBe('retry child');
    hook.unmount();
  });

  it('removes a deleted subtree from every cache when parent refresh fails', async () => {
    appState.workspaceRoot = '/repo';
    appState.filesByDirectory = {
      '/repo': [directory('/repo/deleted'), textFile('/repo/keep.ts')],
      '/repo/deleted': [directory('/repo/deleted/nested')],
      '/repo/deleted/nested': [],
    };
    appState.expandedDirectories = { '/repo/deleted': true, '/repo/deleted/nested': true };
    appState.directoryLoading = { '/repo/deleted/nested': false };
    appState.directoryErrors = { '/repo/deleted': 'old error' };
    vi.spyOn(codeApi, 'deletePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockRejectedValue(new Error('parent refresh failed'));
    const hook = renderHook(() => useWorkspaceController());

    await act(() => hook.result.current.deleteWorkspaceEntry('/repo/deleted'));

    expect(appState.filesByDirectory['/repo'].map((entry) => entry.path)).toEqual(['/repo/keep.ts']);
    expect(Object.keys(appState.filesByDirectory)).not.toContain('/repo/deleted');
    expect(Object.keys(appState.filesByDirectory)).not.toContain('/repo/deleted/nested');
    expect(Object.keys(appState.expandedDirectories)).not.toContain('/repo/deleted');
    expect(Object.keys(appState.directoryLoading)).not.toContain('/repo/deleted/nested');
    expect(Object.keys(appState.directoryErrors)).not.toContain('/repo/deleted');
    expect(appState.directoryErrors['/repo']).toBe('parent refresh failed');
    hook.unmount();
  });

  it('ignores an old directory response after that subtree is renamed', async () => {
    appState.workspaceRoot = '/repo';
    appState.filesByDirectory = { '/repo': [directory('/repo/src')] };
    let resolveOldRead!: (entries: WorkspaceEntry[]) => void;
    const oldRead = new Promise<WorkspaceEntry[]>((resolve) => {
      resolveOldRead = resolve;
    });
    vi.spyOn(codeApi, 'readDir').mockImplementation((path) =>
      path === '/repo/src' ? oldRead : Promise.resolve([directory('/repo/lib')])
    );
    vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    const hook = renderHook(() => useWorkspaceController());

    const refresh = hook.result.current.refreshDirectory('/repo/src');
    await waitFor(() => expect(appState.directoryLoading['/repo/src']).toBe(true));
    await act(() => hook.result.current.renameWorkspaceEntry('/repo/src', 'lib'));
    await act(async () => {
      resolveOldRead([textFile('/repo/src/stale.ts')]);
      await refresh;
    });

    expect(appState.filesByDirectory['/repo/src']).toBeUndefined();
    expect(appState.filesByDirectory['/repo/lib']).toBeUndefined();
    expect(appState.filesByDirectory['/repo'].map((entry) => entry.path)).toEqual(['/repo/lib']);
    expect(appState.directoryLoading['/repo/lib']).toBe(false);
    hook.unmount();
  });
});

function directory(path: string): WorkspaceEntry {
  return {
    name: basename(path),
    path,
    isDirectory: true,
    isFile: false,
    size: 0,
    isBinary: false,
  };
}

function textFile(path: string): WorkspaceEntry {
  return {
    name: basename(path),
    path,
    isDirectory: false,
    isFile: true,
    size: 10,
    extension: path.split('.').pop(),
    isBinary: false,
  };
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}
