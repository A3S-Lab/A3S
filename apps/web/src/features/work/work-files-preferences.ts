import { localPathInside, sameLocalPath, type WorkFilesLayout, type WorkFilesSort } from './work-local-files';
import type { WorkFileSearchScope } from './use-work-file-search';

const preferencesKey = 'a3s-work.local-files';

export interface WorkFilesPreferences {
  rootPath: string;
  rootSource: 'default' | 'user';
  recentRootPaths: string[];
  currentPath: string;
  layout: WorkFilesLayout;
  sort: WorkFilesSort;
  favoritePaths: string[];
  searchScope: WorkFileSearchScope;
}

const defaultPreferences: WorkFilesPreferences = {
  rootPath: '',
  rootSource: 'default',
  recentRootPaths: [],
  currentPath: '',
  layout: 'grid',
  sort: { key: 'name', direction: 'ascending' },
  favoritePaths: [],
  searchScope: 'folder',
};

export function readWorkFilesPreferences(): WorkFilesPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(preferencesKey) ?? '{}') as Partial<WorkFilesPreferences>;
    const rootPath = typeof value.rootPath === 'string' ? value.rootPath : '';
    const rootSource =
      value.rootSource === 'default' || value.rootSource === 'user' ? value.rootSource : rootPath ? 'user' : 'default';
    const recentRootPaths = Array.isArray(value.recentRootPaths)
      ? uniqueLocalPaths(
          value.recentRootPaths.filter((path): path is string => typeof path === 'string' && Boolean(path.trim()))
        )
      : [];
    if (rootPath && !recentRootPaths.some((path) => sameLocalPath(path, rootPath))) recentRootPaths.unshift(rootPath);
    const currentPath =
      typeof value.currentPath === 'string' && localPathInside(rootPath, value.currentPath)
        ? value.currentPath
        : rootPath;
    const layout: WorkFilesLayout = value.layout === 'list' ? 'list' : 'grid';
    const key = ['name', 'modified', 'size', 'kind'].includes(value.sort?.key ?? '') ? value.sort!.key : 'name';
    const direction = value.sort?.direction === 'descending' ? 'descending' : 'ascending';
    const favoritePaths = Array.isArray(value.favoritePaths)
      ? uniqueLocalPaths(
          value.favoritePaths.filter(
            (path): path is string =>
              typeof path === 'string' && localPathInside(rootPath, path) && !sameLocalPath(rootPath, path)
          )
        )
      : [];
    const searchScope: WorkFileSearchScope = value.searchScope === 'workspace' ? 'workspace' : 'folder';
    return {
      rootPath,
      rootSource,
      recentRootPaths: recentRootPaths.slice(0, 8),
      currentPath,
      layout,
      sort: { key, direction },
      favoritePaths,
      searchScope,
    };
  } catch {
    return defaultPreferences;
  }
}

export function persistWorkFilesPreferences(preferences: WorkFilesPreferences): void {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  } catch {
    // The active workspace stays in memory when browser storage is unavailable.
  }
}

function uniqueLocalPaths(paths: readonly string[]): string[] {
  const result: string[] = [];
  for (const path of paths) {
    if (!path || result.some((candidate) => sameLocalPath(candidate, path))) continue;
    result.push(path);
  }
  return result;
}
