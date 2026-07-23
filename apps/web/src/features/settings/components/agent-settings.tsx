import { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { AgentSettings } from '../../../types/settings';
import type { SettingsActions } from '../settings-actions';
import { useSettingsDraft } from '../use-settings-draft';
import { defaultQueueSettings, QueueSettingsEditor } from './agent/queue-settings';
import { SettingsEffectBadge } from './config/settings-effect-badge';
import { SettingsEmptyNotice } from './config/settings-empty-notice';
import { SettingsNumberField, SettingsSliderField } from './config/settings-fields';
import { SettingsPathList } from './config/settings-path-list';
import { SettingsRow } from './config/settings-row';
import { SettingsSection } from './config/settings-section';
import { SettingsCategoryError, SettingsLoadState, SettingsSaveState } from './config/settings-state-view';
import { SettingsSwitch } from './config/settings-switch';

export function AgentSettingsView({
  actions,
  onDirtyChange,
}: {
  actions: SettingsActions;
  onDirtyChange?(dirty: boolean): void;
}) {
  const state = useSnapshot(appState);
  const source = state.agentSettings as AgentSettings | null;
  const { draft, setDraft, dirty, accept, reset } = useSettingsDraft(source);

  useEffect(() => {
    if (!source) void actions.loadSettingsCategory('agent');
  }, [actions, source]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const save = async () => {
    if (!draft) return;
    try {
      accept(await actions.saveAgentSettings(draft));
    } catch {
      // Keep the local draft for correction and retry.
    }
  };

  return (
    <SettingsLoadState
      category='agent'
      loading={state.settingsCategoryLoading.agent}
      error={state.settingsCategoryErrors.agent}
      loaded={Boolean(source && draft)}
      actions={actions}
    >
      {source && draft && (
        <div className='settings-config-page'>
          <div className='settings-config-toolbar'>
            <SettingsEffectBadge effect={source.effect} />
            <SettingsSaveState
              dirty={dirty}
              saving={state.settingsCategorySaving.agent}
              savedAt={state.settingsCategorySavedAt.agent}
              onReset={reset}
              onSave={() => void save()}
            />
          </div>
          <SettingsCategoryError message={state.settingsCategoryErrors.agent} />

          <SettingsSection title='执行边界' description='限制单轮工具调用和并行分支，避免失控执行与意外成本。'>
            <SettingsRow label='最大工具轮次' description='单轮任务允许的工具执行回合数。'>
              <SettingsNumberField
                label='最大工具轮次'
                value={draft.maxToolRounds}
                min={1}
                placeholder='运行时默认'
                suffix='轮'
                onChange={(maxToolRounds) => setDraft({ ...draft, maxToolRounds })}
              />
            </SettingsRow>
            <SettingsRow label='最大并行任务' description='同级分支或工具的并发上限。'>
              <SettingsNumberField
                label='最大并行任务'
                value={draft.maxParallelTasks}
                min={1}
                placeholder='运行时默认'
                suffix='个'
                onChange={(maxParallelTasks) => setDraft({ ...draft, maxParallelTasks })}
              />
            </SettingsRow>
            <SettingsRow label='允许并行执行' description='关闭后，自动委派产生的子任务也会改为串行执行。'>
              <SettingsSwitch
                label='允许并行执行'
                checked={draft.autoParallel ?? draft.autoDelegation.autoParallel}
                onChange={(autoParallel) => setDraft({ ...draft, autoParallel })}
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection
            title='Skills 与 Agent 目录'
            description='服务启动时扫描这些目录；支持相对工作区路径和绝对路径。'
          >
            <SettingsRow label='Skill 目录' vertical>
              <SettingsPathList
                label='Skill 目录'
                value={draft.skillDirs}
                placeholder='./skills'
                onChange={(skillDirs) => setDraft({ ...draft, skillDirs })}
              />
            </SettingsRow>
            <SettingsRow label='Agent 目录' vertical>
              <SettingsPathList
                label='Agent 目录'
                value={draft.agentDirs}
                placeholder='./agents'
                onChange={(agentDirs) => setDraft({ ...draft, agentDirs })}
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection title='自动委派' description='控制运行时是否以及何时把任务拆分给子智能体。'>
            <SettingsRow label='启用自动委派' description='由运行时根据任务结构自动创建子任务。'>
              <SettingsSwitch
                label='启用自动委派'
                checked={draft.autoDelegation.enabled}
                onChange={(enabled) => setDraft({ ...draft, autoDelegation: { ...draft.autoDelegation, enabled } })}
              />
            </SettingsRow>
            <SettingsRow label='允许并行子任务' description='仅在自动委派和全局并行执行都开启时生效。'>
              <SettingsSwitch
                label='允许并行子任务'
                checked={draft.autoDelegation.autoParallel}
                disabled={!draft.autoDelegation.enabled || draft.autoParallel === false}
                onChange={(autoParallel) =>
                  setDraft({ ...draft, autoDelegation: { ...draft.autoDelegation, autoParallel } })
                }
              />
            </SettingsRow>
            <SettingsRow label='向模型开放手动委派工具' description='控制 task / parallel_task 是否进入工具面。'>
              <SettingsSwitch
                label='向模型开放手动委派工具'
                checked={draft.autoDelegation.allowManualDelegation}
                onChange={(allowManualDelegation) =>
                  setDraft({ ...draft, autoDelegation: { ...draft.autoDelegation, allowManualDelegation } })
                }
              />
            </SettingsRow>
            <SettingsRow label='最低置信度' description='模型判断低于这个比例时，不会自动拆分子任务。'>
              <SettingsSliderField
                label='自动委派最低置信度'
                value={draft.autoDelegation.minConfidence ?? 0.72}
                min={0}
                max={1}
                step={0.01}
                disabled={!draft.autoDelegation.enabled}
                formatValue={(value) => `${Math.round(value * 100)}%`}
                onChange={(minConfidence) =>
                  setDraft({
                    ...draft,
                    autoDelegation: { ...draft.autoDelegation, minConfidence },
                  })
                }
              />
            </SettingsRow>
            <SettingsRow label='每次请求最大子任务数'>
              <SettingsNumberField
                label='每次请求最大子任务数'
                value={draft.autoDelegation.maxTasks}
                min={1}
                suffix='个'
                disabled={!draft.autoDelegation.enabled}
                onChange={(maxTasks) =>
                  setDraft({
                    ...draft,
                    autoDelegation: { ...draft.autoDelegation, maxTasks: maxTasks ?? 1 },
                  })
                }
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection
            title='任务队列'
            description='高级 Lane 调度、外部处理、重试、限流与持久化。普通本地任务可保持关闭。'
            toggle={{
              label: '启用高级任务队列',
              checked: Boolean(draft.queue),
              onChange: (enabled) => setDraft({ ...draft, queue: enabled ? defaultQueueSettings() : null }),
            }}
          >
            {draft.queue ? (
              <QueueSettingsEditor value={draft.queue} onChange={(queue) => setDraft({ ...draft, queue })} />
            ) : (
              <SettingsEmptyNotice>未启用高级队列，任务使用直接执行路径。</SettingsEmptyNotice>
            )}
          </SettingsSection>
        </div>
      )}
    </SettingsLoadState>
  );
}
