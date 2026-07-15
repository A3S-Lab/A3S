import { useMemoizedFn } from 'ahooks';
import { codeApi } from '../../lib/api';
import { appState, formatApiError, navigateTask, showToast } from '../../state/app-state';
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

function rebasePath(candidate: string, source: string, destination: string): string {
  const normalizedCandidate = normalizePath(candidate);
  const normalizedSource = normalizePath(source);
  const suffix = normalizedCandidate.slice(normalizedSource.length);
  return pathInside(source, candidate) ? `${normalizePath(destination)}${suffix}` : candidate;
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
  const refreshDirectory = useMemoizedFn(async (path = appState.workspaceRoot) => {
    appState.directoryLoading[path] = true;
    delete appState.directoryErrors[path];
    try {
      appState.filesByDirectory[path] = await codeApi.readDir(path);
    } catch (error) {
      const message = formatApiError(error);
      appState.directoryErrors[path] = message;
      showToast(message, 'error');
    } finally {
      appState.directoryLoading[path] = false;
    }
  });

  const toggleDirectory = useMemoizedFn(async (path: string) => {
    const next = !appState.expandedDirectories[path];
    appState.expandedDirectories[path] = next;
    if (next && !appState.filesByDirectory[path]) await refreshDirectory(path);
  });

  const openFile = useMemoizedFn(
    async (
      file: WorkspaceFileSelection,
      options: { forceReload?: boolean; activate?: boolean } = {}
    ): Promise<boolean> => {
      const id = fileEditorTabId(file.path);
      const location = file.line == null ? null : { line: file.line, column: Math.max(1, file.column ?? 1) };
      const existing = fileTab(file.path);
      const activate = options.activate ?? true;
      if (activate) {
        appState.activeEditorTabId = id;
        navigateTask('review');
      }
      appState.fileLoadError = null;

      if (existing && !options.forceReload && !existing.loadError) {
        existing.location = location;
        return true;
      }

      if (!existing) {
        appState.editorTabs.push({
          id,
          kind: 'file',
          path: file.path,
          content: '',
          draft: '',
          isBinary: file.isBinary,
          location,
          loading: !file.isBinary,
          loadError: null,
          saving: false,
          configValidation: null,
        });
      } else {
        existing.location = location;
        existing.loadError = null;
        existing.loading = !file.isBinary;
        existing.isBinary = file.isBinary;
      }

      if (file.isBinary) return true;

      try {
        const result = await codeApi.readFile(file.path);
        updateFileTab(id, (tab) => {
          tab.content = result.content;
          tab.draft = result.content;
          tab.isBinary = false;
          tab.location = location;
          tab.loadError = null;
          tab.configValidation = null;
        });
        return true;
      } catch (error) {
        const message = formatApiError(error);
        updateFileTab(id, (tab) => {
          tab.loadError = message;
        });
        appState.fileLoadError = { selection: file, message };
        showToast(message, 'error');
        return false;
      } finally {
        updateFileTab(id, (tab) => {
          tab.loading = false;
        });
      }
    }
  );

  const selectFile = useMemoizedFn(async (file: WorkspaceFileSelection) => openFile(file));

  const activateEditorTab = useMemoizedFn((tabId: string) => {
    if (!appState.editorTabs.some((tab) => tab.id === tabId)) return;
    appState.activeEditorTabId = tabId;
    appState.fileLoadError = null;
    navigateTask('review');
  });

  const closeEditorTab = useMemoizedFn((tabId: string) => {
    const tab = appState.editorTabs.find((candidate) => candidate.id === tabId);
    if (!tab) return;
    if (tab.kind === 'file' && isFileEditorTabDirty(tab)) {
      appState.pendingEditorTabCloseId = tabId;
      return;
    }
    removeEditorTabs((candidate) => candidate.id === tabId);
  });

  const confirmEditorTabClose = useMemoizedFn(() => {
    const tabId = appState.pendingEditorTabCloseId;
    if (!tabId) return;
    appState.pendingEditorTabCloseId = null;
    if (appState.fileConflict?.tabId === tabId) appState.fileConflict = null;
    removeEditorTabs((tab) => tab.id === tabId);
  });

  const cancelEditorTabClose = useMemoizedFn(() => {
    appState.pendingEditorTabCloseId = null;
  });

  const updateEditorDraft = useMemoizedFn((tabId: string, content: string) => {
    updateFileTab(tabId, (tab) => {
      tab.draft = content;
      tab.location = null;
      tab.configValidation = null;
    });
  });

  const saveEditorTab = useMemoizedFn(async (requestedTabId?: string): Promise<boolean> => {
    const requestedTab = requestedTabId
      ? appState.editorTabs.find((candidate) => candidate.id === requestedTabId)
      : activeFileTab();
    const tab = requestedTab?.kind === 'file' ? requestedTab : null;
    if (!tab || tab.isBinary || tab.loading || tab.saving) return false;
    if (!isFileEditorTabDirty(tab)) return true;
    const tabId = tab.id;
    const path = tab.path;
    const baseContent = tab.content;
    const draftToSave = tab.draft;
    tab.saving = true;
    try {
      const disk = await codeApi.readFile(path);
      if (disk.content !== baseContent) {
        appState.fileConflict = { tabId, path, diskContent: disk.content };
        showToast('文件已在外部修改，请选择保留版本', 'info');
        return false;
      }
      await codeApi.writeFile(path, draftToSave);
      updateFileTab(tabId, (current) => {
        current.content = draftToSave;
      });
      showToast('文件已保存', 'success');
      return true;
    } catch (error) {
      showToast(formatApiError(error), 'error');
      return false;
    } finally {
      updateFileTab(tabId, (current) => {
        current.saving = false;
      });
    }
  });

  const resolveFileConflict = useMemoizedFn(async (resolution: 'reload' | 'overwrite') => {
    const conflict = appState.fileConflict;
    if (!conflict) return;
    const tab = appState.editorTabs.find((candidate) => candidate.id === conflict.tabId);
    if (tab?.kind !== 'file') {
      appState.fileConflict = null;
      return;
    }
    tab.saving = true;
    try {
      if (resolution === 'reload') {
        const disk = await codeApi.readFile(conflict.path);
        updateFileTab(conflict.tabId, (current) => {
          current.content = disk.content;
          current.draft = disk.content;
          current.configValidation = null;
        });
        showToast('已重新加载最新磁盘版本', 'success');
      } else {
        const draftToSave = tab.draft;
        await codeApi.writeFile(conflict.path, draftToSave);
        updateFileTab(conflict.tabId, (current) => {
          current.content = draftToSave;
        });
        showToast('已用当前编辑覆盖磁盘版本', 'success');
      }
      appState.fileConflict = null;
    } catch (error) {
      showToast(formatApiError(error), 'error');
    } finally {
      updateFileTab(conflict.tabId, (current) => {
        current.saving = false;
      });
    }
  });

  const cancelFileConflict = useMemoizedFn(() => {
    appState.fileConflict = null;
  });

  const validateActiveConfig = useMemoizedFn(async () => {
    const tab = activeFileTab();
    if (!tab || tab.isBinary || basename(tab.path) !== 'config.acl') return;
    const tabId = tab.id;
    const content = tab.draft;
    try {
      const validation = await codeApi.validateConfig(content);
      const current = appState.editorTabs.find((candidate) => candidate.id === tabId);
      if (current?.kind !== 'file' || current.draft !== content) {
        showToast('配置在验证期间已修改，请重新验证', 'info');
        return;
      }
      current.configValidation = validation;
      showToast(validation.valid ? '配置语法有效' : '配置存在问题', validation.valid ? 'success' : 'error');
    } catch (error) {
      showToast(formatApiError(error), 'error');
    }
  });

  const createWorkspaceEntry = useMemoizedFn(async (parent: string, name: string, kind: 'file' | 'directory') => {
    const path = childPath(parent, name.trim());
    try {
      if (kind === 'directory') await codeApi.createDirectory(path);
      else await codeApi.createFile(path);
      await refreshDirectory(parent);
      appState.expandedDirectories[parent] = true;
      if (kind === 'file') await selectFile({ path, isBinary: false });
    } catch (error) {
      showToast(formatApiError(error), 'error');
      throw error;
    }
  });

  const renameWorkspaceEntry = useMemoizedFn(async (path: string, name: string) => {
    const destination = siblingPath(path, name.trim());
    try {
      await codeApi.renamePath(path, destination);
      await refreshDirectory(parentPath(path));
      const rebasedIds = new Map<string, string>();
      for (const tab of appState.editorTabs) {
        const absolutePath = tab.kind === 'file' ? tab.path : absoluteWorkspacePath(tab.path);
        if (!pathInside(path, absolutePath)) continue;
        const nextAbsolutePath = rebasePath(absolutePath, path, destination);
        const previousId = tab.id;
        if (tab.kind === 'file') {
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
    } catch (error) {
      showToast(formatApiError(error), 'error');
      throw error;
    }
  });

  const copyWorkspaceEntry = useMemoizedFn(async (path: string, name: string) => {
    const destination = siblingPath(path, name.trim());
    try {
      await codeApi.copyPath(path, destination);
      await refreshDirectory(parentPath(path));
    } catch (error) {
      showToast(formatApiError(error), 'error');
      throw error;
    }
  });

  const deleteWorkspaceEntry = useMemoizedFn(async (path: string) => {
    try {
      await codeApi.deletePath(path);
      await refreshDirectory(parentPath(path));
      removeEditorTabs((tab) => pathInside(path, tab.kind === 'file' ? tab.path : absoluteWorkspacePath(tab.path)));
      if (appState.fileConflict && pathInside(path, appState.fileConflict.path)) appState.fileConflict = null;
      if (appState.fileLoadError && pathInside(path, appState.fileLoadError.selection.path))
        appState.fileLoadError = null;
    } catch (error) {
      showToast(formatApiError(error), 'error');
      throw error;
    }
  });

  const searchWorkspace = useMemoizedFn(async (query: string) => {
    if (!query.trim()) {
      appState.workspaceSearchResults = [];
      appState.workspaceSearchQuery = '';
      appState.workspaceSearchError = null;
      return;
    }
    appState.workspaceSearchLoading = true;
    appState.workspaceSearchError = null;
    try {
      const normalized = query.trim();
      appState.workspaceSearchResults = await codeApi.searchWorkspace(appState.workspaceRoot, normalized);
      appState.workspaceSearchQuery = normalized;
    } catch (error) {
      const message = formatApiError(error);
      appState.workspaceSearchError = message;
      showToast(message, 'error');
    } finally {
      appState.workspaceSearchLoading = false;
    }
  });

  const replaceWorkspace = useMemoizedFn(async (query: string, replacement: string, filePaths: string[]) => {
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
        rootPath: appState.workspaceRoot,
        query,
        replacement,
        filePaths,
      });
      showToast(`已在 ${result.filesModified} 个文件中完成 ${result.totalReplacements} 处替换`, 'success');
      await searchWorkspace(query);
      const openPaths = appState.editorTabs
        .filter((tab): tab is WorkspaceFileEditorTab => tab.kind === 'file' && filePaths.includes(tab.path))
        .map((tab) => tab.path);
      await Promise.all(
        openPaths.map((path) => openFile({ path, isBinary: false }, { forceReload: true, activate: false }))
      );
    } catch (error) {
      showToast(formatApiError(error), 'error');
      throw error;
    } finally {
      appState.workspaceReplaceLoading = false;
    }
  });

  const refreshGitStatus = useMemoizedFn(async () => {
    appState.gitStatusLoading = true;
    appState.gitStatusError = null;
    try {
      appState.gitStatus = await codeApi.gitStatus(appState.workspaceRoot);
    } catch (error) {
      const message = formatApiError(error);
      appState.gitStatusError = message;
      showToast(message, 'error');
    } finally {
      appState.gitStatusLoading = false;
    }
  });

  const loadGitDiff = useMemoizedFn(async (path: string, staged = false) => {
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
      const diff = await codeApi.gitDiff(appState.workspaceRoot, path, staged);
      updateDiffTab(id, (tab) => {
        tab.path = diff.path || path;
        tab.original = diff.original;
        tab.modified = diff.modified;
        tab.unified = diff.content;
        tab.isBinary = diff.isBinary;
        tab.loadError = null;
      });
    } catch (error) {
      const message = formatApiError(error);
      updateDiffTab(id, (tab) => {
        tab.loadError = message;
      });
      appState.gitDiffError = { path, staged, message };
      showToast(message, 'error');
    } finally {
      updateDiffTab(id, (tab) => {
        tab.loading = false;
      });
    }
  });

  const setGitStaged = useMemoizedFn(async (paths: string[], staged: boolean) => {
    appState.gitActionLoading = true;
    appState.lastCommitReceipt = null;
    try {
      appState.gitStatus = staged
        ? await codeApi.gitStage(appState.workspaceRoot, paths)
        : await codeApi.gitUnstage(appState.workspaceRoot, paths);
      removeEditorTabs((tab) => tab.kind === 'diff');
      appState.gitDiffError = null;
      showToast(staged ? '已加入暂存区' : '已移出暂存区', 'success');
    } catch (error) {
      showToast(formatApiError(error), 'error');
    } finally {
      appState.gitActionLoading = false;
    }
  });

  const commitGitChanges = useMemoizedFn(async (message: string) => {
    appState.gitActionLoading = true;
    try {
      const result = await codeApi.gitCommit(appState.workspaceRoot, message);
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
      showToast(formatApiError(error), 'error');
      throw error;
    } finally {
      appState.gitActionLoading = false;
    }
  });

  return {
    refreshDirectory,
    toggleDirectory,
    selectFile,
    activateEditorTab,
    closeEditorTab,
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
