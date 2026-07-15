import type { LlmSettings } from '../../types/api';
import type { AgentSettings, ConfigCategory, ContextSettings, IntegrationsSettings } from '../../types/settings';

export interface SettingsActions {
  loadSettingsCategory(category: ConfigCategory, force?: boolean): Promise<void>;
  updateDefaultModel(model: string): Promise<void>;
  saveLlmSettings(patch: Partial<LlmSettings>): Promise<LlmSettings>;
  saveAgentSettings(patch: Partial<AgentSettings>): Promise<AgentSettings>;
  saveContextSettings(patch: Partial<ContextSettings>): Promise<ContextSettings>;
  saveIntegrationsSettings(patch: Partial<IntegrationsSettings>): Promise<IntegrationsSettings>;
  loginWithOs(): Promise<void>;
  logout(): Promise<void>;
  checkForUpdates(): Promise<void>;
  installUpdate(version: string): Promise<void>;
}
