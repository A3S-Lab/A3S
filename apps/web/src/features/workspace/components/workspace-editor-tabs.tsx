import { Copy, FileDiff, Files, LoaderCircle, PanelRightClose, X, XCircle } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { appState, showToast } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { isFileEditorTabDirty, type WorkspaceEditorTab, workspaceRelativePath } from '../workspace-state';
import { WorkspaceContextMenu, type WorkspaceContextMenuItem } from './workspace-context-menu';
import { workspaceEditorTabLabels } from './workspace-editor-tab-label';
import { WorkspaceFileIcon } from './workspace-file-icon';

interface TabContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

export function WorkspaceEditorTabs({ actions }: { actions: WorkspaceActions }) {
  const state = useSnapshot(appState);
  const activeRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const requestedFocusIdRef = useRef<string | null>(null);
  const [contextMenu, setContextMenu] = useState<TabContextMenuState | null>(null);

  useLayoutEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const requestedFocusId = requestedFocusIdRef.current;
    if (!requestedFocusId || requestedFocusId !== state.activeEditorTabId) return;
    const target = tabRefs.current.get(requestedFocusId);
    if (!target) return;
    requestedFocusIdRef.current = null;
    target.focus({ preventScroll: true });
  }, [state.activeEditorTabId]);

  if (!state.editorTabs.length) return null;
  const labels = workspaceEditorTabLabels(state.editorTabs, state.workspaceRoot);
  const contextualTab = contextMenu ? state.editorTabs.find((tab) => tab.id === contextMenu.tabId) : undefined;
  const contextualLabel = contextualTab ? labels.get(contextualTab.id) : undefined;

  const activateFromKeyboard = (tabId: string) => {
    requestedFocusIdRef.current = tabId;
    actions.activateEditorTab(tabId);
    const target = tabRefs.current.get(tabId);
    if (!target) return;
    requestedFocusIdRef.current = null;
    target.focus({ preventScroll: true });
  };

  const openContextMenu = (tabId: string, x: number, y: number) => {
    tabRefs.current.get(tabId)?.focus({ preventScroll: true });
    setContextMenu({ tabId, x, y });
  };

  return (
    <>
      <div className='workspace-editor-tabs' role='tablist' aria-label='已打开的编辑器' aria-orientation='horizontal'>
        {state.editorTabs.map((tab, index) => {
          const active = tab.id === state.activeEditorTabId;
          const dirty = tab.kind === 'file' && isFileEditorTabDirty(tab);
          const display = labels.get(tab.id);
          if (!display) return null;
          return (
            <div
              ref={active ? activeRef : undefined}
              className={`workspace-editor-tab ${active ? 'active' : ''} ${dirty ? 'dirty' : ''} ${
                display.detail ? 'disambiguated' : ''
              } ${contextMenu?.tabId === tab.id ? 'contextual' : ''}`}
              key={tab.id}
            >
              <button
                ref={(element) => {
                  if (element) tabRefs.current.set(tab.id, element);
                  else tabRefs.current.delete(tab.id);
                }}
                type='button'
                className='workspace-editor-tab-trigger'
                role='tab'
                aria-label={`${display.ariaLabel}${dirty ? '，未保存' : ''}`}
                aria-selected={active}
                aria-controls='workspace-editor-active-panel'
                aria-haspopup='menu'
                tabIndex={active ? 0 : -1}
                title={display.title}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openContextMenu(tab.id, event.clientX, event.clientY);
                }}
                onClick={() => actions.activateEditorTab(tab.id)}
                onAuxClick={(event) => {
                  if (event.button === 1) actions.closeEditorTab(tab.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                    event.preventDefault();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    openContextMenu(tab.id, bounds.left + Math.min(bounds.width, 160), bounds.bottom);
                    return;
                  }
                  let targetIndex: number | null = null;
                  if (event.key === 'ArrowLeft') targetIndex = index - 1;
                  if (event.key === 'ArrowRight') targetIndex = index + 1;
                  if (event.key === 'Home') targetIndex = 0;
                  if (event.key === 'End') targetIndex = state.editorTabs.length - 1;
                  if (targetIndex !== null) {
                    event.preventDefault();
                    const next = state.editorTabs[(targetIndex + state.editorTabs.length) % state.editorTabs.length];
                    activateFromKeyboard(next.id);
                    return;
                  }
                  if (event.key === 'Delete') {
                    event.preventDefault();
                    actions.closeEditorTab(tab.id);
                  }
                }}
              >
                {tab.kind === 'diff' ? (
                  <FileDiff className={`workspace-tab-icon ${tab.staged ? 'staged' : 'working'}`} size={14} />
                ) : (
                  <WorkspaceFileIcon path={tab.path} size={14} />
                )}
                <span className='workspace-tab-label'>
                  <span className='workspace-tab-name'>{display.name}</span>
                  {display.detail && <small className='workspace-tab-detail'>{display.detail}</small>}
                </span>
              </button>
              {tab.loading ? (
                <LoaderCircle className='workspace-tab-loading spin' size={12} />
              ) : (
                <button
                  type='button'
                  className='workspace-tab-close'
                  aria-label={`关闭 ${display.ariaLabel}${dirty ? '，未保存' : ''}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => actions.closeEditorTab(tab.id)}
                >
                  <span className='workspace-tab-dirty-dot' aria-hidden='true' />
                  <X className='workspace-tab-close-icon' size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {contextMenu && contextualTab && (
        <WorkspaceContextMenu
          label={`${contextualLabel?.ariaLabel ?? basename(contextualTab.path)} 标签页操作`}
          x={contextMenu.x}
          y={contextMenu.y}
          items={tabContextMenuItems(
            contextualTab as WorkspaceEditorTab,
            state.editorTabs as readonly WorkspaceEditorTab[],
            state.workspaceRoot,
            actions
          )}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

function tabContextMenuItems(
  tab: WorkspaceEditorTab,
  tabs: readonly WorkspaceEditorTab[],
  workspaceRoot: string,
  actions: WorkspaceActions
): WorkspaceContextMenuItem[] {
  const index = tabs.findIndex((candidate) => candidate.id === tab.id);
  const otherIds = tabs.filter((candidate) => candidate.id !== tab.id).map((candidate) => candidate.id);
  const rightIds = tabs.slice(index + 1).map((candidate) => candidate.id);
  const relativePath = workspaceRelativePath(tab.path, workspaceRoot);
  const absolutePath = absoluteWorkspacePath(tab.path, workspaceRoot);
  return [
    {
      id: 'close',
      label: '关闭',
      icon: <X size={14} />,
      onSelect: () => actions.closeEditorTabs([tab.id]),
    },
    {
      id: 'close-others',
      label: '关闭其他标签页',
      icon: <Files size={14} />,
      disabled: otherIds.length === 0,
      onSelect: () => actions.closeEditorTabs(otherIds),
    },
    {
      id: 'close-right',
      label: '关闭右侧标签页',
      icon: <PanelRightClose size={14} />,
      disabled: rightIds.length === 0,
      onSelect: () => actions.closeEditorTabs(rightIds),
    },
    {
      id: 'close-all',
      label: '关闭全部标签页',
      icon: <XCircle size={14} />,
      onSelect: () => actions.closeEditorTabs(tabs.map((candidate) => candidate.id)),
    },
    {
      id: 'copy-path',
      label: '复制路径',
      icon: <Copy size={14} />,
      separatorBefore: true,
      onSelect: () => void copyPath(absolutePath),
    },
    {
      id: 'copy-relative-path',
      label: '复制相对路径',
      icon: <Copy size={14} />,
      onSelect: () => void copyPath(relativePath),
    },
  ];
}

async function copyPath(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
    showToast('路径已复制', 'success');
  } catch {
    showToast('无法复制路径', 'error');
  }
}

function absoluteWorkspacePath(path: string, root: string): string {
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return path;
  const separator = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  return `${root.replace(/[\\/]$/, '')}${separator}${path}`;
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}
