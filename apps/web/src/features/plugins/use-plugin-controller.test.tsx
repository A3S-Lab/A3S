import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../lib/api';
import { appState } from '../../state/app-state';
import type { PluginActivityCatalog, PluginActivityContent, PluginActivityItem } from '../../types/api';
import { createPluginsState } from './plugin-state';
import { usePluginController } from './use-plugin-controller';

const contribution: PluginActivityItem = {
  key: 'science:research',
  packageId: 'use/a3s/science',
  route: 'science',
  version: '1.2.3',
  enabled: true,
  id: 'research',
  title: '科研',
  description: 'Explore scientific sources.',
  icon: 'flask-conical',
  skill: 'a3s-use-science',
  order: 120,
  sha256: 'a'.repeat(64),
  mediaType: 'text/html',
};

const catalog: PluginActivityCatalog = {
  schemaVersion: 1,
  available: true,
  generation: 2,
  revision: 'b'.repeat(64),
  items: [contribution],
};

describe('usePluginController', () => {
  beforeEach(() => {
    window.location.hash = '';
    Object.assign(appState, createPluginsState(), {
      activeProduct: 'code',
      pluginCatalog: catalog,
      pluginCatalogStatus: 'ready',
      composerValue: '',
      composerSkills: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.assign(appState, createPluginsState());
  });

  it('aborts the previous asset fetch and discards its late result', async () => {
    const first = createDeferred<PluginActivityContent>();
    const second = createDeferred<PluginActivityContent>();
    const signals: AbortSignal[] = [];
    vi.spyOn(codeApi, 'pluginActivities').mockResolvedValue(catalog);
    vi.spyOn(codeApi, 'pluginActivityContent')
      .mockImplementationOnce((_key, signal) => {
        signals.push(signal as AbortSignal);
        return first.promise;
      })
      .mockImplementationOnce((_key, signal) => {
        signals.push(signal as AbortSignal);
        return second.promise;
      });
    const hook = renderHook(() => usePluginController());

    let firstRequest!: Promise<void>;
    let secondRequest!: Promise<void>;
    act(() => {
      firstRequest = hook.result.current.loadActivityContent(contribution.key, true);
      secondRequest = hook.result.current.loadActivityContent(contribution.key, true);
    });

    expect(signals[0].aborted).toBe(true);
    second.resolve(activityContent('<p>current</p>'));
    await act(() => secondRequest);

    first.resolve(activityContent('<p>stale</p>'));
    await act(() => firstRequest);

    expect(appState.pluginContentByKey[contribution.key]?.html).toBe('<p>current</p>');
    expect(appState.pluginContentStatus).toBe('ready');
    hook.unmount();
  });

  it('hands reviewed context and the same-package Skill back to Code', () => {
    vi.spyOn(codeApi, 'pluginActivities').mockResolvedValue(catalog);
    appState.activeProduct = 'plugin';
    appState.activePluginKey = contribution.key;
    const hook = renderHook(() => usePluginController());

    act(() => {
      hook.result.current.proposeContext({
        sourceKey: contribution.key,
        title: 'Review research context',
        summary: 'Compare recent CRISPR evidence.',
        prompt: 'Compare the selected studies and identify uncertainty.',
        fields: [{ label: 'Source', value: 'PubMed' }],
        usePackageSkill: true,
      });
    });
    act(() => hook.result.current.acceptContextProposal());

    expect(appState.activeProduct).toBe('code');
    expect(window.location.hash).toBe('#code/conversation');
    expect(appState.composerValue).toContain('[Reviewed plugin context: 科研]');
    expect(appState.composerValue).toContain('- Source: PubMed');
    expect(appState.composerValue).toContain('Compare the selected studies and identify uncertainty.');
    expect(appState.composerSkills).toEqual(['a3s-use-science']);
    expect(appState.pluginContextProposal).toBeNull();
    hook.unmount();
  });

  it('hands general-discipline context to Code without attaching the biomedical package Skill', () => {
    vi.spyOn(codeApi, 'pluginActivities').mockResolvedValue(catalog);
    appState.activeProduct = 'plugin';
    appState.activePluginKey = contribution.key;
    const hook = renderHook(() => usePluginController());

    act(() => {
      hook.result.current.proposeContext({
        sourceKey: contribution.key,
        title: 'Review research context',
        summary: 'Assess a software engineering question.',
        prompt: 'Compare the selected software engineering evidence.',
        fields: [{ label: 'Discipline', value: 'Computer Science' }],
        usePackageSkill: false,
      });
    });
    act(() => hook.result.current.acceptContextProposal());

    expect(appState.composerValue).toContain('- Discipline: Computer Science');
    expect(appState.composerSkills).toEqual([]);
    expect(appState.pluginContextProposal).toBeNull();
    hook.unmount();
  });

  it('drops a pending proposal if its package is disabled before review completes', () => {
    vi.spyOn(codeApi, 'pluginActivities').mockResolvedValue(catalog);
    const hook = renderHook(() => usePluginController());

    act(() => {
      hook.result.current.proposeContext({
        sourceKey: contribution.key,
        title: 'Review research context',
        summary: 'Pending context.',
        prompt: 'This must not reach Code.',
        fields: [],
        usePackageSkill: true,
      });
      appState.pluginCatalog = { ...catalog, items: [{ ...contribution, enabled: false }] };
      hook.result.current.acceptContextProposal();
    });

    expect(appState.composerValue).toBe('');
    expect(appState.composerSkills).toEqual([]);
    expect(appState.pluginContextProposal).toBeNull();
    hook.unmount();
  });

  it('converges Marketplace state after uninstall removes the live contribution', async () => {
    const removedCatalog: PluginActivityCatalog = {
      ...catalog,
      generation: 3,
      revision: 'c'.repeat(64),
      items: [],
    };
    const activities = vi
      .spyOn(codeApi, 'pluginActivities')
      .mockResolvedValueOnce(catalog)
      .mockResolvedValue(removedCatalog);
    const marketplace = vi.spyOn(codeApi, 'pluginMarketplace').mockResolvedValue({
      schemaVersion: 1,
      verifiedAt: '2026-07-22T00:00:00Z',
      registries: [],
      items: [],
    });
    vi.spyOn(codeApi, 'applyPluginOperation').mockResolvedValue({
      planDigest: 'd'.repeat(64),
      operations: [{ component: contribution.packageId, changed: true, message: 'Uninstalled.' }],
    });
    appState.activeProduct = 'plugin';
    appState.activePluginKey = contribution.key;
    appState.pluginContextProposal = {
      sourceKey: contribution.key,
      title: 'Pending research context',
      summary: 'Pending.',
      prompt: 'Must be discarded.',
      fields: [],
      usePackageSkill: true,
    };
    appState.pluginOperationReview = {
      request: { action: 'uninstall', componentId: contribution.packageId },
      plan: {
        dryRun: true,
        planSchemaVersion: 1,
        planCommand: `a3s uninstall ${contribution.packageId} --dry-run`,
        planDigest: 'd'.repeat(64),
        plans: [
          {
            component: contribution.packageId,
            action: 'uninstall',
            source: 'installed',
            mutates: true,
            message: 'Uninstall the research plugin.',
          },
        ],
      },
    };
    const hook = renderHook(() => usePluginController());
    await waitFor(() => expect(activities).toHaveBeenCalledOnce());

    await act(() => hook.result.current.applyReviewedOperation());

    await waitFor(() => expect(marketplace.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(appState.pluginCatalog).toEqual(removedCatalog);
    expect(appState.pluginContextProposal).toBeNull();
    expect(appState.pluginOperationReview).toBeNull();
    expect(appState.activeProduct).toBe('code');
    expect(appState.toast?.message).toBe('科研插件已卸载。');
    hook.unmount();
  });
});

function activityContent(html: string): PluginActivityContent {
  return {
    key: contribution.key,
    packageId: contribution.packageId,
    skill: contribution.skill,
    registryRevision: catalog.revision,
    sha256: contribution.sha256,
    mediaType: 'text/html',
    html,
    styles: [],
    scripts: [],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
