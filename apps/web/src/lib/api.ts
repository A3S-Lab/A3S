import type {
  AgentEvent,
  CodeSession,
  EffortLevel,
  HealthResponse,
  LlmSettings,
  ModelCatalog,
  MessageList,
  OsAccount,
  SessionControls,
  SessionCompaction,
  SessionOutput,
  SessionList,
  WorkspaceEntry,
  WorkspaceDirectorySelection,
  WorkspaceFileCatalog,
  WorkspaceSearchFile,
  CodeDiagnosticsResult,
  CodeIntelligenceStatus,
  CodeNavigationKind,
  CodeNavigationResult,
  CodeOutlineResult,
  CodeWorkspaceSymbolResult,
  GitStatus,
  GitDiff,
  ConfigValidation,
  SkillCatalog,
} from '../types/api';
import type { AgentSettings, ContextSettings, IntegrationsSettings } from '../types/settings';

interface ApiEnvelope<T> {
  code: number;
  data: T;
  message?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function unwrapApiResponse<T>(value: unknown): T {
  if (
    value !== null &&
    typeof value === 'object' &&
    'code' in value &&
    'data' in value &&
    typeof (value as Partial<ApiEnvelope<T>>).code === 'number'
  ) {
    return (value as ApiEnvelope<T>).data;
  }
  return value as T;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') {
    for (const key of ['message', 'error', 'error_description']) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
  }
  return fallback;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(path, { ...init, headers });
  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new ApiError(errorMessage(payload, `Request failed with HTTP ${response.status}`), response.status, payload);
  }
  return unwrapApiResponse<T>(payload);
}

function jsonBody(value: unknown): Pick<RequestInit, 'body' | 'headers'> {
  return {
    body: JSON.stringify(value),
    headers: { 'Content-Type': 'application/json' },
  };
}

export interface CodeIntelligenceRequestOptions {
  sessionId?: string | null;
  signal?: AbortSignal;
}

export const codeApi = {
  health: () => apiRequest<HealthResponse>('/api/v1/health'),
  osAccount: () => apiRequest<OsAccount>('/api/v1/os/account'),
  osLogin: () =>
    apiRequest<OsAccount>('/api/v1/os/login/browser', {
      method: 'POST',
      ...jsonBody({}),
    }),
  osLogout: () =>
    apiRequest<OsAccount>('/api/v1/os/logout', {
      method: 'POST',
      ...jsonBody({}),
    }),
  llmSettings: () => apiRequest<LlmSettings>('/api/v1/config/categories/llm'),
  modelCatalog: () => apiRequest<ModelCatalog>('/api/v1/config/llm/models'),
  refreshModelCatalog: () => apiRequest<ModelCatalog>('/api/v1/config/llm/models/refresh'),
  updateLlmSettings: (patch: Partial<LlmSettings>) =>
    apiRequest<LlmSettings>('/api/v1/config/categories/llm', {
      method: 'PUT',
      ...jsonBody(patch),
    }),
  agentSettings: () => apiRequest<AgentSettings>('/api/v1/config/categories/agent'),
  updateAgentSettings: (patch: Partial<AgentSettings>) =>
    apiRequest<AgentSettings>('/api/v1/config/categories/agent', {
      method: 'PUT',
      ...jsonBody(patch),
    }),
  contextSettings: () => apiRequest<ContextSettings>('/api/v1/config/categories/context'),
  updateContextSettings: (patch: Partial<ContextSettings>) =>
    apiRequest<ContextSettings>('/api/v1/config/categories/context', {
      method: 'PUT',
      ...jsonBody(patch),
    }),
  integrationsSettings: () => apiRequest<IntegrationsSettings>('/api/v1/config/categories/integrations'),
  updateIntegrationsSettings: (patch: Partial<IntegrationsSettings>) =>
    apiRequest<IntegrationsSettings>('/api/v1/config/categories/integrations', {
      method: 'PUT',
      ...jsonBody(patch),
    }),
  validateConfig: (content: string) =>
    apiRequest<ConfigValidation>('/api/v1/config/validate', { method: 'POST', ...jsonBody({ content }) }),
  sessions: () => apiRequest<SessionList>('/api/v1/kernel/sessions'),
  createSession: (input: {
    workspace?: string;
    cwd?: string;
    model?: string;
    title?: string;
    permissionMode?: string;
  }) =>
    apiRequest<{ success: boolean; session: CodeSession }>('/api/v1/kernel/sessions', {
      method: 'POST',
      ...jsonBody({ ...input, agentId: 'default' }),
    }),
  updateSession: (sessionId: string, patch: Record<string, unknown>) =>
    apiRequest<CodeSession>(`/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      ...jsonBody(patch),
    }),
  deleteSession: (sessionId: string) =>
    apiRequest<void>(`/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    }),
  messages: (sessionId: string) =>
    apiRequest<MessageList>(`/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}/messages`),
  runMessage: (sessionId: string, content: string) =>
    apiRequest<{ accepted: boolean; events?: AgentEvent[] }>(
      `/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: 'POST',
        ...jsonBody({ content }),
      }
    ),
  cancelSession: (sessionId: string) =>
    apiRequest<{ cancelled: boolean }>(`/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}/actions/cancel`, {
      method: 'POST',
      ...jsonBody({}),
    }),
  compactSession: (sessionId: string) =>
    apiRequest<SessionCompaction>(`/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}/actions/compact`, {
      method: 'POST',
      ...jsonBody({}),
    }),
  sessionOutput: (sessionId: string) =>
    apiRequest<SessionOutput>(`/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}/output`),
  updateStatus: () => apiRequest<unknown>('/api/v1/updates/status'),
  installUpdate: (confirmedVersion: string) =>
    apiRequest<unknown>('/api/v1/updates/install', { method: 'POST', ...jsonBody({ confirmedVersion }) }),
  confirmToolUse: (sessionId: string, toolId: string, approved: boolean, reason?: string) =>
    apiRequest<{ confirmed: boolean; approved: boolean }>(
      `/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}/confirmations/${encodeURIComponent(toolId)}/confirm`,
      {
        method: 'POST',
        ...jsonBody({ approved, reason }),
      }
    ),
  sessionControls: (sessionId: string) =>
    apiRequest<SessionControls>(`/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}/controls`),
  updateSessionControls: (sessionId: string, patch: Record<string, unknown>) =>
    apiRequest<SessionControls>(`/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}/controls`, {
      method: 'PATCH',
      ...jsonBody(patch),
    }),
  effortLevels: () => apiRequest<{ items: EffortLevel[] }>('/api/v1/kernel/session-controls/efforts'),
  skills: (workspace: string) => apiRequest<SkillCatalog>(`/api/v1/plugins?workspace=${encodeURIComponent(workspace)}`),
  pickWorkspaceDirectory: () =>
    apiRequest<WorkspaceDirectorySelection>('/api/v1/workspace/actions/pick-directory', {
      method: 'POST',
      ...jsonBody({}),
    }),
  readDir: async (path: string) => {
    const entries = await apiRequest<Omit<WorkspaceEntry, 'path'>[]>(
      `/api/v1/workspace/read-dir?path=${encodeURIComponent(path)}`
    );
    return entries.map((entry) => ({
      ...entry,
      path: joinPath(path, entry.name),
    }));
  },
  workspaceFiles: (rootPath: string, query = '', maxResults = 120) =>
    apiRequest<WorkspaceFileCatalog>(
      `/api/v1/workspace/files?rootPath=${encodeURIComponent(rootPath)}&query=${encodeURIComponent(query)}&maxResults=${maxResults}`
    ),
  readFile: (path: string) =>
    apiRequest<{ content: string }>(`/api/v1/workspace/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) =>
    apiRequest<{ success: boolean }>('/api/v1/workspace/write', {
      method: 'POST',
      ...jsonBody({ path, content }),
    }),
  writeBinaryFile: (path: string, data: Uint8Array, append = false) =>
    apiRequest<{ success: boolean }>('/api/v1/workspace/write-binary', {
      method: 'POST',
      ...jsonBody({ path, data: Array.from(data), append }),
    }),
  pathExists: (path: string) =>
    apiRequest<{ exists: boolean }>(`/api/v1/workspace/exists?path=${encodeURIComponent(path)}`),
  createDirectory: (path: string) =>
    apiRequest<{ success: boolean }>('/api/v1/workspace/mkdir', { method: 'POST', ...jsonBody({ path }) }),
  createFile: (path: string) =>
    apiRequest<{ success: boolean }>('/api/v1/workspace/create-file', { method: 'POST', ...jsonBody({ path }) }),
  deletePath: (path: string) =>
    apiRequest<{ success: boolean }>(`/api/v1/workspace/delete?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
  renamePath: (src: string, dest: string) =>
    apiRequest<{ success: boolean }>('/api/v1/workspace/rename', { method: 'POST', ...jsonBody({ src, dest }) }),
  copyPath: (src: string, dest: string) =>
    apiRequest<{ success: boolean }>('/api/v1/workspace/copy', { method: 'POST', ...jsonBody({ src, dest }) }),
  gitStatus: (path: string) =>
    apiRequest<GitStatus>(`/api/v1/workspace/git-status?rootPath=${encodeURIComponent(path)}`),
  gitDiff: (rootPath: string, path?: string, staged = false) =>
    apiRequest<GitDiff>(
      `/api/v1/workspace/git-diff?rootPath=${encodeURIComponent(rootPath)}&staged=${String(staged)}${path ? `&path=${encodeURIComponent(path)}` : ''}`
    ),
  gitStage: (rootPath: string, paths: string[]) =>
    apiRequest<GitStatus>('/api/v1/workspace/git-stage', { method: 'POST', ...jsonBody({ rootPath, paths }) }),
  gitUnstage: (rootPath: string, paths: string[]) =>
    apiRequest<GitStatus>('/api/v1/workspace/git-unstage', { method: 'POST', ...jsonBody({ rootPath, paths }) }),
  gitCommit: (rootPath: string, message: string) =>
    apiRequest<{ committed: boolean; summary: string; status: GitStatus }>('/api/v1/workspace/git-commit', {
      method: 'POST',
      ...jsonBody({ rootPath, message }),
    }),
  searchWorkspace: (rootPath: string, query: string) =>
    apiRequest<WorkspaceSearchFile[]>(
      `/api/v1/workspace/search?rootPath=${encodeURIComponent(rootPath)}&query=${encodeURIComponent(query)}&maxResults=300`
    ),
  codeIntelligenceStatus: ({ sessionId, signal }: CodeIntelligenceRequestOptions = {}) =>
    apiRequest<CodeIntelligenceStatus>(`/api/v1/workspace/code-intelligence/status${apiQuery({ sessionId })}`, {
      signal,
    }),
  codeOutline: (path: string, { sessionId, signal }: CodeIntelligenceRequestOptions = {}) =>
    apiRequest<CodeOutlineResult>(`/api/v1/workspace/code-intelligence/outline${apiQuery({ path, sessionId })}`, {
      signal,
    }),
  codeSymbols: (query: string, limit = 100, { sessionId, signal }: CodeIntelligenceRequestOptions = {}) =>
    apiRequest<CodeWorkspaceSymbolResult>(
      `/api/v1/workspace/code-intelligence/symbols${apiQuery({ query, limit, sessionId })}`,
      { signal }
    ),
  codeNavigation: (
    path: string,
    line: number,
    character: number,
    kind: CodeNavigationKind,
    { sessionId, signal }: CodeIntelligenceRequestOptions = {}
  ) =>
    apiRequest<CodeNavigationResult>(
      `/api/v1/workspace/code-intelligence/navigation${apiQuery({ path, line, character, kind, sessionId })}`,
      { signal }
    ),
  codeDiagnostics: (path?: string, { sessionId, signal }: CodeIntelligenceRequestOptions = {}) =>
    apiRequest<CodeDiagnosticsResult>(
      `/api/v1/workspace/code-intelligence/diagnostics${apiQuery({ path, sessionId })}`,
      { signal }
    ),
  replaceWorkspace: (input: { rootPath: string; query: string; replacement: string; filePaths?: string[] }) =>
    apiRequest<{
      filesModified: number;
      totalReplacements: number;
      files: Array<{ path: string; replacements: number }>;
    }>('/api/v1/workspace/replace', {
      method: 'POST',
      ...jsonBody(input),
    }),
};

function joinPath(parent: string, child: string): string {
  const separator = parent.includes('\\') && !parent.includes('/') ? '\\' : '/';
  return `${parent.replace(/[\\/]$/, '')}${separator}${child}`;
}

function apiQuery(values: Record<string, string | number | null | undefined>): string {
  const entries = Object.entries(values).filter((entry): entry is [string, string | number] => {
    const value = entry[1];
    return value !== undefined && value !== null;
  });
  if (!entries.length) return '';
  return `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')}`;
}

export interface StreamHandlers {
  onEvent: (event: AgentEvent) => void;
}

export async function streamSessionMessage(
  sessionId: string,
  content: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const path = `/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}/messages/stream`;
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
    signal,
  });

  if (response.status === 404 || response.status === 405) {
    const result = await codeApi.runMessage(sessionId, content);
    for (const event of result.events ?? []) handlers.onEvent(event);
    return;
  }
  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new ApiError(errorMessage(payload, `Stream failed with HTTP ${response.status}`), response.status, payload);
  }
  if (!response.body) throw new ApiError('The server returned an empty stream', 502);

  let terminalError: string | undefined;
  await consumeEventStream(response.body, (event) => {
    handlers.onEvent(event);
    if (event.type === 'error') terminalError = typeof event.message === 'string' ? event.message : '任务执行失败';
  });
  if (terminalError) throw new ApiError(terminalError, 500);
}

export async function consumeEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: AgentEvent) => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';
    for (const frame of frames) emitSseFrame(frame, onEvent);
    if (done) break;
  }
  if (buffer.trim()) emitSseFrame(buffer, onEvent);
}

function emitSseFrame(frame: string, onEvent: (event: AgentEvent) => void): void {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data || data === '[DONE]') return;
  try {
    onEvent(unwrapApiResponse<AgentEvent>(JSON.parse(data) as unknown));
  } catch {
    onEvent({ type: 'text_delta', text: data });
  }
}
