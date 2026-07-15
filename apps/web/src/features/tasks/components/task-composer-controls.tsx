import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { TaskComposerContextControl } from './task-composer-context-control';
import { TaskComposerEffortControl } from './task-composer-effort-control';
import { TaskComposerModelControl } from './task-composer-model-control';

export function TaskComposerTrailingControls({ actions }: { actions: TaskActions }) {
  const state = useSnapshot(appState);
  const task = state.sessions.find((item) => item.sessionId === state.activeSessionId);
  const controls = task ? state.sessionControls[task.sessionId] : undefined;

  return (
    <section className='composer-controls composer-trailing-controls' aria-label='任务上下文、模型与推理'>
      {controls?.context && task && (
        <TaskComposerContextControl
          context={controls.context}
          compacting={Boolean(state.contextCompacting[task.sessionId])}
          disabled={Boolean(state.streamingSessionId || state.taskConfigSaving)}
          onCompact={() => actions.compactSession()}
        />
      )}
      <TaskComposerEffortControl actions={actions} />
      <TaskComposerModelControl actions={actions} />
    </section>
  );
}
