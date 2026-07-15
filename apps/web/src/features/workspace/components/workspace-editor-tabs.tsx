import { FileDiff, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { isFileEditorTabDirty, workspaceRelativePath } from '../workspace-state';
import { WorkspaceFileIcon } from './workspace-file-icon';

export function WorkspaceEditorTabs({ actions }: { actions: WorkspaceActions }) {
  const state = useSnapshot(appState);
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [state.activeEditorTabId]);
  if (!state.editorTabs.length) return null;

  return (
    <div className='workspace-editor-tabs' role='tablist' aria-label='已打开的编辑器'>
      {state.editorTabs.map((tab, index) => {
        const active = tab.id === state.activeEditorTabId;
        const dirty = tab.kind === 'file' && isFileEditorTabDirty(tab);
        const relativePath = workspaceRelativePath(tab.path, state.workspaceRoot);
        const label =
          tab.kind === 'diff'
            ? `${basename(tab.path)} ${tab.staged ? '（已暂存）' : '（工作树）'}`
            : basename(tab.path);
        return (
          <div
            ref={active ? activeRef : undefined}
            className={`workspace-editor-tab ${active ? 'active' : ''} ${dirty ? 'dirty' : ''}`}
            key={tab.id}
            role='tab'
            aria-selected={active}
            aria-controls='workspace-editor-active-panel'
            tabIndex={active ? 0 : -1}
            title={tab.kind === 'diff' ? `${relativePath} · ${tab.staged ? '已暂存差异' : '工作树差异'}` : relativePath}
            onClick={() => actions.activateEditorTab(tab.id)}
            onAuxClick={(event) => {
              if (event.button === 1) actions.closeEditorTab(tab.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                actions.activateEditorTab(tab.id);
              }
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                const next = state.editorTabs[(index + direction + state.editorTabs.length) % state.editorTabs.length];
                actions.activateEditorTab(next.id);
                requestAnimationFrame(() => activeRef.current?.focus());
              }
            }}
          >
            {tab.kind === 'diff' ? (
              <FileDiff className={`workspace-tab-icon ${tab.staged ? 'staged' : 'working'}`} size={14} />
            ) : (
              <WorkspaceFileIcon path={tab.path} size={14} />
            )}
            <span>{label}</span>
            {tab.loading ? (
              <LoaderCircle className='workspace-tab-loading spin' size={12} />
            ) : (
              <button
                type='button'
                className='workspace-tab-close'
                aria-label={`关闭 ${label}${dirty ? '，未保存' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  actions.closeEditorTab(tab.id);
                }}
              >
                <span className='workspace-tab-dirty-dot' aria-hidden='true' />
                <X className='workspace-tab-close-icon' size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}
