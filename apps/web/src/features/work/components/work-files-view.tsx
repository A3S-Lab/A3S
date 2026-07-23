import {
  Copy,
  Eye,
  FileInput,
  FileText,
  FolderOpen,
  FolderPlus,
  MessageSquareText,
  Pencil,
  Presentation,
  Sheet,
  Sparkles,
  Star,
  Tags,
  TextSearch,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, StateView } from '../../../design-system/primitives';
import { showToast } from '../../../state/app-state';
import type { WorkspaceEntry } from '../../../types/api';
import { WorkspaceContextMenu, type WorkspaceContextMenuItem } from '../../workspace/components/workspace-context-menu';
import { hasDraggedWorkspaceFiles } from '../../workspace/workspace-drop-import';
import type { WorkFilesActions } from '../use-work-files-controller';
import type { WorkAgentRequest } from '../work-agent-request';
import {
  canMoveLocalPaths,
  formatWorkFileDate,
  formatWorkFileSize,
  isWorkOpenableEntry,
  localPathBasename,
  localPathParent,
  readWorkLocalFileDragData,
  relativeLocalPath,
  sameLocalPath,
  workFileKindLabel,
  writeWorkLocalFileDragData,
} from '../work-local-files';
import { WorkFileIcon } from './work-file-icon';
import { type WorkFileOperation, WorkFileOperationDialog } from './work-file-operation-dialog';

interface ContextMenuState {
  entry: WorkspaceEntry | null;
  x: number;
  y: number;
}

export function WorkFilesView({
  actions,
  openingPath,
  createFolderRequest,
  onOpenFile,
  onQuickLook,
  onAgentRequest,
  onCreateArtifact,
}: {
  actions: WorkFilesActions;
  openingPath: string | null;
  createFolderRequest: number;
  onOpenFile: (entry: WorkspaceEntry) => void | Promise<void>;
  onQuickLook: (entry: WorkspaceEntry) => void;
  onAgentRequest: (request: WorkAgentRequest) => void | Promise<void>;
  onCreateArtifact?: (templateId: string) => void;
}) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [operation, setOperation] = useState<WorkFileOperation | null>(null);
  const [draggedPaths, setDraggedPaths] = useState<string[]>([]);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [externalDropTargetPath, setExternalDropTargetPath] = useState<string | null>(null);
  const workspaceSearching = actions.searchScope === 'workspace' && Boolean(actions.query.trim());
  useEffect(() => {
    if (createFolderRequest > 0) setOperation({ kind: 'create-folder' });
  }, [createFolderRequest]);
  const selectedCount = actions.selectedPaths.size;
  const openEntry = (entry: WorkspaceEntry) => {
    if (entry.isDirectory) {
      actions.navigateTo(entry.path);
      return;
    }
    if (!isWorkOpenableEntry(entry)) {
      showToast('这个文件暂不能直接编辑，可以交给 AI 助手处理。', 'info');
      return;
    }
    void onOpenFile(entry);
  };
  const selectedPathsFor = (entry: WorkspaceEntry): string[] =>
    actions.selectedPaths.has(entry.path) ? actions.selectedEntries.map((item) => item.path) : [entry.path];
  const selectedEntriesFor = (entry: WorkspaceEntry): WorkspaceEntry[] =>
    actions.selectedPaths.has(entry.path) ? actions.selectedEntries : [entry];
  const contextItems = contextMenuItems({
    entry: contextMenu?.entry ?? null,
    currentPath: actions.currentPath,
    selectedPaths: contextMenu?.entry ? selectedPathsFor(contextMenu.entry) : [],
    selectedEntries: contextMenu?.entry ? selectedEntriesFor(contextMenu.entry) : [],
    onOpen: openEntry,
    onQuickLook,
    onOperation: setOperation,
    favoritePaths: actions.favoritePaths,
    onToggleFavorite: actions.toggleFavoritePath,
    onAgentRequest,
    onCreateArtifact,
  });

  return (
    <>
      <div
        className={`work-files-content ${actions.layout} ${workspaceSearching ? 'workspace-search' : ''} ${externalDropTargetPath === actions.currentPath ? 'external-drop-target' : ''}`}
        role='listbox'
        aria-label='本地文件'
        aria-multiselectable='true'
        aria-busy={actions.dropImporting || actions.searchLoading}
        tabIndex={0}
        onClick={(event) => {
          if (event.target === event.currentTarget) actions.clearSelection();
        }}
        onContextMenu={(event) => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          setContextMenu({ entry: null, x: event.clientX, y: event.clientY });
        }}
        onDragOver={(event) => {
          if (!hasDraggedWorkspaceFiles(event.dataTransfer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = actions.dropImporting ? 'none' : 'copy';
          setExternalDropTargetPath(actions.currentPath);
        }}
        onDragLeave={(event) => {
          const related = event.relatedTarget;
          if (!(related instanceof Node) || !event.currentTarget.contains(related)) setExternalDropTargetPath(null);
        }}
        onDrop={(event) => {
          if (!hasDraggedWorkspaceFiles(event.dataTransfer)) return;
          event.preventDefault();
          event.stopPropagation();
          setExternalDropTargetPath(null);
          if (actions.dropImporting) return;
          void Promise.resolve(actions.importDroppedItems(event.dataTransfer, actions.currentPath)).catch(
            () => undefined
          );
        }}
        onKeyDown={(event) => {
          const commandKey = event.metaKey || event.ctrlKey;
          if (commandKey && event.key === 'ArrowUp') {
            event.preventDefault();
            actions.goUp();
          } else if (commandKey && event.key === 'ArrowDown' && actions.selectedEntries.length === 1) {
            event.preventDefault();
            openEntry(actions.selectedEntries[0]);
          } else if (commandKey && event.key.toLocaleLowerCase() === 'a') {
            event.preventDefault();
            actions.selectAll();
          } else if (event.key === 'Enter' && actions.selectedEntries.length === 1) {
            event.preventDefault();
            openEntry(actions.selectedEntries[0]);
          } else if (event.key === ' ' && actions.selectedEntries.length === 1) {
            event.preventDefault();
            onQuickLook(actions.selectedEntries[0]);
          } else if (event.key === 'F2' && actions.selectedEntries.length === 1) {
            event.preventDefault();
            setOperation({ kind: 'rename', entry: actions.selectedEntries[0] });
          } else if (
            actions.selectedEntries.length > 0 &&
            (event.key === 'Delete' || (commandKey && event.key === 'Backspace'))
          ) {
            event.preventDefault();
            setOperation({ kind: 'delete', entries: actions.selectedEntries });
          } else if (event.key === 'Escape') {
            actions.clearSelection();
          } else {
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-work-file-index]'));
            const nextIndex = finderKeyboardTargetIndex(
              event.key,
              actions.layout,
              actions.visibleEntries.findIndex((entry) => sameLocalPath(entry.path, actions.selectionFocusPath ?? '')),
              items
            );
            if (nextIndex !== null) {
              event.preventDefault();
              const entry = actions.visibleEntries[nextIndex];
              actions.selectEntry(entry, { range: event.shiftKey });
              items[nextIndex]?.focus();
              items[nextIndex]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
            }
          }
        }}
      >
        {actions.layout === 'list' && actions.visibleEntries.length > 0 && (
          <div className='work-files-list-header' aria-hidden='true'>
            <span>名称</span>
            <span>{workspaceSearching ? '位置' : '修改日期'}</span>
            <span>大小</span>
            <span>种类</span>
          </div>
        )}
        <div className={`work-files-items ${actions.layout}`}>
          {actions.visibleEntries.map((entry, index) => {
            const entryDragPaths = actions.selectedPaths.has(entry.path)
              ? actions.selectedEntries.map((item) => item.path)
              : [entry.path];
            const moving = actions.operationPaths.has(entry.path);
            return (
              <button
                type='button'
                role='option'
                data-work-file-index={index}
                aria-selected={actions.selectedPaths.has(entry.path)}
                aria-label={`${entry.name}，${workFileKindLabel(entry)}`}
                className={`work-file-item ${actions.selectedPaths.has(entry.path) ? 'selected' : ''} ${draggedPaths.some((path) => sameLocalPath(path, entry.path)) ? 'dragging' : ''} ${dropTargetPath === entry.path ? 'drop-target' : ''} ${externalDropTargetPath === entry.path ? 'external-drop-target' : ''}`}
                disabled={openingPath === entry.path || moving}
                draggable={openingPath !== entry.path && !moving}
                key={entry.path}
                onClick={(event) =>
                  actions.selectEntry(entry, {
                    toggle: event.metaKey || event.ctrlKey,
                    range: event.shiftKey,
                  })
                }
                onDoubleClick={() => openEntry(entry)}
                onDragStart={(event) => {
                  if (!actions.selectedPaths.has(entry.path)) actions.selectEntry(entry);
                  writeWorkLocalFileDragData(event.dataTransfer, entryDragPaths);
                  setDraggedPaths(entryDragPaths);
                }}
                onDragEnd={() => {
                  setDraggedPaths([]);
                  setDropTargetPath(null);
                  setExternalDropTargetPath(null);
                }}
                onDragOver={(event) => {
                  if (!entry.isDirectory) return;
                  if (hasDraggedWorkspaceFiles(event.dataTransfer)) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = actions.dropImporting ? 'none' : 'copy';
                    setDropTargetPath(null);
                    setExternalDropTargetPath(entry.path);
                    return;
                  }
                  const paths = draggedPaths.length ? draggedPaths : readWorkLocalFileDragData(event.dataTransfer);
                  if (!canMoveLocalPaths(paths, entry.path)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setExternalDropTargetPath(null);
                  setDropTargetPath(entry.path);
                }}
                onDragLeave={(event) => {
                  const related = event.relatedTarget;
                  if (!(related instanceof Node) || !event.currentTarget.contains(related)) {
                    setDropTargetPath(null);
                    setExternalDropTargetPath(null);
                  }
                }}
                onDrop={(event) => {
                  if (!entry.isDirectory) return;
                  if (hasDraggedWorkspaceFiles(event.dataTransfer)) {
                    event.preventDefault();
                    event.stopPropagation();
                    setDraggedPaths([]);
                    setDropTargetPath(null);
                    setExternalDropTargetPath(null);
                    if (actions.dropImporting) return;
                    void Promise.resolve(actions.importDroppedItems(event.dataTransfer, entry.path)).catch(
                      () => undefined
                    );
                    return;
                  }
                  const paths = readWorkLocalFileDragData(event.dataTransfer);
                  if (!canMoveLocalPaths(paths, entry.path)) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setDraggedPaths([]);
                  setDropTargetPath(null);
                  void Promise.resolve(actions.moveEntries(paths, entry.path)).catch(() => undefined);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!actions.selectedPaths.has(entry.path)) actions.selectEntry(entry);
                  event.currentTarget.focus();
                  setContextMenu({ entry, x: event.clientX, y: event.clientY });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'F2') {
                    event.preventDefault();
                    setOperation({ kind: 'rename', entry });
                  } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                    event.preventDefault();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    setContextMenu({ entry, x: bounds.left + Math.min(bounds.width, 180), y: bounds.bottom });
                  }
                }}
              >
                <span className='work-file-visual'>
                  <WorkFileIcon
                    path={entry.path}
                    directory={entry.isDirectory}
                    size={actions.layout === 'grid' ? 42 : 18}
                  />
                  {openingPath === entry.path && <span className='work-file-opening-spinner' aria-hidden='true' />}
                </span>
                <strong title={entry.name}>{entry.name}</strong>
                <span
                  className='work-file-modified'
                  title={workspaceSearching ? localPathParent(entry.path) : undefined}
                >
                  {workspaceSearching
                    ? relativeLocalPath(localPathParent(entry.path), actions.rootPath) ||
                      localPathBasename(actions.rootPath)
                    : formatWorkFileDate(entry.mtimeMs)}
                </span>
                <span className='work-file-size'>{formatWorkFileSize(entry.size, entry.isDirectory)}</span>
                <span className='work-file-kind'>{workFileKindLabel(entry)}</span>
              </button>
            );
          })}
        </div>
        {!actions.visibleEntries.length &&
          !actions.loading &&
          !actions.searchLoading &&
          !actions.error &&
          !actions.searchError && (
            <StateView
              className='work-files-empty-state'
              size='compact'
              icon={<FolderOpen size={24} />}
              title={actions.query ? '没有匹配的文件' : '这个文件夹是空的'}
              description={actions.query ? '尝试缩短搜索词。' : '你可以直接在这里创建第一个文件夹。'}
              actions={
                !actions.query && (
                  <Button tone='primary' onClick={() => setOperation({ kind: 'create-folder' })}>
                    <FolderPlus size={14} />
                    新建文件夹
                  </Button>
                )
              }
            />
          )}
        {externalDropTargetPath === actions.currentPath && (
          <output className='work-files-drop-hint'>
            <span>
              <Upload size={20} />
            </span>
            <strong>{actions.dropImporting ? '正在复制拖入项目…' : '松开放入当前文件夹'}</strong>
            <small>文件夹会连同其中的内容一起复制</small>
          </output>
        )}
      </div>
      <footer className='work-files-status'>
        <span>
          {selectedCount > 0
            ? `已选择 ${selectedCount} 项`
            : workspaceSearching
              ? `在“${localPathBasename(actions.rootPath)}”中找到 ${actions.visibleEntries.length} 项${actions.searchTruncated ? ' · 部分结果' : ''}`
              : `${actions.visibleEntries.length} 项${actions.query ? ` · 搜索“${actions.query}”` : ''}`}
        </span>
        {actions.selectedEntries.length === 1 && (
          <span>
            {workFileKindLabel(actions.selectedEntries[0])} ·{' '}
            {formatWorkFileSize(actions.selectedEntries[0].size, actions.selectedEntries[0].isDirectory)}
          </span>
        )}
      </footer>
      {contextMenu && (
        <WorkspaceContextMenu
          label={contextMenu.entry ? `${contextMenu.entry.name} 操作` : '当前文件夹操作'}
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}
      {operation && (
        <WorkFileOperationDialog operation={operation} actions={actions} onClose={() => setOperation(null)} />
      )}
    </>
  );
}

function contextMenuItems({
  entry,
  currentPath,
  selectedPaths,
  selectedEntries,
  onOpen,
  onQuickLook,
  onOperation,
  favoritePaths,
  onToggleFavorite,
  onAgentRequest,
  onCreateArtifact,
}: {
  entry: WorkspaceEntry | null;
  currentPath: string;
  selectedPaths: string[];
  selectedEntries: WorkspaceEntry[];
  onOpen: (entry: WorkspaceEntry) => void;
  onQuickLook: (entry: WorkspaceEntry) => void;
  onOperation: (operation: WorkFileOperation) => void;
  favoritePaths: string[];
  onToggleFavorite: (path: string) => void;
  onAgentRequest: (request: WorkAgentRequest) => void | Promise<void>;
  onCreateArtifact?: (templateId: string) => void;
}): WorkspaceContextMenuItem[] {
  if (!entry) {
    const items: WorkspaceContextMenuItem[] = [
      {
        id: 'new-folder',
        label: '新建文件夹',
        icon: <FolderPlus size={14} />,
        onSelect: () => onOperation({ kind: 'create-folder' }),
      },
    ];
    if (onCreateArtifact) {
      items.push(
        {
          id: 'new-document',
          label: '新建文字文档',
          icon: <FileText size={14} />,
          onSelect: () => onCreateArtifact('blank-document'),
        },
        {
          id: 'new-spreadsheet',
          label: '新建电子表格',
          icon: <Sheet size={14} />,
          onSelect: () => onCreateArtifact('blank-spreadsheet'),
        },
        {
          id: 'new-presentation',
          label: '新建演示文稿',
          icon: <Presentation size={14} />,
          onSelect: () => onCreateArtifact('blank-presentation'),
        }
      );
    }
    items.push({
      id: 'organize',
      label: '用 AI 助手整理当前文件夹',
      icon: <Sparkles size={14} />,
      separatorBefore: true,
      onSelect: () =>
        void onAgentRequest({
          workspaceRoot: '',
          paths: [currentPath],
          instruction:
            '请分析当前文件夹的内容和结构，提出一份清晰、可执行的整理方案。先只给出建议，不要移动、重命名或删除任何文件，除非我明确确认。',
        }),
    });
    return items;
  }

  const items: WorkspaceContextMenuItem[] = [
    {
      id: 'open',
      label: entry.isDirectory ? '打开文件夹' : '打开',
      icon: entry.isDirectory ? <FolderOpen size={14} /> : <FileInput size={14} />,
      disabled: !isWorkOpenableEntry(entry),
      onSelect: () => onOpen(entry),
    },
    {
      id: 'quick-look',
      label: '快速查看',
      icon: <Eye size={14} />,
      shortcut: '空格',
      ariaKeyShortcut: 'Space',
      onSelect: () => onQuickLook(entry),
    },
    {
      id: 'ask',
      label: '询问 AI 助手',
      icon: <MessageSquareText size={14} />,
      separatorBefore: true,
      onSelect: () =>
        void onAgentRequest({
          workspaceRoot: '',
          paths: selectedPaths,
          instruction: '请查看已选文件或文件夹，并围绕它们回答我的问题：\n\n问题：',
        }),
    },
  ];
  if (entry.isDirectory) {
    const favorite = favoritePaths.some((path) => sameLocalPath(path, entry.path));
    items.push(
      {
        id: 'favorite',
        label: favorite ? '从侧边栏移除' : '添加到侧边栏',
        icon: <Star size={14} fill={favorite ? 'currentColor' : 'none'} />,
        onSelect: () => onToggleFavorite(entry.path),
      },
      {
        id: 'organize',
        label: selectedPaths.length > 1 ? '用 AI 助手整理所选文件夹' : '用 AI 助手整理文件夹',
        icon: <Sparkles size={14} />,
        onSelect: () =>
          void onAgentRequest({
            workspaceRoot: '',
            paths: selectedPaths,
            instruction:
              '请分析已选文件夹的内容和结构，提出一份清晰、可执行的整理方案。先只给出建议，不要移动、重命名或删除任何文件，除非我明确确认。',
          }),
      }
    );
  } else {
    items.push(
      {
        id: 'summarize',
        label: selectedPaths.length > 1 ? '总结所选文件' : '总结文件',
        icon: <TextSearch size={14} />,
        onSelect: () =>
          void onAgentRequest({
            workspaceRoot: '',
            paths: selectedPaths,
            instruction: '请总结已选文件的核心内容、关键结论和需要注意的事项。先生成摘要，不要修改文件。',
          }),
      },
      {
        id: 'suggest-name',
        label: selectedPaths.length > 1 ? '建议更清晰的文件名' : '建议更清晰的文件名',
        icon: <Tags size={14} />,
        onSelect: () =>
          void onAgentRequest({
            workspaceRoot: '',
            paths: selectedPaths,
            instruction:
              '请根据已选文件的内容建议更清晰、易检索的文件名，并简要说明命名理由。先只给出建议，不要执行重命名。',
          }),
      }
    );
  }
  items.push(
    {
      id: 'rename',
      label: '重命名',
      icon: <Pencil size={14} />,
      shortcut: 'F2',
      ariaKeyShortcut: 'F2',
      separatorBefore: true,
      onSelect: () => onOperation({ kind: 'rename', entry }),
    },
    {
      id: 'duplicate',
      label: '创建副本',
      icon: <Copy size={14} />,
      onSelect: () => onOperation({ kind: 'duplicate', entry }),
    },
    {
      id: 'delete',
      label: selectedEntries.length > 1 ? `永久删除 ${selectedEntries.length} 项` : '永久删除',
      icon: <Trash2 size={14} />,
      shortcut: 'Delete',
      ariaKeyShortcut: 'Delete',
      separatorBefore: true,
      onSelect: () => onOperation({ kind: 'delete', entries: selectedEntries }),
    }
  );
  return items;
}

function finderKeyboardTargetIndex(
  key: string,
  layout: WorkFilesActions['layout'],
  currentIndex: number,
  items: HTMLButtonElement[]
): number | null {
  if (!items.length) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return items.length - 1;
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return null;
  if (layout === 'list' && (key === 'ArrowLeft' || key === 'ArrowRight')) return null;
  if (currentIndex < 0) return key === 'ArrowUp' || key === 'ArrowLeft' ? items.length - 1 : 0;
  const columns = layout === 'grid' ? finderGridColumnCount(items) : 1;
  const offset = key === 'ArrowUp' ? -columns : key === 'ArrowDown' ? columns : key === 'ArrowLeft' ? -1 : 1;
  return Math.max(0, Math.min(items.length - 1, currentIndex + offset));
}

function finderGridColumnCount(items: HTMLButtonElement[]): number {
  const firstTop = items[0]?.getBoundingClientRect().top;
  if (firstTop === undefined) return 1;
  const nextRow = items.findIndex((item, index) => index > 0 && item.getBoundingClientRect().top > firstTop + 1);
  return nextRow > 0 ? nextRow : 1;
}
