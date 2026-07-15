import { useSnapshot } from 'valtio';
import type { CodeActions } from '../../code/use-code-controller';
import { appState } from '../../../state/app-state';
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
        <NewTaskPreparation actions={actions} />
      </section>
    );
  }

  return (
    <section className='code-page task-product active-task-product'>
      <div className={`active-task-layout ${state.taskView !== 'conversation' ? 'with-context' : ''}`}>
        <section className='task-conversation-pane'>
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
