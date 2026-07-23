import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { PluginActivityItem, PluginMarketplaceItem } from '../../../types/api';
import type { PluginActions } from '../use-plugin-controller';
import { PluginMarketplacePage } from './plugin-marketplace-page';

const marketplaceItem: PluginMarketplaceItem = {
  componentId: 'use/a3s/science',
  packageId: 'a3s/science',
  displayName: '科研',
  registryName: 'a3s',
  registryUrl: 'https://packages.a3s.dev',
  version: '1.2.3',
  channel: 'stable',
  target: 'darwin-arm64',
  archiveName: 'science.tar.gz',
  length: 2048,
  sha256: 'a'.repeat(64),
  signedPlanDigest: 'b'.repeat(64),
  installed: false,
  enabled: false,
};

const researchActivity: PluginActivityItem = {
  key: 'science:research',
  packageId: 'use/a3s/science',
  route: 'science',
  version: '1.2.3',
  enabled: true,
  id: 'research',
  title: '科研',
  description: 'Prepare reviewable research tasks.',
  icon: 'flask-conical',
  skill: 'a3s-use-science',
  order: 120,
  sha256: 'c'.repeat(64),
  mediaType: 'text/html',
};

describe('plugin marketplace page', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#plugins');
    appState.activeProduct = 'plugins';
    appState.activePluginKey = null;
    appState.pluginCatalog = {
      schemaVersion: 1,
      available: true,
      generation: 1,
      revision: 'd'.repeat(64),
      items: [],
    };
    appState.pluginMarketplaceStatus = 'ready';
    appState.pluginMarketplaceError = null;
    appState.pluginOperationStatus = 'idle';
    appState.pluginOperationError = null;
    appState.pluginOperationReview = null;
    appState.pluginMarketplace = {
      schemaVersion: 1,
      verifiedAt: '2026-07-21T00:00:00Z',
      registries: [
        {
          name: 'a3s',
          url: 'https://packages.a3s.dev',
          configured: true,
          verified: true,
          metadata: {
            rootVersion: 1,
            timestampVersion: 2,
            snapshotVersion: 3,
            targetsVersion: 4,
            packageTargets: 1,
          },
        },
      ],
      items: [marketplaceItem],
    };
  });

  afterEach(() => cleanup());

  it('uses the same product header and filter-workbench hierarchy as Memory', () => {
    const actions = createPluginActions();
    const { container } = render(<PluginMarketplacePage actions={actions} />);

    expect(screen.getByRole('heading', { name: '市场' })).toBeInTheDocument();
    expect(container.querySelector('.memory-page-header')).toBeInTheDocument();
    expect(container.querySelector('.memory-workbench')).toBeInTheDocument();
    expect(container.querySelector('.plugin-marketplace-toolbar')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '插件筛选' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '推荐' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '插件' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: '知识库' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已安装 0' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: '全部插件' })).toBeInTheDocument();
    expect(screen.queryByText('SHA-256 aaaaaaaaaaaa…')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看并安装 科研' }));
    expect(actions.planOperation).toHaveBeenCalledWith({
      action: 'install',
      componentId: 'use/a3s/science',
      version: '1.2.3',
      channel: 'stable',
    });

    fireEvent.click(screen.getByRole('tab', { name: '来源' }));
    expect(screen.getByRole('tab', { name: '来源' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('complementary', { name: '来源概览' })).toBeInTheDocument();
    expect(screen.getByText('已验证')).toBeInTheDocument();
    expect(screen.getByText('https://packages.a3s.dev')).toBeInTheDocument();
  });

  it('opens an installed-only catalog from the toolbar', () => {
    const actions = createPluginActions();
    appState.pluginMarketplace = {
      ...appState.pluginMarketplace!,
      items: [
        { ...marketplaceItem, installed: true, enabled: true },
        { ...marketplaceItem, componentId: 'use/a3s/finance', packageId: 'a3s/finance', displayName: '金融' },
      ],
    };
    render(<PluginMarketplacePage actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: '已安装 1' }));
    expect(screen.getByRole('heading', { name: '科研' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '金融' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '停用' })).toBeInTheDocument();
  });

  it('presents a verified A3S Use release bundle as an installable Science source', () => {
    appState.pluginMarketplace = {
      schemaVersion: 1,
      verifiedAt: '2026-07-21T00:00:00Z',
      registries: [
        {
          name: 'A3S 发行包',
          url: 'a3s-use://release-bundles',
          sourceKind: 'release-bundle',
          configured: true,
          verified: true,
          hostTarget: 'darwin-aarch64',
          metadata: { packageTargets: 1 },
        },
      ],
      items: [
        {
          ...marketplaceItem,
          registryName: 'A3S 发行包',
          registryUrl: 'a3s-use://release-bundles',
          sourceKind: 'release-bundle',
          signedPlanDigest: undefined,
          integrityDigest: marketplaceItem.sha256,
        },
      ],
    };
    render(<PluginMarketplacePage actions={createPluginActions()} />);

    expect(screen.getByRole('heading', { name: '科研' })).toBeInTheDocument();
    expect(screen.getAllByText('A3S 发行包').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '查看并安装 科研' })).toBeEnabled();

    fireEvent.click(screen.getByRole('tab', { name: '来源' }));
    expect(screen.getByText('发行包已校验')).toBeInTheDocument();
    expect(screen.getByText('a3s-use://release-bundles')).toBeInTheDocument();
  });

  it('opens an installed Science workbench and exposes a reviewed uninstall action', () => {
    const actions = createPluginActions();
    appState.pluginMarketplace = {
      ...appState.pluginMarketplace!,
      items: [{ ...marketplaceItem, installed: true, enabled: true }],
    };
    appState.pluginCatalog = {
      ...appState.pluginCatalog,
      generation: 2,
      revision: 'e'.repeat(64),
      items: [researchActivity],
    };
    render(<PluginMarketplacePage actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: '卸载 科研' }));
    expect(actions.planOperation).toHaveBeenCalledWith({
      action: 'uninstall',
      componentId: 'use/a3s/science',
    });

    fireEvent.click(screen.getByRole('button', { name: '打开科研' }));
    expect(appState.activeProduct).toBe('plugin');
    expect(appState.activePluginKey).toBe('science:research');
    expect(window.location.hash).toBe('#plugin/science%3Aresearch');
  });

  it('shows activation progress until an installed contribution reaches the live registry', () => {
    appState.pluginMarketplace = {
      ...appState.pluginMarketplace!,
      items: [{ ...marketplaceItem, installed: true, enabled: true }],
    };
    render(<PluginMarketplacePage actions={createPluginActions()} />);

    expect(screen.getByRole('button', { name: '正在激活' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '打开科研' })).not.toBeInTheDocument();
  });

  it('combines text search with release-channel filtering', () => {
    const actions = createPluginActions();
    appState.pluginMarketplace = {
      ...appState.pluginMarketplace!,
      items: [
        marketplaceItem,
        {
          ...marketplaceItem,
          componentId: 'use/a3s/finance-analysis',
          packageId: 'a3s/finance-analysis',
          displayName: '金融分析',
          channel: 'beta',
        },
        {
          ...marketplaceItem,
          componentId: 'use/a3s/finance-news',
          packageId: 'a3s/finance-news',
          displayName: '金融资讯',
          channel: 'nightly',
        },
      ],
    };
    render(<PluginMarketplacePage actions={actions} />);

    fireEvent.change(screen.getByPlaceholderText('搜索插件'), { target: { value: '金融' } });
    expect(screen.getByRole('heading', { name: '金融分析' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '金融资讯' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '科研' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '测试版' }));
    expect(screen.getByRole('button', { name: '测试版', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '金融分析' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '金融资讯' })).not.toBeInTheDocument();
  });

  it('requires a second explicit confirmation while hiding technical plan details', async () => {
    const actions = createPluginActions();
    appState.pluginOperationReview = {
      request: { action: 'install', componentId: 'use/a3s/science', version: '1.2.3', channel: 'stable' },
      plan: {
        dryRun: true,
        planSchemaVersion: 1,
        planCommand: 'a3s install use/a3s/science --dry-run',
        planDigest: 'c'.repeat(64),
        plans: [
          {
            component: 'use/a3s/science',
            action: 'install',
            source: 'registry:a3s',
            mutates: true,
            message: 'Install signed Science package.',
          },
        ],
      },
    };
    render(<PluginMarketplacePage actions={actions} />);

    expect(screen.getByRole('dialog', { name: '确认安装' })).toBeInTheDocument();
    expect(screen.getByText('技术信息').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('c'.repeat(64))).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '确认安装' }));
    await waitFor(() => expect(actions.applyReviewedOperation).toHaveBeenCalledOnce());
  });
});

function createPluginActions() {
  return {
    refreshActivities: vi.fn(async () => undefined),
    loadActivityContent: vi.fn(async () => undefined),
    refreshMarketplace: vi.fn(async () => undefined),
    planOperation: vi.fn(async () => undefined),
    applyReviewedOperation: vi.fn(async () => undefined),
    dismissOperationReview: vi.fn(),
    setPackageEnabled: vi.fn(async () => undefined),
    proposeContext: vi.fn(),
    dismissContextProposal: vi.fn(),
    acceptContextProposal: vi.fn(),
  } satisfies PluginActions;
}
