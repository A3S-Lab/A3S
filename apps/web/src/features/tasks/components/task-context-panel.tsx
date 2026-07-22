import { Files, GitBranch, History, Maximize2, Minimize2, PanelRightClose } from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, IconButton, SplitHandle, Tabs } from '../../../design-system/primitives';
import { appState, navigateTask } from '../../../state/app-state';
import type { TaskView } from '../../code/code-state';
import { WorkspacePage } from '../../code/pages/workspace-page';
import type { CodeActions } from '../../code/use-code-controller';
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
  const state = useSnapshot(appState);
  const [width, setWidth] = useState(readPanelWidth);
  const [changesOpen, setChangesOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const presentationButtonRef = useRef<HTMLButtonElement>(null);
  const fullscreen = state.workspacePresentation === 'fullscreen';
  const panelName = view === 'review' ? '任务工作区' : '任务活动面板';
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const target = panel.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view]);
  useEffect(() => {
    if (!fullscreen) return;
    const exitFullscreen = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return;
      event.preventDefault();
      appState.workspacePresentation = 'docked';
      requestAnimationFrame(() => presentationButtonRef.current?.focus());
    };
    window.addEventListener('keydown', exitFullscreen);
    return () => window.removeEventListener('keydown', exitFullscreen);
  }, [fullscreen]);
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
  return (
    <aside
      ref={panelRef}
      className={`task-context-panel ${fullscreen ? 'fullscreen' : ''}`}
      aria-label={panelName}
      style={{ '--task-context-width': `${width}px` } as CSSProperties}
    >
      <SplitHandle
        className='task-context-resizer'
        label='调整任务工作区宽度'
        value={width}
        min={minPanelWidth}
        max={maxPanelWidth}
        defaultValue={defaultPanelWidth}
        step={24}
        direction='reverse'
        valueText={(value) => `${value} 像素`}
        onChange={updateWidth}
        onCommit={(value) => updateWidth(value, true)}
      />
      <header className='task-context-header'>
        <Tabs<Exclude<TaskView, 'conversation'>>
          ariaLabel='任务上下文面板'
          value={view}
          variant='line'
          size='compact'
          className='task-context-tabs'
          items={[
            { id: 'review', label: '工作区', icon: <Files size={14} /> },
            { id: 'activity', label: '活动', icon: <History size={14} /> },
          ]}
          onChange={(nextView) => {
            if (nextView === 'activity') setChangesOpen(false);
            navigateTask(nextView);
          }}
        />
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
          <IconButton
            ref={presentationButtonRef}
            label={fullscreen ? `退出${panelName}全屏` : `全屏显示${panelName}`}
            tooltip={fullscreen ? `退出${panelName}全屏 (Esc)` : `全屏显示${panelName}`}
            selected={fullscreen}
            onClick={() => {
              appState.workspacePresentation = fullscreen ? 'docked' : 'fullscreen';
            }}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </IconButton>
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
