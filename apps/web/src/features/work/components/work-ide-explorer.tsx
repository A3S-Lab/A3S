import { ChevronDown, ChevronRight, FilePlus2, FolderTree, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CollectionState, IconButton, SearchField } from '../../../design-system/primitives';
import { codeApi } from '../../../lib/api';
import { formatApiError, showToast } from '../../../state/app-state';
import type { WorkspaceEntry } from '../../../types/api';
import { useOfficeDialog } from '../editors/office-controls';
import { joinLocalPath, localPathBasename, sortWorkFileEntries } from '../work-local-files';
import { WorkFileIcon } from './work-file-icon';

export function WorkIdeExplorer({
  rootPath,
  activePath,
  onOpenFile,
}: {
  rootPath: string;
  activePath: string | null;
  onOpenFile: (entry: WorkspaceEntry) => void | Promise<void>;
}) {
  const [directories, setDirectories] = useState<Record<string, WorkspaceEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const officeDialog = useOfficeDialog();

  const loadDirectory = useCallback(async (path: string) => {
    setLoading((current) => new Set(current).add(path));
    setErrors((current) => {
      const next = { ...current };
      delete next[path];
      return next;
    });
    try {
      const entries = await codeApi.readDir(path);
      setDirectories((current) => ({ ...current, [path]: entries }));
      return entries;
    } catch (error) {
      const message = formatApiError(error);
      setErrors((current) => ({ ...current, [path]: message }));
      return [];
    } finally {
      setLoading((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    setDirectories({});
    setExpanded(new Set());
    setErrors({});
    setQuery('');
    if (rootPath) void loadDirectory(rootPath);
  }, [loadDirectory, rootPath]);

  const createFile = async () => {
    const requested = await officeDialog.prompt({ title: '新建代码文件', initialValue: 'untitled.ts' });
    const name = requested?.trim();
    if (!name) return;
    if (name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
      showToast('文件名不能包含路径分隔符。', 'error');
      return;
    }
    const path = joinLocalPath(rootPath, name);
    try {
      await codeApi.createFile(path);
      const entries = await loadDirectory(rootPath);
      const entry = entries.find((candidate) => candidate.path === path);
      if (entry) await onOpenFile(entry);
    } catch (error) {
      showToast(formatApiError(error), 'error');
    }
  };

  return (
    <>
      <aside className='work-ide-explorer' aria-label='代码文件导航'>
        <header>
          <span>
            <FolderTree size={16} />
            <strong title={rootPath}>{localPathBasename(rootPath)}</strong>
          </span>
          <div>
            <IconButton label='新建代码文件' onClick={() => void createFile()}>
              <FilePlus2 size={15} />
            </IconButton>
            <IconButton
              label='刷新代码文件列表'
              disabled={loading.has(rootPath)}
              onClick={() => void loadDirectory(rootPath)}
            >
              <RefreshCw className={loading.has(rootPath) ? 'spin' : ''} size={14} />
            </IconButton>
          </div>
        </header>
        <SearchField
          className='work-ide-explorer-filter'
          size='compact'
          label='筛选代码文件'
          clearLabel='清除代码文件筛选'
          placeholder='筛选文件'
          value={query}
          onValueChange={setQuery}
        />
        <div className='work-ide-tree' role='tree' aria-label='代码文件列表'>
          <IdeDirectory
            path={rootPath}
            depth={0}
            query={query.trim().toLocaleLowerCase()}
            activePath={activePath}
            directories={directories}
            expanded={expanded}
            loading={loading}
            error={errors[rootPath]}
            onToggle={(entry) => {
              setExpanded((current) => {
                const next = new Set(current);
                if (next.has(entry.path)) next.delete(entry.path);
                else next.add(entry.path);
                return next;
              });
              if (!directories[entry.path]) void loadDirectory(entry.path);
            }}
            onOpenFile={onOpenFile}
          />
        </div>
      </aside>
      {officeDialog.dialog}
    </>
  );
}

function IdeDirectory({
  path,
  depth,
  query,
  activePath,
  directories,
  expanded,
  loading,
  error,
  onToggle,
  onOpenFile,
}: {
  path: string;
  depth: number;
  query: string;
  activePath: string | null;
  directories: Record<string, WorkspaceEntry[]>;
  expanded: Set<string>;
  loading: Set<string>;
  error?: string;
  onToggle: (entry: WorkspaceEntry) => void;
  onOpenFile: (entry: WorkspaceEntry) => void | Promise<void>;
}) {
  const entries = useMemo(
    () =>
      sortWorkFileEntries(directories[path] ?? [], { key: 'name', direction: 'ascending' }).filter(
        (entry) => !query || entry.name.toLocaleLowerCase().includes(query) || entry.isDirectory
      ),
    [directories, path, query]
  );
  return (
    <div>
      {loading.has(path) && !directories[path] && (
        <CollectionState className='work-ide-tree-state' role='status'>
          正在读取…
        </CollectionState>
      )}
      {error && (
        <CollectionState className='work-ide-tree-state' tone='danger' role='alert'>
          {error}
        </CollectionState>
      )}
      {entries.map((entry) => {
        const open = entry.isDirectory && expanded.has(entry.path);
        return (
          <div className='work-ide-tree-entry' key={entry.path}>
            <button
              type='button'
              role='treeitem'
              aria-level={depth + 1}
              aria-expanded={entry.isDirectory ? open : undefined}
              aria-selected={!entry.isDirectory && activePath === entry.path}
              className={activePath === entry.path ? 'active' : ''}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => {
                if (entry.isDirectory) onToggle(entry);
                else void onOpenFile(entry);
              }}
            >
              <span className='work-ide-tree-chevron'>
                {entry.isDirectory ? open ? <ChevronDown size={12} /> : <ChevronRight size={12} /> : null}
              </span>
              <WorkFileIcon path={entry.path} directory={entry.isDirectory} open={open} size={15} />
              <strong title={entry.path}>{entry.name}</strong>
            </button>
            {entry.isDirectory && open && (
              <IdeDirectory
                path={entry.path}
                depth={depth + 1}
                query={query}
                activePath={activePath}
                directories={directories}
                expanded={expanded}
                loading={loading}
                error={undefined}
                onToggle={onToggle}
                onOpenFile={onOpenFile}
              />
            )}
          </div>
        );
      })}
      {!loading.has(path) && !error && !entries.length && (
        <CollectionState className='work-ide-tree-state' role='status'>
          目录为空
        </CollectionState>
      )}
    </div>
  );
}
