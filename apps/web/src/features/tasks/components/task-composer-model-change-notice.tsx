import { useTimeout } from 'ahooks';
import { Info } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { appState, clearModelChangeNotice } from '../../../state/app-state';
import type { CatalogModel } from '../../../types/api';

export function TaskComposerModelChangeNotice() {
  const state = useSnapshot(appState);
  const notice = state.modelChangeNotice;
  if (!notice || notice.sessionId !== state.activeSessionId) return null;

  return (
    <ModelChangeNoticeItem
      key={notice.id}
      id={notice.id}
      previousModel={notice.previousModel}
      currentModel={notice.currentModel}
      models={state.modelCatalog?.items ?? []}
    />
  );
}

function ModelChangeNoticeItem({
  id,
  previousModel,
  currentModel,
  models,
}: {
  id: number;
  previousModel: string;
  currentModel: string;
  models: readonly CatalogModel[];
}) {
  useTimeout(() => clearModelChangeNotice(id), 5000);
  const previousName = modelDisplayName(previousModel, models);
  const currentName = modelDisplayName(currentModel, models);

  return (
    <output className='composer-model-change-notice' aria-label='模型切换提示'>
      <span>
        {previousName ? (
          <>
            模型已从 <strong>{previousName}</strong> 更改为 <strong>{currentName}</strong>
          </>
        ) : (
          <>
            模型已更改为 <strong>{currentName}</strong>
          </>
        )}
        <Info size={12} aria-hidden='true' />
      </span>
    </output>
  );
}

function modelDisplayName(modelId: string, models: readonly CatalogModel[]): string {
  return models.find((model) => model.id === modelId)?.name || modelId.split('/').pop() || modelId;
}
