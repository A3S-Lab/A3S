import { useMemoizedFn, useRequest } from 'ahooks';
import { useEffect } from 'react';
import { codeApi } from '../../lib/api';
import type { LlmSettings, ModelCatalog } from '../../types/api';
import {
  appState,
  applyTheme,
  captureWorkspaceContext,
  formatApiError,
  isWorkspaceContextCurrent,
  replaceActiveWorkspace,
  reportTaskPersistenceResult,
  showToast,
  switchActiveTask,
} from '../../state/app-state';
import {
  beginSessionControlsRequest,
  beginSessionMessagesRequest,
  isSessionControlsRequestCurrent,
  isSessionMessagesRequestCurrent,
  type SessionResourceRequest,
} from '../tasks/session-resource-order';
import { persistNewTaskConfig } from '../tasks/task-state';
import { applyTurnQueueSnapshot } from '../tasks/turn-queue-state';

interface BootstrapResult {
  activeSessionId: string | null;
  health: Awaited<ReturnType<typeof codeApi.health>>;
  osAccount: Awaited<ReturnType<typeof codeApi.osAccount>>;
  llm: Awaited<ReturnType<typeof codeApi.llmSettings>>;
  modelCatalog: Awaited<ReturnType<typeof codeApi.modelCatalog>>;
  sessionList: Awaited<ReturnType<typeof codeApi.sessions>>;
  effortLevels: Awaited<ReturnType<typeof codeApi.effortLevels>>;
  rootFiles: Awaited<ReturnType<typeof codeApi.readDir>>;
  activeMessages?: Awaited<ReturnType<typeof codeApi.messages>>;
  activeControls?: Awaited<ReturnType<typeof codeApi.sessionControls>>;
  activeTurnQueue?: Awaited<ReturnType<typeof codeApi.turnQueue>>;
  activeMessagesRequest?: SessionResourceRequest;
  activeControlsRequest?: SessionResourceRequest;
  activeMessagesError?: string;
  activeControlsError?: string;
  activeTurnQueueError?: string;
}

async function loadBootstrapResult(): Promise<BootstrapResult> {
  const activeSessionId = appState.activeSessionId;
  const health = await codeApi.health();
  const [osAccount, llm, modelCatalogResult, sessionList, effortLevels, rootFiles] = await Promise.all([
    codeApi.osAccount(),
    codeApi.llmSettings(),
    codeApi
      .modelCatalog()
      .then((value) => ({ value }))
      .catch(() => ({ value: null })),
    codeApi.sessions(),
    codeApi.effortLevels(),
    codeApi.readDir(health.workspace),
  ]);
  const modelCatalog = modelCatalogResult.value ?? fallbackModelCatalog(llm);
  let activeMessages: BootstrapResult['activeMessages'];
  let activeControls: BootstrapResult['activeControls'];
  let activeTurnQueue: BootstrapResult['activeTurnQueue'];
  let activeMessagesRequest: SessionResourceRequest | undefined;
  let activeControlsRequest: SessionResourceRequest | undefined;
  let activeMessagesError: string | undefined;
  let activeControlsError: string | undefined;
  let activeTurnQueueError: string | undefined;
  if (activeSessionId && sessionList.items.some((session) => session.sessionId === activeSessionId)) {
    activeMessagesRequest = beginSessionMessagesRequest(activeSessionId);
    activeControlsRequest = beginSessionControlsRequest(activeSessionId);
    const [messages, controls, turnQueue] = await Promise.allSettled([
      codeApi.messages(activeSessionId),
      codeApi.sessionControls(activeSessionId),
      codeApi.turnQueue(activeSessionId),
    ]);
    if (messages.status === 'fulfilled') activeMessages = messages.value;
    else activeMessagesError = formatApiError(messages.reason);
    if (controls.status === 'fulfilled') activeControls = controls.value;
    else activeControlsError = formatApiError(controls.reason);
    if (turnQueue.status === 'fulfilled') activeTurnQueue = turnQueue.value;
    else activeTurnQueueError = formatApiError(turnQueue.reason);
  }
  return {
    activeSessionId,
    health,
    osAccount,
    llm,
    modelCatalog,
    sessionList,
    effortLevels,
    rootFiles,
    activeMessages,
    activeControls,
    activeTurnQueue,
    activeMessagesRequest,
    activeControlsRequest,
    activeMessagesError,
    activeControlsError,
    activeTurnQueueError,
  };
}

export function fallbackModelCatalog(llm: LlmSettings): ModelCatalog {
  return {
    defaultModel: llm.defaultModel,
    warnings: ['模型目录接口不可用，已根据当前 Provider 配置恢复模型列表。'],
    items: llm.providers.flatMap((provider) =>
      provider.models.map((model) => ({
        id: `${provider.name}/${model.id}`,
        name: model.name?.trim() || model.id,
        source: provider.name,
        contextWindow: model.limit?.context || null,
        reasoning: Boolean(model.reasoning),
        toolCall: Boolean(model.toolCall),
      }))
    ),
  };
}

function applyBootstrapResult(result: BootstrapResult) {
  appState.health = result.health;
  appState.osAccount = result.osAccount;
  appState.llm = result.llm;
  appState.modelCatalog = result.modelCatalog;
  appState.selectedModel = result.modelCatalog.defaultModel || result.llm.defaultModel;
  if (!result.modelCatalog.items.some((model) => model.id === appState.newTaskConfig.model)) {
    appState.newTaskConfig.model = appState.selectedModel || '';
  }
  appState.sessions = result.sessionList.items;
  if (appState.activeSessionId === result.activeSessionId && result.activeSessionId) {
    const active = result.sessionList.items.find((session) => session.sessionId === result.activeSessionId);
    const correctProduct = appState.activeProduct === 'work' ? active?.agentId === 'work' : active?.agentId !== 'work';
    if (!active || !correctProduct) switchActiveTask(null);
  }
  const messagesCurrent = Boolean(
    result.activeMessagesRequest && isSessionMessagesRequestCurrent(result.activeMessagesRequest)
  );
  const controlsCurrent = Boolean(
    result.activeControlsRequest && isSessionControlsRequestCurrent(result.activeControlsRequest)
  );
  if (result.activeSessionId && messagesCurrent && result.activeMessages) {
    appState.messagesBySession[result.activeSessionId] = result.activeMessages.items;
  }
  if (result.activeSessionId && messagesCurrent) {
    appState.messagesLoading[result.activeSessionId] = false;
    if (result.activeMessagesError) appState.messageErrors[result.activeSessionId] = result.activeMessagesError;
    else delete appState.messageErrors[result.activeSessionId];
  }
  if (result.activeSessionId && controlsCurrent && result.activeControls) {
    appState.sessionControls[result.activeSessionId] = result.activeControls;
  }
  if (appState.activeSessionId === result.activeSessionId && result.activeSessionId && result.activeTurnQueue) {
    applyTurnQueueSnapshot(result.activeTurnQueue);
  }
  if (appState.activeSessionId === result.activeSessionId && result.activeSessionId) {
    appState.turnQueueLoading[result.activeSessionId] = false;
    if (result.activeTurnQueueError) appState.turnQueueErrors[result.activeSessionId] = result.activeTurnQueueError;
    else delete appState.turnQueueErrors[result.activeSessionId];
  }
  if (result.activeSessionId && controlsCurrent) {
    appState.sessionControlsLoading[result.activeSessionId] = false;
    if (result.activeControlsError) appState.sessionControlsErrors[result.activeSessionId] = result.activeControlsError;
    else delete appState.sessionControlsErrors[result.activeSessionId];
  }
  appState.effortLevels = result.effortLevels.items;
  if (!result.effortLevels.items.some((effort) => effort.id === appState.newTaskConfig.effort)) {
    appState.newTaskConfig.effort = result.effortLevels.items[0]?.id || 'medium';
  }
  if (!appState.newTaskConfig.workspace.trim()) {
    appState.newTaskConfig.workspace = result.health.workspace;
    reportTaskPersistenceResult(persistNewTaskConfig(appState.newTaskConfig));
  }
  const activeWorkspace = result.sessionList.items.find(
    (session) => session.sessionId === appState.activeSessionId
  )?.workspace;
  const workspaceRoot =
    activeWorkspace ||
    (appState.activeProduct === 'work'
      ? appState.workspaceRoot || appState.newTaskConfig.workspace
      : appState.newTaskConfig.workspace) ||
    result.health.workspace;
  replaceActiveWorkspace(workspaceRoot);
  appState.filesByDirectory[result.health.workspace] = result.rootFiles;
  appState.expandedDirectories[result.health.workspace] = true;
  appState.directoryLoading[result.health.workspace] = false;
  delete appState.directoryErrors[result.health.workspace];
  if (workspaceRoot !== result.health.workspace) {
    const context = captureWorkspaceContext();
    appState.directoryLoading[workspaceRoot] = true;
    delete appState.directoryErrors[workspaceRoot];
    void codeApi
      .readDir(workspaceRoot)
      .then((entries) => {
        if (!isWorkspaceContextCurrent(context)) return;
        appState.filesByDirectory[workspaceRoot] = entries;
        appState.expandedDirectories[workspaceRoot] = true;
      })
      .catch((error: unknown) => {
        if (!isWorkspaceContextCurrent(context)) return;
        appState.directoryErrors[workspaceRoot] = formatApiError(error);
      })
      .finally(() => {
        if (isWorkspaceContextCurrent(context)) appState.directoryLoading[workspaceRoot] = false;
      });
  }
  appState.bootPhase = 'ready';
  appState.bootError = null;
  appState.serviceStatus = 'connected';
  appState.serviceError = null;
}

async function refreshAccountModelCatalog() {
  try {
    const catalog = await codeApi.refreshModelCatalog();
    appState.modelCatalog = catalog;
    appState.selectedModel = catalog.defaultModel || appState.llm?.defaultModel || appState.selectedModel;
    if (!catalog.items.some((model) => model.id === appState.newTaskConfig.model)) {
      appState.newTaskConfig.model = appState.selectedModel || '';
    }
  } catch {
    // Older services do not expose account refresh. Keep the already usable
    // configured/fallback catalog instead of turning discovery into a startup
    // or reconnection failure.
  }
}

export function useAppBootstrap() {
  useRequest(loadBootstrapResult, {
    onSuccess(result) {
      applyBootstrapResult(result);
      void refreshAccountModelCatalog();
    },
    onError(error) {
      appState.bootPhase = 'error';
      appState.bootError = formatApiError(error);
      appState.serviceStatus = 'disconnected';
      appState.serviceError = formatApiError(error);
    },
  });
  const retryBootstrap = useMemoizedFn(async () => {
    appState.bootPhase = 'loading';
    appState.bootError = null;
    appState.serviceStatus = 'checking';
    try {
      applyBootstrapResult(await loadBootstrapResult());
      void refreshAccountModelCatalog();
    } catch (error) {
      const message = formatApiError(error);
      appState.bootPhase = 'error';
      appState.bootError = message;
      appState.serviceStatus = 'disconnected';
      appState.serviceError = message;
    }
  });
  const retryConnection = useMemoizedFn(async () => {
    appState.serviceStatus = 'checking';
    try {
      applyBootstrapResult(await loadBootstrapResult());
      void refreshAccountModelCatalog();
      showToast('已重新连接本地 A3S Code 服务', 'success');
    } catch (error) {
      appState.serviceStatus = 'disconnected';
      appState.serviceError = formatApiError(error);
    }
  });
  useEffect(() => {
    applyTheme();
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (appState.theme === 'system') applyTheme('system');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    const markOffline = () => {
      if (appState.bootPhase !== 'ready') return;
      appState.serviceStatus = 'disconnected';
      appState.serviceError = '浏览器已离线，本地服务状态可能已过期。';
    };
    const reconnect = () => {
      if (appState.bootPhase === 'ready') void retryConnection();
    };
    window.addEventListener('offline', markOffline);
    window.addEventListener('online', reconnect);
    const timer = window.setInterval(async () => {
      if (appState.bootPhase !== 'ready' || appState.serviceStatus === 'checking') return;
      if (appState.serviceStatus === 'disconnected') {
        await retryConnection();
        return;
      }
      try {
        appState.health = await codeApi.health();
        appState.serviceStatus = 'connected';
        appState.serviceError = null;
      } catch (error) {
        appState.serviceStatus = 'disconnected';
        appState.serviceError = formatApiError(error);
      }
    }, 15000);
    return () => {
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('online', reconnect);
      window.clearInterval(timer);
    };
  }, [retryConnection]);
  return { retryBootstrap, retryConnection };
}
