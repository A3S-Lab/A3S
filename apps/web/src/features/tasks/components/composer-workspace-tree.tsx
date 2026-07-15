import { ChevronRight, FolderOpen, LoaderCircle } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { codeApi } from '../../../lib/api';
import { formatApiError } from '../../../state/app-state';
import type { WorkspaceEntry } from '../../../types/api';
import { flattenComposerWorkspaceTree } from './composer-workspace-tree-state';
import { WorkspaceEntryIcon } from './workspace-entry-icon';

export interface ComposerWorkspaceTreeHandle {
  moveActive: (offset: number) => void;
  activateActive: () => boolean;
}

export const ComposerWorkspaceTree = forwardRef<
  ComposerWorkspaceTreeHandle,
  {
    id: string;
    workspaceRoot: string;
    query: string;
    selectedFiles: readonly string[];
    onSelect: (path: string) => void;
    onActiveDescendantChange: (id?: string) => void;
  }
>(function ComposerWorkspaceTree({ id, workspaceRoot, query, selectedFiles, onSelect, onActiveDescendantChange }, ref) {
  const [entriesByDirectory, setEntriesByDirectory] = useState<Record<string, WorkspaceEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const loadingRef = useRef(new Set<string>());
  const workspaceRef = useRef(workspaceRoot);

  const loadDirectory = useCallback(async (path: string) => {
    if (!path || loadingRef.current.has(path)) return;
    const requestWorkspace = workspaceRef.current;
    loadingRef.current.add(path);
    setLoadingPaths((current) => new Set(current).add(path));
    setErrors((current) => {
      const next = { ...current };
      delete next[path];
      return next;
    });
    try {
      const entries = await codeApi.readDir(path);
      if (workspaceRef.current === requestWorkspace) {
        setEntriesByDirectory((current) => ({ ...current, [path]: entries }));
      }
    } catch (error) {
      if (workspaceRef.current === requestWorkspace) {
        setErrors((current) => ({ ...current, [path]: formatApiError(error) }));
      }
    } finally {
      loadingRef.current.delete(path);
      if (workspaceRef.current === requestWorkspace) {
        setLoadingPaths((current) => {
          const next = new Set(current);
          next.delete(path);
          return next;
        });
      }
    }
  }, []);

  useEffect(() => {
    workspaceRef.current = workspaceRoot;
    loadingRef.current.clear();
    setEntriesByDirectory({});
    setExpandedPaths(new Set());
    setLoadingPaths(new Set());
    setErrors({});
    setActiveIndex(0);
    void loadDirectory(workspaceRoot);
  }, [loadDirectory, workspaceRoot]);

  const rows = useMemo(
    () =>
      flattenComposerWorkspaceTree({
        workspaceRoot,
        entriesByDirectory,
        expandedPaths,
        selectedFiles,
        query,
      }),
    [entriesByDirectory, expandedPaths, query, selectedFiles, workspaceRoot]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex >= rows.length) setActiveIndex(Math.max(0, rows.length - 1));
  }, [activeIndex, rows.length]);

  const currentIndex = Math.min(activeIndex, Math.max(0, rows.length - 1));
  const activeId = rows[currentIndex] ? `${id}-${currentIndex}` : undefined;

  useEffect(() => {
    onActiveDescendantChange(activeId);
    return () => onActiveDescendantChange(undefined);
  }, [activeId, onActiveDescendantChange]);

  const toggleDirectory = useCallback(
    (path: string) => {
      const expanding = !expandedPaths.has(path);
      setExpandedPaths((current) => {
        const next = new Set(current);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
      if (expanding && (!entriesByDirectory[path] || errors[path])) void loadDirectory(path);
    },
    [entriesByDirectory, errors, expandedPaths, loadDirectory]
  );

  const activate = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return false;
      if (row.entry.isDirectory) toggleDirectory(row.entry.path);
      else onSelect(row.entry.path);
      return true;
    },
    [onSelect, rows, toggleDirectory]
  );

  useImperativeHandle(
    ref,
    () => ({
      moveActive: (offset) => {
        setActiveIndex((index) => Math.max(0, Math.min(index + offset, Math.max(0, rows.length - 1))));
      },
      activateActive: () => activate(currentIndex),
    }),
    [activate, currentIndex, rows.length]
  );

  const firstError = Object.values(errors)[0];
  return (
    <section className='composer-suggestion-menu composer-workspace-tree-menu' aria-label='添加工作区文件'>
      <header>
        <span>
          <FolderOpen size={15} />
          <strong>工作区文件</strong>
        </span>
        <kbd>@</kbd>
      </header>
      {query && <p className='composer-suggestion-query'>筛选“{query}”</p>}
      <div id={id} role='tree' aria-label='工作区文件树'>
        {rows.map((row, index) => {
          const directory = row.entry.isDirectory;
          const expanded = directory && expandedPaths.has(row.entry.path);
          const loading = loadingPaths.has(row.entry.path);
          return (
            <button
              id={`${id}-${index}`}
              type='button'
              role='treeitem'
              aria-level={row.depth + 1}
              aria-expanded={directory ? expanded : undefined}
              aria-selected={index === currentIndex}
              className={index === currentIndex ? 'active' : ''}
              style={{ paddingLeft: `${8 + row.depth * 18}px` }}
              key={row.entry.path}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => activate(index)}
            >
              <span className={`composer-tree-chevron ${directory ? '' : 'file'}`}>
                {directory && <ChevronRight className={expanded ? 'expanded' : ''} size={13} />}
              </span>
              <WorkspaceEntryIcon
                name={row.entry.name}
                extension={row.entry.extension}
                isDirectory={directory}
                expanded={expanded}
                size={16}
              />
              <span className='composer-suggestion-copy'>
                <strong>{row.entry.name}</strong>
                <small>{row.relativePath}</small>
              </span>
              {loading && <LoaderCircle className='spin' size={13} />}
            </button>
          );
        })}
        {loadingPaths.has(workspaceRoot) && !rows.length && (
          <output className='composer-suggestion-state'>
            <LoaderCircle className='spin' size={14} /> 正在读取工作区…
          </output>
        )}
        {!loadingPaths.has(workspaceRoot) && firstError && (
          <p className='composer-suggestion-state error' role='alert'>
            {firstError}
          </p>
        )}
        {!loadingPaths.has(workspaceRoot) && !firstError && !rows.length && (
          <p className='composer-suggestion-state'>{query ? '没有匹配的已加载文件' : '工作区中没有可选文件'}</p>
        )}
      </div>
      <footer>
        <span>↑↓ 选择</span>
        <span>Enter 展开 / 添加</span>
        <span>Esc 关闭</span>
      </footer>
    </section>
  );
});
