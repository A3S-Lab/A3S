import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../lib/api';
import { appState, switchActiveTask } from '../../state/app-state';
import { useWorkspaceController } from './use-workspace-controller';
import { fileEditorTabId, type WorkspaceFileEditorTab } from './workspace-state';

describe('useWorkspaceController file operation ordering', () => {
  afterEach(() => {
    cleanup();
    appState.workspaceRoot = '';
    appState.filesByDirectory = {};
    appState.expandedDirectories = {};
    appState.directoryLoading = {};
    appState.directoryErrors = {};
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    appState.pendingEditorTabCloseId = null;
    appState.fileLoadError = null;
    appState.fileConflict = null;
    appState.workspaceSnapshotsByTask = {};
    appState.workspaceGeneration = 0;
    appState.activeSessionId = null;
    appState.sessions = [];
    appState.draftsByTask = {};
    appState.workspaceSearchResults = [];
    appState.workspaceSearchQuery = '';
    appState.workspaceSearchLoading = false;
    appState.gitStatus = null;
    appState.gitStatusLoading = false;
    vi.restoreAllMocks();
  });

  it('finishes a pending file read against the same tab after its parent is renamed', async () => {
    appState.workspaceRoot = '/repo';
    const read = deferred<{ content: string; revision: string }>();
    vi.spyOn(codeApi, 'readFile').mockReturnValue(read.promise);
    vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());

    let selection!: Promise<boolean>;
    act(() => {
      selection = hook.result.current.selectFile({ path: '/repo/src/app.ts', isBinary: false });
    });
    await waitFor(() => expect(codeApi.readFile).toHaveBeenCalledWith('/repo/src/app.ts'));

    await act(() => hook.result.current.renameWorkspaceEntry('/repo/src', 'lib'));
    expect(activeFileTab()).toMatchObject({
      id: fileEditorTabId('/repo/lib/app.ts'),
      path: '/repo/lib/app.ts',
      loading: true,
    });

    await act(async () => {
      read.resolve({ content: 'export const renamed = true;\n', revision: 'sha256:renamed' });
      await selection;
    });

    expect(activeFileTab()).toMatchObject({
      id: fileEditorTabId('/repo/lib/app.ts'),
      path: '/repo/lib/app.ts',
      content: 'export const renamed = true;\n',
      draft: 'export const renamed = true;\n',
      revision: 'sha256:renamed',
      loading: false,
      loadError: null,
    });
    hook.unmount();
  });

  it('retries a pending file read at its rebased path when the old path disappears', async () => {
    appState.workspaceRoot = '/repo';
    const oldPathRead = deferred<{ content: string }>();
    const readFile = vi
      .spyOn(codeApi, 'readFile')
      .mockReturnValueOnce(oldPathRead.promise)
      .mockResolvedValueOnce({ content: 'export const retried = true;\n' });
    vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());

    let selection!: Promise<boolean>;
    act(() => {
      selection = hook.result.current.selectFile({ path: '/repo/src/app.ts', isBinary: false });
    });
    await waitFor(() => expect(readFile).toHaveBeenCalledWith('/repo/src/app.ts'));
    await act(() => hook.result.current.renameWorkspaceEntry('/repo/src', 'lib'));

    await act(async () => {
      oldPathRead.reject(new Error('old path no longer exists'));
      await selection;
    });

    expect(readFile).toHaveBeenNthCalledWith(2, '/repo/lib/app.ts');
    expect(activeFileTab()).toMatchObject({
      path: '/repo/lib/app.ts',
      content: 'export const retried = true;\n',
      loading: false,
      loadError: null,
    });
    expect(appState.fileLoadError).toBeNull();
    hook.unmount();
  });

  it('does not publish a late read error after the pending tab is deleted', async () => {
    appState.workspaceRoot = '/repo';
    const read = deferred<{ content: string }>();
    vi.spyOn(codeApi, 'readFile').mockReturnValue(read.promise);
    vi.spyOn(codeApi, 'deletePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());

    let selection!: Promise<boolean>;
    act(() => {
      selection = hook.result.current.selectFile({ path: '/repo/src/app.ts', isBinary: false });
    });
    await waitFor(() => expect(codeApi.readFile).toHaveBeenCalledWith('/repo/src/app.ts'));
    await act(() => hook.result.current.deleteWorkspaceEntry('/repo/src'));

    await act(async () => {
      read.reject(new Error('path disappeared'));
      await selection;
    });

    expect(appState.editorTabs).toEqual([]);
    expect(appState.fileLoadError).toBeNull();
    hook.unmount();
  });

  it('keeps the latest requested location in navigation history while the initial read is pending', async () => {
    appState.workspaceRoot = '/repo';
    const read = deferred<{ content: string }>();
    vi.spyOn(codeApi, 'readFile').mockReturnValue(read.promise);
    const hook = renderHook(() => useWorkspaceController());

    let initialSelection!: Promise<boolean>;
    act(() => {
      initialSelection = hook.result.current.selectFile({
        path: '/repo/app.ts',
        isBinary: false,
        line: 2,
        column: 1,
      });
    });
    await waitFor(() => expect(codeApi.readFile).toHaveBeenCalledWith('/repo/app.ts'));
    await act(() => hook.result.current.selectFile({ path: '/repo/app.ts', isBinary: false, line: 20, column: 7 }));

    await act(async () => {
      read.resolve({ content: 'export const value = 1;\n' });
      await initialSelection;
    });

    expect(activeFileTab()?.location).toEqual({ line: 20, column: 7 });
    await act(() => hook.result.current.selectFile({ path: '/repo/other.ts', isBinary: false, line: 1, column: 1 }));
    await act(() => hook.result.current.navigateEditorBack());
    expect(activeFileTab()).toMatchObject({
      path: '/repo/app.ts',
      location: { line: 20, column: 7 },
    });
    hook.unmount();
  });

  it('saves against the loaded revision without a client-side read-before-write request', async () => {
    appState.workspaceRoot = '/repo';
    const tab = setOpenFileTab('/repo/app.ts', 'saved', 'local edit');
    tab.revision = 'sha256:saved';
    const readFile = vi.spyOn(codeApi, 'readFile').mockResolvedValue({
      content: 'saved',
      revision: 'sha256:saved',
    });
    const writeFile = vi.spyOn(codeApi, 'writeFile').mockResolvedValue({
      success: true,
      revision: 'sha256:local-edit',
    });
    const hook = renderHook(() => useWorkspaceController());

    await act(() => hook.result.current.saveEditorTab(tab.id));

    expect(readFile).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith('/repo/app.ts', 'local edit', {
      expectedRevision: 'sha256:saved',
    });
    expect(activeFileTab()).toMatchObject({
      content: 'local edit',
      draft: 'local edit',
      revision: 'sha256:local-edit',
      saving: false,
    });
    hook.unmount();
  });

  it('waits for an in-flight save before renaming its parent directory', async () => {
    appState.workspaceRoot = '/repo';
    const tab = setOpenFileTab('/repo/src/app.ts', 'saved', 'local edit');
    const write = deferred<{ success: boolean }>();
    vi.spyOn(codeApi, 'writeFile').mockReturnValue(write.promise);
    const renamePath = vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());

    let save!: Promise<boolean>;
    act(() => {
      save = hook.result.current.saveEditorTab(tab.id);
    });
    await waitFor(() =>
      expect(codeApi.writeFile).toHaveBeenCalledWith('/repo/src/app.ts', 'local edit', {
        expectedContent: 'saved',
      })
    );

    let rename!: Promise<void>;
    act(() => {
      rename = hook.result.current.renameWorkspaceEntry('/repo/src', 'lib');
    });
    expect(renamePath).not.toHaveBeenCalled();

    await act(async () => {
      write.resolve({ success: true });
      await save;
      await rename;
    });

    expect(renamePath).toHaveBeenCalledWith('/repo/src', '/repo/lib');
    expect(activeFileTab()).toMatchObject({
      path: '/repo/lib/app.ts',
      content: 'local edit',
      draft: 'local edit',
      saving: false,
    });
    hook.unmount();
  });

  it('orders a rename requested in the same turn immediately after save', async () => {
    appState.workspaceRoot = '/repo';
    const tab = setOpenFileTab('/repo/src/app.ts', 'saved', 'local edit');
    const write = deferred<{ success: boolean }>();
    vi.spyOn(codeApi, 'writeFile').mockReturnValue(write.promise);
    const renamePath = vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());

    let save!: Promise<boolean>;
    let rename!: Promise<void>;
    act(() => {
      save = hook.result.current.saveEditorTab(tab.id);
      rename = hook.result.current.renameWorkspaceEntry('/repo/src', 'lib');
    });
    await waitFor(() =>
      expect(codeApi.writeFile).toHaveBeenCalledWith('/repo/src/app.ts', 'local edit', {
        expectedContent: 'saved',
      })
    );
    expect(renamePath).not.toHaveBeenCalled();

    await act(async () => {
      write.resolve({ success: true });
      await save;
      await rename;
    });

    expect(renamePath).toHaveBeenCalledWith('/repo/src', '/repo/lib');
    expect(activeFileTab()).toMatchObject({ path: '/repo/lib/app.ts', content: 'local edit', saving: false });
    hook.unmount();
  });

  it('waits for an in-flight save before deleting its parent directory', async () => {
    appState.workspaceRoot = '/repo';
    const tab = setOpenFileTab('/repo/src/app.ts', 'saved', 'local edit');
    const write = deferred<{ success: boolean }>();
    vi.spyOn(codeApi, 'writeFile').mockReturnValue(write.promise);
    const deletePath = vi.spyOn(codeApi, 'deletePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());

    let save!: Promise<boolean>;
    act(() => {
      save = hook.result.current.saveEditorTab(tab.id);
    });
    await waitFor(() =>
      expect(codeApi.writeFile).toHaveBeenCalledWith('/repo/src/app.ts', 'local edit', {
        expectedContent: 'saved',
      })
    );

    let remove!: Promise<void>;
    act(() => {
      remove = hook.result.current.deleteWorkspaceEntry('/repo/src');
    });
    expect(deletePath).not.toHaveBeenCalled();

    await act(async () => {
      write.resolve({ success: true });
      await save;
      await remove;
    });

    expect(deletePath).toHaveBeenCalledWith('/repo/src');
    expect(appState.editorTabs).toEqual([]);
    hook.unmount();
  });

  it('saves to the new path when save is requested during a rename', async () => {
    appState.workspaceRoot = '/repo';
    const tab = setOpenFileTab('/repo/src/app.ts', 'saved', 'local edit');
    const rename = deferred<{ success: boolean }>();
    vi.spyOn(codeApi, 'renamePath').mockReturnValue(rename.promise);
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const readFile = vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: 'saved' });
    const writeFile = vi.spyOn(codeApi, 'writeFile').mockResolvedValue({ success: true });
    const hook = renderHook(() => useWorkspaceController());

    let renameOperation!: Promise<void>;
    act(() => {
      renameOperation = hook.result.current.renameWorkspaceEntry('/repo/src', 'lib');
    });
    await waitFor(() => expect(codeApi.renamePath).toHaveBeenCalledWith('/repo/src', '/repo/lib'));

    let save!: Promise<boolean>;
    act(() => {
      save = hook.result.current.saveEditorTab(tab.id);
    });
    expect(readFile).not.toHaveBeenCalled();

    await act(async () => {
      rename.resolve({ success: true });
      await renameOperation;
      await save;
    });

    expect(readFile).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith('/repo/lib/app.ts', 'local edit', {
      expectedContent: 'saved',
    });
    expect(activeFileTab()).toMatchObject({ path: '/repo/lib/app.ts', content: 'local edit', saving: false });
    hook.unmount();
  });

  it('also defers saving a file opened after its parent rename has started', async () => {
    appState.workspaceRoot = '/repo';
    const rename = deferred<{ success: boolean }>();
    vi.spyOn(codeApi, 'renamePath').mockReturnValue(rename.promise);
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const readFile = vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: 'saved' });
    const writeFile = vi.spyOn(codeApi, 'writeFile').mockResolvedValue({ success: true });
    const hook = renderHook(() => useWorkspaceController());

    let renameOperation!: Promise<void>;
    act(() => {
      renameOperation = hook.result.current.renameWorkspaceEntry('/repo/src', 'lib');
    });
    await waitFor(() => expect(codeApi.renamePath).toHaveBeenCalledWith('/repo/src', '/repo/lib'));
    await act(() => hook.result.current.selectFile({ path: '/repo/src/app.ts', isBinary: false }));
    const tab = activeFileTab();
    expect(tab).not.toBeNull();
    act(() => hook.result.current.updateEditorDraft(tab!.id, 'local edit'));

    let save!: Promise<boolean>;
    act(() => {
      save = hook.result.current.saveEditorTab(tab!.id);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(writeFile).not.toHaveBeenCalled();

    await act(async () => {
      rename.resolve({ success: true });
      await renameOperation;
      await save;
    });

    expect(readFile).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith('/repo/lib/app.ts', 'local edit', {
      expectedContent: 'saved',
    });
    expect(activeFileTab()).toMatchObject({ path: '/repo/lib/app.ts', content: 'local edit', saving: false });
    hook.unmount();
  });

  it('waits for an in-flight conflict overwrite before deleting the file', async () => {
    appState.workspaceRoot = '/repo';
    const tab = setOpenFileTab('/repo/app.ts', 'saved', 'local edit');
    appState.fileConflict = {
      tabId: tab.id,
      path: tab.path,
      diskContent: 'external edit',
      diskRevision: null,
    };
    const write = deferred<{ success: boolean }>();
    vi.spyOn(codeApi, 'writeFile').mockReturnValue(write.promise);
    const deletePath = vi.spyOn(codeApi, 'deletePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());

    let overwrite!: Promise<void>;
    act(() => {
      overwrite = hook.result.current.resolveFileConflict('overwrite');
    });
    await waitFor(() => expect(codeApi.writeFile).toHaveBeenCalledWith('/repo/app.ts', 'local edit'));

    let remove!: Promise<void>;
    act(() => {
      remove = hook.result.current.deleteWorkspaceEntry('/repo/app.ts');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(deletePath).not.toHaveBeenCalled();

    await act(async () => {
      write.resolve({ success: true });
      await overwrite;
      await remove;
    });

    expect(deletePath).toHaveBeenCalledWith('/repo/app.ts');
    expect(appState.editorTabs).toEqual([]);
    expect(appState.fileConflict).toBeNull();
    hook.unmount();
  });

  it('does not publish a pending file read into another task that uses the same workspace', async () => {
    setTaskSwitchFixture();
    const read = deferred<{ content: string }>();
    vi.spyOn(codeApi, 'readFile').mockReturnValue(read.promise);
    const hook = renderHook(() => useWorkspaceController());

    let selection!: Promise<boolean>;
    act(() => {
      selection = hook.result.current.selectFile({ path: '/repo/a.ts', isBinary: false });
    });
    await waitFor(() => expect(codeApi.readFile).toHaveBeenCalledWith('/repo/a.ts'));

    act(() => {
      switchActiveTask('task-b');
    });
    expect(appState.editorTabs).toEqual([]);

    await act(async () => {
      read.resolve({ content: 'late A content' });
      await selection;
    });

    expect(appState.activeSessionId).toBe('task-b');
    expect(appState.editorTabs).toEqual([]);
    expect(appState.fileLoadError).toBeNull();

    act(() => {
      switchActiveTask('task-a');
    });
    expect(appState.editorTabs).toHaveLength(1);
    expect(appState.editorTabs[0]).toMatchObject({
      path: '/repo/a.ts',
      content: '',
      draft: '',
      loading: false,
    });
    hook.unmount();
  });

  it('keeps a completed save scoped to its source task after switching away', async () => {
    setTaskSwitchFixture();
    const tab = setOpenFileTab('/repo/a.ts', 'saved A', 'draft A');
    const write = deferred<{ success: boolean }>();
    vi.spyOn(codeApi, 'writeFile').mockReturnValue(write.promise);
    const hook = renderHook(() => useWorkspaceController());

    let save!: Promise<boolean>;
    act(() => {
      save = hook.result.current.saveEditorTab(tab.id);
    });
    await waitFor(() =>
      expect(codeApi.writeFile).toHaveBeenCalledWith('/repo/a.ts', 'draft A', {
        expectedContent: 'saved A',
      })
    );

    act(() => {
      switchActiveTask('task-b');
    });
    const tabB = setOpenFileTab('/repo/b.ts', 'saved B');
    appState.toast = null;

    await act(async () => {
      write.resolve({ success: true });
      await save;
    });

    expect(appState.activeSessionId).toBe('task-b');
    expect(appState.editorTabs).toHaveLength(1);
    expect(appState.editorTabs[0]).toMatchObject({ id: tabB.id, content: 'saved B' });
    expect(appState.toast).toBeNull();

    act(() => {
      switchActiveTask('task-a');
    });
    expect(appState.editorTabs[0]).toMatchObject({
      id: tab.id,
      content: 'saved A',
      draft: 'draft A',
      saving: false,
    });
    hook.unmount();
  });

  it('ignores stale search and Git status responses after a same-root task switch', async () => {
    setTaskSwitchFixture();
    const search = deferred<Array<{ path: string; matches: [] }>>();
    const status = deferred<{ isGitRepo: boolean; branch: string; files: [] }>();
    vi.spyOn(codeApi, 'searchWorkspace').mockReturnValue(search.promise);
    vi.spyOn(codeApi, 'gitStatus').mockReturnValue(status.promise);
    const hook = renderHook(() => useWorkspaceController());

    let searchRequest!: Promise<void>;
    let statusRequest!: Promise<void>;
    act(() => {
      searchRequest = hook.result.current.searchWorkspace('needle', { scope: 'source' });
      statusRequest = hook.result.current.refreshGitStatus();
    });
    await waitFor(() => expect(codeApi.searchWorkspace).toHaveBeenCalled());
    await waitFor(() => expect(codeApi.gitStatus).toHaveBeenCalledWith('/repo'));

    act(() => {
      switchActiveTask('task-b');
      appState.workspaceSearchQuery = 'task B query';
      appState.gitStatus = { isGitRepo: true, branch: 'task-b', files: [] };
    });

    await act(async () => {
      search.resolve([{ path: '/repo/a.ts', matches: [] }]);
      status.resolve({ isGitRepo: true, branch: 'task-a', files: [] });
      await Promise.all([searchRequest, statusRequest]);
    });

    expect(appState.workspaceSearchQuery).toBe('task B query');
    expect(appState.workspaceSearchResults).toEqual([]);
    expect(appState.workspaceSearchLoading).toBe(false);
    expect(appState.gitStatus?.branch).toBe('task-b');
    expect(appState.gitStatusLoading).toBe(false);
    hook.unmount();
  });

  it('does not let a stale directory or replace response alter the destination task', async () => {
    setTaskSwitchFixture();
    const directory =
      deferred<
        Array<{
          name: string;
          path: string;
          isDirectory: boolean;
          isFile: boolean;
          size: number;
          isBinary: boolean;
        }>
      >();
    const replacement = deferred<{
      filesModified: number;
      totalReplacements: number;
      files: Array<{ path: string; replacements: number }>;
    }>();
    vi.spyOn(codeApi, 'readDir').mockReturnValue(directory.promise);
    vi.spyOn(codeApi, 'replaceWorkspace').mockReturnValue(replacement.promise);
    const search = vi.spyOn(codeApi, 'searchWorkspace');
    const hook = renderHook(() => useWorkspaceController());

    let directoryRequest!: Promise<void>;
    let replaceRequest!: Promise<void>;
    act(() => {
      directoryRequest = hook.result.current.refreshDirectory('/repo/src');
      replaceRequest = hook.result.current.replaceWorkspace('before', 'after', ['/repo/a.ts']);
    });
    await waitFor(() => expect(codeApi.readDir).toHaveBeenCalledWith('/repo/src'));
    await waitFor(() => expect(codeApi.replaceWorkspace).toHaveBeenCalled());

    act(() => {
      switchActiveTask('task-b');
      appState.filesByDirectory['/repo/src'] = [workspaceEntry('/repo/src/b.ts')];
      appState.workspaceSearchQuery = 'task B search';
      appState.toast = null;
    });

    await act(async () => {
      directory.resolve([workspaceEntry('/repo/src/a.ts')]);
      replacement.resolve({
        filesModified: 1,
        totalReplacements: 2,
        files: [{ path: '/repo/a.ts', replacements: 2 }],
      });
      await Promise.all([directoryRequest, replaceRequest]);
    });

    expect(appState.filesByDirectory['/repo/src']).toEqual([workspaceEntry('/repo/src/b.ts')]);
    expect(appState.workspaceSearchQuery).toBe('task B search');
    expect(appState.workspaceReplaceLoading).toBe(false);
    expect(search).not.toHaveBeenCalled();
    expect(appState.toast).toBeNull();
    hook.unmount();
  });

  it('keeps stale Git diff and staging results out of the destination task', async () => {
    setTaskSwitchFixture();
    const diff = deferred<{
      path: string;
      staged: boolean;
      content: string;
      original: string;
      modified: string;
      isBinary: boolean;
    }>();
    const staged = deferred<{ isGitRepo: boolean; branch: string; files: [] }>();
    vi.spyOn(codeApi, 'gitDiff').mockReturnValue(diff.promise);
    vi.spyOn(codeApi, 'gitStage').mockReturnValue(staged.promise);
    const hook = renderHook(() => useWorkspaceController());

    let diffRequest!: Promise<void>;
    let stageRequest!: Promise<void>;
    act(() => {
      diffRequest = hook.result.current.loadGitDiff('a.ts');
      stageRequest = hook.result.current.setGitStaged(['a.ts'], true);
    });
    await waitFor(() => expect(codeApi.gitDiff).toHaveBeenCalledWith('/repo', 'a.ts', false));
    await waitFor(() => expect(codeApi.gitStage).toHaveBeenCalledWith('/repo', ['a.ts']));

    act(() => {
      switchActiveTask('task-b');
      appState.gitStatus = { isGitRepo: true, branch: 'task-b', files: [] };
      appState.toast = null;
    });

    await act(async () => {
      diff.resolve({
        path: 'a.ts',
        staged: false,
        content: 'late diff',
        original: 'before',
        modified: 'after',
        isBinary: false,
      });
      staged.resolve({ isGitRepo: true, branch: 'task-a', files: [] });
      await Promise.all([diffRequest, stageRequest]);
    });

    expect(appState.editorTabs).toEqual([]);
    expect(appState.gitStatus?.branch).toBe('task-b');
    expect(appState.gitActionLoading).toBe(false);
    expect(appState.toast).toBeNull();

    act(() => {
      switchActiveTask('task-a');
    });
    expect(appState.editorTabs).toHaveLength(1);
    expect(appState.editorTabs[0]).toMatchObject({
      kind: 'diff',
      path: 'a.ts',
      original: '',
      modified: '',
      loading: false,
    });
    hook.unmount();
  });
});

function setTaskSwitchFixture(): void {
  appState.sessions = [
    {
      sessionId: 'task-a',
      workspace: '/repo',
      cwd: '/repo',
      model: 'codex/gpt',
      followDefaultModel: false,
      permissionMode: 'default',
      state: 'idle',
      createdAt: 1,
    },
    {
      sessionId: 'task-b',
      workspace: '/repo',
      cwd: '/repo',
      model: 'codex/gpt',
      followDefaultModel: false,
      permissionMode: 'default',
      state: 'idle',
      createdAt: 2,
    },
  ];
  appState.activeSessionId = 'task-a';
  appState.workspaceRoot = '/repo';
  appState.editorTabs = [];
  appState.activeEditorTabId = null;
  appState.workspaceSearchResults = [];
  appState.workspaceSearchQuery = '';
  appState.workspaceSearchLoading = false;
  appState.gitStatus = null;
  appState.gitStatusLoading = false;
  appState.draftsByTask = {};
}

function workspaceEntry(path: string) {
  return {
    name: path.split('/').at(-1) ?? path,
    path,
    isDirectory: false,
    isFile: true,
    size: 1,
    isBinary: false,
  };
}

function setOpenFileTab(path: string, content: string, draft = content): WorkspaceFileEditorTab {
  const tab: WorkspaceFileEditorTab = {
    id: fileEditorTabId(path),
    kind: 'file',
    path,
    content,
    draft,
    revision: null,
    isBinary: false,
    location: null,
    loading: false,
    loadError: null,
    saving: false,
    configValidation: null,
  };
  appState.editorTabs = [tab];
  appState.activeEditorTabId = tab.id;
  return appState.editorTabs[0] as WorkspaceFileEditorTab;
}

function activeFileTab(): WorkspaceFileEditorTab | null {
  const tab = appState.editorTabs.find((candidate) => candidate.id === appState.activeEditorTabId);
  return tab?.kind === 'file' ? tab : null;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
