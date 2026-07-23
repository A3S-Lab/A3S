import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef } from 'react';
import { codeApi } from '../../lib/api';
import { appendTaskInstruction, appState, formatApiError, navigateTask, showToast } from '../../state/app-state';
import type { PluginActivityCatalog, PluginOperationRequest } from '../../types/api';
import type { PluginContextProposal } from './plugin-state';

const ACTIVITY_POLL_MS = 2_500;

export function usePluginController() {
  const activitySequence = useRef(0);
  const contentSequence = useRef(0);
  const contentAbort = useRef<AbortController | null>(null);
  const marketplaceSequence = useRef(0);
  const marketplaceAbort = useRef<AbortController | null>(null);

  const applyCatalog = useMemoizedFn((catalog: PluginActivityCatalog) => {
    const previous = new Map(appState.pluginCatalog.items.map((item) => [item.key, item.sha256]));
    const items = [...catalog.items].sort(
      (left, right) =>
        left.order - right.order || left.title.localeCompare(right.title) || left.key.localeCompare(right.key)
    );
    appState.pluginCatalog = { ...catalog, items };
    appState.pluginCatalogStatus = 'ready';
    appState.pluginCatalogError = null;
    for (const [key, digest] of previous) {
      const next = items.find((item) => item.key === key);
      if (!next || next.sha256 !== digest || !next.enabled) delete appState.pluginContentByKey[key];
    }
    if (
      appState.pluginContextProposal &&
      !items.some((item) => item.key === appState.pluginContextProposal?.sourceKey && item.enabled)
    ) {
      appState.pluginContextProposal = null;
    }
    if (
      appState.activeProduct === 'plugin' &&
      (!appState.activePluginKey || !items.some((item) => item.key === appState.activePluginKey && item.enabled))
    ) {
      navigateTask('conversation');
      showToast('该插件已卸载或停用，已返回 Code。', 'info');
    }
  });

  const refreshActivities = useMemoizedFn(async (silent = false) => {
    const sequence = ++activitySequence.current;
    if (!silent || appState.pluginCatalogStatus === 'idle') appState.pluginCatalogStatus = 'loading';
    try {
      const catalog = await codeApi.pluginActivities();
      if (sequence !== activitySequence.current) return;
      applyCatalog(catalog);
    } catch (error) {
      if (sequence !== activitySequence.current) return;
      appState.pluginCatalogStatus = 'error';
      appState.pluginCatalogError = formatApiError(error);
    }
  });

  const loadActivityContent = useMemoizedFn(async (key: string, force = false) => {
    const item = appState.pluginCatalog.items.find((candidate) => candidate.key === key && candidate.enabled);
    if (!item) {
      navigateTask('conversation');
      return;
    }
    const cached = appState.pluginContentByKey[key];
    if (
      !force &&
      cached &&
      cached.sha256 === item.sha256 &&
      cached.registryRevision === appState.pluginCatalog.revision
    ) {
      appState.pluginContentStatus = 'ready';
      appState.pluginContentError = null;
      return;
    }

    contentAbort.current?.abort();
    const controller = new AbortController();
    contentAbort.current = controller;
    const sequence = ++contentSequence.current;
    appState.pluginContentStatus = 'loading';
    appState.pluginContentError = null;
    appState.pluginRuntimeError = null;
    try {
      const content = await codeApi.pluginActivityContent(key, controller.signal);
      if (sequence !== contentSequence.current) return;
      const current = appState.pluginCatalog.items.find((candidate) => candidate.key === key && candidate.enabled);
      if (
        !current ||
        content.sha256 !== current.sha256 ||
        content.registryRevision !== appState.pluginCatalog.revision ||
        content.packageId !== current.packageId ||
        content.skill !== current.skill
      ) {
        throw new Error('插件内容与当前注册表 revision 不一致，请刷新后重试。');
      }
      appState.pluginContentByKey[key] = content;
      appState.pluginContentStatus = 'ready';
    } catch (error) {
      if (controller.signal.aborted || sequence !== contentSequence.current) return;
      appState.pluginContentStatus = 'error';
      appState.pluginContentError = formatApiError(error);
    }
  });

  const refreshMarketplace = useMemoizedFn(async () => {
    marketplaceAbort.current?.abort();
    const controller = new AbortController();
    marketplaceAbort.current = controller;
    const sequence = ++marketplaceSequence.current;
    appState.pluginMarketplaceStatus = 'loading';
    appState.pluginMarketplaceError = null;
    try {
      const marketplace = await codeApi.pluginMarketplace(controller.signal);
      if (sequence !== marketplaceSequence.current) return;
      appState.pluginMarketplace = marketplace;
      appState.pluginMarketplaceStatus = 'ready';
    } catch (error) {
      if (controller.signal.aborted || sequence !== marketplaceSequence.current) return;
      appState.pluginMarketplaceStatus = 'error';
      appState.pluginMarketplaceError = formatApiError(error);
    }
  });

  const planOperation = useMemoizedFn(async (request: PluginOperationRequest) => {
    appState.pluginOperationStatus = 'loading';
    appState.pluginOperationError = null;
    appState.pluginOperationReview = null;
    try {
      const plan = await codeApi.planPluginOperation(request);
      appState.pluginOperationReview = { request, plan };
      appState.pluginOperationStatus = 'ready';
    } catch (error) {
      appState.pluginOperationStatus = 'error';
      appState.pluginOperationError = formatApiError(error);
    }
  });

  const applyReviewedOperation = useMemoizedFn(async () => {
    const review = appState.pluginOperationReview;
    if (!review) return;
    const previousRevision = appState.pluginCatalog.revision;
    appState.pluginOperationStatus = 'loading';
    appState.pluginOperationError = null;
    try {
      const result = await codeApi.applyPluginOperation({
        ...review.request,
        planDigest: review.plan.planDigest,
      });
      appState.pluginOperationReview = null;
      appState.pluginOperationStatus = 'ready';
      const changed = result.operations.some((operation) => operation.changed);
      await refreshActivities(true);
      showToast(pluginOperationSuccessMessage(review.request, changed), 'success');
      void refreshMarketplace();
      void refreshMarketplaceAfterRevisionSettles(previousRevision, refreshActivities, refreshMarketplace);
    } catch (error) {
      appState.pluginOperationStatus = 'error';
      appState.pluginOperationError = formatApiError(error);
    }
  });

  const setPackageEnabled = useMemoizedFn(async (componentId: string, enabled: boolean) => {
    const previousRevision = appState.pluginCatalog.revision;
    appState.pluginOperationStatus = 'loading';
    appState.pluginOperationError = null;
    try {
      await codeApi.setPluginPackageEnabled(componentId, enabled);
      appState.pluginOperationStatus = 'ready';
      await refreshActivities(true);
      showToast(enabled ? '插件已启用。' : '插件已停用。', 'success');
      void refreshMarketplace();
      void refreshMarketplaceAfterRevisionSettles(previousRevision, refreshActivities, refreshMarketplace);
    } catch (error) {
      appState.pluginOperationStatus = 'error';
      appState.pluginOperationError = formatApiError(error);
    }
  });

  const proposeContext = useMemoizedFn((proposal: PluginContextProposal) => {
    const contribution = appState.pluginCatalog.items.find((item) => item.key === proposal.sourceKey && item.enabled);
    if (!contribution) return;
    appState.pluginContextProposal = proposal;
  });

  const dismissContextProposal = useMemoizedFn(() => {
    appState.pluginContextProposal = null;
  });

  const acceptContextProposal = useMemoizedFn(() => {
    const proposal = appState.pluginContextProposal;
    if (!proposal) return;
    const contribution = appState.pluginCatalog.items.find((item) => item.key === proposal.sourceKey && item.enabled);
    if (!contribution) {
      appState.pluginContextProposal = null;
      return;
    }
    const fields = proposal.fields.map((field) => `- ${field.label}: ${field.value}`).join('\n');
    const context = [
      `[Reviewed plugin context: ${contribution.title}]`,
      proposal.summary,
      fields,
      '[/Reviewed plugin context]',
      proposal.prompt,
    ]
      .filter(Boolean)
      .join('\n\n');
    appendTaskInstruction(context);
    if (proposal.usePackageSkill && !appState.composerSkills.includes(contribution.skill)) {
      appState.composerSkills = [...appState.composerSkills, contribution.skill];
    }
    appState.pluginContextProposal = null;
    navigateTask('conversation');
    showToast(
      proposal.usePackageSkill
        ? `已将审核后的上下文和 ${contribution.skill} Skill 加入 Code。`
        : '已将审核后的科研上下文加入 Code。',
      'success'
    );
  });

  const dismissOperationReview = useMemoizedFn(() => {
    if (appState.pluginOperationStatus !== 'loading') appState.pluginOperationReview = null;
  });

  useEffect(() => {
    void refreshActivities();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshActivities(true);
    }, ACTIVITY_POLL_MS);
    return () => {
      window.clearInterval(interval);
      contentAbort.current?.abort();
      marketplaceAbort.current?.abort();
    };
  }, [refreshActivities]);

  return {
    refreshActivities,
    loadActivityContent,
    refreshMarketplace,
    planOperation,
    applyReviewedOperation,
    dismissOperationReview,
    setPackageEnabled,
    proposeContext,
    dismissContextProposal,
    acceptContextProposal,
  };
}

async function refreshUntilRevisionChanges(
  previousRevision: string,
  refresh: (silent?: boolean) => Promise<void>
): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (appState.pluginCatalog.revision !== previousRevision) return;
    await delay(400 * (attempt + 1));
    await refresh(true);
  }
}

async function refreshMarketplaceAfterRevisionSettles(
  previousRevision: string,
  refreshActivities: (silent?: boolean) => Promise<void>,
  refreshMarketplace: () => Promise<void>
): Promise<void> {
  await refreshUntilRevisionChanges(previousRevision, refreshActivities);
  await refreshMarketplace();
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function pluginOperationSuccessMessage(request: PluginOperationRequest, changed: boolean): string {
  if (!changed) return '插件已处于目标状态。';
  const isScience = request.componentId === 'use/a3s/science';
  if (request.action === 'install') {
    return isScience ? '科研插件已安装并启用，可从市场或活动栏打开。' : '插件已安装并启用。';
  }
  if (request.action === 'uninstall') return isScience ? '科研插件已卸载。' : '插件已卸载。';
  return isScience ? '科研插件已升级。' : '插件已升级。';
}

export type PluginActions = ReturnType<typeof usePluginController>;
