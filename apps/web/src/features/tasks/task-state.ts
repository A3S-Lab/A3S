import type { AgentEvent, ChatMessage, CodeSession, EffortLevel, SessionControls, TurnQueue } from '../../types/api';

export interface TaskState {
  sessions: CodeSession[];
  sessionTitles: Record<string, string>;
  activeSessionId: string | null;
  messagesBySession: Record<string, ChatMessage[]>;
  messagesLoading: Record<string, boolean>;
  messageErrors: Record<string, string>;
  streamingSessionId: string | null;
  taskSubmissionState: 'creating' | 'queueing' | null;
  streamEvents: AgentEvent[];
  composerValue: string;
  composerContextFiles: string[];
  composerSkills: string[];
  composerMode: ComposerMode;
  draftsByTask: Record<string, TaskDraft>;
  turnQueues: Record<string, TurnQueue>;
  turnQueueLoading: Record<string, boolean>;
  turnQueueErrors: Record<string, string>;
  searchQuery: string;
  sessionControls: Record<string, SessionControls>;
  sessionControlsLoading: Record<string, boolean>;
  sessionControlsErrors: Record<string, string>;
  toolDecisionState: Record<string, 'approving' | 'denying' | 'approved' | 'denied'>;
  toolDecisionErrors: Record<string, string>;
  effortLevels: EffortLevel[];
  newTaskConfig: NewTaskConfig;
  taskConfigSaving: 'model' | 'effort' | 'permission' | 'goal' | null;
  contextCompacting: Record<string, boolean>;
  executionTimings: Record<string, TaskExecutionTiming>;
  goalTimings: Record<string, GoalTiming>;
  modelChangeNotice: ModelChangeNotice | null;
  taskPersistenceWarningShown: boolean;
}
export interface ModelChangeNotice {
  id: number;
  sessionId: string | null;
  previousModel: string;
  currentModel: string;
}
export interface TaskDraft {
  content: string;
  contextFiles: string[];
  skillNames?: string[];
  mode?: Extract<ComposerMode, 'deepResearch'>;
}
export type ComposerMode = 'standard' | 'deepResearch';
export interface TaskExecutionTiming {
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'cancelled' | 'failed';
}
export interface GoalTiming {
  goal: string;
  startedAt: number;
  completedAt?: number;
}
export interface NewTaskConfig {
  workspace: string;
  model: string;
  effort: string;
  permissionMode: string;
  goal: string;
}
function readTitles(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('a3s-code-web.session-titles') ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}
const activeTaskKey = 'a3s-code-web.active-task';
const workActiveTaskKey = 'a3s-work.ai-assistant.active-session';
const taskDraftsKey = 'a3s-code-web.task-drafts';
const newTaskConfigKey = 'a3s-code-web.new-task-config';
const goalTimingsKey = 'a3s-code-web.goal-timings';
export const newTaskDraftKey = '__new_task__';

function readRecord<T>(key: string): Record<string, T> {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {};
  } catch {
    return {};
  }
}
export type TaskProduct = 'code' | 'work';

export function readActiveTask(product: TaskProduct = 'code'): string | null {
  try {
    return localStorage.getItem(product === 'work' ? workActiveTaskKey : activeTaskKey);
  } catch {
    return null;
  }
}
export function persistActiveTask(sessionId: string | null, product: TaskProduct = 'code'): boolean {
  try {
    const key = product === 'work' ? workActiveTaskKey : activeTaskKey;
    if (sessionId) localStorage.setItem(key, sessionId);
    else localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
export function taskDraftKey(sessionId: string | null, product: TaskProduct = 'code'): string {
  return sessionId || (product === 'work' ? '__work_ai_assistant__' : newTaskDraftKey);
}
export function persistTaskDrafts(drafts: Record<string, TaskDraft>): boolean {
  try {
    localStorage.setItem(taskDraftsKey, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

export function createTaskDraft(
  content: string,
  contextFiles: readonly string[],
  skillNames: readonly string[],
  mode: ComposerMode
): TaskDraft {
  const draft: TaskDraft = {
    content,
    contextFiles: [...contextFiles],
    skillNames: [...skillNames],
  };
  if (mode === 'deepResearch') draft.mode = mode;
  return draft;
}
export function persistNewTaskConfig(config: NewTaskConfig): boolean {
  try {
    localStorage.setItem(newTaskConfigKey, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}
export function persistGoalTimings(timings: Record<string, GoalTiming>): boolean {
  try {
    localStorage.setItem(goalTimingsKey, JSON.stringify(timings));
    return true;
  } catch {
    return false;
  }
}
function readGoalTimings(): Record<string, GoalTiming> {
  const stored = readRecord<GoalTiming>(goalTimingsKey);
  return Object.fromEntries(
    Object.entries(stored).filter(
      ([, timing]) =>
        typeof timing?.goal === 'string' &&
        timing.goal.trim().length > 0 &&
        Number.isFinite(timing.startedAt) &&
        timing.startedAt > 0 &&
        (timing.completedAt === undefined || Number.isFinite(timing.completedAt))
    )
  );
}
function readNewTaskConfig(): NewTaskConfig {
  try {
    const value = JSON.parse(localStorage.getItem(newTaskConfigKey) ?? '{}') as Partial<NewTaskConfig>;
    return {
      workspace: typeof value.workspace === 'string' ? value.workspace : '',
      model: typeof value.model === 'string' ? value.model : '',
      effort: typeof value.effort === 'string' ? value.effort : 'medium',
      permissionMode: ['default', 'plan', 'auto'].includes(value.permissionMode ?? '')
        ? (value.permissionMode as string)
        : 'default',
      goal: typeof value.goal === 'string' ? value.goal : '',
    };
  } catch {
    return { workspace: '', model: '', effort: 'medium', permissionMode: 'default', goal: '' };
  }
}
export function createTaskState(product: TaskProduct = 'code'): TaskState {
  const activeSessionId = readActiveTask(product);
  const draftsByTask = readTaskDrafts();
  const activeDraft = draftsByTask[taskDraftKey(activeSessionId, product)];
  return {
    sessions: [],
    sessionTitles: readTitles(),
    activeSessionId,
    messagesBySession: {},
    messagesLoading: {},
    messageErrors: {},
    streamingSessionId: null,
    taskSubmissionState: null,
    streamEvents: [],
    composerValue: activeDraft?.content ?? '',
    composerContextFiles: activeDraft?.contextFiles ?? [],
    composerSkills: activeDraft?.skillNames ?? [],
    composerMode: activeDraft?.mode === 'deepResearch' && product === 'code' ? 'deepResearch' : 'standard',
    draftsByTask,
    turnQueues: {},
    turnQueueLoading: {},
    turnQueueErrors: {},
    searchQuery: '',
    sessionControls: {},
    sessionControlsLoading: {},
    sessionControlsErrors: {},
    toolDecisionState: {},
    toolDecisionErrors: {},
    effortLevels: [],
    newTaskConfig: readNewTaskConfig(),
    taskConfigSaving: null,
    contextCompacting: {},
    executionTimings: {},
    goalTimings: readGoalTimings(),
    modelChangeNotice: null,
    taskPersistenceWarningShown: false,
  };
}

function readTaskDrafts(): Record<string, TaskDraft> {
  const drafts = readRecord<TaskDraft>(taskDraftsKey);
  let changed = false;
  for (const [key, draft] of Object.entries(drafts)) {
    if (!isLegacyEditorInjectedDraft(draft)) continue;
    delete drafts[key];
    changed = true;
  }
  if (changed) persistTaskDrafts(drafts);
  return drafts;
}

function isLegacyEditorInjectedDraft(draft: TaskDraft | undefined): boolean {
  if (!draft || !Array.isArray(draft.contextFiles) || draft.contextFiles.length !== 1) return false;
  const content = typeof draft.content === 'string' ? draft.content.trim() : '';
  if (
    ![
      '请查看当前代码文件，并回答我的问题',
      '请查看当前代码文件，并回答我的问题：',
      '请查看当前代码文件，并回答我的问题。',
    ].includes(content)
  ) {
    return false;
  }
  const fileName = draft.contextFiles[0]?.replaceAll('\\', '/').split('/').pop()?.toUpperCase();
  return fileName === 'CLAUDE.MD' || fileName === 'CLAUD.MD';
}
