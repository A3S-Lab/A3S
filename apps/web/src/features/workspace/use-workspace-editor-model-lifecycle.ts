import { useEffect, useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../state/app-state';
import { taskDraftKey } from '../tasks/task-state';
import { disposeWorkspaceEditorModelsExcept, workspaceEditorModelPath } from './components/monaco-editor-model-store';

export function useWorkspaceEditorModelLifecycle(): void {
  const state = useSnapshot(appState);
  const retainedModelPaths = useMemo(() => {
    const retained = new Set<string>();
    addFileTabModelPaths(retained, state.editorModelScope, state.editorTabs);
    const activeTaskKey = taskDraftKey(state.activeSessionId, state.activeProduct === 'work' ? 'work' : 'code');
    for (const [taskKey, snapshot] of Object.entries(state.workspaceSnapshotsByTask)) {
      if (taskKey === activeTaskKey) continue;
      addFileTabModelPaths(retained, snapshot.state.editorModelScope, snapshot.state.editorTabs);
    }
    return retained;
  }, [
    state.activeProduct,
    state.activeSessionId,
    state.editorModelScope,
    state.editorTabs,
    state.workspaceSnapshotsByTask,
  ]);

  useEffect(() => {
    if (state.activeProduct === 'work') return;
    disposeWorkspaceEditorModelsExcept(retainedModelPaths);
  }, [retainedModelPaths, state.activeProduct]);
}

function addFileTabModelPaths(
  target: Set<string>,
  scope: string,
  tabs: ReadonlyArray<{ kind: 'file' | 'diff'; path: string }>
): void {
  for (const tab of tabs) {
    if (tab.kind === 'file') target.add(workspaceEditorModelPath(scope, tab.path));
  }
}
