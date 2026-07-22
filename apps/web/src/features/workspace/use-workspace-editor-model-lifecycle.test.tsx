import { act, renderHook, waitFor } from '@testing-library/react';
import type { editor } from 'monaco-editor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../state/app-state';
import {
  clearWorkspaceEditorModels,
  saveWorkspaceEditorModel,
  workspaceEditorModelPath,
} from './components/monaco-editor-model-store';
import { useWorkspaceController } from './use-workspace-controller';
import { useWorkspaceEditorModelLifecycle } from './use-workspace-editor-model-lifecycle';
import {
  captureWorkspaceTaskSnapshot,
  createWorkspaceTaskState,
  fileEditorTabId,
  type WorkspaceFileEditorTab,
} from './workspace-state';

describe('workspace editor model lifecycle', () => {
  beforeEach(() => {
    appState.activeProduct = 'code';
    appState.activeSessionId = 'task-a';
    appState.editorModelScope = 'scope-a';
    appState.workspaceRoot = '/repo';
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    appState.pendingEditorTabCloseId = null;
    appState.workspaceSnapshotsByTask = {};
  });

  afterEach(() => {
    clearWorkspaceEditorModels();
    appState.activeSessionId = null;
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    appState.pendingEditorTabCloseId = null;
    appState.workspaceSnapshotsByTask = {};
  });

  it('retains models owned by the active task and inactive task snapshots while disposing orphans', async () => {
    const activeTab = fileTab('/repo/a.ts', false);
    appState.editorTabs = [activeTab];
    appState.activeEditorTabId = activeTab.id;
    const inactive = createWorkspaceTaskState('/repo');
    inactive.editorModelScope = 'scope-b';
    inactive.editorTabs = [fileTab('/repo/b.ts', false)];
    inactive.activeEditorTabId = inactive.editorTabs[0].id;
    appState.workspaceSnapshotsByTask = {
      'task-a': captureWorkspaceTaskSnapshot(createWorkspaceTaskState('/stale'), 'review'),
      'task-b': captureWorkspaceTaskSnapshot(inactive, 'review'),
    };
    const activeModel = fakeModel();
    const inactiveModel = fakeModel();
    const orphanModel = fakeModel();
    saveWorkspaceEditorModel(workspaceEditorModelPath('scope-a', activeTab.path), activeModel.value, null);
    saveWorkspaceEditorModel(
      workspaceEditorModelPath('scope-b', inactive.editorTabs[0].path),
      inactiveModel.value,
      null
    );
    saveWorkspaceEditorModel(workspaceEditorModelPath('scope-orphan', '/repo/orphan.ts'), orphanModel.value, null);

    renderHook(() => useWorkspaceEditorModelLifecycle());

    await waitFor(() => expect(orphanModel.dispose).toHaveBeenCalledTimes(1));
    expect(activeModel.dispose).not.toHaveBeenCalled();
    expect(inactiveModel.dispose).not.toHaveBeenCalled();

    act(() => {
      appState.editorTabs = [];
      appState.activeEditorTabId = null;
    });
    await waitFor(() => expect(activeModel.dispose).toHaveBeenCalledTimes(1));
    expect(inactiveModel.dispose).not.toHaveBeenCalled();
  });

  it('keeps a dirty model until close confirmation removes its tab', async () => {
    const tab = fileTab('/repo/dirty.ts', true);
    appState.editorTabs = [tab];
    appState.activeEditorTabId = tab.id;
    const model = fakeModel();
    saveWorkspaceEditorModel(workspaceEditorModelPath('scope-a', tab.path), model.value, null);
    const hook = renderHook(() => {
      const actions = useWorkspaceController();
      useWorkspaceEditorModelLifecycle();
      return actions;
    });

    act(() => hook.result.current.closeEditorTab(tab.id));
    expect(appState.pendingEditorTabCloseId).toBe(tab.id);
    expect(model.dispose).not.toHaveBeenCalled();

    act(() => hook.result.current.confirmEditorTabClose());
    await waitFor(() => expect(model.dispose).toHaveBeenCalledTimes(1));
    expect(appState.editorTabs).toEqual([]);
  });

  it('keeps Work WebIDE models alive while Work is active and releases them after returning to Code', async () => {
    appState.activeProduct = 'work';
    const workModel = fakeModel();
    saveWorkspaceEditorModel(workspaceEditorModelPath('work', '/repo/work.ts'), workModel.value, null);

    renderHook(() => useWorkspaceEditorModelLifecycle());

    await act(async () => undefined);
    expect(workModel.dispose).not.toHaveBeenCalled();

    act(() => {
      appState.activeProduct = 'code';
    });
    await waitFor(() => expect(workModel.dispose).toHaveBeenCalledTimes(1));
  });
});

function fileTab(path: string, dirty: boolean): WorkspaceFileEditorTab {
  return {
    id: fileEditorTabId(path),
    kind: 'file',
    path,
    content: 'saved',
    draft: dirty ? 'unsaved' : 'saved',
    revision: null,
    isBinary: false,
    location: null,
    loading: false,
    loadError: null,
    saving: false,
    configValidation: null,
  };
}

function fakeModel(): { value: editor.ITextModel; dispose: ReturnType<typeof vi.fn> } {
  const dispose = vi.fn();
  let disposed = false;
  dispose.mockImplementation(() => {
    disposed = true;
  });
  return {
    value: {
      dispose,
      isDisposed: () => disposed,
    } as unknown as editor.ITextModel,
    dispose,
  };
}
