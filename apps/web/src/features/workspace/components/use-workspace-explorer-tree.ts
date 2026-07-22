import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { WorkspaceEntry } from '../../../types/api';

export interface ExplorerTreeItem {
  entry: Readonly<WorkspaceEntry>;
  parentPath: string;
  displayExpanded: boolean;
  index: number;
}

export interface ExplorerTreeProjection {
  items: ExplorerTreeItem[];
  itemByPath: Map<string, ExplorerTreeItem>;
  visiblePaths: Set<string>;
  displayExpandedPaths: Set<string>;
  normalizedQuery: string;
}

export function useWorkspaceExplorerTree({
  root,
  filesByDirectory,
  expandedDirectories,
  query,
  activePath,
  toggleDirectory,
}: {
  root: string;
  filesByDirectory: Readonly<Record<string, readonly Readonly<WorkspaceEntry>[]>>;
  expandedDirectories: Readonly<Record<string, boolean>>;
  query: string;
  activePath: string | null;
  toggleDirectory: (path: string) => Promise<void>;
}) {
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const tree = useMemo(
    () => projectExplorerTree(root, filesByDirectory, expandedDirectories, query),
    [root, filesByDirectory, expandedDirectories, query]
  );
  const rovingPath =
    (focusedPath && tree.itemByPath.has(focusedPath) ? focusedPath : null) ??
    (activePath && tree.itemByPath.has(activePath) ? activePath : null) ??
    tree.items[0]?.entry.path ??
    null;
  const registerItem = useCallback((path: string, element: HTMLButtonElement | null) => {
    if (element) itemRefs.current.set(path, element);
    else itemRefs.current.delete(path);
  }, []);
  const focusItem = useCallback((path: string) => {
    setFocusedPath(path);
    const target = itemRefs.current.get(path);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, []);
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof Element)) return;
      const row = event.target.closest<HTMLButtonElement>('button[data-explorer-path]');
      if (!row || !event.currentTarget.contains(row)) return;
      const path = row.dataset.explorerPath;
      const item = path ? tree.itemByPath.get(path) : undefined;
      if (!path || !item) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const targetIndex =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tree.items.length - 1
              : event.key === 'ArrowDown'
                ? Math.min(item.index + 1, tree.items.length - 1)
                : Math.max(item.index - 1, 0);
        const target = tree.items[targetIndex];
        if (target) focusItem(target.entry.path);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (!item.entry.isDirectory) return;
        if (!item.displayExpanded) {
          void toggleDirectory(path);
          return;
        }
        const firstChild = tree.items[item.index + 1];
        if (firstChild?.parentPath === path) focusItem(firstChild.entry.path);
        return;
      }

      if (event.key !== 'ArrowLeft') return;
      event.preventDefault();
      if (item.entry.isDirectory && item.displayExpanded && !tree.normalizedQuery) {
        void toggleDirectory(path);
        return;
      }
      if (tree.itemByPath.has(item.parentPath)) focusItem(item.parentPath);
    },
    [focusItem, toggleDirectory, tree]
  );

  return { tree, rovingPath, setFocusedPath, registerItem, focusItem, handleKeyDown };
}

function projectExplorerTree(
  root: string,
  filesByDirectory: Readonly<Record<string, readonly Readonly<WorkspaceEntry>[]>>,
  expandedDirectories: Readonly<Record<string, boolean>>,
  query: string
): ExplorerTreeProjection {
  const normalizedQuery = query.trim().toLowerCase();
  const items: ExplorerTreeItem[] = [];
  const itemByPath = new Map<string, ExplorerTreeItem>();
  const visiblePaths = new Set<string>();
  const displayExpandedPaths = new Set<string>();
  const matchCache = new Map<string, boolean>();
  const matchingStack = new Set<string>();

  const hasLoadedMatch = (directory: string): boolean => {
    const cached = matchCache.get(directory);
    if (cached !== undefined) return cached;
    if (matchingStack.has(directory)) return false;
    matchingStack.add(directory);
    const matches = (filesByDirectory[directory] ?? []).some(
      (entry) => entry.name.toLowerCase().includes(normalizedQuery) || (entry.isDirectory && hasLoadedMatch(entry.path))
    );
    matchingStack.delete(directory);
    matchCache.set(directory, matches);
    return matches;
  };

  const projectedDirectories = new Set<string>();
  const visit = (directory: string) => {
    if (projectedDirectories.has(directory)) return;
    projectedDirectories.add(directory);
    for (const entry of filesByDirectory[directory] ?? []) {
      const matchingDescendant = Boolean(normalizedQuery && entry.isDirectory && hasLoadedMatch(entry.path));
      const visible = !normalizedQuery || entry.name.toLowerCase().includes(normalizedQuery) || matchingDescendant;
      if (!visible || itemByPath.has(entry.path)) continue;
      const displayExpanded = Boolean(expandedDirectories[entry.path]) || matchingDescendant;
      const item = { entry, parentPath: directory, displayExpanded, index: items.length };
      items.push(item);
      itemByPath.set(entry.path, item);
      visiblePaths.add(entry.path);
      if (!entry.isDirectory || !displayExpanded) continue;
      displayExpandedPaths.add(entry.path);
      visit(entry.path);
    }
  };

  visit(root);
  return { items, itemByPath, visiblePaths, displayExpandedPaths, normalizedQuery };
}
