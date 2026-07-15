import type { ConfigEffect } from './api';

export type ConfigCategory = 'llm' | 'agent' | 'context' | 'integrations';
export type ConfigSecret = string | null;

export interface ConfigCategoryMetadata {
  category: ConfigCategory;
  effect: ConfigEffect;
  configPath: string;
}

export interface AutoDelegationSettings {
  enabled: boolean;
  autoParallel: boolean;
  allowManualDelegation: boolean;
  minConfidence: number;
  maxTasks: number;
}

export type QueueLane = 'Control' | 'Query' | 'Execute' | 'Generate';
export type QueueHandlerMode = 'Internal' | 'External' | 'Hybrid';

export interface QueueLaneHandlerSettings {
  mode: QueueHandlerMode;
  timeout_ms: number;
}

export interface QueueRetryPolicySettings {
  strategy: 'exponential' | 'fixed' | 'none';
  maxRetries: number;
  initialDelayMs: number;
  fixedDelayMs?: number | null;
}

export interface QueueRateLimitSettings {
  limitType: 'per_second' | 'per_minute' | 'per_hour' | 'unlimited';
  maxOperations?: number | null;
}

export interface QueuePriorityBoostSettings {
  strategy: 'standard' | 'aggressive' | 'disabled';
  deadlineMs?: number | null;
}

export interface QueueSettings {
  controlMaxConcurrency: number;
  queryMaxConcurrency: number;
  executeMaxConcurrency: number;
  generateMaxConcurrency: number;
  laneHandlers: Partial<Record<QueueLane, QueueLaneHandlerSettings>>;
  enableDlq: boolean;
  dlqMaxSize?: number | null;
  enableMetrics: boolean;
  enableAlerts: boolean;
  defaultTimeoutMs?: number | null;
  storagePath?: string | null;
  retryPolicy?: QueueRetryPolicySettings | null;
  rateLimit?: QueueRateLimitSettings | null;
  priorityBoost?: QueuePriorityBoostSettings | null;
  pressureThreshold?: number | null;
  laneTimeouts: Partial<Record<QueueLane, number>>;
}

export interface AgentSettings extends ConfigCategoryMetadata {
  skillDirs: string[];
  agentDirs: string[];
  maxToolRounds?: number | null;
  maxParallelTasks?: number | null;
  autoParallel?: boolean | null;
  autoDelegation: AutoDelegationSettings;
  queue?: QueueSettings | null;
}

export interface MemoryRelevanceSettings {
  decayDays: number;
  importanceWeight: number;
  recencyWeight: number;
}

export interface MemoryPrunePolicySettings {
  maxAgeDays: number;
  minImportanceToKeep: number;
  maxItems: number;
}

export interface MemorySettings {
  relevance: MemoryRelevanceSettings;
  maxShortTerm: number;
  maxWorking: number;
  prunePolicy?: MemoryPrunePolicySettings | null;
  pruneIntervalSecs: number;
  llmExtraction: boolean;
  llmExtractionMaxItems: number;
  llmExtractionMaxInputChars: number;
}

export interface ContextSettings extends ConfigCategoryMetadata {
  storageBackend: 'memory' | 'file' | 'custom';
  sessionsDir?: string | null;
  memoryDir?: string | null;
  storageUrl?: ConfigSecret;
  memory?: MemorySettings | null;
}

export interface SearchHealthSettings {
  maxFailures: number;
  suspendSeconds: number;
}

export interface SearchEngineSettings {
  enabled: boolean;
  weight: number;
  timeout?: number | null;
}

export interface SearchHeadlessSettings {
  backend: 'chrome' | 'lightpanda';
  maxTabs: number;
  browserPath?: string | null;
  launchArgs: string[];
  proxyUrl?: string | null;
}

export interface SearchSettings {
  timeout: number;
  health?: SearchHealthSettings | null;
  engine: Record<string, SearchEngineSettings>;
  headless?: SearchHeadlessSettings | null;
}

export interface DocumentCacheSettings {
  enabled: boolean;
  directory?: string | null;
}

export interface DocumentOcrSettings {
  enabled: boolean;
  model?: string | null;
  prompt?: string | null;
  maxImages: number;
  dpi: number;
  provider?: string | null;
  baseUrl?: string | null;
  apiKey?: ConfigSecret;
}

export interface DocumentParserSettings {
  enabled: boolean;
  maxFileSizeMb: number;
  ocr?: DocumentOcrSettings | null;
  cache?: DocumentCacheSettings | null;
}

export type McpTransportSettings =
  | { type: 'stdio'; command: string; args: string[] }
  | { type: 'http'; url: string; headers: Record<string, string> }
  | { type: 'streamable-http'; url: string; headers: Record<string, string> };

export interface McpOAuthSettings {
  auth_url: string;
  token_url: string;
  client_id: string;
  client_secret?: ConfigSecret;
  scopes: string[];
  redirect_uri: string;
  access_token?: ConfigSecret;
}

export interface McpServerSettings {
  name: string;
  transport: McpTransportSettings;
  enabled: boolean;
  env: Record<string, string>;
  oauth?: McpOAuthSettings | null;
  tool_timeout_secs: number;
}

export interface IntegrationsSettings extends ConfigCategoryMetadata {
  os?: { address: string } | null;
  search?: SearchSettings | null;
  documentParser?: DocumentParserSettings | null;
  mcpServers: McpServerSettings[];
}

export type ConfigCategorySettings = AgentSettings | ContextSettings | IntegrationsSettings;
