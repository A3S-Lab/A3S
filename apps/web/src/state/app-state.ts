import { proxy } from 'valtio';
import type { CodeSession } from '../types/api';
import {
  createCodeShellState,
  type TaskView,
  type CodeShellState,
  type ThemePreference,
  type ToastState,
} from '../features/code/code-state';
import {
  createTaskState,
  persistActiveTask,
  persistTaskDrafts,
  taskDraftKey,
  type TaskState,
} from '../features/tasks/task-state';
import { createWorkspaceState, type WorkspaceState } from '../features/workspace/workspace-state';
import { createRunsState, type RunsState } from '../features/runs/runs-state';
import { createSettingsState, type SettingsState } from '../features/settings/settings-state';
import type { SettingsTab } from '../features/settings/settings-state';
export type { TaskView, ThemePreference } from '../features/code/code-state';
type AppState = CodeShellState & TaskState & WorkspaceState & RunsState & SettingsState;

const titleStorageKey = 'a3s-code-web.session-titles';
const themeStorageKey = 'a3s-code-web.theme';
let modelChangeNoticeId = 0;

export const appState = proxy<AppState>({
  ...createCodeShellState(),
  ...createTaskState(),
  ...createWorkspaceState(),
  ...createRunsState(),
  ...createSettingsState(),
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

export function switchActiveTask(sessionId: string | null): void {
  const currentKey = taskDraftKey(appState.activeSessionId);
  appState.draftsByTask[currentKey] = {
    content: appState.composerValue,
    contextFiles: [...appState.composerContextFiles],
    skillNames: [...appState.composerSkills],
  };
  reportTaskPersistenceResult(persistTaskDrafts(appState.draftsByTask));
  appState.activeSessionId = sessionId;
  reportTaskPersistenceResult(persistActiveTask(sessionId));
  const next = appState.draftsByTask[taskDraftKey(sessionId)];
  appState.composerValue = next?.content ?? '';
  appState.composerContextFiles = [...(next?.contextFiles ?? [])];
  appState.composerSkills = [...(next?.skillNames ?? [])];
  appState.modelChangeNotice = null;
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
  appState.settingsOpen = false;
  appState.taskView = view;
  window.history.replaceState(null, '', `#code/${view}`);
}

export function navigateSettings(tab: SettingsTab): void {
  appState.settingsOpen = true;
  appState.settingsTab = tab;
  window.history.replaceState(null, '', `#settings/${tab}`);
}

export function closeSettings(): void {
  appState.settingsOpen = false;
  window.history.replaceState(null, '', `#code/${appState.taskView}`);
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
