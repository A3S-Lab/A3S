import type { AgentEvent, ChatMessage, CodeSession, EffortLevel, SessionControls } from '../../types/api';

export interface TaskState {
  sessions: CodeSession[];
  sessionTitles: Record<string, string>;
  activeSessionId: string | null;
  messagesBySession: Record<string, ChatMessage[]>;
  messagesLoading: Record<string, boolean>;
  messageErrors: Record<string, string>;
  streamingSessionId: string | null;
  streamEvents: AgentEvent[];
  composerValue: string;
  composerContextFiles: string[];
  composerSkills: string[];
  draftsByTask: Record<string, TaskDraft>;
  queuedPrompts: Record<string, QueuedPrompt[]>;
  pausedQueues: Record<string, boolean>;
  searchQuery: string;
  sessionControls: Record<string, SessionControls>;
  sessionControlsLoading: Record<string, boolean>;
  sessionControlsErrors: Record<string, string>;
  toolDecisionState: Record<string, 'approving' | 'denying' | 'approved' | 'denied'>;
  toolDecisionErrors: Record<string, string>;
  effortLevels: EffortLevel[];
  activeEffort: string;
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
export interface QueuedPrompt {
  id: string;
  content: string;
  contextFiles: string[];
  skillNames?: string[];
}
export interface TaskDraft {
  content: string;
  contextFiles: string[];
  skillNames?: string[];
}
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
const taskDraftsKey = 'a3s-code-web.task-drafts';
const queuedPromptsKey = 'a3s-code-web.queued-prompts';
const pausedQueuesKey = 'a3s-code-web.paused-queues';
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
function readActiveTask(): string | null {
  try {
    return localStorage.getItem(activeTaskKey);
  } catch {
    return null;
  }
}
export function persistActiveTask(sessionId: string | null): boolean {
  try {
    if (sessionId) localStorage.setItem(activeTaskKey, sessionId);
    else localStorage.removeItem(activeTaskKey);
    return true;
  } catch {
    return false;
  }
}
export function taskDraftKey(sessionId: string | null): string {
  return sessionId || newTaskDraftKey;
}
export function persistTaskDrafts(drafts: Record<string, TaskDraft>): boolean {
  try {
    localStorage.setItem(taskDraftsKey, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}
export function persistQueuedPrompts(queues: Record<string, QueuedPrompt[]>): boolean {
  try {
    localStorage.setItem(queuedPromptsKey, JSON.stringify(queues));
    return true;
  } catch {
    return false;
  }
}
export function persistPausedQueues(queues: Record<string, boolean>): boolean {
  try {
    localStorage.setItem(pausedQueuesKey, JSON.stringify(queues));
    return true;
  } catch {
    return false;
  }
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
export function createTaskState(): TaskState {
  const activeSessionId = readActiveTask();
  const draftsByTask = readRecord<TaskDraft>(taskDraftsKey);
  const queuedPrompts = readRecord<QueuedPrompt[]>(queuedPromptsKey);
  const pausedQueues = readRecord<boolean>(pausedQueuesKey);
  for (const [sessionId, queue] of Object.entries(queuedPrompts)) {
    if (queue.length) pausedQueues[sessionId] = true;
  }
  const activeDraft = draftsByTask[taskDraftKey(activeSessionId)];
  return {
    sessions: [],
    sessionTitles: readTitles(),
    activeSessionId,
    messagesBySession: {},
    messagesLoading: {},
    messageErrors: {},
    streamingSessionId: null,
    streamEvents: [],
    composerValue: activeDraft?.content ?? '',
    composerContextFiles: activeDraft?.contextFiles ?? [],
    composerSkills: activeDraft?.skillNames ?? [],
    draftsByTask,
    queuedPrompts,
    pausedQueues,
    searchQuery: '',
    sessionControls: {},
    sessionControlsLoading: {},
    sessionControlsErrors: {},
    toolDecisionState: {},
    toolDecisionErrors: {},
    effortLevels: [],
    activeEffort: 'medium',
    newTaskConfig: readNewTaskConfig(),
    taskConfigSaving: null,
    contextCompacting: {},
    executionTimings: {},
    goalTimings: readGoalTimings(),
    modelChangeNotice: null,
    taskPersistenceWarningShown: false,
  };
}
