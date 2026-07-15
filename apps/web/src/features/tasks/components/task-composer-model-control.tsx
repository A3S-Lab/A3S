import { useSnapshot } from 'valtio';
import { ModelCombobox } from '../../../design-system/primitives';
import { appState, navigateSettings, showModelChangeNotice } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { updateNewTaskConfig } from './task-composer-config';

export function TaskComposerModelControl({ actions }: { actions: TaskActions }) {
  const state = useSnapshot(appState);
  const task = state.sessions.find((item) => item.sessionId === state.activeSessionId);
  const model = task
    ? (task.model ?? state.selectedModel)
    : state.newTaskConfig.model || state.selectedModel || state.llm?.defaultModel || '';
  const busy = Boolean(state.streamingSessionId || state.taskConfigSaving);
  const loading = state.taskConfigSaving === 'model';

  return (
    <div className='composer-model-control'>
      <ModelCombobox
        compact
        placement='top'
        sourceTabs
        label={task ? '任务模型' : '新任务模型'}
        models={state.modelCatalog?.items ?? []}
        value={model}
        defaultModel={state.modelCatalog?.defaultModel}
        disabled={busy}
        loading={loading}
        configureLabel='配置自定义模型'
        onConfigure={() => navigateSettings('model')}
        onChange={(value) => {
          if (task) void actions.updateSessionModel(value);
          else {
            updateNewTaskConfig({ model: value });
            showModelChangeNotice(null, model, value);
          }
        }}
      />
    </div>
  );
}
