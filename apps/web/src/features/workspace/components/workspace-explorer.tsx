import {
  ChevronDown,
  ChevronRight,
  Copy,
  FilePlus2,
  FileSearch,
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
import { useLayoutEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, CollectionState, IconButton, SearchField } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { WorkspaceEntry } from '../../../types/api';
import type { WorkspaceActions } from '../workspace-actions';
import { isFileEditorTabDirty, normalizePath, workspaceRelativePath } from '../workspace-state';
import { WorkspaceContextMenu, type WorkspaceContextMenuItem } from './workspace-context-menu';
import { WorkspaceFileIcon } from './workspace-file-icon';
import { type WorkspaceInlineAction, WorkspaceInlineEntry, workspaceInlineActionKey } from './workspace-inline-entry';
import { type ExplorerTreeProjection, useWorkspaceExplorerTree } from './use-workspace-explorer-tree';

interface ContextMenuState {
  entry: Readonly<WorkspaceEntry> | null;
  x: number;
  y: number;
}

interface InlineFocusOrigin {
  element: HTMLElement | null;
  path: string | null;
  index: number;
}

export function WorkspaceExplorer({ actions, onOpenSearch }: { actions: WorkspaceActions; onOpenSearch: () => void }) {
  const state = useSnapshot(appState);
  const [query, setQuery] = useState('');
  const [restoreInlineFocus, setRestoreInlineFocus] = useState(false);
  const [inlineAction, setInlineAction] = useState<WorkspaceInlineAction | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const inlineFocusOriginRef = useRef<InlineFocusOrigin | null>(null);
  const activeTab = state.editorTabs.find((tab) => tab.id === state.activeEditorTabId);
  const activePath =
    activeTab?.kind === 'file'
      ? activeTab.path
      : activeTab?.kind === 'diff'
        ? absoluteWorkspacePath(activeTab.path, state.workspaceRoot)
        : null;
  const { tree, rovingPath, setFocusedPath, registerItem, focusItem, handleKeyDown } = useWorkspaceExplorerTree({
    root: state.workspaceRoot,
    filesByDirectory: state.filesByDirectory,
    expandedDirectories: state.expandedDirectories,
    query,
    activePath,
    toggleDirectory: actions.toggleDirectory,
  });
  const closeContextMenu = () => setContextMenu(null);
  const updateInlineAction = (action: WorkspaceInlineAction | null) => {
    closeContextMenu();
    if (action) {
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const returnElement = activeElement?.closest('.workspace-context-menu') ? null : activeElement;
      const path = 'entry' in action ? action.entry.path : rovingPath;
      inlineFocusOriginRef.current = {
        element: returnElement,
        path,
        index: path ? (tree.itemByPath.get(path)?.index ?? -1) : -1,
      };
      if (path) setFocusedPath(path);
      setRestoreInlineFocus(false);
    } else if (inlineFocusOriginRef.current) {
      setRestoreInlineFocus(true);
    }
    setInlineAction(action);
  };
  useLayoutEffect(() => {
    if (!restoreInlineFocus || inlineAction) return;
    const origin = inlineFocusOriginRef.current;
    const fallbackIndex = Math.min(Math.max(origin?.index ?? 0, 0), Math.max(tree.items.length - 1, 0));
    const fallbackPath =
      (origin?.path && tree.itemByPath.has(origin.path) ? origin.path : null) ??
      (activePath && tree.itemByPath.has(activePath) ? activePath : null) ??
      tree.items[fallbackIndex]?.entry.path ??
      null;
    if (origin?.element?.isConnected) {
      origin.element.focus({ preventScroll: true });
      origin.element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    } else if (fallbackPath) {
      focusItem(fallbackPath);
    }
    inlineFocusOriginRef.current = null;
    setRestoreInlineFocus(false);
  }, [activePath, focusItem, inlineAction, restoreInlineFocus, tree]);
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
          <IconButton
            label='快速打开文件'
            onClick={() => {
              appState.fileQuickOpenOpen = true;
            }}
          >
            <FileSearch size={15} />
          </IconButton>
          <IconButton label='全局搜索' onClick={onOpenSearch}>
            <Search size={15} />
          </IconButton>
          <IconButton
            label='新建文件'
            onClick={() => updateInlineAction({ kind: 'create-file', parent: state.workspaceRoot })}
          >
            <Plus size={15} />
          </IconButton>
          <IconButton
            label='新建文件夹'
            onClick={() => updateInlineAction({ kind: 'create-directory', parent: state.workspaceRoot })}
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
      <SearchField
        className='workspace-explorer-filter'
        size='compact'
        label='筛选文件'
        clearLabel='清除文件筛选'
        placeholder='筛选文件'
        value={query}
        onValueChange={setQuery}
      />
      <div
        className='workspace-tree'
        role='tree'
        aria-label='工作区文件树'
        aria-orientation='vertical'
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({ entry: null, x: event.clientX, y: event.clientY });
        }}
      >
        <Directory
          directory={state.workspaceRoot}
          query={query}
          depth={0}
          tree={tree}
          activePath={activePath}
          rovingPath={rovingPath}
          actions={actions}
          inlineAction={inlineAction}
          contextMenuPath={contextMenu?.entry?.path ?? null}
          onInlineAction={updateInlineAction}
          onContextMenu={(entry, x, y) => setContextMenu({ entry, x, y })}
          onEntryFocus={setFocusedPath}
          onEntryRef={registerItem}
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
  tree,
  activePath,
  rovingPath,
  actions,
  inlineAction,
  contextMenuPath,
  onInlineAction,
  onContextMenu,
  onEntryFocus,
  onEntryRef,
}: {
  directory: string;
  query: string;
  depth: number;
  tree: ExplorerTreeProjection;
  activePath: string | null;
  rovingPath: string | null;
  actions: WorkspaceActions;
  inlineAction: WorkspaceInlineAction | null;
  contextMenuPath: string | null;
  onInlineAction: (action: WorkspaceInlineAction | null) => void;
  onContextMenu: (entry: Readonly<WorkspaceEntry>, x: number, y: number) => void;
  onEntryFocus: (path: string) => void;
  onEntryRef: (path: string, element: HTMLButtonElement | null) => void;
}) {
  const state = useSnapshot(appState);
  const entries = state.filesByDirectory[directory] ?? [];
  const loading = state.directoryLoading[directory];
  const error = state.directoryErrors[directory];
  const visible = entries.filter((entry) => tree.visiblePaths.has(entry.path));
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
        <CollectionState className='directory-state' role='status' icon={<LoaderCircle className='spin' size={13} />}>
          正在读取 {basename(directory)}
        </CollectionState>
      )}
      {error && !loading && (
        <CollectionState
          className='directory-state'
          tone='danger'
          role='alert'
          actions={
            <Button tone='quiet' onClick={() => void actions.refreshDirectory(directory)}>
              重试
            </Button>
          }
        >
          {error}
        </CollectionState>
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
        const displayExpanded = tree.displayExpandedPaths.has(entry.path);
        const relativePath = normalizePath(workspaceRelativePath(entry.path, state.workspaceRoot));
        const gitFile = state.gitStatus?.files.find((file) => normalizePath(file.path) === relativePath);
        const gitDecoration = gitFile ? gitStatusDecoration(gitFile.indexStatus, gitFile.worktreeStatus) : null;
        return (
          <div className='explorer-entry' key={entry.path}>
            <button
              ref={(element) => onEntryRef(entry.path, element)}
              type='button'
              role='treeitem'
              data-explorer-path={entry.path}
              aria-expanded={entry.isDirectory ? displayExpanded : undefined}
              aria-level={depth + 1}
              aria-selected={activePath === entry.path}
              tabIndex={rovingPath === entry.path ? 0 : -1}
              className={`explorer-row ${activePath === entry.path ? 'active' : ''} ${contextMenuPath === entry.path ? 'contextual' : ''}`}
              style={{ paddingLeft: 9 + depth * 14 }}
              onClick={() => {
                if (entry.isDirectory) void actions.toggleDirectory(entry.path);
                else void actions.selectFile(entry);
              }}
              onFocus={() => onEntryFocus(entry.path)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.focus();
                onContextMenu(entry, event.clientX, event.clientY);
              }}
              onKeyDown={(event) => {
                if (event.key === 'F2') {
                  event.preventDefault();
                  onInlineAction({ kind: 'rename', entry });
                  return;
                }
                if (event.key === 'Delete') {
                  event.preventDefault();
                  onInlineAction({ kind: 'delete', entry });
                  return;
                }
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
                tree={tree}
                activePath={activePath}
                rovingPath={rovingPath}
                actions={actions}
                inlineAction={inlineAction}
                contextMenuPath={contextMenuPath}
                onInlineAction={onInlineAction}
                onContextMenu={onContextMenu}
                onEntryFocus={onEntryFocus}
                onEntryRef={onEntryRef}
              />
            )}
          </div>
        );
      })}
      {!visible.length && !createAction && !loading && !error && (
        <CollectionState className='directory-empty' role='status'>
          {query ? '没有匹配文件' : '目录为空'}
        </CollectionState>
      )}
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
      ariaLabel: '重命名',
      icon: <Pencil size={14} />,
      shortcut: 'F2',
      ariaKeyShortcut: 'F2',
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
      ariaLabel: '删除',
      icon: <Trash2 size={14} />,
      shortcut: 'Delete',
      ariaKeyShortcut: 'Delete',
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
