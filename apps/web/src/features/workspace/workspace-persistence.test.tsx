import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../state/app-state';
import {
  captureWorkspaceTaskSnapshot,
  createWorkspaceState,
  createWorkspaceTaskState,
  fileEditorTabId,
  persistWorkspaceTaskSnapshots,
  workspaceSnapshotsStorageKey,
} from './workspace-state';
import { useWorkspacePersistence } from './use-workspace-persistence';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.removeItem(workspaceSnapshotsStorageKey);
  appState.activeSessionId = null;
  appState.workspaceSnapshotsByTask = {};
  appState.workspaceRoot = '';
  appState.editorTabs = [];
  appState.activeEditorTabId = null;
  appState.taskView = 'conversation';
});

describe('workspace task persistence', () => {
  it('restores task-scoped tabs and dirty drafts after a fresh state initialization', () => {
    const taskA = createWorkspaceTaskState('/repo');
    const taskATab = {
      id: fileEditorTabId('/repo/src/a.ts'),
      kind: 'file' as const,
      path: '/repo/src/a.ts',
      content: 'saved A',
      draft: 'dirty A',
      revision: 'sha256:saved-a',
      isBinary: false,
      location: { line: 7, column: 3 },
      loading: false,
      loadError: null,
      saving: false,
      configValidation: null,
    };
    taskA.editorTabs = [taskATab];
    taskA.activeEditorTabId = taskATab.id;
    taskA.workspaceSearchQuery = 'needle';
    taskA.workspacePresentation = 'fullscreen';
    const taskB = createWorkspaceTaskState('/repo');
    taskB.editorTabs = [
      {
        ...taskATab,
        id: fileEditorTabId('/repo/src/b.ts'),
        path: '/repo/src/b.ts',
        content: 'saved B',
        draft: 'saved B',
      },
    ];
    taskB.activeEditorTabId = taskB.editorTabs[0].id;

    expect(
      persistWorkspaceTaskSnapshots(
        { 'task-b': captureWorkspaceTaskSnapshot(taskB, 'activity') },
        'task-a',
        taskA,
        'review'
      )
    ).toBe(true);

    const restoredA = createWorkspaceState('task-a');
    expect(restoredA.workspaceRoot).toBe('/repo');
    expect(restoredA.editorModelScope).toBe(taskA.editorModelScope);
    expect(restoredA.activeEditorTabId).toBe(taskATab.id);
    expect(restoredA.editorTabs[0]).toMatchObject({
      path: taskATab.path,
      content: 'saved A',
      draft: 'dirty A',
      revision: 'sha256:saved-a',
      location: { line: 7, column: 3 },
    });
    expect(restoredA.workspaceSearchQuery).toBe('needle');
    expect(restoredA.workspacePresentation).toBe('fullscreen');
    expect(restoredA.workspaceSnapshotsByTask['task-a']?.taskView).toBe('review');
    expect(restoredA.workspaceSnapshotsByTask['task-b']?.taskView).toBe('activity');

    const restoredB = createWorkspaceState('task-b');
    expect(restoredB.editorModelScope).toBe(taskB.editorModelScope);
    expect(restoredB.editorModelScope).not.toBe(restoredA.editorModelScope);
    expect(restoredB.editorTabs[0]).toMatchObject({ path: '/repo/src/b.ts', draft: 'saved B' });
    expect(restoredB.activeEditorTabId).toBe(fileEditorTabId('/repo/src/b.ts'));
  });

  it('ignores malformed persisted snapshots instead of breaking application startup', () => {
    localStorage.setItem(
      workspaceSnapshotsStorageKey,
      JSON.stringify({
        version: 1,
        snapshots: { 'task-a': { taskView: 'review', state: { workspaceRoot: '/repo' } } },
      })
    );

    expect(() => createWorkspaceState('task-a')).not.toThrow();
    const restored = createWorkspaceState('task-a');
    expect(restored.workspaceRoot).toBe('');
    expect(restored.editorTabs).toEqual([]);
    expect(restored.workspaceSnapshotsByTask).toEqual({});
  });

  it('restores pre-presentation snapshots as docked workspaces', () => {
    const legacy = captureWorkspaceTaskSnapshot(createWorkspaceTaskState('/repo'), 'review');
    Reflect.deleteProperty(legacy.state, 'workspacePresentation');
    localStorage.setItem(workspaceSnapshotsStorageKey, JSON.stringify({ version: 1, snapshots: { 'task-a': legacy } }));

    const restored = createWorkspaceState('task-a');

    expect(restored.workspaceRoot).toBe('/repo');
    expect(restored.workspacePresentation).toBe('docked');
    expect(restored.workspaceSnapshotsByTask['task-a']?.taskView).toBe('review');
  });

  it('restores legacy file tabs without revisions using content-based save compatibility', () => {
    const state = createWorkspaceTaskState('/repo');
    state.editorTabs = [
      {
        id: fileEditorTabId('/repo/legacy.ts'),
        kind: 'file',
        path: '/repo/legacy.ts',
        content: 'saved legacy content',
        draft: 'unsaved legacy content',
        revision: 'sha256:legacy',
        isBinary: false,
        location: null,
        loading: false,
        loadError: null,
        saving: false,
        configValidation: null,
      },
    ];
    state.activeEditorTabId = state.editorTabs[0].id;
    const legacy = captureWorkspaceTaskSnapshot(state, 'review');
    Reflect.deleteProperty(legacy.state.editorTabs[0], 'revision');
    localStorage.setItem(workspaceSnapshotsStorageKey, JSON.stringify({ version: 1, snapshots: { legacy } }));

    const restored = createWorkspaceState('legacy');

    expect(restored.editorTabs[0]).toMatchObject({
      path: '/repo/legacy.ts',
      content: 'saved legacy content',
      draft: 'unsaved legacy content',
      revision: null,
    });
  });

  it('upgrades a legacy task snapshot with a stable editor model scope', () => {
    const legacy = captureWorkspaceTaskSnapshot(createWorkspaceTaskState('/repo'), 'review');
    Reflect.deleteProperty(legacy.state, 'editorModelScope');
    localStorage.setItem(workspaceSnapshotsStorageKey, JSON.stringify({ version: 1, snapshots: { 'task-a': legacy } }));

    const firstRestore = createWorkspaceState('task-a');
    expect(firstRestore.editorModelScope).toEqual(expect.any(String));
    expect(firstRestore.editorModelScope).not.toBe('');
    expect(firstRestore.workspaceSnapshotsByTask['task-a']?.state.editorModelScope).toBe(firstRestore.editorModelScope);

    persistWorkspaceTaskSnapshots(firstRestore.workspaceSnapshotsByTask, 'task-a', firstRestore, 'review');
    const secondRestore = createWorkspaceState('task-a');
    expect(secondRestore.editorModelScope).toBe(firstRestore.editorModelScope);
  });

  it('falls back to dirty-draft recovery when the complete snapshot exceeds browser storage', () => {
    const state = createWorkspaceTaskState('/repo');
    state.editorTabs = [
      {
        id: fileEditorTabId('/repo/dirty.ts'),
        kind: 'file',
        path: '/repo/dirty.ts',
        content: 'saved dirty file',
        draft: 'unsaved dirty file',
        revision: null,
        isBinary: false,
        location: null,
        loading: false,
        loadError: null,
        saving: false,
        configValidation: null,
      },
      {
        id: fileEditorTabId('/repo/clean.ts'),
        kind: 'file',
        path: '/repo/clean.ts',
        content: 'large clean content',
        draft: 'large clean content',
        revision: null,
        isBinary: false,
        location: null,
        loading: false,
        loadError: null,
        saving: false,
        configValidation: null,
      },
      {
        id: 'diff:working:/repo/changed.ts',
        kind: 'diff',
        path: '/repo/changed.ts',
        staged: false,
        original: 'large original diff',
        modified: 'large modified diff',
        unified: 'large unified diff',
        isBinary: false,
        loading: false,
        loadError: null,
      },
    ];
    state.activeEditorTabId = state.editorTabs[0].id;
    const setItem = Storage.prototype.setItem;
    let snapshotWrites = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === workspaceSnapshotsStorageKey && snapshotWrites++ === 0) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return setItem.call(this, key, value);
    });

    expect(persistWorkspaceTaskSnapshots({}, 'task-a', state, 'review')).toBe(true);

    const restored = createWorkspaceState('task-a');
    expect(restored.editorTabs[0]).toMatchObject({
      path: '/repo/dirty.ts',
      content: 'saved dirty file',
      draft: 'unsaved dirty file',
      loadError: null,
    });
    expect(restored.editorTabs[1]).toMatchObject({
      path: '/repo/clean.ts',
      content: '',
      draft: '',
      loadError: '文件内容未随刷新恢复，请重试。',
    });
    expect(restored.editorTabs[2]).toMatchObject({
      path: '/repo/changed.ts',
      original: '',
      modified: '',
      unified: '',
      loadError: '差异内容未随刷新恢复，请重试。',
    });
  });

  it('flushes the active dirty editor state on pagehide before a refresh', () => {
    vi.useFakeTimers();
    const tab = {
      id: fileEditorTabId('/repo/src/live.ts'),
      kind: 'file' as const,
      path: '/repo/src/live.ts',
      content: 'saved',
      draft: 'saved',
      revision: null,
      isBinary: false,
      location: null,
      loading: false,
      loadError: null,
      saving: false,
      configValidation: null,
    };
    appState.activeSessionId = 'task-live';
    appState.workspaceRoot = '/repo';
    appState.editorTabs = [tab];
    appState.activeEditorTabId = tab.id;
    appState.taskView = 'review';
    appState.workspacePresentation = 'fullscreen';
    const hook = renderHook(() => useWorkspacePersistence());

    act(() => {
      const activeTab = appState.editorTabs[0];
      if (activeTab.kind === 'file') activeTab.draft = 'unsaved before refresh';
      window.dispatchEvent(new Event('pagehide'));
    });

    const restored = createWorkspaceState('task-live');
    expect(restored.activeEditorTabId).toBe(tab.id);
    expect(restored.editorTabs[0]).toMatchObject({
      path: tab.path,
      content: 'saved',
      draft: 'unsaved before refresh',
    });
    expect(restored.workspaceSnapshotsByTask['task-live']?.taskView).toBe('review');
    expect(restored.workspacePresentation).toBe('fullscreen');
    hook.unmount();
  });
});
