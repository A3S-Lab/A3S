import { useEffect } from 'react';
import { subscribe } from 'valtio';
import { appState, reportTaskPersistenceResult } from '../../state/app-state';
import { taskDraftKey } from '../tasks/task-state';
import { persistWorkspaceTaskSnapshots } from './workspace-state';

const persistenceDelayMs = 300;

function persistActiveWorkspace(): void {
  reportTaskPersistenceResult(
    persistWorkspaceTaskSnapshots(
      appState.workspaceSnapshotsByTask,
      taskDraftKey(appState.activeSessionId, appState.activeProduct === 'work' ? 'work' : 'code'),
      appState,
      appState.taskView
    )
  );
}

export function useWorkspacePersistence(): void {
  useEffect(() => {
    let timer: number | null = null;
    const flush = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      persistActiveWorkspace();
    };
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(flush, persistenceDelayMs);
    };
    const unsubscribe = subscribe(appState, schedule);
    window.addEventListener('pagehide', flush);
    schedule();
    return () => {
      window.removeEventListener('pagehide', flush);
      unsubscribe();
      flush();
    };
  }, []);
}
