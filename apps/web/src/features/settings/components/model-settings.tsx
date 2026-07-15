import { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { LlmSettings, ProviderInfo } from '../../../types/api';
import type { SettingsActions } from '../settings-actions';
import { useSettingsDraft } from '../use-settings-draft';
import { SettingsEffectBadge } from './config/settings-effect-badge';
import { SettingsLoadState, SettingsSaveState } from './config/settings-state-view';
import { DefaultModelSetting } from './model/default-model-setting';
import { buildModelCatalog, validDefaultModel } from './model/model-catalog';
import { ModelRuntimeSettings } from './model/model-runtime-settings';
import { ProviderManager } from './model/provider-manager';

export function ModelSettings({
  actions,
  onDirtyChange,
}: {
  actions: SettingsActions;
  onDirtyChange?(dirty: boolean): void;
}) {
  const state = useSnapshot(appState);
  const source = state.llm as LlmSettings | null;
  const { draft, setDraft, dirty, accept, reset } = useSettingsDraft(source);

  useEffect(() => {
    if (!source) void actions.loadSettingsCategory('llm');
  }, [actions, source]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  if (!draft || !source) {
    return (
      <SettingsLoadState
        category='llm'
        loading={state.settingsCategoryLoading.llm}
        error={state.settingsCategoryErrors.llm}
        loaded={false}
        actions={actions}
      >
        {null}
      </SettingsLoadState>
    );
  }

  const catalog = buildModelCatalog(draft.providers);
  const updateProviders = (providers: ProviderInfo[]) => {
    setDraft({ ...draft, providers, defaultModel: validDefaultModel(draft.defaultModel, providers) });
  };
  const save = async () => {
    try {
      accept(await actions.saveLlmSettings(draft));
    } catch {
      // The controller keeps the error visible without discarding the draft.
    }
  };

  return (
    <div className='settings-config-page'>
      <div className='settings-config-toolbar'>
        <SettingsEffectBadge effect={source.effect} />
        <SettingsSaveState
          dirty={dirty}
          saving={state.settingsCategorySaving.llm}
          savedAt={state.settingsCategorySavedAt.llm}
          onReset={reset}
          onSave={() => void save()}
        />
      </div>
      {state.settingsCategoryErrors.llm && <p className='settings-inline-error'>{state.settingsCategoryErrors.llm}</p>}

      <DefaultModelSetting
        models={catalog}
        providerCount={draft.providers.length}
        value={draft.defaultModel}
        savedValue={source.defaultModel}
        onChange={(defaultModel) => setDraft({ ...draft, defaultModel })}
      />

      <ModelRuntimeSettings
        thinkingBudget={draft.thinkingBudget}
        timeoutMs={draft.llmApiTimeoutMs}
        onThinkingBudgetChange={(thinkingBudget) => setDraft({ ...draft, thinkingBudget })}
        onTimeoutChange={(llmApiTimeoutMs) => setDraft({ ...draft, llmApiTimeoutMs })}
      />

      <ProviderManager providers={draft.providers} defaultModel={draft.defaultModel} onChange={updateProviders} />
    </div>
  );
}
