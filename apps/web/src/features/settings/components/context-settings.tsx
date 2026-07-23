import { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { ContextSettings } from '../../../types/settings';
import type { SettingsActions } from '../settings-actions';
import { useSettingsDraft } from '../use-settings-draft';
import { SettingsEffectBadge } from './config/settings-effect-badge';
import { SettingsEmptyNotice } from './config/settings-empty-notice';
import { SettingsSecretField, SettingsSegmentedControl, SettingsTextField } from './config/settings-fields';
import { SettingsRow } from './config/settings-row';
import { SettingsSection } from './config/settings-section';
import { SettingsCategoryError, SettingsLoadState, SettingsSaveState } from './config/settings-state-view';
import { defaultMemorySettings, MemorySettingsEditor } from './context/memory-settings';

export function ContextSettingsView({
  actions,
  onDirtyChange,
}: {
  actions: SettingsActions;
  onDirtyChange?(dirty: boolean): void;
}) {
  const state = useSnapshot(appState);
  const source = state.contextSettings as ContextSettings | null;
  const { draft, setDraft, dirty, accept, reset } = useSettingsDraft(source);

  useEffect(() => {
    if (!source) void actions.loadSettingsCategory('context');
  }, [actions, source]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const save = async () => {
    if (!draft) return;
    try {
      accept(await actions.saveContextSettings(draft));
    } catch {
      // Keep local edits available for retry.
    }
  };

  return (
    <SettingsLoadState
      category='context'
      loading={state.settingsCategoryLoading.context}
      error={state.settingsCategoryErrors.context}
      loaded={Boolean(source && draft)}
      actions={actions}
    >
      {source && draft && (
        <div className='settings-config-page'>
          <div className='settings-config-toolbar'>
            <SettingsEffectBadge effect={source.effect} />
            <SettingsSaveState
              dirty={dirty}
              saving={state.settingsCategorySaving.context}
              savedAt={state.settingsCategorySavedAt.context}
              onReset={reset}
              onSave={() => void save()}
            />
          </div>
          <SettingsCategoryError message={state.settingsCategoryErrors.context} />

          <SettingsSection title='会话存储' description='决定任务会话保存在哪里；自定义后端需要可用的连接地址。'>
            <SettingsRow label='存储后端'>
              <SettingsSegmentedControl
                label='会话存储后端'
                value={draft.storageBackend}
                options={[
                  { value: 'file', label: '本地文件', description: '推荐；重启后仍可恢复任务' },
                  { value: 'memory', label: '仅内存' },
                  { value: 'custom', label: '自定义' },
                ]}
                onChange={(storageBackend) => setDraft({ ...draft, storageBackend })}
              />
            </SettingsRow>
            <SettingsRow label='会话目录' description='文件后端保存任务记录的位置。'>
              <SettingsTextField
                label='会话目录'
                value={draft.sessionsDir}
                placeholder='<workspace>/.a3s/sessions'
                onChange={(sessionsDir) => setDraft({ ...draft, sessionsDir: sessionsDir || null })}
              />
            </SettingsRow>
            <SettingsRow label='记忆目录' description='默认文件记忆存储的位置。'>
              <SettingsTextField
                label='记忆目录'
                value={draft.memoryDir}
                placeholder='<workspace>/.a3s/memory'
                onChange={(memoryDir) => setDraft({ ...draft, memoryDir: memoryDir || null })}
              />
            </SettingsRow>
            {draft.storageBackend === 'custom' && (
              <SettingsRow label='自定义连接地址' description='例如 Redis、PostgreSQL 或兼容后端 URL。'>
                <SettingsSecretField
                  label='自定义存储连接地址'
                  value={draft.storageUrl}
                  onChange={(storageUrl) => setDraft({ ...draft, storageUrl })}
                />
              </SettingsRow>
            )}
          </SettingsSection>

          <SettingsSection
            title='Agent 记忆'
            description='三层记忆、相关性评分、LLM 提取和长期清理策略。'
            toggle={{
              label: '启用 Agent 记忆配置',
              checked: Boolean(draft.memory),
              onChange: (enabled) => setDraft({ ...draft, memory: enabled ? defaultMemorySettings() : null }),
            }}
          >
            {draft.memory ? (
              <MemorySettingsEditor value={draft.memory} onChange={(memory) => setDraft({ ...draft, memory })} />
            ) : (
              <SettingsEmptyNotice>未声明显式记忆参数，运行时使用默认行为。</SettingsEmptyNotice>
            )}
          </SettingsSection>
        </div>
      )}
    </SettingsLoadState>
  );
}
