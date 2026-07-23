import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef } from 'react';
import { codeApi } from '../../lib/api';
import { appState, formatApiError, showToast } from '../../state/app-state';
import type { KnowledgeBaseImportRequest, KnowledgeBaseMutation, PersonalKnowledgeBase } from '../../types/api';

export function useKnowledgeController() {
  const sequence = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const refreshKnowledge = useMemoizedFn(async (silent = false) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const request = ++sequence.current;
    if (!silent || !appState.personalKnowledgeBases) {
      appState.knowledgeStatus = 'loading';
    }
    appState.knowledgeError = null;
    try {
      const personal = await codeApi.personalKnowledgeBases(controller.signal);
      if (controller.signal.aborted || request !== sequence.current) return;
      appState.personalKnowledgeBases = personal;
      appState.knowledgeStatus = 'ready';
    } catch (error) {
      if (controller.signal.aborted || request !== sequence.current) return;
      appState.knowledgeStatus = appState.personalKnowledgeBases ? 'ready' : 'error';
      appState.knowledgeError = formatApiError(error);
    }
  });

  const createKnowledgeBase = useMemoizedFn(async (input: { name: string; description?: string }) => {
    appState.knowledgeOperationStatus = 'loading';
    appState.knowledgeOperationId = 'create';
    appState.knowledgeOperationError = null;
    try {
      const mutation = await codeApi.createPersonalKnowledgeBase(input);
      applyMutation(mutation);
      appState.knowledgeOperationStatus = 'ready';
      appState.knowledgeOperationId = null;
      showToast(mutation.changed ? '知识库已创建。' : '知识库已存在。', 'success');
      void refreshKnowledge(true);
      return true;
    } catch (error) {
      appState.knowledgeOperationStatus = 'error';
      appState.knowledgeOperationId = null;
      appState.knowledgeOperationError = formatApiError(error);
      return false;
    }
  });

  const pickKnowledgeBaseDirectory = useMemoizedFn(async (): Promise<string | null> => {
    try {
      const selection = await codeApi.pickWorkspaceDirectory();
      return selection.cancelled ? null : selection.path;
    } catch (error) {
      appState.knowledgeOperationError = formatApiError(error);
      return null;
    }
  });

  const importKnowledgeBase = useMemoizedFn(
    async (input: KnowledgeBaseImportRequest): Promise<PersonalKnowledgeBase | null> => {
      appState.knowledgeOperationStatus = 'loading';
      appState.knowledgeOperationId = 'import';
      appState.knowledgeOperationError = null;
      try {
        const mutation = await codeApi.importPersonalKnowledgeBase(input);
        applyMutation(mutation);
        appState.knowledgeOperationStatus = 'ready';
        appState.knowledgeOperationId = null;
        showToast(mutation.changed ? '知识库已导入。' : '知识库已存在。', 'success');
        void refreshKnowledge(true);
        return mutation.knowledgeBase;
      } catch (error) {
        appState.knowledgeOperationStatus = 'error';
        appState.knowledgeOperationId = null;
        appState.knowledgeOperationError = formatApiError(error);
        return null;
      }
    }
  );

  const setPinned = useMemoizedFn(async (id: string, pinned: boolean) => {
    appState.knowledgeOperationStatus = 'loading';
    appState.knowledgeOperationId = id;
    appState.knowledgeOperationError = null;
    try {
      const mutation = await codeApi.setPersonalKnowledgeBasePinned(id, pinned);
      applyMutation(mutation);
      appState.knowledgeOperationStatus = 'ready';
      appState.knowledgeOperationId = null;
      return true;
    } catch (error) {
      appState.knowledgeOperationStatus = 'error';
      appState.knowledgeOperationId = null;
      appState.knowledgeOperationError = formatApiError(error);
      return false;
    }
  });

  const clearOperationError = useMemoizedFn(() => {
    appState.knowledgeOperationError = null;
    if (appState.knowledgeOperationStatus === 'error') appState.knowledgeOperationStatus = 'idle';
  });

  useEffect(
    () => () => {
      abort.current?.abort();
    },
    []
  );

  return {
    refreshKnowledge,
    createKnowledgeBase,
    pickKnowledgeBaseDirectory,
    importKnowledgeBase,
    setPinned,
    clearOperationError,
  };
}

function applyMutation(mutation: KnowledgeBaseMutation): void {
  const base = mutation.knowledgeBase;
  if (appState.personalKnowledgeBases) {
    const items = appState.personalKnowledgeBases.items.filter((item) => item.id !== base.id);
    items.push(base);
    items.sort(
      (left, right) =>
        Number(right.pinned) - Number(left.pinned) ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.name.localeCompare(right.name)
    );
    appState.personalKnowledgeBases = {
      ...appState.personalKnowledgeBases,
      items,
      total: items.length,
    };
  }
}

export type KnowledgeActions = ReturnType<typeof useKnowledgeController>;
