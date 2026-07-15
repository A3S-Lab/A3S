import { Files, History, PanelLeftOpen } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { IconButton, StatusBadge } from '../../../design-system/primitives';
import { appState, navigateTask, sessionTitle } from '../../../state/app-state';

export function TaskHeader() {
  const state = useSnapshot(appState);
  const task = state.sessions.find((item) => item.sessionId === state.activeSessionId);
  const title = task ? sessionTitle(task, state.sessionTitles) : '新任务';
  return (
    <header className='task-header'>
      <div className='task-header-leading'>
        {!state.sidebarOpen && (
          <IconButton
            label='打开任务列表'
            onClick={() => {
              appState.sidebarOpen = true;
            }}
          >
            <PanelLeftOpen size={17} />
          </IconButton>
        )}
        <div className='task-header-title'>
          <strong title={title}>{title}</strong>
          {task && (
            <>
              <span aria-hidden='true'>·</span>
              <small title={task.cwd}>{task.cwd}</small>
            </>
          )}
        </div>
      </div>
      <div className='task-header-actions'>
        {task && state.streamingSessionId === task.sessionId && <StatusBadge tone='info'>运行中</StatusBadge>}
        <IconButton
          label={state.taskView === 'review' ? '关闭工作区' : '打开工作区'}
          selected={state.taskView === 'review'}
          onClick={() => {
            if (state.taskView === 'review') {
              navigateTask('conversation');
              return;
            }
            appState.reviewIntent = 'review';
            appState.reviewSourceTaskId = state.activeSessionId;
            navigateTask('review');
          }}
        >
          <Files size={17} />
        </IconButton>
        <IconButton
          label={state.taskView === 'activity' ? '关闭任务活动' : '打开任务活动'}
          selected={state.taskView === 'activity'}
          onClick={() => navigateTask(state.taskView === 'activity' ? 'conversation' : 'activity')}
        >
          <History size={17} />
        </IconButton>
      </div>
    </header>
  );
}
