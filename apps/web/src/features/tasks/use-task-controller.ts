import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef } from 'react';
import { subscribeKey } from 'valtio/utils';
import { codeApi, streamQueuedSessionMessage } from '../../lib/api';
import {
  appState,
  captureWorkspaceContext,
  formatApiError,
  isWorkspaceContextCurrent,
  persistSessionTitle,
  promoteActiveTask,
  reportTaskPersistenceResult,
  removePersistedSessionTitle,
  removeWorkspaceTaskSnapshot,
  replaceActiveWorkspace,
  showModelChangeNotice,
  showToast,
  switchActiveTask,
} from '../../state/app-state';
import type { AgentEvent, ChatMessage, CodeSession, QueuedTurn, SessionControls, TurnQueue } from '../../types/api';
import { parseGoalCommand, type GoalCommand } from './goal-command';
import {
  beginSessionControlsRequest,
  beginSessionMessagesRequest,
  invalidateSessionControlsRequests,
  invalidateSessionMessagesRequests,
  isSessionControlsRequestCurrent,
  isSessionMessagesRequestCurrent,
} from './session-resource-order';
import {
  newTaskDraftKey,
  persistGoalTimings,
  persistNewTaskConfig,
  persistTaskDrafts,
  type TaskProduct,
  taskDraftKey,
} from './task-state';
import { applyTurnQueueSnapshot } from './turn-queue-state';

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

function activeTaskProduct(): TaskProduct {
  return appState.activeProduct === 'work' ? 'work' : 'code';
}

function sessionProduct(session: Pick<CodeSession, 'agentId'> | undefined): TaskProduct {
  return session?.agentId === 'work' ? 'work' : 'code';
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
  const context = captureWorkspaceContext();
  appState.directoryLoading[workspace] = true;
  delete appState.directoryErrors[workspace];
  try {
    const entries = await codeApi.readDir(workspace);
    if (!isWorkspaceContextCurrent(context)) return;
    appState.filesByDirectory[workspace] = entries;
    appState.expandedDirectories[workspace] = true;
  } catch (error) {
    if (!isWorkspaceContextCurrent(context)) return;
    appState.directoryErrors[workspace] = formatApiError(error);
    throw error;
  } finally {
    if (isWorkspaceContextCurrent(context)) appState.directoryLoading[workspace] = false;
  }
}

export function useTaskController() {
  const abortRef = useRef<AbortController | null>(null);
  const invalidateMessageRequests = (sessionId: string) => {
    invalidateSessionMessagesRequests(sessionId);
    appState.messagesLoading[sessionId] = false;
  };
  const invalidateControlsRequests = (sessionId: string) => {
    const request = invalidateSessionControlsRequests(sessionId);
    appState.sessionControlsLoading[sessionId] = false;
    return request;
  };
  const publishControlsMutation = (sessionId: string, controls: SessionControls) => {
    invalidateSessionControlsRequests(sessionId);
    appState.sessionControls[sessionId] = controls;
    appState.sessionControlsLoading[sessionId] = false;
    delete appState.sessionControlsErrors[sessionId];
  };
  const persistCurrentDraft = useMemoizedFn(() => {
    const key = taskDraftKey(appState.activeSessionId, activeTaskProduct());
    appState.draftsByTask[key] = {
      content: appState.composerValue,
      contextFiles: [...appState.composerContextFiles],
      skillNames: [...appState.composerSkills],
    };
    reportTaskPersistenceResult(persistTaskDrafts(appState.draftsByTask));
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
    const request = beginSessionMessagesRequest(sessionId);
    appState.messagesLoading[sessionId] = true;
    delete appState.messageErrors[sessionId];
    try {
      const messages = await codeApi.messages(sessionId);
      if (!isSessionMessagesRequestCurrent(request)) return;
      appState.messagesBySession[sessionId] = messages.items;
    } catch (error) {
      if (!isSessionMessagesRequestCurrent(request)) return;
      const message = formatApiError(error);
      appState.messageErrors[sessionId] = message;
      showToast(message, 'error');
    } finally {
      if (isSessionMessagesRequestCurrent(request)) {
        appState.messagesLoading[sessionId] = false;
      }
    }
  });
  const loadControls = useMemoizedFn(async (sessionId: string) => {
    const request = beginSessionControlsRequest(sessionId);
    appState.sessionControlsLoading[sessionId] = true;
    delete appState.sessionControlsErrors[sessionId];
    try {
      const controls = await codeApi.sessionControls(sessionId);
      if (!isSessionControlsRequestCurrent(request)) return;
      appState.sessionControls[sessionId] = controls;
    } catch (error) {
      if (!isSessionControlsRequestCurrent(request)) return;
      appState.sessionControlsErrors[sessionId] = formatApiError(error);
      throw error;
    } finally {
      if (isSessionControlsRequestCurrent(request)) {
        appState.sessionControlsLoading[sessionId] = false;
      }
    }
  });
  const loadTurnQueue = useMemoizedFn(async (sessionId: string): Promise<TurnQueue> => {
    appState.turnQueueLoading[sessionId] = true;
    delete appState.turnQueueErrors[sessionId];
    try {
      const queue = await codeApi.turnQueue(sessionId);
      applyTurnQueueSnapshot(queue);
      return queue;
    } catch (error) {
      appState.turnQueueErrors[sessionId] = formatApiError(error);
      throw error;
    } finally {
      appState.turnQueueLoading[sessionId] = false;
    }
  });
  const selectSession = useMemoizedFn(async (sessionId: string) => {
    const session = appState.sessions.find((item) => item.sessionId === sessionId);
    if (session && sessionProduct(session) !== activeTaskProduct()) return;
    switchActiveTask(sessionId, session?.workspace);
    if (session?.workspace) {
      if (!appState.filesByDirectory[session.workspace]) {
        void cacheWorkspaceDirectory(session.workspace).catch(() => undefined);
      }
    }
    if (!appState.messagesBySession[sessionId]) await loadMessages(sessionId);
    try {
      await Promise.all([loadControls(sessionId), loadTurnQueue(sessionId)]);
    } catch {
      // The Composer owns the persistent error and retry path.
    }
  });
  const reloadActiveTask = useMemoizedFn(async () => {
    const sessionId = appState.activeSessionId;
    if (!sessionId) return;
    await Promise.all([
      loadMessages(sessionId),
      loadControls(sessionId).catch(() => undefined),
      loadTurnQueue(sessionId).catch(() => undefined),
    ]);
  });
  const createSession = useMemoizedFn(async (title = '新任务', model?: string): Promise<CodeSession> => {
    const product = activeTaskProduct();
    const config = appState.newTaskConfig;
    const requestedGoal = product === 'work' ? '' : config.goal.trim();
    const preparedGoalTiming = appState.goalTimings[newTaskDraftKey];
    const workspace =
      product === 'work'
        ? appState.workspaceRoot || appState.health?.workspace
        : config.workspace.trim() || appState.workspaceRoot || appState.health?.workspace;
    const response = await codeApi.createSession({
      workspace,
      cwd: workspace,
      model: model || config.model || appState.selectedModel || appState.llm?.defaultModel || undefined,
      title,
      permissionMode: config.permissionMode,
      agentId: product === 'work' ? 'work' : 'default',
    });
    const session = response.session;
    appState.sessions.unshift(session);
    promoteActiveTask(session.sessionId, session.workspace);
    appState.messagesBySession[session.sessionId] = [];
    applyTurnQueueSnapshot({
      sessionId: session.sessionId,
      status: 'idle',
      paused: false,
      active: null,
      items: [],
      total: 0,
      nextItemId: null,
    });
    reportTaskPersistenceResult(persistSessionTitle(session.sessionId, title));
    const controlsMutationRequest = invalidateControlsRequests(session.sessionId);
    appState.sessionControlsLoading[session.sessionId] = true;
    try {
      const controls = await codeApi.updateSessionControls(session.sessionId, {
        effort: config.effort,
        goal: requestedGoal || null,
      });
      publishControlsMutation(session.sessionId, controls);
      if (controls.goal) {
        appState.goalTimings[session.sessionId] =
          preparedGoalTiming?.goal === controls.goal
            ? { ...preparedGoalTiming }
            : { goal: controls.goal, startedAt: Date.now() };
      }
      delete appState.goalTimings[newTaskDraftKey];
      reportTaskPersistenceResult(persistGoalTimings(appState.goalTimings));
      if (product === 'code') {
        appState.newTaskConfig.goal = '';
        reportTaskPersistenceResult(persistNewTaskConfig(appState.newTaskConfig));
      }
    } catch (error) {
      if (isSessionControlsRequestCurrent(controlsMutationRequest)) {
        appState.sessionControlsErrors[session.sessionId] = formatApiError(error);
        appState.sessionControlsLoading[session.sessionId] = false;
      }
      throw error;
    }
    return session;
  });
  const selectNewTaskWorkspace = useMemoizedFn(async (workspace: string) => {
    if (appState.activeSessionId) throw new Error('只能在创建新任务时切换工作区。');
    const normalized = workspace.trim();
    if (!normalized) throw new Error('请选择一个有效的工作区。');
    const context = captureWorkspaceContext();
    const entries = await codeApi.readDir(normalized);
    if (!isWorkspaceContextCurrent(context) || appState.activeSessionId) return;
    replaceActiveWorkspace(normalized);
    appState.filesByDirectory[normalized] = entries;
    appState.expandedDirectories[normalized] = true;
    if (activeTaskProduct() === 'work') {
      appState.composerContextFiles = [];
      appState.composerSkills = [];
      return;
    }
    if (appState.newTaskConfig.workspace !== normalized) {
      appState.composerContextFiles = [];
      appState.composerSkills = [];
    }
    appState.newTaskConfig.workspace = normalized;
    reportTaskPersistenceResult(persistNewTaskConfig(appState.newTaskConfig));
  });
  const pickNewTaskWorkspace = useMemoizedFn(async (): Promise<string | null> => {
    if (appState.activeSessionId) throw new Error('只能在创建新任务时打开本地文件夹。');
    const selected = await codeApi.pickWorkspaceDirectory(
      appState.newTaskConfig.workspace || appState.workspaceRoot || appState.health?.workspace || undefined
    );
    if (selected.cancelled || !selected.path) return null;
    await selectNewTaskWorkspace(selected.path);
    return selected.path;
  });
  const newConversation = useMemoizedFn(() => {
    const product = activeTaskProduct();
    const workspace =
      product === 'work'
        ? appState.workspaceRoot
        : appState.newTaskConfig.workspace || appState.health?.workspace || appState.workspaceRoot;
    switchActiveTask(null, workspace);
    appState.streamEvents = [];
  });
  const refreshSessions = useMemoizedFn(async () => {
    appState.sessions = (await codeApi.sessions()).items;
  });
  const applyStreamEvent = useMemoizedFn((sessionId: string, event: AgentEvent) => {
    appState.streamEvents.push(event);
    if (event.type === 'goal_achieved') {
      const goalState = appState.sessionControls[sessionId]?.goalState;
      if (goalState && goalState.status !== 'achieved') {
        goalState.status = 'achieved';
        goalState.progressPercent = 100;
        goalState.completedAt = Date.now();
        goalState.updatedAt = goalState.completedAt;
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
  const executeQueuedTurn = useMemoizedFn(async (sessionId: string, turn: QueuedTurn) => {
    const transportContent =
      turn.kind === 'goalContinuation'
        ? `[goal continuation]\n${turn.content}`
        : composeTaskPrompt(turn.content, turn.contextFiles, turn.skillNames);
    let completed = false;
    let executionStatus: 'completed' | 'cancelled' | 'failed' = 'failed';
    const executionStartedAt = Date.now();
    try {
      const currentQueue = appState.turnQueues[sessionId];
      if (currentQueue) {
        const pendingItems = currentQueue.items.filter((item) => item.id !== turn.id);
        applyTurnQueueSnapshot({
          ...currentQueue,
          status: 'running',
          active: { turn, startedAt: executionStartedAt },
          items: pendingItems,
          total: pendingItems.length,
          nextItemId: pendingItems[0]?.id ?? null,
        });
      }
      invalidateMessageRequests(sessionId);
      const user = temporaryMessage(sessionId, 'user', transportContent);
      const assistant = temporaryMessage(sessionId, 'assistant', '');
      appState.messagesBySession[sessionId] ??= [];
      appState.messagesBySession[sessionId].push(user, assistant);
      appState.streamingSessionId = sessionId;
      appState.streamEvents = [];
      appState.executionTimings[sessionId] = {
        startedAt: executionStartedAt,
        status: 'running',
      };
      const controller = new AbortController();
      abortRef.current = controller;
      await streamQueuedSessionMessage(
        sessionId,
        turn.id,
        { onEvent: (event) => applyStreamEvent(sessionId, event) },
        controller.signal
      );
      executionStatus = 'completed';
      const pending = activeAssistant(sessionId);
      if (pending) pending.pending = false;
      completed = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        executionStatus = 'cancelled';
        const assistant = activeAssistant(sessionId);
        if (assistant) {
          assistant.pending = false;
          assistant.events ??= [];
          assistant.events.push({ type: 'cancelled', message: '任务已由用户停止' });
        }
      } else {
        executionStatus = 'failed';
        const message = formatApiError(error);
        const assistant = activeAssistant(sessionId);
        if (assistant) {
          assistant.pending = false;
          assistant.events ??= [];
          assistant.events.push({ type: 'error', message });
        }
        showToast(message, 'error');
      }
    } finally {
      const timing = appState.executionTimings[sessionId];
      if (timing?.startedAt === executionStartedAt) {
        timing.completedAt = Date.now();
        timing.status = executionStatus;
      }
      abortRef.current = null;
      appState.streamingSessionId = null;
      clearSessionToolDecisions(sessionId);
      const [, , queue] = await Promise.all([
        loadMessages(sessionId),
        Promise.all([refreshSessions(), loadControls(sessionId)]).catch(() => undefined),
        loadTurnQueue(sessionId).catch(() => undefined),
      ]);
      if (completed && queue && !queue.paused && queue.items[0]) {
        void executeQueuedTurn(sessionId, queue.items[0]);
      }
    }
  });
  const sendMessage = useMemoizedFn(async () => {
    const content = appState.composerValue.trim();
    if (!content || appState.taskSubmissionState) return;
    const goalCommand = parseGoalCommand(content);
    if (goalCommand) {
      await applyGoalCommand(goalCommand);
      return;
    }
    const contextFiles = [...appState.composerContextFiles];
    const skillNames = [...appState.composerSkills];
    let sessionId = appState.activeSessionId;
    appState.taskSubmissionState = sessionId ? 'queueing' : 'creating';
    try {
      if (!sessionId) sessionId = (await createSession(promptTitle(content))).sessionId;
      else if ((appState.messagesBySession[sessionId]?.length ?? 0) === 0)
        reportTaskPersistenceResult(persistSessionTitle(sessionId, promptTitle(content)));
      if (appState.streamingSessionId && appState.streamingSessionId !== sessionId) return;
      const queue = await codeApi.enqueueTurn(sessionId, { content, contextFiles, skillNames });
      applyTurnQueueSnapshot(queue);
      clearComposer();
      let execution: Promise<void> | undefined;
      if (!appState.streamingSessionId && !queue.paused && queue.items[0]) {
        execution = executeQueuedTurn(sessionId, queue.items[0]);
      }
      appState.taskSubmissionState = null;
      if (execution) await execution;
    } catch (error) {
      showToast(formatApiError(error), 'error');
    } finally {
      appState.taskSubmissionState = null;
    }
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
    invalidateControlsRequests(sessionId);
    try {
      const controls = await codeApi.updateSessionControls(sessionId, { goal });
      publishControlsMutation(sessionId, controls);
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
      await Promise.all([loadControls(sessionId), loadTurnQueue(sessionId)]);
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
    }
  });
  const resumeQueue = useMemoizedFn(async (sessionId: string) => {
    if (appState.activeSessionId !== sessionId) return;
    try {
      const queue = await codeApi.turnQueueAction(sessionId, 'resume');
      applyTurnQueueSnapshot(queue);
      if (!appState.streamingSessionId && queue.items[0]) await executeQueuedTurn(sessionId, queue.items[0]);
    } catch (error) {
      showToast(formatApiError(error), 'error');
    }
  });
  const pauseQueue = useMemoizedFn(async (sessionId: string) => {
    try {
      applyTurnQueueSnapshot(await codeApi.turnQueueAction(sessionId, 'pause'));
    } catch (error) {
      showToast(formatApiError(error), 'error');
    }
  });
  const updateQueuedMessage = useMemoizedFn(async (sessionId: string, turnId: string, content: string) => {
    const turn = appState.turnQueues[sessionId]?.items.find((item) => item.id === turnId);
    if (!turn) return;
    try {
      applyTurnQueueSnapshot(
        await codeApi.updateQueuedTurn(sessionId, turnId, {
          content,
          contextFiles: [...turn.contextFiles],
          skillNames: [...turn.skillNames],
        })
      );
    } catch (error) {
      showToast(formatApiError(error), 'error');
      throw error;
    }
  });
  const moveQueuedMessage = useMemoizedFn(async (sessionId: string, turnId: string, offset: number) => {
    const items = appState.turnQueues[sessionId]?.items ?? [];
    const index = items.findIndex((item) => item.id === turnId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= items.length) return;
    const orderedIds = items.map((item) => item.id);
    [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
    try {
      applyTurnQueueSnapshot(await codeApi.reorderQueuedTurns(sessionId, orderedIds));
    } catch (error) {
      showToast(formatApiError(error), 'error');
    }
  });
  const removeQueuedMessage = useMemoizedFn(async (sessionId: string, turnId: string) => {
    try {
      applyTurnQueueSnapshot(await codeApi.deleteQueuedTurn(sessionId, turnId));
    } catch (error) {
      showToast(formatApiError(error), 'error');
    }
  });
  const updateGoalAction = useMemoizedFn(async (action: 'pause' | 'resume' | 'retry') => {
    const sessionId = appState.activeSessionId;
    if (!sessionId) return;
    try {
      publishControlsMutation(sessionId, await codeApi.goalAction(sessionId, action));
      const queue = await loadTurnQueue(sessionId);
      if (action !== 'pause' && !appState.streamingSessionId && queue.items[0]) {
        await executeQueuedTurn(sessionId, queue.items[0]);
      }
    } catch (error) {
      showToast(formatApiError(error), 'error');
    }
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
      const session = appState.sessions.find((candidate) => candidate.sessionId === sessionId);
      const product = sessionProduct(session);
      await codeApi.deleteSession(sessionId);
      const index = sessionIndex(sessionId);
      if (index >= 0) appState.sessions.splice(index, 1);
      invalidateMessageRequests(sessionId);
      invalidateControlsRequests(sessionId);
      delete appState.messagesBySession[sessionId];
      delete appState.messagesLoading[sessionId];
      delete appState.messageErrors[sessionId];
      delete appState.sessionControls[sessionId];
      delete appState.sessionControlsLoading[sessionId];
      delete appState.sessionControlsErrors[sessionId];
      delete appState.contextCompacting[sessionId];
      clearSessionToolDecisions(sessionId);
      delete appState.turnQueues[sessionId];
      delete appState.turnQueueLoading[sessionId];
      delete appState.turnQueueErrors[sessionId];
      delete appState.draftsByTask[taskDraftKey(sessionId, product)];
      reportTaskPersistenceResult(persistTaskDrafts(appState.draftsByTask));
      reportTaskPersistenceResult(persistGoalTimings(appState.goalTimings));
      const titlePersisted = removePersistedSessionTitle(sessionId);
      if (appState.reviewSourceTaskId === sessionId) appState.reviewSourceTaskId = null;
      if (appState.activeSessionId === sessionId) {
        const workspace =
          product === 'work'
            ? appState.workspaceRoot
            : appState.newTaskConfig.workspace || appState.health?.workspace || appState.workspaceRoot;
        switchActiveTask(null, workspace);
      }
      removeWorkspaceTaskSnapshot(sessionId);
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
    invalidateControlsRequests(sessionId);
    try {
      const controls = await codeApi.updateSessionControls(sessionId, { effort });
      publishControlsMutation(sessionId, controls);
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
    pauseQueue,
    updateQueuedMessage,
    moveQueuedMessage,
    removeQueuedMessage,
    updateGoalAction,
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
