import {
  ChevronDown,
  ChevronRight,
  Copy,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderPlus,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useSnapshot } from 'valtio';
import { IconButton } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { WorkspaceEntry } from '../../../types/api';
import type { WorkspaceActions } from '../workspace-actions';
import { isFileEditorTabDirty, normalizePath, workspaceRelativePath } from '../workspace-state';
import { WorkspaceFileIcon } from './workspace-file-icon';
import { WorkspaceContextMenu, type WorkspaceContextMenuItem } from './workspace-context-menu';
import { WorkspaceInlineEntry, type WorkspaceInlineAction, workspaceInlineActionKey } from './workspace-inline-entry';

interface ContextMenuState {
  entry: Readonly<WorkspaceEntry> | null;
  x: number;
  y: number;
}

export function WorkspaceExplorer({ actions, onOpenSearch }: { actions: WorkspaceActions; onOpenSearch: () => void }) {
  const state = useSnapshot(appState);
  const [query, setQuery] = useState('');
  const [inlineAction, setInlineAction] = useState<WorkspaceInlineAction | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const closeContextMenu = () => setContextMenu(null);
  const updateInlineAction = (action: WorkspaceInlineAction | null) => {
    closeContextMenu();
    setInlineAction(action);
  };
  const contextItems = contextMenuItems(
    contextMenu?.entry ?? null,
    state.expandedDirectories,
    actions,
    updateInlineAction
  );
  return (
    <aside className='workspace-explorer' aria-label='文件资源管理器'>
      <header>
        <div>
          <span className='eyebrow'>EXPLORER</span>
          <strong>{basename(state.workspaceRoot)}</strong>
        </div>
        <span className='explorer-header-actions'>
          <IconButton label='全局搜索' onClick={onOpenSearch}>
            <Search size={15} />
          </IconButton>
          <IconButton
            label='新建文件'
            onClick={() => setInlineAction({ kind: 'create-file', parent: state.workspaceRoot })}
          >
            <Plus size={15} />
          </IconButton>
          <IconButton
            label='新建文件夹'
            onClick={() => setInlineAction({ kind: 'create-directory', parent: state.workspaceRoot })}
          >
            <FolderPlus size={15} />
          </IconButton>
          <IconButton
            label='刷新文件'
            disabled={state.directoryLoading[state.workspaceRoot]}
            onClick={() => void actions.refreshDirectory()}
          >
            <RefreshCw className={state.directoryLoading[state.workspaceRoot] ? 'spin' : ''} size={15} />
          </IconButton>
        </span>
      </header>
      <label>
        <Search size={14} />
        <input
          type='search'
          aria-label='筛选文件'
          placeholder='筛选文件'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div
        className='workspace-tree'
        role='tree'
        aria-label='工作区文件树'
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({ entry: null, x: event.clientX, y: event.clientY });
        }}
      >
        <Directory
          directory={state.workspaceRoot}
          query={query}
          depth={0}
          actions={actions}
          inlineAction={inlineAction}
          contextMenuPath={contextMenu?.entry?.path ?? null}
          onInlineAction={updateInlineAction}
          onContextMenu={(entry, x, y) => setContextMenu({ entry, x, y })}
        />
      </div>
      {contextMenu && (
        <WorkspaceContextMenu
          label={contextMenu.entry ? `${contextMenu.entry.name} 操作` : '工作区操作'}
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={closeContextMenu}
        />
      )}
    </aside>
  );
}

function Directory({
  directory,
  query,
  depth,
  actions,
  inlineAction,
  contextMenuPath,
  onInlineAction,
  onContextMenu,
}: {
  directory: string;
  query: string;
  depth: number;
  actions: WorkspaceActions;
  inlineAction: WorkspaceInlineAction | null;
  contextMenuPath: string | null;
  onInlineAction: (action: WorkspaceInlineAction | null) => void;
  onContextMenu: (entry: Readonly<WorkspaceEntry>, x: number, y: number) => void;
}) {
  const state = useSnapshot(appState);
  const activeTab = state.editorTabs.find((tab) => tab.id === state.activeEditorTabId);
  const activePath =
    activeTab?.kind === 'file'
      ? activeTab.path
      : activeTab?.kind === 'diff'
        ? absoluteWorkspacePath(activeTab.path, state.workspaceRoot)
        : null;
  const entries = state.filesByDirectory[directory] ?? [];
  const loading = state.directoryLoading[directory];
  const error = state.directoryErrors[directory];
  const normalizedQuery = query.trim().toLowerCase();
  const hasLoadedMatch = (path: string): boolean =>
    (state.filesByDirectory[path] ?? []).some(
      (entry) => entry.name.toLowerCase().includes(normalizedQuery) || (entry.isDirectory && hasLoadedMatch(entry.path))
    );
  const visible = entries.filter(
    (entry) =>
      !normalizedQuery ||
      entry.name.toLowerCase().includes(normalizedQuery) ||
      (entry.isDirectory && hasLoadedMatch(entry.path))
  );
  const createAction =
    inlineAction &&
    (inlineAction.kind === 'create-file' || inlineAction.kind === 'create-directory') &&
    inlineAction.parent === directory
      ? inlineAction
      : null;
  const content = (
    <>
      {createAction && (
        <WorkspaceInlineEntry
          key={workspaceInlineActionKey(createAction)}
          action={createAction}
          depth={depth}
          actions={actions}
          onComplete={() => onInlineAction(null)}
        />
      )}
      {loading && (
        <output className='directory-state'>
          <LoaderCircle className='spin' size={13} />
          正在读取 {basename(directory)}
        </output>
      )}
      {error && !loading && (
        <div className='directory-state error' role='alert'>
          <span>{error}</span>
          <button type='button' onClick={() => void actions.refreshDirectory(directory)}>
            重试
          </button>
        </div>
      )}
      {visible.map((entry) => {
        const activeInlineEntry =
          inlineAction && 'entry' in inlineAction && inlineAction.entry.path === entry.path ? inlineAction : null;
        if (activeInlineEntry) {
          const dirtyDescendant = state.editorTabs.some(
            (tab) => tab.kind === 'file' && pathInside(entry.path, tab.path) && isFileEditorTabDirty(tab)
          );
          return (
            <WorkspaceInlineEntry
              key={workspaceInlineActionKey(activeInlineEntry)}
              action={activeInlineEntry}
              depth={depth}
              dirtyDescendant={dirtyDescendant}
              actions={actions}
              onComplete={() => onInlineAction(null)}
            />
          );
        }
        const expanded = Boolean(state.expandedDirectories[entry.path]);
        const matchingDescendant = Boolean(normalizedQuery && entry.isDirectory && hasLoadedMatch(entry.path));
        const displayExpanded = expanded || matchingDescendant;
        const relativePath = normalizePath(workspaceRelativePath(entry.path, state.workspaceRoot));
        const gitFile = state.gitStatus?.files.find((file) => normalizePath(file.path) === relativePath);
        const gitDecoration = gitFile ? gitStatusDecoration(gitFile.indexStatus, gitFile.worktreeStatus) : null;
        return (
          <div className='explorer-entry' key={entry.path}>
            <button
              type='button'
              role='treeitem'
              aria-expanded={entry.isDirectory ? displayExpanded : undefined}
              aria-level={depth + 1}
              aria-selected={activePath === entry.path}
              className={`explorer-row ${activePath === entry.path ? 'active' : ''} ${contextMenuPath === entry.path ? 'contextual' : ''}`}
              style={{ paddingLeft: 9 + depth * 14 }}
              onClick={() => {
                if (entry.isDirectory) void actions.toggleDirectory(entry.path);
                else void actions.selectFile(entry);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.focus();
                onContextMenu(entry, event.clientX, event.clientY);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
                event.preventDefault();
                const bounds = event.currentTarget.getBoundingClientRect();
                onContextMenu(entry, bounds.left + Math.min(bounds.width, 180), bounds.bottom);
              }}
            >
              <span>
                {entry.isDirectory ? displayExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
              </span>
              <WorkspaceFileIcon path={entry.path} directory={entry.isDirectory} expanded={displayExpanded} size={14} />
              <strong>{entry.name}</strong>
            </button>
            {gitDecoration && !entry.isDirectory && (
              <span
                className={`explorer-git-decoration ${gitDecoration.tone}`}
                role='img'
                aria-label={gitDecoration.label}
              >
                {gitDecoration.code}
              </span>
            )}
            {entry.isDirectory && displayExpanded && (
              <Directory
                directory={entry.path}
                query={query}
                depth={depth + 1}
                actions={actions}
                inlineAction={inlineAction}
                contextMenuPath={contextMenuPath}
                onInlineAction={onInlineAction}
                onContextMenu={onContextMenu}
              />
            )}
          </div>
        );
      })}
      {!visible.length && !createAction && !loading && !error && <p>{query ? '没有匹配文件' : '目录为空'}</p>}
    </>
  );
  return <div>{content}</div>;
}

function contextMenuItems(
  entry: Readonly<WorkspaceEntry> | null,
  expandedDirectories: Readonly<Record<string, boolean>>,
  actions: WorkspaceActions,
  onInlineAction: (action: WorkspaceInlineAction | null) => void
): WorkspaceContextMenuItem[] {
  if (!entry) {
    return [
      {
        id: 'new-file',
        label: '新建文件',
        icon: <FilePlus2 size={14} />,
        onSelect: () => onInlineAction({ kind: 'create-file', parent: appState.workspaceRoot }),
      },
      {
        id: 'new-directory',
        label: '新建文件夹',
        icon: <FolderPlus size={14} />,
        onSelect: () => onInlineAction({ kind: 'create-directory', parent: appState.workspaceRoot }),
      },
      {
        id: 'refresh',
        label: '刷新资源管理器',
        icon: <RefreshCw size={14} />,
        separatorBefore: true,
        onSelect: () => void actions.refreshDirectory(),
      },
    ];
  }

  const items: WorkspaceContextMenuItem[] = [
    {
      id: 'open',
      label: entry.isDirectory ? (expandedDirectories[entry.path] ? '折叠文件夹' : '展开文件夹') : '打开文件',
      icon: entry.isDirectory ? <FolderOpen size={14} /> : <FileText size={14} />,
      onSelect: () => {
        if (entry.isDirectory) void actions.toggleDirectory(entry.path);
        else void actions.selectFile(entry);
      },
    },
  ];
  if (entry.isDirectory) {
    items.push(
      {
        id: 'new-file',
        label: '新建文件',
        icon: <FilePlus2 size={14} />,
        separatorBefore: true,
        onSelect: () => onInlineAction({ kind: 'create-file', parent: entry.path }),
      },
      {
        id: 'new-directory',
        label: '新建文件夹',
        icon: <FolderPlus size={14} />,
        onSelect: () => onInlineAction({ kind: 'create-directory', parent: entry.path }),
      }
    );
  }
  items.push(
    {
      id: 'rename',
      label: '重命名',
      icon: <Pencil size={14} />,
      separatorBefore: true,
      onSelect: () => onInlineAction({ kind: 'rename', entry }),
    },
    {
      id: 'copy',
      label: '复制',
      icon: <Copy size={14} />,
      onSelect: () => onInlineAction({ kind: 'copy', entry }),
    },
    {
      id: 'delete',
      label: '删除',
      icon: <Trash2 size={14} />,
      danger: true,
      separatorBefore: true,
      onSelect: () => onInlineAction({ kind: 'delete', entry }),
    }
  );
  return items;
}

function basename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function pathInside(parent: string, candidate: string) {
  const normalizedParent = parent.replace(/\\/g, '/').replace(/\/$/, '');
  const normalizedCandidate = candidate.replace(/\\/g, '/');
  const windows = /^[A-Za-z]:\//.test(normalizedParent);
  const base = windows ? normalizedParent.toLowerCase() : normalizedParent;
  const value = windows ? normalizedCandidate.toLowerCase() : normalizedCandidate;
  return value === base || value.startsWith(`${base}/`);
}

function absoluteWorkspacePath(path: string, root: string): string {
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return path;
  const separator = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  return `${root.replace(/[\\/]$/, '')}${separator}${path}`;
}

function gitStatusDecoration(indexStatus: string, worktreeStatus: string) {
  const code = worktreeStatus.trim() || indexStatus.trim();
  switch (code) {
    case 'A':
      return { code, label: 'Git：已添加', tone: 'added' };
    case 'D':
      return { code, label: 'Git：已删除', tone: 'deleted' };
    case 'R':
      return { code, label: 'Git：已重命名', tone: 'renamed' };
    case '?':
      return { code: 'U', label: 'Git：未跟踪', tone: 'untracked' };
    case 'U':
      return { code: '!', label: 'Git：存在冲突', tone: 'conflict' };
    default:
      return { code: 'M', label: 'Git：已修改', tone: 'modified' };
  }
}
