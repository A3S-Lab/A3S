import { useMemoizedFn } from 'ahooks';
import { useRef } from 'react';
import { ApiError, codeApi } from '../../lib/api';
import {
  appState,
  captureWorkspaceContext,
  formatApiError,
  isWorkspaceContextCurrent,
  navigateTask,
  showToast,
} from '../../state/app-state';
import { useEditorNavigationHistory } from './use-editor-navigation-history';
import { rebaseWorkspaceEditorModelPath } from './components/monaco-editor-model-store';
import {
  DEFAULT_WORKSPACE_SEARCH_EXCLUDE_PATTERN,
  limitWorkspaceSearchResults,
  WORKSPACE_SEARCH_RESULT_LIMIT,
  type WorkspaceSearchOptions,
} from './workspace-search';
import {
  diffEditorTabId,
  fileEditorTabId,
  isFileEditorTabDirty,
  normalizePath,
  type WorkspaceDiffEditorTab,
  type WorkspaceEditorTab,
  type WorkspaceFileEditorTab,
  type WorkspaceFileSelection,
  workspaceRelativePath,
} from './workspace-state';

function parentPath(path: string): string {
  const normalized = path.replace(/[\\/]$/, '');
  const separator = normalized.includes('\\') && !normalized.includes('/') ? '\\' : '/';
  const index = normalized.lastIndexOf(separator);
  return index > 0 ? normalized.slice(0, index) : separator;
}

function siblingPath(path: string, name: string): string {
  return childPath(parentPath(path), name);
}

function childPath(parent: string, name: string): string {
  const separator = parent.includes('\\') && !parent.includes('/') ? '\\' : '/';
  return `${parent.replace(/[\\/]$/, '')}${separator}${name}`;
}

function pathInside(parent: string, candidate: string): boolean {
  const normalizedParent = normalizePath(parent).replace(/\/$/, '');
  const normalizedCandidate = normalizePath(candidate);
  const windows = /^[A-Za-z]:\//.test(normalizedParent);
  const base = windows ? normalizedParent.toLowerCase() : normalizedParent;
  const value = windows ? normalizedCandidate.toLowerCase() : normalizedCandidate;
  return value === base || value.startsWith(`${base}/`);
}

function samePath(left: string, right: string): boolean {
  return pathInside(left, right) && pathInside(right, left);
}

function rebasePath(candidate: string, source: string, destination: string): string {
  const normalizedCandidate = normalizePath(candidate);
  const normalizedSource = normalizePath(source);
  const suffix = normalizedCandidate.slice(normalizedSource.length);
  return pathInside(source, candidate) ? `${normalizePath(destination)}${suffix}` : candidate;
}

function rebaseWorkspaceDirectoryState(source: string, destination: string): void {
  for (const entries of Object.values(appState.filesByDirectory)) {
    for (const entry of entries) {
      const previousPath = entry.path;
      if (!pathInside(source, previousPath)) continue;
      entry.path = rebasePath(previousPath, source, destination);
      if (samePath(previousPath, source)) entry.name = basename(destination);
    }
  }
  rebaseRecordSubtree(appState.filesByDirectory, source, destination);
  rebaseRecordSubtree(appState.expandedDirectories, source, destination);
  rebaseRecordSubtree(appState.directoryLoading, source, destination);
  rebaseRecordSubtree(appState.directoryErrors, source, destination);
  for (const path of Object.keys(appState.directoryLoading)) {
    if (pathInside(destination, path)) appState.directoryLoading[path] = false;
  }
}

function removeWorkspaceDirectoryState(path: string): void {
  for (const [directory, entries] of Object.entries(appState.filesByDirectory)) {
    if (pathInside(path, directory)) {
      delete appState.filesByDirectory[directory];
      continue;
    }
    const remaining = entries.filter((entry) => !pathInside(path, entry.path));
    if (remaining.length !== entries.length) appState.filesByDirectory[directory] = remaining;
  }
  removeRecordSubtree(appState.expandedDirectories, path);
  removeRecordSubtree(appState.directoryLoading, path);
  removeRecordSubtree(appState.directoryErrors, path);
}

function rebaseRecordSubtree<T>(record: Record<string, T>, source: string, destination: string): void {
  const moved = Object.entries(record).filter(([path]) => pathInside(source, path));
  for (const [path] of moved) delete record[path];
  for (const [path, value] of moved) record[rebasePath(path, source, destination)] = value;
}

function removeRecordSubtree<T>(record: Record<string, T>, path: string): void {
  for (const key of Object.keys(record)) {
    if (pathInside(path, key)) delete record[key];
  }
}

function absoluteWorkspacePath(path: string): string {
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return path;
  return childPath(appState.workspaceRoot, path);
}

function fileTab(path: string): WorkspaceFileEditorTab | null {
  const tab = appState.editorTabs.find((candidate) => candidate.id === fileEditorTabId(path));
  return tab?.kind === 'file' ? tab : null;
}

function activeFileTab(): WorkspaceFileEditorTab | null {
  const tab = appState.editorTabs.find((candidate) => candidate.id === appState.activeEditorTabId);
  return tab?.kind === 'file' ? tab : null;
}

function isOpenFileTab(tab: WorkspaceFileEditorTab): boolean {
  return appState.editorTabs.some((candidate) => candidate === tab);
}

function removeEditorTabs(predicate: (tab: WorkspaceEditorTab) => boolean): void {
  const previousTabs = [...appState.editorTabs];
  const activeIndex = previousTabs.findIndex((tab) => tab.id === appState.activeEditorTabId);
  const activeRemoved = activeIndex >= 0 && predicate(previousTabs[activeIndex]);
  const nextTabs = previousTabs.filter((tab) => !predicate(tab));
  appState.editorTabs = nextTabs;
  if (appState.pendingEditorTabCloseId && !nextTabs.some((tab) => tab.id === appState.pendingEditorTabCloseId)) {
    appState.pendingEditorTabCloseId = null;
  }
  if (!activeRemoved) return;
  const nextActive =
    previousTabs.slice(activeIndex + 1).find((tab) => !predicate(tab)) ??
    [...previousTabs.slice(0, activeIndex)].reverse().find((tab) => !predicate(tab));
  appState.activeEditorTabId = nextActive?.id ?? null;
}

function updateFileTab(tabId: string, update: (tab: WorkspaceFileEditorTab) => void): void {
  const tab = appState.editorTabs.find((candidate) => candidate.id === tabId);
  if (tab?.kind === 'file') update(tab);
}

function updateDiffTab(tabId: string, update: (tab: WorkspaceDiffEditorTab) => void): void {
  const tab = appState.editorTabs.find((candidate) => candidate.id === tabId);
  if (tab?.kind === 'diff') update(tab);
}

export function useWorkspaceController() {
  const pendingCloseQueueRef = useRef<{ generation: number; ids: string[] }>({
    generation: appState.workspaceGeneration,
    ids: [],
  });
  const workspaceSearchRequestId = useRef(0);
  const directoryRequestIds = useRef(new Map<string, number>());
  const fileLoadOperations = useRef(new WeakMap<WorkspaceFileEditorTab, symbol>());
  const fileWriteOperations = useRef(new WeakMap<WorkspaceFileEditorTab, Promise<unknown>>());
  const pathMutationBarriers = useRef(new Map<string, Promise<void>>());
  const invalidateDirectoryRequests = useMemoizedFn((path: string) => {
    for (const [candidate, requestId] of directoryRequestIds.current) {
      if (pathInside(path, candidate)) directoryRequestIds.current.set(candidate, requestId + 1);
    }
  });
  const refreshDirectory = useMemoizedFn(async (path = appState.workspaceRoot) => {
    const context = captureWorkspaceContext();
    const requestId = (directoryRequestIds.current.get(path) ?? 0) + 1;
    directoryRequestIds.current.set(path, requestId);
    appState.directoryLoading[path] = true;
    delete appState.directoryErrors[path];
    try {
      const entries = await codeApi.readDir(path);
      if (!isWorkspaceContextCurrent(context) || directoryRequestIds.current.get(path) !== requestId) return;
      appState.filesByDirectory[path] = entries;
    } catch (error) {
      if (!isWorkspaceContextCurrent(context) || directoryRequestIds.current.get(path) !== requestId) return;
      const message = formatApiError(error);
      appState.directoryErrors[path] = message;
      showToast(message, 'error');
    } finally {
      if (isWorkspaceContextCurrent(context) && directoryRequestIds.current.get(path) === requestId) {
        appState.directoryLoading[path] = false;
      }
    }
  });

  const toggleDirectory = useMemoizedFn(async (path: string) => {
    const next = !appState.expandedDirectories[path];
    appState.expandedDirectories[path] = next;
    if (next && !appState.filesByDirectory[path]) await refreshDirectory(path);
  });

  const findWorkspaceFiles = useMemoizedFn((query: string, maxResults = 120) => {
    const workspaceRoot = appState.workspaceRoot;
    return codeApi.workspaceFiles(workspaceRoot, query, maxResults);
  });

  const pendingFileMutations = useMemoizedFn((path: string): Promise<void>[] => {
    const barriers = new Set<Promise<void>>();
    for (const [mutationPath, barrier] of pathMutationBarriers.current) {
      if (pathInside(mutationPath, path)) barriers.add(barrier);
    }
    return [...barriers];
  });

  const runWithFileMutationBarrier = useMemoizedFn(
    async (paths: readonly string[], operation: () => Promise<void>): Promise<void> => {
      const mutationPaths = [...new Set(paths.map(normalizePath))];
      const overlapsMutation = (candidate: string) =>
        mutationPaths.some((path) => pathInside(path, candidate) || pathInside(candidate, path));
      const affectedTabs = appState.editorTabs.filter(
        (tab): tab is WorkspaceFileEditorTab => tab.kind === 'file' && overlapsMutation(tab.path)
      );
      const precedingOperations = new Set<Promise<unknown>>();
      for (const [path, mutation] of pathMutationBarriers.current) {
        if (overlapsMutation(path)) precedingOperations.add(mutation);
      }
      for (const tab of affectedTabs) {
        const write = fileWriteOperations.current.get(tab);
        if (write) precedingOperations.add(write);
      }

      let releaseBarrier!: () => void;
      const barrier = new Promise<void>((resolve) => {
        releaseBarrier = resolve;
      });
      for (const path of mutationPaths) pathMutationBarriers.current.set(path, barrier);

      try {
        await Promise.all(precedingOperations);
        await operation();
      } finally {
        releaseBarrier();
        for (const path of mutationPaths) {
          if (pathMutationBarriers.current.get(path) === barrier) pathMutationBarriers.current.delete(path);
        }
      }
    }
  );

  const openFile = useMemoizedFn(
    async (
      file: WorkspaceFileSelection,
      options: { forceReload?: boolean; activate?: boolean } = {}
    ): Promise<WorkspaceFileSelection | null> => {
      const context = captureWorkspaceContext();
      const id = fileEditorTabId(file.path);
      const location = file.line == null ? null : { line: file.line, column: Math.max(1, file.column ?? 1) };
      let tab = fileTab(file.path);
      const activate = options.activate ?? true;
      if (activate) {
        appState.activeEditorTabId = id;
        navigateTask('review');
      }
      appState.fileLoadError = null;

      if (tab && !options.forceReload && !tab.loadError) {
        tab.location = location;
        return { ...file, path: tab.path, isBinary: tab.isBinary };
      }

      if (!tab) {
        appState.editorTabs.push({
          id,
          kind: 'file',
          path: file.path,
          content: '',
          draft: '',
          revision: null,
          isBinary: file.isBinary,
          location,
          loading: !file.isBinary,
          loadError: null,
          saving: false,
          configValidation: null,
        });
        tab = fileTab(file.path);
      } else {
        tab.location = location;
        tab.loadError = null;
        tab.loading = !file.isBinary;
        tab.isBinary = file.isBinary;
      }

      if (!tab) return null;
      if (file.isBinary) {
        fileLoadOperations.current.delete(tab);
        return { ...file, path: tab.path, isBinary: true };
      }

      const loadOperation = Symbol('file-load');
      fileLoadOperations.current.set(tab, loadOperation);
      const isCurrentLoad = () =>
        isWorkspaceContextCurrent(context) &&
        isOpenFileTab(tab) &&
        fileLoadOperations.current.get(tab) === loadOperation;
      try {
        let readPath = file.path;
        for (;;) {
          let result: Awaited<ReturnType<typeof codeApi.readFile>>;
          try {
            result = await codeApi.readFile(readPath);
          } catch (error) {
            if (!isCurrentLoad()) return null;
            if (!samePath(readPath, tab.path)) {
              readPath = tab.path;
              continue;
            }
            const message = formatApiError(error);
            tab.loadError = message;
            appState.fileLoadError = { selection: { ...file, path: tab.path }, message };
            showToast(message, 'error');
            return null;
          }
          if (!isCurrentLoad()) return null;
          tab.content = result.content;
          tab.draft = result.content;
          tab.revision = result.revision ?? null;
          tab.isBinary = false;
          tab.loadError = null;
          tab.configValidation = null;
          return { ...file, path: tab.path, isBinary: false };
        }
      } finally {
        if (isCurrentLoad()) {
          tab.loading = false;
          fileLoadOperations.current.delete(tab);
        }
      }
    }
  );
  const editorNavigation = useEditorNavigationHistory(openFile);
  const selectFile = editorNavigation.selectFile;

  const activateEditorTab = useMemoizedFn((tabId: string) => {
    if (!appState.editorTabs.some((tab) => tab.id === tabId)) return;
    appState.activeEditorTabId = tabId;
    appState.fileLoadError = null;
    navigateTask('review');
  });

  const continueEditorTabClose = useMemoizedFn(() => {
    const queue = pendingCloseQueueRef.current;
    if (queue.generation !== appState.workspaceGeneration) {
      pendingCloseQueueRef.current = { generation: appState.workspaceGeneration, ids: [] };
      return;
    }
    while (queue.ids.length > 0) {
      const tabId = queue.ids.shift();
      if (!tabId) continue;
      const tab = appState.editorTabs.find((candidate) => candidate.id === tabId);
      if (!tab) continue;
      if (tab.kind === 'file' && isFileEditorTabDirty(tab)) {
        appState.pendingEditorTabCloseId = tabId;
        return;
      }
      removeEditorTabs((candidate) => candidate.id === tabId);
    }
  });

  const closeEditorTabs = useMemoizedFn((tabIds: readonly string[]) => {
    const requestedIds = new Set(tabIds);
    const requestedTabs = appState.editorTabs.filter((tab) => requestedIds.has(tab.id));
    pendingCloseQueueRef.current = {
      generation: appState.workspaceGeneration,
      ids: requestedTabs.filter((tab) => tab.kind === 'file' && isFileEditorTabDirty(tab)).map((tab) => tab.id),
    };
    appState.pendingEditorTabCloseId = null;
    removeEditorTabs((tab) => requestedIds.has(tab.id) && !(tab.kind === 'file' && isFileEditorTabDirty(tab)));
    continueEditorTabClose();
  });

  const closeEditorTab = useMemoizedFn((tabId: string) => {
    closeEditorTabs([tabId]);
  });

  const confirmEditorTabClose = useMemoizedFn(() => {
    const tabId = appState.pendingEditorTabCloseId;
    if (!tabId) return;
    appState.pendingEditorTabCloseId = null;
    if (appState.fileConflict?.tabId === tabId) appState.fileConflict = null;
    removeEditorTabs((tab) => tab.id === tabId);
    continueEditorTabClose();
  });

  const cancelEditorTabClose = useMemoizedFn(() => {
    pendingCloseQueueRef.current = { generation: appState.workspaceGeneration, ids: [] };
    appState.pendingEditorTabCloseId = null;
  });

  const updateEditorDraft = useMemoizedFn((tabId: string, content: string) => {
    updateFileTab(tabId, (tab) => {
      tab.draft = content;
      tab.location = null;
      tab.configValidation = null;
    });
  });

  const consumeEditorLocation = useMemoizedFn((tabId: string) => {
    updateFileTab(tabId, (tab) => {
      tab.location = null;
    });
  });

  const saveEditorTab = useMemoizedFn(async (requestedTabId?: string): Promise<boolean> => {
    const context = captureWorkspaceContext();
    const requestedTab = requestedTabId
      ? appState.editorTabs.find((candidate) => candidate.id === requestedTabId)
      : activeFileTab();
    const tab = requestedTab?.kind === 'file' ? requestedTab : null;
    if (!tab || tab.isBinary || tab.loading || tab.saving) return false;
    for (;;) {
      const mutations = pendingFileMutations(tab.path);
      if (mutations.length === 0) break;
      await Promise.all(mutations);
      if (!isWorkspaceContextCurrent(context) || !isOpenFileTab(tab)) return false;
    }
    if (!isWorkspaceContextCurrent(context) || !isOpenFileTab(tab) || tab.isBinary || tab.loading || tab.saving) {
      return false;
    }
    if (!isFileEditorTabDirty(tab)) return true;
    const tabId = tab.id;
    const path = tab.path;
    const baseContent = tab.content;
    const baseRevision = tab.revision;
    const draftToSave = tab.draft;
    tab.saving = true;
    const operation = (async (): Promise<boolean> => {
      try {
        const saved = await codeApi.writeFile(
          path,
          draftToSave,
          baseRevision ? { expectedRevision: baseRevision } : { expectedContent: baseContent }
        );
        if (!isWorkspaceContextCurrent(context) || !isOpenFileTab(tab)) return false;
        tab.content = draftToSave;
        tab.revision = saved.revision ?? null;
        showToast('文件已保存', 'success');
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 412) {
          try {
            const disk = await codeApi.readFile(path);
            if (!isWorkspaceContextCurrent(context) || !isOpenFileTab(tab)) return false;
            appState.fileConflict = {
              tabId,
              path,
              diskContent: disk.content,
              diskRevision: disk.revision ?? null,
            };
            showToast('文件已在外部修改，请选择保留版本', 'info');
          } catch (readError) {
            if (isWorkspaceContextCurrent(context)) showToast(formatApiError(readError), 'error');
          }
          return false;
        }
        if (isWorkspaceContextCurrent(context)) showToast(formatApiError(error), 'error');
        return false;
      } finally {
        if (isWorkspaceContextCurrent(context) && isOpenFileTab(tab)) tab.saving = false;
      }
    })();
    fileWriteOperations.current.set(tab, operation);
    try {
      return await operation;
    } finally {
      if (fileWriteOperations.current.get(tab) === operation) fileWriteOperations.current.delete(tab);
    }
  });

  const resolveFileConflict = useMemoizedFn(async (resolution: 'reload' | 'overwrite') => {
    const context = captureWorkspaceContext();
    const initialConflict = appState.fileConflict;
    if (!initialConflict) return;
    const tab = appState.editorTabs.find((candidate) => candidate.id === initialConflict.tabId);
    if (tab?.kind !== 'file') {
      appState.fileConflict = null;
      return;
    }
    if (tab.saving) return;
    for (;;) {
      const mutations = pendingFileMutations(tab.path);
      if (mutations.length === 0) break;
      await Promise.all(mutations);
      if (!isWorkspaceContextCurrent(context) || !isOpenFileTab(tab)) return;
    }
    if (!isWorkspaceContextCurrent(context) || !isOpenFileTab(tab) || tab.saving) return;
    const conflict = appState.fileConflict;
    if (!conflict || conflict.tabId !== tab.id) return;

    tab.saving = true;
    const operation = (async (): Promise<void> => {
      try {
        if (resolution === 'reload') {
          const disk = await codeApi.readFile(conflict.path);
          if (!isWorkspaceContextCurrent(context) || !isOpenFileTab(tab)) return;
          tab.content = disk.content;
          tab.draft = disk.content;
          tab.revision = disk.revision ?? null;
          tab.configValidation = null;
          showToast('已重新加载最新磁盘版本', 'success');
        } else {
          const draftToSave = tab.draft;
          const saved = await codeApi.writeFile(conflict.path, draftToSave);
          if (!isWorkspaceContextCurrent(context) || !isOpenFileTab(tab)) return;
          tab.content = draftToSave;
          tab.revision = saved.revision ?? null;
          showToast('已用当前编辑覆盖磁盘版本', 'success');
        }
        if (appState.fileConflict?.tabId === tab.id && samePath(appState.fileConflict.path, conflict.path)) {
          appState.fileConflict = null;
        }
      } catch (error) {
        if (isWorkspaceContextCurrent(context)) showToast(formatApiError(error), 'error');
      } finally {
        if (isWorkspaceContextCurrent(context) && isOpenFileTab(tab)) tab.saving = false;
      }
    })();
    fileWriteOperations.current.set(tab, operation);
    try {
      await operation;
    } finally {
      if (fileWriteOperations.current.get(tab) === operation) fileWriteOperations.current.delete(tab);
    }
  });

  const cancelFileConflict = useMemoizedFn(() => {
    appState.fileConflict = null;
  });

  const validateActiveConfig = useMemoizedFn(async () => {
    const context = captureWorkspaceContext();
    const tab = activeFileTab();
    if (!tab || tab.isBinary || basename(tab.path) !== 'config.acl') return;
    const tabId = tab.id;
    const content = tab.draft;
    try {
      const validation = await codeApi.validateConfig(content);
      if (!isWorkspaceContextCurrent(context)) return;
      const current = appState.editorTabs.find((candidate) => candidate.id === tabId);
      if (current?.kind !== 'file' || current.draft !== content) {
        showToast('配置在验证期间已修改，请重新验证', 'info');
        return;
      }
      current.configValidation = validation;
      showToast(validation.valid ? '配置语法有效' : '配置存在问题', validation.valid ? 'success' : 'error');
    } catch (error) {
      if (isWorkspaceContextCurrent(context)) showToast(formatApiError(error), 'error');
    }
  });

  const createWorkspaceEntry = useMemoizedFn(async (parent: string, name: string, kind: 'file' | 'directory') => {
    const context = captureWorkspaceContext();
    const path = childPath(parent, name.trim());
    try {
      if (kind === 'directory') await codeApi.createDirectory(path);
      else await codeApi.createFile(path);
      if (!isWorkspaceContextCurrent(context)) return;
      await refreshDirectory(parent);
      if (!isWorkspaceContextCurrent(context)) return;
      appState.expandedDirectories[parent] = true;
      if (kind === 'file') await selectFile({ path, isBinary: false });
    } catch (error) {
      if (isWorkspaceContextCurrent(context)) showToast(formatApiError(error), 'error');
      throw error;
    }
  });

  const renameWorkspaceEntry = useMemoizedFn(async (path: string, name: string) => {
    const context = captureWorkspaceContext();
    const destination = siblingPath(path, name.trim());
    try {
      await runWithFileMutationBarrier([path, destination], async () => {
        await codeApi.renamePath(path, destination);
        if (!isWorkspaceContextCurrent(context)) return;
        invalidateDirectoryRequests(path);
        rebaseWorkspaceDirectoryState(path, destination);
        const rebasedIds = new Map<string, string>();
        for (const tab of appState.editorTabs) {
          const absolutePath = tab.kind === 'file' ? tab.path : absoluteWorkspacePath(tab.path);
          if (!pathInside(path, absolutePath)) continue;
          const nextAbsolutePath = rebasePath(absolutePath, path, destination);
          const previousId = tab.id;
          if (tab.kind === 'file') {
            rebaseWorkspaceEditorModelPath(appState.editorModelScope, tab.path, nextAbsolutePath);
            tab.path = nextAbsolutePath;
            tab.id = fileEditorTabId(nextAbsolutePath);
          } else {
            tab.path = workspaceRelativePath(nextAbsolutePath, appState.workspaceRoot);
            tab.id = diffEditorTabId(tab.path, tab.staged);
          }
          rebasedIds.set(previousId, tab.id);
        }
        if (appState.activeEditorTabId) {
          appState.activeEditorTabId = rebasedIds.get(appState.activeEditorTabId) ?? appState.activeEditorTabId;
        }
        if (appState.pendingEditorTabCloseId) {
          appState.pendingEditorTabCloseId =
            rebasedIds.get(appState.pendingEditorTabCloseId) ?? appState.pendingEditorTabCloseId;
        }
        if (appState.fileConflict) {
          appState.fileConflict.tabId = rebasedIds.get(appState.fileConflict.tabId) ?? appState.fileConflict.tabId;
          appState.fileConflict.path = rebasePath(appState.fileConflict.path, path, destination);
        }
        if (appState.fileLoadError) {
          appState.fileLoadError.selection.path = rebasePath(appState.fileLoadError.selection.path, path, destination);
        }
        editorNavigation.rebasePaths((candidate) => rebasePath(candidate, path, destination), rebasedIds);
        await refreshDirectory(parentPath(path));
      });
    } catch (error) {
      if (isWorkspaceContextCurrent(context)) showToast(formatApiError(error), 'error');
      throw error;
    }
  });

  const copyWorkspaceEntry = useMemoizedFn(async (path: string, name: string) => {
    const context = captureWorkspaceContext();
    const destination = siblingPath(path, name.trim());
    try {
      await codeApi.copyPath(path, destination);
      if (!isWorkspaceContextCurrent(context)) return;
      await refreshDirectory(parentPath(path));
    } catch (error) {
      if (isWorkspaceContextCurrent(context)) showToast(formatApiError(error), 'error');
      throw error;
    }
  });

  const deleteWorkspaceEntry = useMemoizedFn(async (path: string) => {
    const context = captureWorkspaceContext();
    try {
      await runWithFileMutationBarrier([path], async () => {
        await codeApi.deletePath(path);
        if (!isWorkspaceContextCurrent(context)) return;
        invalidateDirectoryRequests(path);
        removeWorkspaceDirectoryState(path);
        const removedFileIds = appState.editorTabs
          .filter((tab) => tab.kind === 'file' && pathInside(path, tab.path))
          .map((tab) => tab.id);
        removeEditorTabs((tab) => pathInside(path, tab.kind === 'file' ? tab.path : absoluteWorkspacePath(tab.path)));
        editorNavigation.removePaths((candidate) => pathInside(path, candidate), removedFileIds);
        if (appState.fileConflict && pathInside(path, appState.fileConflict.path)) appState.fileConflict = null;
        if (appState.fileLoadError && pathInside(path, appState.fileLoadError.selection.path))
          appState.fileLoadError = null;
        await refreshDirectory(parentPath(path));
      });
    } catch (error) {
      if (isWorkspaceContextCurrent(context)) showToast(formatApiError(error), 'error');
      throw error;
    }
  });

  const searchWorkspace = useMemoizedFn(async (query: string, options: WorkspaceSearchOptions) => {
    const context = captureWorkspaceContext();
    const requestId = ++workspaceSearchRequestId.current;
    const normalized = query.trim();
    const workspaceRoot = appState.workspaceRoot;
    appState.workspaceSearchScope = options.scope;
    if (!normalized) {
      appState.workspaceSearchResults = [];
      appState.workspaceSearchQuery = '';
      appState.workspaceSearchResultScope = null;
      appState.workspaceSearchResultRoot = null;
      appState.workspaceSearchResultsTruncated = false;
      appState.workspaceSearchLoading = false;
      appState.workspaceSearchError = null;
      return;
    }
    appState.workspaceSearchLoading = true;
    appState.workspaceSearchError = null;
    try {
      const results = await codeApi.searchWorkspace(workspaceRoot, normalized, {
        ...(options.scope === 'source' ? { excludePattern: DEFAULT_WORKSPACE_SEARCH_EXCLUDE_PATTERN } : {}),
        maxResults: WORKSPACE_SEARCH_RESULT_LIMIT + 1,
      });
      if (requestId !== workspaceSearchRequestId.current || !isWorkspaceContextCurrent(context)) return;
      const bounded = limitWorkspaceSearchResults(results);
      appState.workspaceSearchResults = bounded.results;
      appState.workspaceSearchResultsTruncated = bounded.truncated;
      appState.workspaceSearchQuery = normalized;
      appState.workspaceSearchResultScope = options.scope;
      appState.workspaceSearchResultRoot = workspaceRoot;
    } catch (error) {
      if (requestId !== workspaceSearchRequestId.current || !isWorkspaceContextCurrent(context)) return;
      const message = formatApiError(error);
      appState.workspaceSearchError = message;
      showToast(message, 'error');
    } finally {
      if (requestId === workspaceSearchRequestId.current && isWorkspaceContextCurrent(context)) {
        appState.workspaceSearchLoading = false;
      }
    }
  });

  const replaceWorkspace = useMemoizedFn(async (query: string, replacement: string, filePaths: string[]) => {
    const context = captureWorkspaceContext();
    const workspaceRoot = appState.workspaceRoot;
    if (appState.workspaceSearchResultsTruncated) {
      const error = new Error('搜索结果超过安全展示上限，请缩小搜索范围后再替换。');
      showToast(error.message, 'error');
      throw error;
    }
    const dirtyTab = appState.editorTabs.find(
      (tab) => tab.kind === 'file' && filePaths.includes(tab.path) && isFileEditorTabDirty(tab)
    );
    if (dirtyTab) {
      const error = new Error('替换范围包含未保存的文件，请先保存或放弃编辑。');
      showToast(error.message, 'error');
      throw error;
    }
    appState.workspaceReplaceLoading = true;
    try {
      const result = await codeApi.replaceWorkspace({
        rootPath: workspaceRoot,
        query,
        replacement,
        filePaths,
      });
      if (!isWorkspaceContextCurrent(context)) return;
      showToast(`已在 ${result.filesModified} 个文件中完成 ${result.totalReplacements} 处替换`, 'success');
      await searchWorkspace(query, { scope: appState.workspaceSearchResultScope ?? appState.workspaceSearchScope });
      const openPaths = appState.editorTabs
        .filter((tab): tab is WorkspaceFileEditorTab => tab.kind === 'file' && filePaths.includes(tab.path))
        .map((tab) => tab.path);
      await Promise.all(
        openPaths.map((path) => openFile({ path, isBinary: false }, { forceReload: true, activate: false }))
      );
    } catch (error) {
      if (isWorkspaceContextCurrent(context)) showToast(formatApiError(error), 'error');
      throw error;
    } finally {
      if (isWorkspaceContextCurrent(context)) appState.workspaceReplaceLoading = false;
    }
  });

  const refreshGitStatus = useMemoizedFn(async () => {
    const context = captureWorkspaceContext();
    const workspaceRoot = appState.workspaceRoot;
    appState.gitStatusLoading = true;
    appState.gitStatusError = null;
    try {
      const status = await codeApi.gitStatus(workspaceRoot);
      if (!isWorkspaceContextCurrent(context)) return;
      appState.gitStatus = status;
    } catch (error) {
      if (!isWorkspaceContextCurrent(context)) return;
      const message = formatApiError(error);
      appState.gitStatusError = message;
      showToast(message, 'error');
    } finally {
      if (isWorkspaceContextCurrent(context)) appState.gitStatusLoading = false;
    }
  });

  const loadGitDiff = useMemoizedFn(async (path: string, staged = false) => {
    const context = captureWorkspaceContext();
    const workspaceRoot = appState.workspaceRoot;
    const id = diffEditorTabId(path, staged);
    const existing = appState.editorTabs.find((tab) => tab.id === id);
    if (existing?.kind === 'diff') {
      existing.loading = true;
      existing.loadError = null;
    } else {
      appState.editorTabs.push({
        id,
        kind: 'diff',
        path,
        staged,
        original: '',
        modified: '',
        unified: '',
        isBinary: false,
        loading: true,
        loadError: null,
      });
    }
    appState.activeEditorTabId = id;
    appState.gitDiffError = null;
    navigateTask('review');
    try {
      const diff = await codeApi.gitDiff(workspaceRoot, path, staged);
      if (!isWorkspaceContextCurrent(context)) return;
      updateDiffTab(id, (tab) => {
        tab.path = diff.path || path;
        tab.original = diff.original;
        tab.modified = diff.modified;
        tab.unified = diff.content;
        tab.isBinary = diff.isBinary;
        tab.loadError = null;
      });
    } catch (error) {
      if (!isWorkspaceContextCurrent(context)) return;
      const message = formatApiError(error);
      updateDiffTab(id, (tab) => {
        tab.loadError = message;
      });
      appState.gitDiffError = { path, staged, message };
      showToast(message, 'error');
    } finally {
      if (isWorkspaceContextCurrent(context)) {
        updateDiffTab(id, (tab) => {
          tab.loading = false;
        });
      }
    }
  });

  const setGitStaged = useMemoizedFn(async (paths: string[], staged: boolean) => {
    const context = captureWorkspaceContext();
    const workspaceRoot = appState.workspaceRoot;
    appState.gitActionLoading = true;
    appState.lastCommitReceipt = null;
    try {
      const status = staged
        ? await codeApi.gitStage(workspaceRoot, paths)
        : await codeApi.gitUnstage(workspaceRoot, paths);
      if (!isWorkspaceContextCurrent(context)) return;
      appState.gitStatus = status;
      removeEditorTabs((tab) => tab.kind === 'diff');
      appState.gitDiffError = null;
      showToast(staged ? '已加入暂存区' : '已移出暂存区', 'success');
    } catch (error) {
      if (isWorkspaceContextCurrent(context)) showToast(formatApiError(error), 'error');
    } finally {
      if (isWorkspaceContextCurrent(context)) appState.gitActionLoading = false;
    }
  });

  const commitGitChanges = useMemoizedFn(async (message: string) => {
    const context = captureWorkspaceContext();
    const workspaceRoot = appState.workspaceRoot;
    appState.gitActionLoading = true;
    try {
      const result = await codeApi.gitCommit(workspaceRoot, message);
      if (!isWorkspaceContextCurrent(context)) return;
      appState.gitStatus = result.status;
      removeEditorTabs((tab) => tab.kind === 'diff');
      appState.gitDiffError = null;
      appState.lastCommitReceipt = {
        summary: result.summary.split('\n')[0] || '提交已创建',
        message,
        branch: result.status.branch || '当前分支',
      };
      showToast(result.summary.split('\n')[0] || '提交已创建', 'success');
    } catch (error) {
      if (isWorkspaceContextCurrent(context)) showToast(formatApiError(error), 'error');
      throw error;
    } finally {
      if (isWorkspaceContextCurrent(context)) appState.gitActionLoading = false;
    }
  });

  return {
    canNavigateEditorBack: editorNavigation.canNavigateBack,
    canNavigateEditorForward: editorNavigation.canNavigateForward,
    refreshDirectory,
    toggleDirectory,
    findWorkspaceFiles,
    selectFile,
    navigateEditorBack: editorNavigation.navigateBack,
    navigateEditorForward: editorNavigation.navigateForward,
    updateEditorPosition: editorNavigation.updatePosition,
    consumeEditorLocation,
    activateEditorTab,
    closeEditorTab,
    closeEditorTabs,
    confirmEditorTabClose,
    cancelEditorTabClose,
    updateEditorDraft,
    saveEditorTab,
    resolveFileConflict,
    cancelFileConflict,
    validateActiveConfig,
    createWorkspaceEntry,
    renameWorkspaceEntry,
    copyWorkspaceEntry,
    deleteWorkspaceEntry,
    searchWorkspace,
    replaceWorkspace,
    refreshGitStatus,
    loadGitDiff,
    setGitStaged,
    commitGitChanges,
  };
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}
