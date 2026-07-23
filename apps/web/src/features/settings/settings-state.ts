import type { LlmSettings, ModelCatalog, OsAccount } from '../../types/api';
import type { AgentSettings, ConfigCategory, ContextSettings, IntegrationsSettings } from '../../types/settings';

export type SettingsTab =
  | 'account'
  | 'general'
  | 'model'
  | 'agent'
  | 'context'
  | 'integrations'
  | 'channels'
  | 'about'
  | 'help';

export type ChannelSettingsTab = 'weixin' | 'feishu';

const settingsTabs: readonly SettingsTab[] = [
  'account',
  'general',
  'model',
  'agent',
  'context',
  'integrations',
  'channels',
  'about',
  'help',
];

export function settingsTabFromHash(hash: string): SettingsTab | null {
  if (hash === '#help') return 'help';
  if (settingsChannelFromHash(hash)) return 'channels';
  const value = hash.match(/^#settings\/([^/]+)$/)?.[1];
  return settingsTabs.find((tab) => tab === value) ?? null;
}

export function settingsChannelFromHash(hash: string): ChannelSettingsTab | null {
  if (hash === '#weixin' || hash === '#settings/weixin' || hash === '#settings/channels') return 'weixin';
  if (hash === '#settings/feishu') return 'feishu';
  const channel = hash.match(/^#settings\/channels\/(weixin|feishu)$/)?.[1];
  if (channel === 'weixin' || channel === 'feishu') return channel;
  return null;
}

export function settingsHashForTab(tab: SettingsTab, channel: ChannelSettingsTab = 'weixin'): string {
  return tab === 'channels' ? `#settings/channels/${channel}` : `#settings/${tab}`;
}
export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  canSelfUpdate: boolean;
  checkedAt: string;
}
export interface SettingsState {
  osAccount: OsAccount | null;
  llm: LlmSettings | null;
  modelCatalog: ModelCatalog | null;
  agentSettings: AgentSettings | null;
  contextSettings: ContextSettings | null;
  integrationsSettings: IntegrationsSettings | null;
  settingsCategoryLoading: Record<ConfigCategory, boolean>;
  settingsCategorySaving: Record<ConfigCategory, boolean>;
  settingsCategoryErrors: Record<ConfigCategory, string | null>;
  settingsCategorySavedAt: Record<ConfigCategory, number | null>;
  selectedModel: string;
  defaultModelSaving: boolean;
  modelCatalogRefreshing: boolean;
  modelCatalogRefreshError: string | null;
  modelCatalogRefreshedAt: number | null;
  updateStatus: UpdateStatus | null;
  updateChecking: boolean;
  updateInstalling: boolean;
  updateCheckError: string | null;
  updateInstallError: string | null;
  updateInstalledVersion: string | null;
  settingsTab: SettingsTab;
  settingsChannel: ChannelSettingsTab;
}
export function createSettingsState(): SettingsState {
  const initialTab = settingsTabFromHash(window.location.hash);
  const initialChannel = settingsChannelFromHash(window.location.hash);
  return {
    osAccount: null,
    llm: null,
    modelCatalog: null,
    agentSettings: null,
    contextSettings: null,
    integrationsSettings: null,
    settingsCategoryLoading: { llm: false, agent: false, context: false, integrations: false },
    settingsCategorySaving: { llm: false, agent: false, context: false, integrations: false },
    settingsCategoryErrors: { llm: null, agent: null, context: null, integrations: null },
    settingsCategorySavedAt: { llm: null, agent: null, context: null, integrations: null },
    selectedModel: '',
    defaultModelSaving: false,
    modelCatalogRefreshing: false,
    modelCatalogRefreshError: null,
    modelCatalogRefreshedAt: null,
    updateStatus: null,
    updateChecking: false,
    updateInstalling: false,
    updateCheckError: null,
    updateInstallError: null,
    updateInstalledVersion: null,
    settingsTab: initialTab ?? 'general',
    settingsChannel: initialChannel ?? 'weixin',
  };
}
