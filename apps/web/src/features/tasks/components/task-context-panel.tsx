import { Files, GitBranch, History, PanelRightClose } from 'lucide-react';
import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { CodeActions } from '../../code/use-code-controller';
import type { TaskView } from '../../code/code-state';
import { Button, IconButton } from '../../../design-system/primitives';
import { navigateTask } from '../../../state/app-state';
import { WorkspacePage } from '../../code/pages/workspace-page';
import { RunsPage } from '../../runs/pages/runs-page';

const panelWidthKey = 'a3s-code-web.task-context-width';
const defaultPanelWidth = 640;
const minPanelWidth = 560;
const maxPanelWidth = 1100;

function clampPanelWidth(width: number) {
  return Math.min(maxPanelWidth, Math.max(minPanelWidth, Math.round(width)));
}

function readPanelWidth() {
  try {
    const width = Number(localStorage.getItem(panelWidthKey));
    return Number.isFinite(width) && width > 0 ? clampPanelWidth(width) : defaultPanelWidth;
  } catch {
    return defaultPanelWidth;
  }
}

export function TaskContextPanel({ view, actions }: { view: Exclude<TaskView, 'conversation'>; actions: CodeActions }) {
  const [width, setWidth] = useState(readPanelWidth);
  const [changesOpen, setChangesOpen] = useState(false);
  const updateWidth = (next: number, persist = false) => {
    const normalized = clampPanelWidth(next);
    setWidth(normalized);
    if (!persist) return;
    try {
      localStorage.setItem(panelWidthKey, String(normalized));
    } catch {
      // Resizing remains available when local persistence is unavailable.
    }
  };
  const resizeFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateWidth(window.innerWidth - event.clientX);
  };
  return (
    <aside
      className='task-context-panel'
      aria-label={view === 'review' ? '任务工作区' : '任务活动面板'}
      style={{ '--task-context-width': `${width}px` } as CSSProperties}
    >
      <hr
        className='task-context-resizer'
        aria-label='调整任务工作区宽度'
        aria-orientation='vertical'
        aria-valuemin={minPanelWidth}
        aria-valuemax={maxPanelWidth}
        aria-valuenow={width}
        tabIndex={0}
        onDoubleClick={() => updateWidth(defaultPanelWidth, true)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          updateWidth(width + (event.key === 'ArrowLeft' ? 24 : -24), true);
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          document.documentElement.classList.add('resizing-task-context');
        }}
        onPointerMove={resizeFromPointer}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          document.documentElement.classList.remove('resizing-task-context');
          updateWidth(window.innerWidth - event.clientX, true);
        }}
        onPointerCancel={() => document.documentElement.classList.remove('resizing-task-context')}
      />
      <header className='task-context-header'>
        <nav aria-label='任务上下文面板'>
          <button
            type='button'
            className={view === 'review' ? 'active' : ''}
            aria-current={view === 'review' ? 'page' : undefined}
            onClick={() => navigateTask('review')}
          >
            <Files size={14} />
            工作区
          </button>
          <button
            type='button'
            className={view === 'activity' ? 'active' : ''}
            aria-current={view === 'activity' ? 'page' : undefined}
            onClick={() => {
              setChangesOpen(false);
              navigateTask('activity');
            }}
          >
            <History size={14} />
            活动
          </button>
        </nav>
        <div className='task-context-actions'>
          {view === 'review' && (
            <Button
              tone='quiet'
              className='task-context-changes'
              aria-pressed={changesOpen}
              onClick={() => setChangesOpen((open) => !open)}
            >
              <GitBranch size={14} />
              工作区变更
            </Button>
          )}
          <IconButton label='关闭任务上下文面板' onClick={() => navigateTask('conversation')}>
            <PanelRightClose size={16} />
          </IconButton>
        </div>
      </header>
      <div className='task-context-body'>
        {view === 'review' ? (
          <WorkspacePage
            actions={actions}
            changesOpen={changesOpen}
            onChangesOpenChange={setChangesOpen}
            showChangesTrigger={false}
          />
        ) : (
          <RunsPage actions={actions} />
        )}
      </div>
    </aside>
  );
}
