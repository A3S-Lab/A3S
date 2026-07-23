import { proxy } from 'valtio';
import {
  type CodeShellState,
  createCodeShellState,
  type ProductId,
  type TaskView,
  type ThemePreference,
  type ToastState,
} from '../features/code/code-state';
import { createKnowledgeState, type KnowledgeState } from '../features/knowledge/knowledge-state';
import { createMemoryState, type MemoryState } from '../features/memory/memory-state';
import { createPluginsState, type PluginsState } from '../features/plugins/plugin-state';
import { createRunsState, type RunsState } from '../features/runs/runs-state';
import {
  type ChannelSettingsTab,
  createSettingsState,
  type SettingsState,
  type SettingsTab,
  settingsHashForTab,
} from '../features/settings/settings-state';
import {
  createTaskDraft,
  createTaskState,
  persistActiveTask,
  persistTaskDrafts,
  readActiveTask,
  type TaskProduct,
  type TaskState,
  taskDraftKey,
} from '../features/tasks/task-state';
import { rememberTaskContextFocus, restoreTaskContextFocus } from '../features/tasks/task-context-focus';
import {
  captureWorkspaceTaskSnapshot,
  createWorkspaceState,
  createWorkspaceTaskState,
  normalizePath,
  persistWorkspaceTaskSnapshots,
  restoreWorkspaceTaskState,
  type WorkspaceState,
} from '../features/workspace/workspace-state';
import { createWeixinRemoteState, type WeixinRemoteState } from '../features/weixin-remote/weixin-remote-state';
import type { CodeSession } from '../types/api';
export type { ProductId, TaskView, ThemePreference } from '../features/code/code-state';

type AppState = CodeShellState &
  TaskState &
  WorkspaceState &
  RunsState &
  SettingsState &
  MemoryState &
  PluginsState &
  KnowledgeState &
  WeixinRemoteState;

const titleStorageKey = 'a3s-code-web.session-titles';
const themeStorageKey = 'a3s-code-web.theme';
let modelChangeNoticeId = 0;

const initialShellState = createCodeShellState();
const initialTaskProduct: TaskProduct = initialShellState.activeProduct === 'work' ? 'work' : 'code';
const initialTaskState = createTaskState(initialTaskProduct);
const initialTaskKey = taskDraftKey(initialTaskState.activeSessionId, initialTaskProduct);
const initialWorkspaceState = createWorkspaceState(initialTaskKey);
const initialWorkspaceSnapshot = initialWorkspaceState.workspaceSnapshotsByTask[initialTaskKey];
if (initialWorkspaceSnapshot) initialShellState.taskView = initialWorkspaceSnapshot.taskView;

export const appState = proxy<AppState>({
  ...initialShellState,
  ...initialTaskState,
  ...initialWorkspaceState,
  ...createRunsState(),
  ...createSettingsState(),
  ...createMemoryState(),
  ...createPluginsState(),
  ...createKnowledgeState(),
  ...createWeixinRemoteState(),
});

export function persistSessionTitle(sessionId: string, title: string): boolean {
  const normalized = title.trim().slice(0, 72) || '新任务';
  appState.sessionTitles[sessionId] = normalized;
  try {
    localStorage.setItem(titleStorageKey, JSON.stringify(appState.sessionTitles));
    return true;
  } catch {
    return false;
  }
}
export function removePersistedSessionTitle(sessionId: string): boolean {
  delete appState.sessionTitles[sessionId];
  try {
    localStorage.setItem(titleStorageKey, JSON.stringify(appState.sessionTitles));
    return true;
  } catch {
    return false;
  }
}

export function sessionTitle(
  session: Pick<CodeSession, 'sessionId' | 'title'>,
  titles: Readonly<Record<string, string>> = appState.sessionTitles
): string {
  return titles[session.sessionId] || session.title?.trim() || '新任务';
}

export interface WorkspaceContext {
  generation: number;
  workspaceRoot: string;
}

export function captureWorkspaceContext(): WorkspaceContext {
  return {
    generation: appState.workspaceGeneration,
    workspaceRoot: appState.workspaceRoot,
  };
}

export function isWorkspaceContextCurrent(context: WorkspaceContext): boolean {
  return (
    context.generation === appState.workspaceGeneration &&
    sameWorkspaceRoot(context.workspaceRoot, appState.workspaceRoot)
  );
}

export function switchActiveTask(sessionId: string | null, workspaceRoot?: string): boolean {
  const product = activeTaskProduct();
  if (sessionId === appState.activeSessionId) {
    const resolvedRoot = resolveWorkspaceRoot(sessionId, workspaceRoot, product);
    if (resolvedRoot && !sameWorkspaceRoot(resolvedRoot, appState.workspaceRoot)) {
      replaceActiveWorkspace(resolvedRoot);
    }
    return true;
  }

  const currentKey = taskDraftKey(appState.activeSessionId, product);
  appState.draftsByTask[currentKey] = createTaskDraft(
    appState.composerValue,
    appState.composerContextFiles,
    appState.composerSkills,
    appState.composerMode
  );
  reportTaskPersistenceResult(persistTaskDrafts(appState.draftsByTask));
  appState.workspaceSnapshotsByTask[currentKey] = captureWorkspaceTaskSnapshot(appState, appState.taskView);
  appState.activeSessionId = sessionId;
  reportTaskPersistenceResult(persistActiveTask(sessionId, product));
  const nextKey = taskDraftKey(sessionId, product);
  const resolvedRoot = resolveWorkspaceRoot(sessionId, workspaceRoot, product);
  const stored = appState.workspaceSnapshotsByTask[nextKey];
  const nextWorkspace =
    stored && sameWorkspaceRoot(stored.state.workspaceRoot, resolvedRoot)
      ? stored
      : { taskView: 'conversation' as const, state: createWorkspaceTaskState(resolvedRoot) };
  if (stored && stored !== nextWorkspace) delete appState.workspaceSnapshotsByTask[nextKey];
  restoreWorkspaceTaskState(appState, nextWorkspace.state);
  appState.taskView = nextWorkspace.taskView;
  appState.workspaceGeneration += 1;
  appState.fileQuickOpenOpen = false;
  appState.commandPaletteOpen = false;
  const nextDraft = appState.draftsByTask[nextKey];
  appState.composerValue = nextDraft?.content ?? '';
  appState.composerContextFiles = [...(nextDraft?.contextFiles ?? [])];
  appState.composerSkills = [...(nextDraft?.skillNames ?? [])];
  appState.composerMode = nextDraft?.mode === 'deepResearch' && product === 'code' ? 'deepResearch' : 'standard';
  appState.modelChangeNotice = null;
  reportTaskPersistenceResult(persistActiveWorkspaceTask());
  return true;
}

export function promoteActiveTask(sessionId: string, workspaceRoot: string): void {
  const product = activeTaskProduct();
  if (appState.activeSessionId) {
    switchActiveTask(sessionId, workspaceRoot);
    return;
  }
  const preparedDraftKey = taskDraftKey(null, product);
  appState.draftsByTask[taskDraftKey(sessionId, product)] = createTaskDraft(
    appState.composerValue,
    appState.composerContextFiles,
    appState.composerSkills,
    appState.composerMode
  );
  delete appState.draftsByTask[preparedDraftKey];
  reportTaskPersistenceResult(persistTaskDrafts(appState.draftsByTask));
  const rootChanged = !sameWorkspaceRoot(appState.workspaceRoot, workspaceRoot);
  if (rootChanged) {
    restoreWorkspaceTaskState(appState, createWorkspaceTaskState(workspaceRoot));
    appState.taskView = 'conversation';
    appState.workspaceGeneration += 1;
  } else {
    appState.workspaceRoot = workspaceRoot;
  }
  delete appState.workspaceSnapshotsByTask[preparedDraftKey];
  appState.activeSessionId = sessionId;
  reportTaskPersistenceResult(persistActiveTask(sessionId, product));
  appState.modelChangeNotice = null;
  reportTaskPersistenceResult(persistActiveWorkspaceTask());
}

export function replaceActiveWorkspace(workspaceRoot: string): void {
  if (sameWorkspaceRoot(workspaceRoot, appState.workspaceRoot)) {
    appState.workspaceRoot = workspaceRoot;
    reportTaskPersistenceResult(persistActiveWorkspaceTask());
    return;
  }
  const key = taskDraftKey(appState.activeSessionId, activeTaskProduct());
  delete appState.workspaceSnapshotsByTask[key];
  restoreWorkspaceTaskState(appState, createWorkspaceTaskState(workspaceRoot));
  appState.taskView = 'conversation';
  appState.workspaceGeneration += 1;
  appState.fileQuickOpenOpen = false;
  reportTaskPersistenceResult(persistActiveWorkspaceTask());
}

export function removeWorkspaceTaskSnapshot(sessionId: string): void {
  delete appState.workspaceSnapshotsByTask[taskDraftKey(sessionId, activeTaskProduct())];
  reportTaskPersistenceResult(persistActiveWorkspaceTask());
}

function persistActiveWorkspaceTask(product: TaskProduct = activeTaskProduct()): boolean {
  return persistWorkspaceTaskSnapshots(
    appState.workspaceSnapshotsByTask,
    taskDraftKey(appState.activeSessionId, product),
    appState,
    appState.taskView
  );
}

function resolveWorkspaceRoot(
  sessionId: string | null,
  explicit?: string,
  product: TaskProduct = activeTaskProduct()
): string {
  const requested = explicit?.trim();
  if (requested) return requested;
  const sessionWorkspace = sessionId
    ? appState.sessions.find((session) => session.sessionId === sessionId)?.workspace.trim()
    : '';
  if (sessionWorkspace) return sessionWorkspace;
  const storedWorkspace = appState.workspaceSnapshotsByTask[taskDraftKey(sessionId, product)]?.state.workspaceRoot;
  if (product === 'work') return storedWorkspace || appState.workspaceRoot || appState.health?.workspace.trim() || '';
  return (
    appState.newTaskConfig.workspace.trim() ||
    storedWorkspace ||
    appState.health?.workspace.trim() ||
    appState.workspaceRoot
  );
}

function sameWorkspaceRoot(left: string, right: string): boolean {
  const normalizedLeft = normalizePath(left).replace(/\/$/, '');
  const normalizedRight = normalizePath(right).replace(/\/$/, '');
  if (/^[A-Za-z]:\//.test(normalizedLeft) || /^[A-Za-z]:\//.test(normalizedRight)) {
    return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
  }
  return normalizedLeft === normalizedRight;
}

export function reportTaskPersistenceResult(persisted: boolean): void {
  if (persisted || appState.taskPersistenceWarningShown) return;
  appState.taskPersistenceWarningShown = true;
  showToast('当前页面内容仍保留，但浏览器无法保存本地状态；刷新前请复制重要草稿。', 'error');
}

export function setTheme(theme: ThemePreference): void {
  appState.theme = theme;
  applyTheme(theme);
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    reportTaskPersistenceResult(false);
  }
}

export function applyTheme(theme = appState.theme): void {
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function showToast(message: string, tone: ToastState['tone'] = 'info'): void {
  appState.toast = { id: Date.now(), tone, message };
}

export function showModelChangeNotice(sessionId: string | null, previousModel: string, currentModel: string): void {
  if (!currentModel || previousModel === currentModel) return;
  modelChangeNoticeId += 1;
  appState.modelChangeNotice = {
    id: modelChangeNoticeId,
    sessionId,
    previousModel,
    currentModel,
  };
}

export function clearModelChangeNotice(id: number): void {
  if (appState.modelChangeNotice?.id === id) appState.modelChangeNotice = null;
}

export function appendTaskInstruction(content: string): void {
  appState.composerValue = [appState.composerValue.trim(), content.trim()].filter(Boolean).join('\n\n');
}

export function navigateTask(view: TaskView): void {
  activateTaskProduct('code');
  const previousView = appState.taskView;
  if (previousView === 'conversation' && view !== 'conversation') rememberTaskContextFocus(view);
  appState.settingsOpen = false;
  appState.activeProduct = 'code';
  appState.codeSurface = 'tasks';
  if (view === 'conversation') appState.workspacePresentation = 'docked';
  appState.taskView = view;
  window.history.replaceState(null, '', `#code/${view}`);
  if (previousView !== 'conversation' && view === 'conversation') restoreTaskContextFocus(previousView);
}

export function navigateMemory(): void {
  activateTaskProduct('code');
  appState.settingsOpen = false;
  appState.activeProduct = 'code';
  appState.codeSurface = 'memory';
  window.history.replaceState(null, '', '#code/memory');
}

export function navigateProduct(product: ProductId): void {
  if (product === 'code') {
    navigateTask(appState.taskView);
    return;
  }
  if (product === 'work') activateTaskProduct('work');
  if (product === 'plugin') {
    if (appState.activePluginKey) navigatePlugin(appState.activePluginKey);
    else navigateTask('conversation');
    return;
  }
  if (product === 'plugins') {
    navigatePlugins();
    return;
  }
  if (product === 'knowledge') {
    navigateKnowledge();
    return;
  }
  appState.settingsOpen = false;
  appState.commandPaletteOpen = false;
  appState.activeProduct = product;
  window.history.replaceState(null, '', '#work/home');
}

export function navigatePlugin(key: string): void {
  const contribution = appState.pluginCatalog.items.find((item) => item.key === key && item.enabled);
  if (!contribution) {
    navigateTask('conversation');
    return;
  }
  appState.settingsOpen = false;
  appState.commandPaletteOpen = false;
  appState.activeProduct = 'plugin';
  appState.activePluginKey = contribution.key;
  appState.pluginRuntimeError = null;
  window.history.replaceState(null, '', `#plugin/${encodeURIComponent(contribution.key)}`);
}

export function navigatePlugins(): void {
  appState.settingsOpen = false;
  appState.commandPaletteOpen = false;
  appState.activeProduct = 'plugins';
  window.history.replaceState(null, '', '#plugins');
}

export function navigateKnowledge(): void {
  appState.settingsOpen = false;
  appState.commandPaletteOpen = false;
  appState.activeProduct = 'knowledge';
  window.history.replaceState(null, '', '#knowledge');
}

function activeTaskProduct(): TaskProduct {
  return appState.activeProduct === 'work' ? 'work' : 'code';
}

function activateTaskProduct(product: TaskProduct): void {
  const currentProduct = activeTaskProduct();
  if (currentProduct === product) return;
  const currentKey = taskDraftKey(appState.activeSessionId, currentProduct);
  appState.draftsByTask[currentKey] = createTaskDraft(
    appState.composerValue,
    appState.composerContextFiles,
    appState.composerSkills,
    appState.composerMode
  );
  reportTaskPersistenceResult(persistTaskDrafts(appState.draftsByTask));
  reportTaskPersistenceResult(persistActiveTask(appState.activeSessionId, currentProduct));
  appState.workspaceSnapshotsByTask[currentKey] = captureWorkspaceTaskSnapshot(appState, appState.taskView);

  const sessionId = readActiveTask(product);
  const nextKey = taskDraftKey(sessionId, product);
  const draft = appState.draftsByTask[nextKey];
  const workspaceRoot = resolveWorkspaceRoot(sessionId, undefined, product);
  const storedWorkspace = appState.workspaceSnapshotsByTask[nextKey];
  const nextWorkspace =
    storedWorkspace && sameWorkspaceRoot(storedWorkspace.state.workspaceRoot, workspaceRoot)
      ? storedWorkspace
      : { taskView: 'conversation' as const, state: createWorkspaceTaskState(workspaceRoot) };
  if (storedWorkspace && storedWorkspace !== nextWorkspace) delete appState.workspaceSnapshotsByTask[nextKey];
  appState.activeSessionId = sessionId;
  appState.activeProduct = product;
  restoreWorkspaceTaskState(appState, nextWorkspace.state);
  appState.taskView = nextWorkspace.taskView;
  appState.workspaceGeneration += 1;
  appState.composerValue = draft?.content ?? '';
  appState.composerContextFiles = [...(draft?.contextFiles ?? [])];
  appState.composerSkills = [...(draft?.skillNames ?? [])];
  appState.composerMode = draft?.mode === 'deepResearch' && product === 'code' ? 'deepResearch' : 'standard';
  appState.streamEvents = [];
  appState.modelChangeNotice = null;
  appState.fileQuickOpenOpen = false;
  appState.commandPaletteOpen = false;
  reportTaskPersistenceResult(persistActiveWorkspaceTask(product));
}

export function navigateSettings(tab: SettingsTab): void {
  appState.settingsOpen = true;
  appState.settingsTab = tab;
  window.history.replaceState(null, '', settingsHashForTab(tab, appState.settingsChannel));
}

export function navigateSettingsChannel(channel: ChannelSettingsTab): void {
  appState.settingsOpen = true;
  appState.settingsTab = 'channels';
  appState.settingsChannel = channel;
  window.history.replaceState(null, '', settingsHashForTab('channels', channel));
}

export function closeSettings(): void {
  appState.settingsOpen = false;
  window.history.replaceState(
    null,
    '',
    appState.activeProduct === 'plugin' && appState.activePluginKey
      ? `#plugin/${encodeURIComponent(appState.activePluginKey)}`
      : appState.activeProduct === 'plugins'
        ? '#plugins'
        : appState.activeProduct === 'knowledge'
          ? '#knowledge'
          : appState.activeProduct === 'work'
            ? '#work/home'
            : appState.codeSurface === 'memory'
              ? '#code/memory'
              : `#code/${appState.taskView}`
  );
}

export function clearToast(id: number): void {
  if (appState.toast?.id === id) appState.toast = null;
}

export function formatApiError(error: unknown): string {
  if (!(error instanceof Error)) return '发生了未知错误';
  if (error.message === 'Failed to fetch' || error.message.includes('NetworkError'))
    return '无法访问本地 A3S Code 服务。';
  return error.message;
}
