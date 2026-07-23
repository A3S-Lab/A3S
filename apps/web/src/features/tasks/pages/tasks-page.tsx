import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { CodeActions } from '../../code/use-code-controller';
import { ExecutionStream } from '../components/execution-stream';
import { NewTaskPreparation } from '../components/new-task-preparation';
import { TaskComposer } from '../components/task-composer';
import { TaskContextPanel } from '../components/task-context-panel';
import { TaskHeader } from '../components/task-header';
import { TaskRuntimeFloatingPanel } from '../components/task-runtime-floating-panel';

export function TasksPage({ actions }: { actions: CodeActions }) {
  const state = useSnapshot(appState);

  if (!state.activeSessionId) {
    return (
      <section className='code-page task-product new-task-product'>
        <TaskRuntimeFloatingPanel />
        <NewTaskPreparation actions={actions} />
      </section>
    );
  }

  const contextFullscreen = state.taskView !== 'conversation' && state.workspacePresentation === 'fullscreen';
  return (
    <section className='code-page task-product active-task-product'>
      <div
        className={`active-task-layout ${state.taskView !== 'conversation' ? 'with-context' : ''} ${contextFullscreen ? 'context-fullscreen' : ''}`}
      >
        <section
          className='task-conversation-pane'
          aria-hidden={contextFullscreen || undefined}
          inert={contextFullscreen || undefined}
        >
          <TaskHeader />
          <TaskRuntimeFloatingPanel />
          <main className='task-workspace'>
            <ExecutionStream actions={actions} />
            <TaskComposer actions={actions} />
          </main>
        </section>
        {state.taskView !== 'conversation' && <TaskContextPanel view={state.taskView} actions={actions} />}
      </div>
    </section>
  );
}
