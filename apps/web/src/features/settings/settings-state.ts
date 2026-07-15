import type { LlmSettings, ModelCatalog, OsAccount } from '../../types/api';
import type { AgentSettings, ConfigCategory, ContextSettings, IntegrationsSettings } from '../../types/settings';

export type SettingsTab = 'account' | 'general' | 'model' | 'agent' | 'context' | 'integrations' | 'about' | 'help';

const settingsTabs: readonly SettingsTab[] = [
  'account',
  'general',
  'model',
  'agent',
  'context',
  'integrations',
  'about',
  'help',
];

export function settingsTabFromHash(hash: string): SettingsTab | null {
  if (hash === '#help') return 'help';
  const value = hash.match(/^#settings\/([^/]+)$/)?.[1];
  return settingsTabs.find((tab) => tab === value) ?? null;
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
  updateStatus: UpdateStatus | null;
  updateChecking: boolean;
  updateInstalling: boolean;
  updateCheckError: string | null;
  updateInstallError: string | null;
  updateInstalledVersion: string | null;
  settingsTab: SettingsTab;
}
export function createSettingsState(): SettingsState {
  const initialTab = settingsTabFromHash(window.location.hash);
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
    updateStatus: null,
    updateChecking: false,
    updateInstalling: false,
    updateCheckError: null,
    updateInstallError: null,
    updateInstalledVersion: null,
    settingsTab: initialTab ?? 'general',
  };
}
