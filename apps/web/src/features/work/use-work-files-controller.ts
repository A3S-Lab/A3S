import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { codeApi } from '../../lib/api';
import { formatApiError, showToast } from '../../state/app-state';
import type { WorkspaceEntry } from '../../types/api';
import { importWorkspaceDrop } from '../workspace/workspace-drop-import';
import { useWorkFileSearch, type WorkFileSearchScope } from './use-work-file-search';
import {
  persistWorkFilesPreferences,
  readWorkFilesPreferences,
  type WorkFilesPreferences,
} from './work-files-preferences';
import { moveWorkLocalFileBindings, removeWorkLocalFileBindingsAtPath } from './work-local-file-binding';
import {
  joinLocalPath,
  localPathBasename,
  localPathInside,
  localPathParent,
  rebaseLocalPath,
  sameLocalPath,
  siblingLocalPath,
  sortWorkFileEntries,
  type WorkFilesLayout,
  type WorkFilesSort,
} from './work-local-files';

interface NavigationHistory {
  paths: string[];
  index: number;
}

interface SelectionOptions {
  toggle?: boolean;
  range?: boolean;
}

export function useWorkFilesController(defaultRootPath = '') {
  const [initialPreferences] = useState(readWorkFilesPreferences);
  const [initialRoot] = useState(() => resolveInitialRoot(initialPreferences, defaultRootPath));
  const [rootPath, setRootPath] = useState(initialRoot.rootPath);
  const [rootSource, setRootSource] = useState<WorkFilesPreferences['rootSource']>(initialPreferences.rootSource);
  const [recentRootPaths, setRecentRootPaths] = useState(() =>
    rememberRecentRoot(initialPreferences.recentRootPaths, initialRoot.rootPath)
  );
  const [history, setHistory] = useState<NavigationHistory>(() => {
    const currentPath =
      initialPreferences.currentPath &&
      sameLocalPath(initialPreferences.rootPath, initialRoot.rootPath) &&
      localPathInside(initialRoot.rootPath, initialPreferences.currentPath)
        ? initialPreferences.currentPath
        : initialRoot.rootPath;
    return { paths: currentPath ? [currentPath] : [], index: 0 };
  });
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchScope, setSearchScopeState] = useState<WorkFileSearchScope>(initialPreferences.searchScope);
  const [filesystemRevision, setFilesystemRevision] = useState(0);
  const [layout, setLayout] = useState<WorkFilesLayout>(initialPreferences.layout);
  const [sort, setSort] = useState<WorkFilesSort>(initialPreferences.sort);
  const [favoritePaths, setFavoritePaths] = useState(() =>
    sameLocalPath(initialPreferences.rootPath, initialRoot.rootPath) ? initialPreferences.favoritePaths : []
  );
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [selectionFocusPath, setSelectionFocusPath] = useState<string | null>(null);
  const [operationPaths, setOperationPaths] = useState<Set<string>>(() => new Set());
  const [dropImporting, setDropImporting] = useState(false);
  const selectionAnchorRef = useRef<string | null>(null);
  const dropImportingRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const currentPath = history.paths[history.index] ?? rootPath;
  const workspaceSearch = useWorkFileSearch({ rootPath, query, scope: searchScope, filesystemRevision });
  const normalizedDefaultRoot = defaultRootPath.trim();

  const loadDirectory = useCallback(async (path: string): Promise<WorkspaceEntry[]> => {
    if (!path) {
      setEntries([]);
      return [];
    }
    requestSequenceRef.current += 1;
    const sequence = requestSequenceRef.current;
    setLoading(true);
    setError(null);
    try {
      const nextEntries = await codeApi.readDir(path);
      if (sequence === requestSequenceRef.current) {
        const available = new Set(nextEntries.map((entry) => entry.path));
        setEntries(nextEntries);
        setSelectedPaths((current) => {
          return new Set([...current].filter((selected) => available.has(selected)));
        });
        setSelectionFocusPath((current) => (current && available.has(current) ? current : null));
      }
      return nextEntries;
    } catch (loadError) {
      const message = formatApiError(loadError);
      if (sequence === requestSequenceRef.current) {
        setEntries([]);
        setError(message);
      }
      throw loadError;
    } finally {
      if (sequence === requestSequenceRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentPath) {
      setEntries([]);
      setLoading(false);
      setError(null);
      return;
    }
    void loadDirectory(currentPath).catch(() => undefined);
  }, [currentPath, loadDirectory]);

  useEffect(() => {
    persistWorkFilesPreferences({
      rootPath,
      rootSource,
      recentRootPaths,
      currentPath,
      layout,
      sort,
      favoritePaths,
      searchScope,
    });
  }, [rootPath, rootSource, recentRootPaths, currentPath, layout, sort, favoritePaths, searchScope]);

  useEffect(() => {
    if (rootSource !== 'default' || !normalizedDefaultRoot || sameLocalPath(rootPath, normalizedDefaultRoot)) {
      return;
    }
    setRootPath(normalizedDefaultRoot);
    setRecentRootPaths((current) => rememberRecentRoot(current, normalizedDefaultRoot));
    setHistory({ paths: [normalizedDefaultRoot], index: 0 });
    setFavoritePaths([]);
    setQuery('');
    setSelectedPaths(new Set());
    setSelectionFocusPath(null);
    selectionAnchorRef.current = null;
  }, [normalizedDefaultRoot, rootPath, rootSource]);

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered =
      searchScope === 'workspace' && normalizedQuery
        ? workspaceSearch.entries
        : normalizedQuery
          ? entries.filter((entry) => entry.name.toLocaleLowerCase().includes(normalizedQuery))
          : entries;
    return sortWorkFileEntries(filtered, sort);
  }, [entries, query, searchScope, sort, workspaceSearch.entries]);

  const selectedEntries = useMemo(
    () => visibleEntries.filter((entry) => selectedPaths.has(entry.path)),
    [selectedPaths, visibleEntries]
  );

  const setSearchScope = useCallback((scope: WorkFileSearchScope) => {
    setSearchScopeState(scope);
    setSelectedPaths(new Set());
    setSelectionFocusPath(null);
    selectionAnchorRef.current = null;
  }, []);

  const activateRoot = useCallback(
    (path: string) => {
      setFavoritePaths((current) => (rootPath && sameLocalPath(rootPath, path) ? current : []));
      setRootSource('user');
      setRootPath(path);
      setRecentRootPaths((current) => rememberRecentRoot(current, path));
      setHistory({ paths: [path], index: 0 });
      setQuery('');
      setSelectedPaths(new Set());
      setSelectionFocusPath(null);
      selectionAnchorRef.current = null;
    },
    [rootPath]
  );

  const selectRoot = useCallback(
    async (candidate: string): Promise<string | null> => {
      const path = candidate.trim();
      if (!path) return null;
      if (rootPath && sameLocalPath(rootPath, path)) {
        setHistory({ paths: [rootPath], index: 0 });
        setQuery('');
        setSelectedPaths(new Set());
        setSelectionFocusPath(null);
        selectionAnchorRef.current = null;
        return rootPath;
      }
      try {
        await codeApi.readDir(path);
        activateRoot(path);
        return path;
      } catch (selectionError) {
        showToast(`无法打开工作区：${formatApiError(selectionError)}`, 'error');
        return null;
      }
    },
    [activateRoot, rootPath]
  );

  const pickRoot = useCallback(async (): Promise<string | null> => {
    try {
      const selection = await codeApi.pickWorkspaceDirectory(rootPath || normalizedDefaultRoot || undefined);
      if (selection.cancelled || !selection.path) return null;
      return await selectRoot(selection.path);
    } catch (pickError) {
      showToast(formatApiError(pickError), 'error');
      return null;
    }
  }, [normalizedDefaultRoot, rootPath, selectRoot]);

  const navigateTo = useCallback(
    (path: string) => {
      if (!rootPath || !localPathInside(rootPath, path)) return;
      setHistory((current) => {
        const active = current.paths[current.index];
        if (active && sameLocalPath(active, path)) return current;
        return {
          paths: [...current.paths.slice(0, current.index + 1), path],
          index: current.index + 1,
        };
      });
      setQuery('');
      setSelectedPaths(new Set());
      setSelectionFocusPath(null);
      selectionAnchorRef.current = null;
    },
    [rootPath]
  );

  const goBack = useCallback(() => {
    setHistory((current) => ({ ...current, index: Math.max(0, current.index - 1) }));
    setQuery('');
    setSelectedPaths(new Set());
    setSelectionFocusPath(null);
    selectionAnchorRef.current = null;
  }, []);

  const goForward = useCallback(() => {
    setHistory((current) => ({
      ...current,
      index: Math.min(current.paths.length - 1, current.index + 1),
    }));
    setQuery('');
    setSelectedPaths(new Set());
    setSelectionFocusPath(null);
    selectionAnchorRef.current = null;
  }, []);

  const goUp = useCallback(() => {
    if (!rootPath || sameLocalPath(currentPath, rootPath)) return;
    const parent = localPathParent(currentPath);
    if (localPathInside(rootPath, parent)) navigateTo(parent);
  }, [currentPath, navigateTo, rootPath]);

  const refresh = useCallback(async () => {
    if (!currentPath) return;
    setFilesystemRevision((current) => current + 1);
    try {
      await loadDirectory(currentPath);
    } catch (refreshError) {
      showToast(formatApiError(refreshError), 'error');
    }
  }, [currentPath, loadDirectory]);

  const selectEntry = useCallback(
    (entry: WorkspaceEntry, options: SelectionOptions = {}) => {
      const paths = visibleEntries.map((candidate) => candidate.path);
      setSelectedPaths((current) => {
        if (options.range && selectionAnchorRef.current) {
          const anchorIndex = paths.indexOf(selectionAnchorRef.current);
          const targetIndex = paths.indexOf(entry.path);
          if (anchorIndex >= 0 && targetIndex >= 0) {
            const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
            return new Set(paths.slice(start, end + 1));
          }
        }
        selectionAnchorRef.current = entry.path;
        if (!options.toggle) return new Set([entry.path]);
        const next = new Set(current);
        if (next.has(entry.path)) next.delete(entry.path);
        else next.add(entry.path);
        return next;
      });
      setSelectionFocusPath(entry.path);
    },
    [visibleEntries]
  );

  const selectAll = useCallback(() => {
    setSelectedPaths(new Set(visibleEntries.map((entry) => entry.path)));
    setSelectionFocusPath(visibleEntries.at(-1)?.path ?? null);
    selectionAnchorRef.current = visibleEntries.at(-1)?.path ?? null;
  }, [visibleEntries]);

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set());
    setSelectionFocusPath(null);
    selectionAnchorRef.current = null;
  }, []);

  const toggleFavoritePath = useCallback(
    (path: string) => {
      if (!rootPath || sameLocalPath(rootPath, path) || !localPathInside(rootPath, path)) return;
      setFavoritePaths((current) =>
        current.some((favorite) => sameLocalPath(favorite, path))
          ? current.filter((favorite) => !sameLocalPath(favorite, path))
          : [...current, path]
      );
    },
    [rootPath]
  );

  const createFolder = useCallback(
    async (name: string) => {
      const normalized = validateEntryName(name);
      const path = joinLocalPath(currentPath, normalized);
      setOperationPaths(new Set([path]));
      try {
        await codeApi.createDirectory(path);
        await loadDirectory(currentPath);
        setFilesystemRevision((current) => current + 1);
        setSelectedPaths(new Set([path]));
        setSelectionFocusPath(path);
        selectionAnchorRef.current = path;
        showToast('文件夹已创建', 'success');
      } catch (operationError) {
        showToast(formatApiError(operationError), 'error');
        throw operationError;
      } finally {
        setOperationPaths(new Set());
      }
    },
    [currentPath, loadDirectory]
  );

  const renameEntry = useCallback(
    async (entry: WorkspaceEntry, name: string) => {
      const normalized = validateEntryName(name);
      if (normalized === entry.name) return;
      const destination = siblingLocalPath(entry.path, normalized);
      setOperationPaths(new Set([entry.path]));
      try {
        await codeApi.renamePath(entry.path, destination);
        moveWorkLocalFileBindings(entry.path, destination);
        setFavoritePaths((current) => current.map((path) => rebaseLocalPath(path, entry.path, destination)));
        await loadDirectory(currentPath);
        setFilesystemRevision((current) => current + 1);
        setSelectedPaths(new Set([destination]));
        setSelectionFocusPath(destination);
        selectionAnchorRef.current = destination;
        showToast('名称已更新', 'success');
      } catch (operationError) {
        showToast(formatApiError(operationError), 'error');
        throw operationError;
      } finally {
        setOperationPaths(new Set());
      }
    },
    [currentPath, loadDirectory]
  );

  const duplicateEntry = useCallback(
    async (entry: WorkspaceEntry, name: string) => {
      const normalized = validateEntryName(name);
      const destination = siblingLocalPath(entry.path, normalized);
      setOperationPaths(new Set([entry.path]));
      try {
        await codeApi.copyPath(entry.path, destination);
        await loadDirectory(currentPath);
        setFilesystemRevision((current) => current + 1);
        setSelectedPaths(new Set([destination]));
        setSelectionFocusPath(destination);
        selectionAnchorRef.current = destination;
        showToast('副本已创建', 'success');
      } catch (operationError) {
        showToast(formatApiError(operationError), 'error');
        throw operationError;
      } finally {
        setOperationPaths(new Set());
      }
    },
    [currentPath, loadDirectory]
  );

  const deleteEntries = useCallback(
    async (items: readonly WorkspaceEntry[]) => {
      const paths = uniqueLocalPaths(items.map((entry) => entry.path));
      if (!paths.length) return;
      if (!rootPath || paths.some((path) => !localPathInside(rootPath, path) || sameLocalPath(rootPath, path))) {
        throw new Error('只能删除当前文件夹中的项目，且不能删除已打开的根文件夹。');
      }

      const deletedPaths: string[] = [];
      setOperationPaths(new Set(paths));
      try {
        for (const path of paths) {
          await codeApi.deletePath(path);
          deletedPaths.push(path);
          removeWorkLocalFileBindingsAtPath(path);
        }
        setFavoritePaths((current) =>
          current.filter((favorite) => !deletedPaths.some((path) => localPathInside(path, favorite)))
        );
        setSelectedPaths(new Set());
        setSelectionFocusPath(null);
        selectionAnchorRef.current = null;
        await loadDirectory(currentPath);
        setFilesystemRevision((current) => current + 1);
        showToast(`${deletedPaths.length} 项已永久删除`, 'success');
      } catch (operationError) {
        if (deletedPaths.length) {
          setFavoritePaths((current) =>
            current.filter((favorite) => !deletedPaths.some((path) => localPathInside(path, favorite)))
          );
          setSelectedPaths(new Set());
          setSelectionFocusPath(null);
          selectionAnchorRef.current = null;
          setFilesystemRevision((current) => current + 1);
          await loadDirectory(currentPath).catch(() => undefined);
        }
        showToast(formatApiError(operationError), 'error');
        throw operationError;
      } finally {
        setOperationPaths(new Set());
      }
    },
    [currentPath, loadDirectory, rootPath]
  );

  const moveEntries = useCallback(
    async (paths: readonly string[], destinationDirectory: string) => {
      try {
        if (!rootPath || !localPathInside(rootPath, destinationDirectory)) {
          throw new Error('只能在当前本地根目录内移动文件。');
        }
        const sources = uniqueLocalPaths(paths);
        if (sources.some((path) => !localPathInside(rootPath, path))) {
          throw new Error('只能移动当前本地根目录内的文件。');
        }
        if (
          sources.some(
            (source) => sameLocalPath(source, destinationDirectory) || localPathInside(source, destinationDirectory)
          )
        ) {
          throw new Error('不能将文件夹移动到自身内部。');
        }
        const moves = sources
          .filter((source) => !sameLocalPath(localPathParent(source), destinationDirectory))
          .map((source) => ({
            source,
            destination: joinLocalPath(destinationDirectory, localPathBasename(source)),
          }));
        if (!moves.length) return;

        setOperationPaths(new Set(moves.map((move) => move.source)));
        const existence = await Promise.all(moves.map((move) => codeApi.pathExists(move.destination)));
        const occupiedIndex = existence.findIndex((result) => result.exists);
        if (occupiedIndex >= 0) {
          throw new Error(`目标文件夹中已存在“${localPathBasename(moves[occupiedIndex].destination)}”。`);
        }
        for (const move of moves) {
          await codeApi.renamePath(move.source, move.destination);
          moveWorkLocalFileBindings(move.source, move.destination);
        }
        setFavoritePaths((current) =>
          current.map((path) =>
            moves.reduce((rebased, move) => rebaseLocalPath(rebased, move.source, move.destination), path)
          )
        );
        await loadDirectory(currentPath);
        setFilesystemRevision((current) => current + 1);
        if (sameLocalPath(currentPath, destinationDirectory)) {
          const destinations = moves.map((move) => move.destination);
          setSelectedPaths(new Set(destinations));
          setSelectionFocusPath(destinations.at(-1) ?? null);
          selectionAnchorRef.current = destinations[0] ?? null;
        } else {
          setSelectedPaths(new Set());
          setSelectionFocusPath(null);
          selectionAnchorRef.current = null;
        }
        showToast(`${moves.length} 项已移动`, 'success');
      } catch (operationError) {
        showToast(formatApiError(operationError), 'error');
        throw operationError;
      } finally {
        setOperationPaths(new Set());
      }
    },
    [currentPath, loadDirectory, rootPath]
  );

  const importDroppedItems = useCallback(
    async (dataTransfer: DataTransfer, destinationDirectory: string) => {
      if (dropImportingRef.current) throw new Error('正在处理上一批拖入内容，请稍候。');
      dropImportingRef.current = true;
      setDropImporting(true);
      try {
        if (!rootPath || !localPathInside(rootPath, destinationDirectory)) {
          throw new Error('只能拖入当前本地根目录内的文件夹。');
        }
        const result = await importWorkspaceDrop(dataTransfer, destinationDirectory);
        try {
          await loadDirectory(currentPath);
        } catch {
          // The imported roots remain valid even when the current listing cannot refresh yet.
        }
        setFilesystemRevision((current) => current + 1);
        if (sameLocalPath(currentPath, destinationDirectory)) {
          setSelectedPaths(new Set(result.importedPaths));
          setSelectionFocusPath(result.importedPaths.at(-1) ?? null);
          selectionAnchorRef.current = result.importedPaths[0] ?? null;
        }
        showToast(
          `已放入 ${result.fileCount} 个文件${result.directoryCount ? `、${result.directoryCount} 个文件夹` : ''}`,
          'success'
        );
        return result;
      } catch (operationError) {
        showToast(`拖入失败：${formatApiError(operationError)}`, 'error');
        throw operationError;
      } finally {
        dropImportingRef.current = false;
        setDropImporting(false);
      }
    },
    [currentPath, loadDirectory, rootPath]
  );

  return {
    rootPath,
    recentRootPaths,
    currentPath,
    entries,
    visibleEntries,
    selectedPaths,
    selectedEntries,
    loading,
    error,
    query,
    searchScope,
    searchLoading: workspaceSearch.loading,
    searchError: workspaceSearch.error,
    searchTruncated: workspaceSearch.truncated,
    searchUnreadableDirectories: workspaceSearch.unreadableDirectories,
    layout,
    sort,
    favoritePaths,
    selectionFocusPath,
    operationPaths,
    dropImporting,
    canGoBack: history.index > 0,
    canGoForward: history.index < history.paths.length - 1,
    canGoUp: Boolean(rootPath && currentPath && !sameLocalPath(rootPath, currentPath)),
    setQuery,
    setSearchScope,
    setLayout,
    setSort,
    selectRoot,
    pickRoot,
    navigateTo,
    goBack,
    goForward,
    goUp,
    refresh,
    selectEntry,
    selectAll,
    clearSelection,
    toggleFavoritePath,
    createFolder,
    renameEntry,
    duplicateEntry,
    deleteEntries,
    moveEntries,
    importDroppedItems,
  };
}

export type WorkFilesActions = ReturnType<typeof useWorkFilesController>;

function resolveInitialRoot(preferences: WorkFilesPreferences, defaultRootPath: string): { rootPath: string } {
  if (preferences.rootSource === 'user') return { rootPath: preferences.rootPath };
  return { rootPath: defaultRootPath.trim() || preferences.rootPath };
}

function validateEntryName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error('请输入名称。');
  if (name === '.' || name === '..' || /[\\/]/.test(name)) throw new Error('名称不能包含路径分隔符。');
  return name;
}

function uniqueLocalPaths(paths: readonly string[]): string[] {
  const result: string[] = [];
  for (const path of paths) {
    if (!path || result.some((candidate) => sameLocalPath(candidate, path))) continue;
    result.push(path);
  }
  return result;
}

function rememberRecentRoot(paths: readonly string[], path: string): string[] {
  const normalized = path.trim();
  if (!normalized) return uniqueLocalPaths(paths).slice(0, 8);
  return uniqueLocalPaths([normalized, ...paths.filter((candidate) => !sameLocalPath(candidate, normalized))]).slice(
    0,
    8
  );
}
