import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { appState, navigateTask } from '../../state/app-state';
import { fileEditorTabId, normalizePath, type WorkspaceFileSelection } from './workspace-state';

const historyLimit = 100;

type OpenFile = (
  file: WorkspaceFileSelection,
  options?: { forceReload?: boolean; activate?: boolean }
) => Promise<WorkspaceFileSelection | null>;

interface EditorNavigationHistory {
  workspaceGeneration: number;
  workspaceRoot: string;
  back: WorkspaceFileSelection[];
  forward: WorkspaceFileSelection[];
}

export function useEditorNavigationHistory(openFile: OpenFile) {
  const state = useSnapshot(appState);
  const positionsRef = useRef(new Map<string, { line: number; column: number }>());
  const navigationRequestIdRef = useRef(0);
  const historyRef = useRef<EditorNavigationHistory>({
    workspaceGeneration: appState.workspaceGeneration,
    workspaceRoot: appState.workspaceRoot,
    back: [],
    forward: [],
  });
  const [availability, setAvailability] = useState({ back: false, forward: false });

  const syncAvailability = useMemoizedFn(() => {
    const history = historyRef.current;
    setAvailability((current) => {
      const next = { back: history.back.length > 0, forward: history.forward.length > 0 };
      return current.back === next.back && current.forward === next.forward ? current : next;
    });
  });

  const reset = useMemoizedFn(() => {
    navigationRequestIdRef.current += 1;
    historyRef.current = {
      workspaceGeneration: appState.workspaceGeneration,
      workspaceRoot: appState.workspaceRoot,
      back: [],
      forward: [],
    };
    positionsRef.current.clear();
    syncAvailability();
  });

  const ensureWorkspace = useMemoizedFn(() => {
    if (
      historyRef.current.workspaceGeneration !== appState.workspaceGeneration ||
      historyRef.current.workspaceRoot !== appState.workspaceRoot
    ) {
      reset();
    }
  });

  useEffect(() => {
    reset();
  }, [reset, state.workspaceGeneration, state.workspaceRoot]);

  const currentLocation = useMemoizedFn((): WorkspaceFileSelection | null => {
    const tab = appState.editorTabs.find((candidate) => candidate.id === appState.activeEditorTabId);
    if (tab?.kind !== 'file') return null;
    const position = positionsRef.current.get(tab.id) ?? tab.location ?? { line: 1, column: 1 };
    return { path: tab.path, isBinary: tab.isBinary, ...position };
  });

  const selectFile = useMemoizedFn(async (file: WorkspaceFileSelection): Promise<boolean> => {
    ensureWorkspace();
    const requestId = ++navigationRequestIdRef.current;
    const source = currentLocation();
    const newLocation = !source || !sameLocation(source, file);
    const selected = await openFile(file);
    if (!selected) return false;
    if (requestId !== navigationRequestIdRef.current) return true;

    rememberTargetPosition(selected);
    if (newLocation) {
      if (source) pushLocation(historyRef.current.back, source);
      historyRef.current.forward = [];
      syncAvailability();
    }
    return true;
  });

  const navigate = useMemoizedFn(async (direction: 'back' | 'forward'): Promise<boolean> => {
    ensureWorkspace();
    const history = historyRef.current;
    const sourceStack = direction === 'back' ? history.back : history.forward;
    const destinationStack = direction === 'back' ? history.forward : history.back;
    const target = sourceStack.at(-1);
    if (!target) {
      syncAvailability();
      return false;
    }
    const requestId = ++navigationRequestIdRef.current;

    const source = currentLocation();
    // Load a closed target without replacing the active editor until the read
    // succeeds. A broken history entry therefore never strands the user on an
    // error tab or destroys the remaining navigation branch.
    const selected = await openFile(target, { activate: false });
    if (requestId !== navigationRequestIdRef.current) return false;
    if (!selected) {
      popMatchingLocation(sourceStack, target);
      syncAvailability();
      return false;
    }

    popMatchingLocation(sourceStack, target, selected);
    rememberTargetPosition(selected);
    if (source) pushLocation(destinationStack, source);
    appState.activeEditorTabId = fileEditorTabId(selected.path);
    appState.fileLoadError = null;
    navigateTask('review');
    syncAvailability();
    return true;
  });

  const updatePosition = useMemoizedFn((tabId: string, position: { line: number; column: number }) => {
    const tab = appState.editorTabs.find((candidate) => candidate.id === tabId);
    if (tab?.kind !== 'file' || position.line < 1 || position.column < 1) return;
    positionsRef.current.set(tabId, position);
  });

  const rebasePaths = useMemoizedFn(
    (transform: (path: string) => string, rebasedTabIds: ReadonlyMap<string, string>) => {
      for (const stack of [historyRef.current.back, historyRef.current.forward]) {
        for (const location of stack) location.path = transform(location.path);
      }
      for (const [previousId, nextId] of rebasedTabIds) {
        const position = positionsRef.current.get(previousId);
        if (!position) continue;
        positionsRef.current.delete(previousId);
        positionsRef.current.set(nextId, position);
      }
    }
  );

  const removePaths = useMemoizedFn((matches: (path: string) => boolean, removedTabIds: readonly string[]) => {
    for (const id of removedTabIds) positionsRef.current.delete(id);
    historyRef.current.back = historyRef.current.back.filter((location) => !matches(location.path));
    historyRef.current.forward = historyRef.current.forward.filter((location) => !matches(location.path));
    syncAvailability();
  });

  const navigateBack = useMemoizedFn(() => navigate('back'));
  const navigateForward = useMemoizedFn(() => navigate('forward'));

  const rememberTargetPosition = (location: WorkspaceFileSelection): void => {
    if (location.line == null) return;
    positionsRef.current.set(fileEditorTabId(location.path), {
      line: location.line,
      column: Math.max(1, location.column ?? 1),
    });
  };

  return {
    canNavigateBack: availability.back,
    canNavigateForward: availability.forward,
    selectFile,
    navigateBack,
    navigateForward,
    updatePosition,
    rebasePaths,
    removePaths,
  };
}

function sameLocation(left: WorkspaceFileSelection, right: WorkspaceFileSelection): boolean {
  if (normalizePath(left.path) !== normalizePath(right.path)) return false;
  if (right.line == null) return true;
  return left.line === right.line && left.column === Math.max(1, right.column ?? 1);
}

function pushLocation(stack: WorkspaceFileSelection[], location: WorkspaceFileSelection): void {
  const value = { ...location };
  const last = stack.at(-1);
  if (last && sameLocation(last, value)) return;
  stack.push(value);
  if (stack.length > historyLimit) stack.splice(0, stack.length - historyLimit);
}

function popMatchingLocation(stack: WorkspaceFileSelection[], ...candidates: readonly WorkspaceFileSelection[]): void {
  const last = stack.at(-1);
  if (last && candidates.some((candidate) => sameLocation(last, candidate))) stack.pop();
}
