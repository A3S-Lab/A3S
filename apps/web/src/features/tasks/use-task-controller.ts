import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef } from 'react';
import { subscribeKey } from 'valtio/utils';
import { codeApi, streamSessionMessage } from '../../lib/api';
import {
  appState,
  formatApiError,
  persistSessionTitle,
  reportTaskPersistenceResult,
  removePersistedSessionTitle,
  showModelChangeNotice,
  showToast,
} from '../../state/app-state';
import type { AgentEvent, ChatMessage, CodeSession } from '../../types/api';
import { parseGoalCommand, type GoalCommand } from './goal-command';
import {
  persistActiveTask,
  persistGoalTimings,
  persistNewTaskConfig,
  persistPausedQueues,
  persistQueuedPrompts,
  persistTaskDrafts,
  newTaskDraftKey,
  taskDraftKey,
} from './task-state';

function temporaryMessage(sessionId: string, role: 'user' | 'assistant', content: string): ChatMessage {
  return {
    id: `local-${Date.now()}-${role}-${Math.random().toString(16).slice(2)}`,
    sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
    pending: role === 'assistant',
    events: [],
  };
}
function promptTitle(prompt: string): string {
  return (
    prompt
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[/#>]+\s*/, '')
      .slice(0, 48) || '新任务'
  );
}
export function composeTaskPrompt(content: string, contextFiles: string[], skillNames: string[] = []): string {
  const sections: string[] = [];
  if (skillNames.length) {
    sections.push(
      `[Selected skills]\n${skillNames.map((name) => `- Use your \`${name}\` skill.`).join('\n')}\n[/Selected skills]`
    );
  }
  if (contextFiles.length) {
    sections.push(
      `[Workspace context files]\n${contextFiles.map((path) => `- ${path}`).join('\n')}\n[/Workspace context files]`
    );
  }
  sections.push(content);
  return sections.join('\n\n');
}
function sessionIndex(sessionId: string): number {
  return appState.sessions.findIndex((session) => session.sessionId === sessionId);
}
function activeAssistant(sessionId: string): ChatMessage | undefined {
  return [...(appState.messagesBySession[sessionId] ?? [])]
    .reverse()
    .find((message) => message.role === 'assistant' && message.pending);
}

export function applyAssistantStreamEvent(assistant: ChatMessage, event: AgentEvent): void {
  assistant.events ??= [];
  assistant.events.push(event);
  switch (event.type) {
    case 'text_delta':
      assistant.content += typeof event.text === 'string' ? event.text : '';
      break;
    case 'reasoning_delta':
      assistant.reasoning = `${assistant.reasoning ?? ''}${typeof event.text === 'string' ? event.text : ''}`;
      break;
    case 'agent_end':
      if (!assistant.content && typeof event.text === 'string') assistant.content = event.text;
      assistant.pending = false;
      break;
    case 'error':
    case 'cancelled':
      assistant.pending = false;
      break;
    default:
      break;
  }
}

function clearSessionToolDecisions(sessionId: string): void {
  const prefix = `${sessionId}:`;
  for (const key of Object.keys(appState.toolDecisionState)) {
    if (key.startsWith(prefix)) delete appState.toolDecisionState[key];
  }
  for (const key of Object.keys(appState.toolDecisionErrors)) {
    if (key.startsWith(prefix)) delete appState.toolDecisionErrors[key];
  }
}

async function cacheWorkspaceDirectory(workspace: string): Promise<void> {
  appState.directoryLoading[workspace] = true;
  delete appState.directoryErrors[workspace];
  try {
    appState.filesByDirectory[workspace] = await codeApi.readDir(workspace);
    appState.expandedDirectories[workspace] = true;
  } catch (error) {
    appState.directoryErrors[workspace] = formatApiError(error);
    throw error;
  } finally {
    appState.directoryLoading[workspace] = false;
  }
}

export function useTaskController() {
  const abortRef = useRef<AbortController | null>(null);
  const persistCurrentDraft = useMemoizedFn(() => {
    const key = taskDraftKey(appState.activeSessionId);
    appState.draftsByTask[key] = {
      content: appState.composerValue,
      contextFiles: [...appState.composerContextFiles],
      skillNames: [...appState.composerSkills],
    };
    reportTaskPersistenceResult(persistTaskDrafts(appState.draftsByTask));
  });
  const restoreDraft = useMemoizedFn((sessionId: string | null) => {
    const draft = appState.draftsByTask[taskDraftKey(sessionId)];
    appState.composerValue = draft?.content ?? '';
    appState.composerContextFiles = [...(draft?.contextFiles ?? [])];
    appState.composerSkills = [...(draft?.skillNames ?? [])];
  });
  useEffect(() => {
    const persist = () => persistCurrentDraft();
    const unsubscribeValue = subscribeKey(appState, 'composerValue', persist, true);
    const unsubscribeContext = subscribeKey(appState, 'composerContextFiles', persist, true);
    const unsubscribeSkills = subscribeKey(appState, 'composerSkills', persist, true);
    return () => {
      unsubscribeValue();
      unsubscribeContext();
      unsubscribeSkills();
    };
  }, [persistCurrentDraft]);
  const loadMessages = useMemoizedFn(async (sessionId: string) => {
    appState.messagesLoading[sessionId] = true;
    delete appState.messageErrors[sessionId];
    try {
      appState.messagesBySession[sessionId] = (await codeApi.messages(sessionId)).items;
    } catch (error) {
      const message = formatApiError(error);
      appState.messageErrors[sessionId] = message;
      showToast(message, 'error');
    } finally {
      appState.messagesLoading[sessionId] = false;
    }
  });
  const loadControls = useMemoizedFn(async (sessionId: string) => {
    appState.sessionControlsLoading[sessionId] = true;
    delete appState.sessionControlsErrors[sessionId];
    try {
      const controls = await codeApi.sessionControls(sessionId);
      appState.sessionControls[sessionId] = controls;
      appState.activeEffort = controls.effort;
    } catch (error) {
      appState.sessionControlsErrors[sessionId] = formatApiError(error);
      throw error;
    } finally {
      appState.sessionControlsLoading[sessionId] = false;
    }
  });
  const selectSession = useMemoizedFn(async (sessionId: string) => {
    persistCurrentDraft();
    const session = appState.sessions.find((item) => item.sessionId === sessionId);
    appState.activeSessionId = sessionId;
    appState.taskView = 'conversation';
    if (session?.workspace) {
      appState.workspaceRoot = session.workspace;
      if (!appState.filesByDirectory[session.workspace]) {
        void cacheWorkspaceDirectory(session.workspace).catch(() => undefined);
      }
    }
    reportTaskPersistenceResult(persistActiveTask(sessionId));
    restoreDraft(sessionId);
    if (!appState.messagesBySession[sessionId]) await loadMessages(sessionId);
    try {
      await loadControls(sessionId);
    } catch {
      // The Composer owns the persistent error and retry path.
    }
  });
  const reloadActiveTask = useMemoizedFn(async () => {
    const sessionId = appState.activeSessionId;
    if (!sessionId) return;
    await Promise.all([loadMessages(sessionId), loadControls(sessionId).catch(() => undefined)]);
  });
  const createSession = useMemoizedFn(async (title = '新任务', model?: string): Promise<CodeSession> => {
    const config = appState.newTaskConfig;
    const requestedGoal = config.goal.trim();
    const preparedGoalTiming = appState.goalTimings[newTaskDraftKey];
    const workspace = config.workspace.trim() || appState.workspaceRoot || appState.health?.workspace;
    const response = await codeApi.createSession({
      workspace,
      cwd: workspace,
      model: model || config.model || appState.selectedModel || appState.llm?.defaultModel || undefined,
      title,
      permissionMode: config.permissionMode,
    });
    const session = response.session;
    appState.sessions.unshift(session);
    appState.activeSessionId = session.sessionId;
    appState.taskView = 'conversation';
    appState.workspaceRoot = session.workspace;
    reportTaskPersistenceResult(persistActiveTask(session.sessionId));
    appState.messagesBySession[session.sessionId] = [];
    reportTaskPersistenceResult(persistSessionTitle(session.sessionId, title));
    appState.sessionControlsLoading[session.sessionId] = true;
    try {
      const controls = await codeApi.updateSessionControls(session.sessionId, {
        effort: config.effort,
        goal: requestedGoal || null,
      });
      appState.sessionControls[session.sessionId] = controls;
      appState.activeEffort = controls.effort;
      delete appState.sessionControlsErrors[session.sessionId];
      if (controls.goal) {
        appState.goalTimings[session.sessionId] =
          preparedGoalTiming?.goal === controls.goal
            ? { ...preparedGoalTiming }
            : { goal: controls.goal, startedAt: Date.now() };
      }
      delete appState.goalTimings[newTaskDraftKey];
      reportTaskPersistenceResult(persistGoalTimings(appState.goalTimings));
      appState.newTaskConfig.goal = '';
      reportTaskPersistenceResult(persistNewTaskConfig(appState.newTaskConfig));
    } catch (error) {
      appState.sessionControlsErrors[session.sessionId] = formatApiError(error);
      throw error;
    } finally {
      appState.sessionControlsLoading[session.sessionId] = false;
    }
    return session;
  });
  const selectNewTaskWorkspace = useMemoizedFn(async (workspace: string) => {
    if (appState.activeSessionId) throw new Error('只能在创建新任务时切换工作区。');
    const normalized = workspace.trim();
    if (!normalized) throw new Error('请选择一个有效的工作区。');
    await cacheWorkspaceDirectory(normalized);
    if (appState.newTaskConfig.workspace !== normalized) {
      appState.composerContextFiles = [];
      appState.composerSkills = [];
    }
    appState.newTaskConfig.workspace = normalized;
    appState.workspaceRoot = normalized;
    reportTaskPersistenceResult(persistNewTaskConfig(appState.newTaskConfig));
  });
  const pickNewTaskWorkspace = useMemoizedFn(async (): Promise<string | null> => {
    if (appState.activeSessionId) throw new Error('只能在创建新任务时打开本地文件夹。');
    const selected = await codeApi.pickWorkspaceDirectory();
    if (selected.cancelled || !selected.path) return null;
    await selectNewTaskWorkspace(selected.path);
    return selected.path;
  });
  const newConversation = useMemoizedFn(() => {
    persistCurrentDraft();
    appState.activeSessionId = null;
    appState.taskView = 'conversation';
    reportTaskPersistenceResult(persistActiveTask(null));
    restoreDraft(null);
    appState.streamEvents = [];
    appState.workspaceRoot = appState.newTaskConfig.workspace || appState.health?.workspace || appState.workspaceRoot;
  });
  const refreshSessions = useMemoizedFn(async () => {
    appState.sessions = (await codeApi.sessions()).items;
  });
  const applyStreamEvent = useMemoizedFn((sessionId: string, event: AgentEvent) => {
    appState.streamEvents.push(event);
    if (event.type === 'goal_achieved') {
      const timing = appState.goalTimings[sessionId];
      if (timing && !timing.completedAt) {
        timing.completedAt = Date.now();
        reportTaskPersistenceResult(persistGoalTimings(appState.goalTimings));
      }
    }
    const assistant = activeAssistant(sessionId);
    if (!assistant) return;
    const decisionTerminal = [
      'confirmation_received',
      'confirmation_timeout',
      'permission_denied',
      'tool_end',
    ].includes(event.type);
    const toolId = decisionTerminal ? String(event.tool_id || event.id || '') : '';
    if (toolId) {
      delete appState.toolDecisionState[`${sessionId}:${toolId}`];
      delete appState.toolDecisionErrors[`${sessionId}:${toolId}`];
    }
    if (['agent_end', 'error', 'cancelled'].includes(event.type)) {
      clearSessionToolDecisions(sessionId);
    }
    applyAssistantStreamEvent(assistant, event);
  });
  const executeMessage = useMemoizedFn(
    async (
      sessionId: string | null,
      content: string,
      contextFiles: string[],
      skillNames: string[],
      onAccepted?: () => void
    ) => {
      const transportContent = composeTaskPrompt(content, contextFiles, skillNames);
      let completed = false;
      let executionStatus: 'completed' | 'cancelled' | 'failed' = 'failed';
      let executionStartedAt: number | undefined;
      try {
        if (!sessionId) sessionId = (await createSession(promptTitle(content))).sessionId;
        else if ((appState.messagesBySession[sessionId]?.length ?? 0) === 0)
          reportTaskPersistenceResult(persistSessionTitle(sessionId, promptTitle(content)));
        const targetSessionId = sessionId;
        const user = temporaryMessage(targetSessionId, 'user', transportContent);
        const assistant = temporaryMessage(targetSessionId, 'assistant', '');
        appState.messagesBySession[targetSessionId] ??= [];
        appState.messagesBySession[targetSessionId].push(user, assistant);
        appState.streamingSessionId = targetSessionId;
        appState.streamEvents = [];
        executionStartedAt = Date.now();
        appState.executionTimings[targetSessionId] = {
          startedAt: executionStartedAt,
          status: 'running',
        };
        onAccepted?.();
        const controller = new AbortController();
        abortRef.current = controller;
        await streamSessionMessage(
          targetSessionId,
          transportContent,
          { onEvent: (event) => applyStreamEvent(targetSessionId, event) },
          controller.signal
        );
        executionStatus = 'completed';
        const pending = activeAssistant(targetSessionId);
        if (pending) pending.pending = false;
        await loadMessages(targetSessionId);
        await refreshSessions();
        await loadControls(targetSessionId).catch(() => undefined);
        completed = true;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          executionStatus = 'cancelled';
          const assistant = sessionId ? activeAssistant(sessionId) : undefined;
          if (assistant) {
            assistant.pending = false;
            assistant.events ??= [];
            assistant.events.push({ type: 'cancelled', message: '任务已由用户停止' });
          }
        } else {
          executionStatus = 'failed';
          const message = formatApiError(error);
          const assistant = sessionId ? activeAssistant(sessionId) : undefined;
          if (assistant) {
            assistant.pending = false;
            assistant.events ??= [];
            assistant.events.push({ type: 'error', message });
          }
          showToast(message, 'error');
        }
      } finally {
        if (sessionId && executionStartedAt) {
          const timing = appState.executionTimings[sessionId];
          if (timing?.startedAt === executionStartedAt) {
            timing.completedAt = Date.now();
            timing.status = executionStatus;
          }
        }
        abortRef.current = null;
        appState.streamingSessionId = null;
        if (sessionId) clearSessionToolDecisions(sessionId);
        if (!completed && sessionId && appState.queuedPrompts[sessionId]?.length) {
          appState.pausedQueues[sessionId] = true;
          reportTaskPersistenceResult(persistPausedQueues(appState.pausedQueues));
        }
        if (completed && sessionId && !appState.pausedQueues[sessionId]) {
          const next = appState.queuedPrompts[sessionId]?.shift();
          reportTaskPersistenceResult(persistQueuedPrompts(appState.queuedPrompts));
          if (next) void executeMessage(sessionId, next.content, next.contextFiles, next.skillNames ?? []);
          else {
            delete appState.pausedQueues[sessionId];
            reportTaskPersistenceResult(persistPausedQueues(appState.pausedQueues));
          }
        }
      }
    }
  );
  const sendMessage = useMemoizedFn(async () => {
    const content = appState.composerValue.trim();
    if (!content) return;
    const goalCommand = parseGoalCommand(content);
    if (goalCommand) {
      await applyGoalCommand(goalCommand);
      return;
    }
    const contextFiles = [...appState.composerContextFiles];
    const skillNames = [...appState.composerSkills];
    const sessionId = appState.activeSessionId;
    if (appState.streamingSessionId) {
      if (!sessionId || sessionId !== appState.streamingSessionId) {
        return;
      }
      appState.queuedPrompts[sessionId] ??= [];
      appState.queuedPrompts[sessionId].push({ id: crypto.randomUUID(), content, contextFiles, skillNames });
      appState.pausedQueues[sessionId] = false;
      reportTaskPersistenceResult(persistQueuedPrompts(appState.queuedPrompts));
      reportTaskPersistenceResult(persistPausedQueues(appState.pausedQueues));
      appState.composerValue = '';
      appState.composerContextFiles = [];
      appState.composerSkills = [];
      return;
    }
    await executeMessage(sessionId, content, contextFiles, skillNames, () => {
      appState.composerValue = '';
      appState.composerContextFiles = [];
      appState.composerSkills = [];
    });
  });
  const applyGoalCommand = useMemoizedFn(async (command: GoalCommand) => {
    if (command.kind === 'missing') {
      showToast('请输入目标，例如：/goal 所有重点测试通过', 'info');
      return;
    }
    if (appState.taskConfigSaving) {
      showToast('任务参数正在保存，请稍后重试', 'info');
      return;
    }
    const goal = command.kind === 'clear' ? null : command.goal;
    const sessionId = appState.activeSessionId;
    if (!sessionId) {
      appState.newTaskConfig.goal = goal ?? '';
      reportTaskPersistenceResult(persistNewTaskConfig(appState.newTaskConfig));
      if (goal) appState.goalTimings[newTaskDraftKey] = { goal, startedAt: Date.now() };
      else delete appState.goalTimings[newTaskDraftKey];
      reportTaskPersistenceResult(persistGoalTimings(appState.goalTimings));
      clearComposer();
      return;
    }
    appState.taskConfigSaving = 'goal';
    try {
      const controls = await codeApi.updateSessionControls(sessionId, { goal });
      appState.sessionControls[sessionId] = controls;
      if (controls.goal) appState.goalTimings[sessionId] = { goal: controls.goal, startedAt: Date.now() };
      else delete appState.goalTimings[sessionId];
      reportTaskPersistenceResult(persistGoalTimings(appState.goalTimings));
      clearComposer();
    } catch (error) {
      showToast(formatApiError(error), 'error');
    } finally {
      appState.taskConfigSaving = null;
    }
  });
  const cancelMessage = useMemoizedFn(async () => {
    const sessionId = appState.streamingSessionId;
    if (!sessionId) return;
    abortRef.current?.abort();
    try {
      await codeApi.cancelSession(sessionId);
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('404'))) showToast(formatApiError(error), 'error');
    }
  });
  const compactSession = useMemoizedFn(async () => {
    const sessionId = appState.activeSessionId;
    const context = sessionId ? appState.sessionControls[sessionId]?.context : undefined;
    if (!sessionId || appState.streamingSessionId || appState.taskConfigSaving || appState.contextCompacting[sessionId])
      return;
    if (!context?.historyMessages) return;
    appState.contextCompacting[sessionId] = true;
    try {
      await codeApi.compactSession(sessionId);
      await Promise.all([loadMessages(sessionId), loadControls(sessionId)]);
    } catch (error) {
      showToast(formatApiError(error), 'error');
    } finally {
      delete appState.contextCompacting[sessionId];
      delete appState.executionTimings[sessionId];
      delete appState.goalTimings[sessionId];
    }
  });
  const resumeQueue = useMemoizedFn(async (sessionId: string) => {
    if (appState.streamingSessionId || appState.activeSessionId !== sessionId) return;
    const next = appState.queuedPrompts[sessionId]?.shift();
    if (!next) {
      delete appState.pausedQueues[sessionId];
      reportTaskPersistenceResult(persistPausedQueues(appState.pausedQueues));
      return;
    }
    appState.pausedQueues[sessionId] = false;
    reportTaskPersistenceResult(persistQueuedPrompts(appState.queuedPrompts));
    reportTaskPersistenceResult(persistPausedQueues(appState.pausedQueues));
    await executeMessage(sessionId, next.content, next.contextFiles, next.skillNames ?? []);
  });
  const confirmToolUse = useMemoizedFn(async (sessionId: string, toolId: string, approved: boolean) => {
    const key = `${sessionId}:${toolId}`;
    if (appState.toolDecisionState[key]) return;
    const submitting = approved ? 'approving' : 'denying';
    delete appState.toolDecisionErrors[key];
    appState.toolDecisionState[key] = submitting;
    try {
      await codeApi.confirmToolUse(sessionId, toolId, approved, approved ? undefined : 'Rejected in A3S Code Web');
      if (appState.toolDecisionState[key] === submitting)
        appState.toolDecisionState[key] = approved ? 'approved' : 'denied';
    } catch (error) {
      if (appState.toolDecisionState[key] !== submitting) return;
      const message = formatApiError(error);
      delete appState.toolDecisionState[key];
      appState.toolDecisionErrors[key] = message;
      showToast(message, 'error');
    }
  });
  const removeSession = useMemoizedFn(async (sessionId: string) => {
    if (appState.streamingSessionId === sessionId) {
      const error = new Error('运行中的任务不能删除，请先停止任务。');
      showToast(error.message, 'error');
      throw error;
    }
    try {
      await codeApi.deleteSession(sessionId);
      const index = sessionIndex(sessionId);
      if (index >= 0) appState.sessions.splice(index, 1);
      delete appState.messagesBySession[sessionId];
      delete appState.messagesLoading[sessionId];
      delete appState.messageErrors[sessionId];
      delete appState.sessionControls[sessionId];
      delete appState.sessionControlsLoading[sessionId];
      delete appState.sessionControlsErrors[sessionId];
      delete appState.contextCompacting[sessionId];
      clearSessionToolDecisions(sessionId);
      delete appState.queuedPrompts[sessionId];
      delete appState.pausedQueues[sessionId];
      delete appState.draftsByTask[taskDraftKey(sessionId)];
      reportTaskPersistenceResult(persistQueuedPrompts(appState.queuedPrompts));
      reportTaskPersistenceResult(persistPausedQueues(appState.pausedQueues));
      reportTaskPersistenceResult(persistTaskDrafts(appState.draftsByTask));
      reportTaskPersistenceResult(persistGoalTimings(appState.goalTimings));
      const titlePersisted = removePersistedSessionTitle(sessionId);
      if (appState.reviewSourceTaskId === sessionId) appState.reviewSourceTaskId = null;
      if (appState.activeSessionId === sessionId) {
        appState.activeSessionId = null;
        appState.taskView = 'conversation';
        reportTaskPersistenceResult(persistActiveTask(null));
        restoreDraft(null);
      }
      reportTaskPersistenceResult(titlePersisted);
    } catch (error) {
      showToast(formatApiError(error), 'error');
      throw error;
    }
  });
  const renameSession = useMemoizedFn(async (sessionId: string, title: string) => {
    try {
      const updated = await codeApi.updateSession(sessionId, { title });
      const index = sessionIndex(sessionId);
      if (index >= 0) appState.sessions[index] = updated;
      const titlePersisted = persistSessionTitle(sessionId, title);
      reportTaskPersistenceResult(titlePersisted);
    } catch (error) {
      showToast(formatApiError(error), 'error');
      throw error;
    }
  });
  const updateSessionModel = useMemoizedFn(async (model: string) => {
    const sessionId = appState.activeSessionId;
    if (!sessionId || appState.taskConfigSaving) return;
    const currentIndex = sessionIndex(sessionId);
    const previousModel =
      (currentIndex >= 0 ? appState.sessions[currentIndex].model : null) ||
      appState.selectedModel ||
      appState.llm?.defaultModel ||
      '';
    appState.taskConfigSaving = 'model';
    try {
      const updated = await codeApi.updateSession(sessionId, { model, followDefaultModel: false });
      const index = sessionIndex(sessionId);
      if (index >= 0) appState.sessions[index] = updated;
      showModelChangeNotice(sessionId, previousModel, updated.model || model);
    } catch (error) {
      showToast(formatApiError(error), 'error');
    } finally {
      appState.taskConfigSaving = null;
    }
  });
  const updateEffort = useMemoizedFn(async (effort: string) => {
    const sessionId = appState.activeSessionId;
    if (!sessionId || appState.taskConfigSaving) return;
    appState.taskConfigSaving = 'effort';
    try {
      const controls = await codeApi.updateSessionControls(sessionId, { effort });
      appState.sessionControls[sessionId] = controls;
      appState.activeEffort = controls.effort;
    } catch (error) {
      showToast(formatApiError(error), 'error');
    } finally {
      appState.taskConfigSaving = null;
    }
  });
  const updatePermissionMode = useMemoizedFn(async (permissionMode: string) => {
    const sessionId = appState.activeSessionId;
    if (!sessionId || appState.taskConfigSaving) return;
    appState.taskConfigSaving = 'permission';
    try {
      const updated = await codeApi.updateSession(sessionId, { permissionMode });
      const index = sessionIndex(sessionId);
      if (index >= 0) appState.sessions[index] = updated;
    } catch (error) {
      showToast(formatApiError(error), 'error');
    } finally {
      appState.taskConfigSaving = null;
    }
  });
  return {
    selectSession,
    selectNewTaskWorkspace,
    pickNewTaskWorkspace,
    reloadActiveTask,
    createSession,
    newConversation,
    sendMessage,
    cancelMessage,
    compactSession,
    resumeQueue,
    confirmToolUse,
    removeSession,
    renameSession,
    updateSessionModel,
    updateEffort,
    updatePermissionMode,
  };
}

function clearComposer() {
  appState.composerValue = '';
  appState.composerContextFiles = [];
  appState.composerSkills = [];
}
