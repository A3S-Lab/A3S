import { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { IntegrationsSettings } from '../../../types/settings';
import type { SettingsActions } from '../settings-actions';
import { useSettingsDraft } from '../use-settings-draft';
import { SettingsEffectBadge } from './config/settings-effect-badge';
import { SettingsTextField } from './config/settings-fields';
import { SettingsRow } from './config/settings-row';
import { SettingsLoadState, SettingsSaveState } from './config/settings-state-view';
import { SettingsSection } from './config/settings-section';
import { defaultDocumentParserSettings, DocumentParserSettingsEditor } from './integrations/document-parser-settings';
import { McpSettingsEditor } from './integrations/mcp-settings';
import { defaultSearchSettings, SearchSettingsEditor } from './integrations/search-settings';

export function IntegrationsSettingsView({
  actions,
  onDirtyChange,
}: {
  actions: SettingsActions;
  onDirtyChange?(dirty: boolean): void;
}) {
  const state = useSnapshot(appState);
  const source = state.integrationsSettings as IntegrationsSettings | null;
  const { draft, setDraft, dirty, accept, reset } = useSettingsDraft(source);

  useEffect(() => {
    if (!source) void actions.loadSettingsCategory('integrations');
  }, [actions, source]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const save = async () => {
    if (!draft) return;
    try {
      accept(await actions.saveIntegrationsSettings(draft));
    } catch {
      // Keep the local draft available for correction and retry.
    }
  };

  return (
    <SettingsLoadState
      category='integrations'
      loading={state.settingsCategoryLoading.integrations}
      error={state.settingsCategoryErrors.integrations}
      loaded={Boolean(source && draft)}
      actions={actions}
    >
      {source && draft && (
        <div className='settings-config-page'>
          <div className='settings-config-toolbar'>
            <SettingsEffectBadge effect={source.effect} />
            <SettingsSaveState
              dirty={dirty}
              saving={state.settingsCategorySaving.integrations}
              savedAt={state.settingsCategorySavedAt.integrations}
              onReset={reset}
              onSave={() => void save()}
            />
          </div>
          {state.settingsCategoryErrors.integrations && (
            <p className='settings-inline-error'>{state.settingsCategoryErrors.integrations}</p>
          )}

          <SettingsSection
            title='A3S OS'
            description='可选的平台地址；账户授权仍在“账户管理”中完成。'
            toggle={{
              label: '配置 A3S OS 地址',
              checked: Boolean(draft.os),
              onChange: (enabled) => setDraft({ ...draft, os: enabled ? { address: '' } : null }),
            }}
          >
            {draft.os ? (
              <SettingsRow label='平台地址' description='A3S OS 登录和平台能力发现使用的基础地址。'>
                <SettingsTextField
                  type='url'
                  label='A3S OS 平台地址'
                  value={draft.os.address}
                  placeholder='https://os.a3s.dev'
                  onChange={(address) => setDraft({ ...draft, os: { address } })}
                />
              </SettingsRow>
            ) : (
              <div className='config-empty-inline'>未配置 A3S OS，A3S Code 继续以纯本地模式运行。</div>
            )}
          </SettingsSection>

          <SettingsSection
            title='Web 搜索'
            description='配置搜索引擎聚合、健康熔断和需要 JavaScript 的无头浏览器。'
            toggle={{
              label: '配置 Web 搜索',
              checked: Boolean(draft.search),
              onChange: (enabled) => setDraft({ ...draft, search: enabled ? defaultSearchSettings() : null }),
            }}
          >
            {draft.search ? (
              <SearchSettingsEditor value={draft.search} onChange={(search) => setDraft({ ...draft, search })} />
            ) : (
              <div className='config-empty-inline'>未声明搜索配置，运行时不会注册自定义搜索引擎。</div>
            )}
          </SettingsSection>

          <SettingsSection
            title='文档解析'
            description='控制文档上下文提取、解析缓存以及扫描件 OCR。'
            toggle={{
              label: '配置文档解析',
              checked: Boolean(draft.documentParser),
              onChange: (enabled) =>
                setDraft({ ...draft, documentParser: enabled ? defaultDocumentParserSettings() : null }),
            }}
          >
            {draft.documentParser ? (
              <DocumentParserSettingsEditor
                value={draft.documentParser}
                onChange={(documentParser) => setDraft({ ...draft, documentParser })}
              />
            ) : (
              <div className='config-empty-inline'>未配置文档解析器。</div>
            )}
          </SettingsSection>

          <SettingsSection title='MCP' description='为 Agent 注册本地或远程工具服务；授权信息始终由本地 CLI 持有。'>
            <McpSettingsEditor value={draft.mcpServers} onChange={(mcpServers) => setDraft({ ...draft, mcpServers })} />
          </SettingsSection>
        </div>
      )}
    </SettingsLoadState>
  );
}
