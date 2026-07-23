import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FilterX,
  FlaskConical,
  LoaderCircle,
  PackageCheck,
  Plus,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import {
  Button,
  Dialog,
  IconButton,
  InlineNotice,
  PageHeader,
  SearchField,
  StateView,
  Tabs,
} from '../../../design-system/primitives';
import { appState, navigatePlugin } from '../../../state/app-state';
import type { PluginMarketplaceItem, PluginOperationAction, PluginOperationRequest } from '../../../types/api';
import type { PluginActions } from '../use-plugin-controller';

type MarketplaceSection = 'catalog' | 'sources';
type CatalogView = 'all' | 'installed';
type ChannelFilter = 'all' | PluginMarketplaceItem['channel'];

export function PluginMarketplacePage({ actions }: { actions: PluginActions }) {
  const state = useSnapshot(appState);
  const [section, setSection] = useState<MarketplaceSection>('catalog');
  const [view, setView] = useState<CatalogView>('all');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [registry, setRegistry] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (appState.pluginMarketplaceStatus === 'idle') void actions.refreshMarketplace();
  }, [actions.refreshMarketplace]);

  const items = useMemo(
    () => (state.pluginMarketplace?.items ?? []).map((item) => item as PluginMarketplaceItem),
    [state.pluginMarketplace?.items]
  );
  const installedCount = items.filter((item) => item.installed).length;
  const registryNames = useMemo(
    () => [...new Set((state.pluginMarketplace?.registries ?? []).map((item) => item.name))],
    [state.pluginMarketplace?.registries]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredItems = items.filter((item) => {
    if (view === 'installed' && !item.installed) return false;
    if (channel !== 'all' && item.channel !== channel) return false;
    if (registry !== 'all' && item.registryName !== registry) return false;
    return [item.displayName, item.componentId, item.registryName, item.channel]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
  const busy = state.pluginOperationStatus === 'loading';

  const showInstalled = () => {
    setSection('catalog');
    setView('installed');
    setChannel('all');
    setRegistry('all');
    setQuery('');
  };

  const selectSection = (next: MarketplaceSection) => {
    setSection(next);
    setQuery('');
  };

  const clearFilters = () => {
    setChannel('all');
    setRegistry('all');
    setQuery('');
  };

  const filtersActive = normalizedQuery.length > 0 || channel !== 'all' || registry !== 'all';

  return (
    <section className='plugin-marketplace-page memory-page' data-section={section} aria-label='A3S 市场'>
      <PageHeader
        className='memory-page-header'
        icon={<Store size={19} />}
        title='市场'
        navigation={
          <Tabs<MarketplaceSection>
            ariaLabel='市场页面'
            value={section}
            className='memory-section-switcher'
            items={[
              { id: 'catalog', label: '插件', icon: <Puzzle size={14} /> },
              { id: 'sources', label: '来源', icon: <ShieldCheck size={14} /> },
            ]}
            onChange={selectSection}
          />
        }
        actions={
          <>
            <Button tone='quiet' className='plugin-installed-action' onClick={showInstalled}>
              <PackageCheck size={14} /> 已安装 {installedCount}
            </Button>
            <Button
              tone='secondary'
              loading={state.pluginMarketplaceStatus === 'loading'}
              disabled={state.pluginMarketplaceStatus === 'loading'}
              onClick={() => void actions.refreshMarketplace()}
            >
              {state.pluginMarketplaceStatus !== 'loading' && <RefreshCw size={14} />} 刷新
            </Button>
          </>
        }
      />

      {section === 'sources' ? (
        <RegistryCatalog />
      ) : (
        <section className='memory-workbench plugin-marketplace-workbench' aria-labelledby='plugin-directory-title'>
          <aside className='memory-filters plugin-marketplace-filters' aria-label='插件筛选'>
            <div className='memory-filter-heading'>
              <div>
                <strong>筛选</strong>
                <span>{items.length} 个可用插件</span>
              </div>
              {filtersActive && (
                <Button tone='quiet' className='memory-filter-clear' onClick={clearFilters}>
                  <FilterX size={13} /> 清除
                </Button>
              )}
            </div>
            <SearchField
              className='memory-search'
              size='compact'
              label='搜索插件'
              clearLabel='清除搜索'
              value={query}
              placeholder='搜索插件'
              onValueChange={setQuery}
            />
            <section className='memory-filter-group'>
              <h2>版本</h2>
              <div className='memory-filter-segments plugin-channel-segments'>
                {(['all', 'stable', 'beta', 'nightly'] as const).map((candidate) => (
                  <button
                    key={candidate}
                    type='button'
                    className={channel === candidate ? 'active' : ''}
                    aria-pressed={channel === candidate}
                    onClick={() => setChannel(candidate)}
                  >
                    {channelLabel(candidate)}
                  </button>
                ))}
              </div>
            </section>
            <section className='memory-filter-group'>
              <h2>来源</h2>
              <div className='memory-filter-options source-options'>
                <button
                  type='button'
                  className={registry === 'all' ? 'active' : ''}
                  aria-pressed={registry === 'all'}
                  data-tone='source'
                  onClick={() => setRegistry('all')}
                >
                  <i aria-hidden='true' />
                  <span>全部来源</span>
                  <small>{items.length}</small>
                </button>
                {registryNames.map((name) => (
                  <button
                    type='button'
                    className={registry === name ? 'active' : ''}
                    aria-pressed={registry === name}
                    data-tone='source'
                    key={name}
                    onClick={() => setRegistry(name)}
                  >
                    <i aria-hidden='true' />
                    <span>{name}</span>
                    <small>{items.filter((item) => item.registryName === name).length}</small>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <main className='memory-visualization'>
            <header className='memory-visualization-toolbar'>
              <Tabs<CatalogView>
                ariaLabel='插件目录视图'
                value={view}
                className='memory-view-switcher'
                items={[
                  {
                    id: 'all',
                    label: '全部插件',
                    icon: <Puzzle size={14} />,
                    tabId: 'plugin-view-all',
                    panelId: 'plugin-directory-panel',
                  },
                  {
                    id: 'installed',
                    label: '已安装',
                    icon: <PackageCheck size={14} />,
                    tabId: 'plugin-view-installed',
                    panelId: 'plugin-directory-panel',
                  },
                ]}
                onChange={setView}
              />
              <div className='memory-visualization-context'>
                <span>
                  {filteredItems.length === items.length
                    ? `${items.length} 个插件`
                    : `${filteredItems.length} / ${items.length} 个插件`}
                </span>
              </div>
            </header>
            <div className='plugin-marketplace-content'>
              <h2 className='sr-only' id='plugin-directory-title'>
                插件目录
              </h2>
              <MarketplaceMessages />
              {state.pluginMarketplaceStatus === 'loading' && !state.pluginMarketplace && (
                <StateView
                  className='plugin-catalog-state'
                  size='compact'
                  role='status'
                  icon={<LoaderCircle className='spin' size={22} />}
                  title='正在加载插件'
                  description='正在读取已验证的插件目录。'
                />
              )}
              {state.pluginMarketplace && filteredItems.length === 0 && (
                <StateView
                  className='plugin-catalog-state plugin-catalog-empty'
                  size='compact'
                  icon={<FilterX size={22} />}
                  title={
                    normalizedQuery
                      ? '没有符合搜索条件的插件'
                      : view === 'installed'
                        ? '尚未安装插件'
                        : '当前筛选条件下暂无插件'
                  }
                  description='调整搜索或筛选条件后再试。'
                />
              )}
              <div
                className='plugin-catalog-list'
                id='plugin-directory-panel'
                role='tabpanel'
                aria-labelledby={`plugin-view-${view}`}
              >
                {filteredItems.map((item) => (
                  <MarketplaceCard
                    key={`${item.registryName}:${item.componentId}:${item.channel}`}
                    item={item}
                    busy={busy}
                    activityKey={
                      state.pluginCatalog.items.find(
                        (activity) => activity.packageId === item.componentId && activity.enabled
                      )?.key
                    }
                    onPlan={(action) => void actions.planOperation(operationRequest(action, item))}
                    onToggle={(enabled) => void actions.setPackageEnabled(item.componentId, enabled)}
                  />
                ))}
              </div>
            </div>
          </main>
        </section>
      )}

      {state.pluginOperationReview && <OperationReviewDialog actions={actions} />}
    </section>
  );
}

function MarketplaceMessages() {
  const state = useSnapshot(appState);
  return (
    <>
      {state.pluginMarketplaceStatus === 'error' && (
        <InlineNotice
          className='plugin-marketplace-notice'
          tone='danger'
          role='alert'
          icon={<AlertTriangle size={18} />}
          title='无法读取插件目录'
        >
          {state.pluginMarketplaceError}
        </InlineNotice>
      )}
      {state.pluginOperationError && (
        <InlineNotice
          className='plugin-marketplace-notice'
          tone='danger'
          role='alert'
          icon={<AlertTriangle size={18} />}
          title='插件操作失败'
        >
          {state.pluginOperationError}
        </InlineNotice>
      )}
    </>
  );
}

function RegistryCatalog() {
  const state = useSnapshot(appState);
  const registries = state.pluginMarketplace?.registries ?? [];
  const verifiedCount = registries.filter((registry) => registry.verified).length;
  const attentionCount = registries.length - verifiedCount;
  const packageCount = registries.reduce((count, registry) => count + (registry.metadata?.packageTargets ?? 0), 0);
  return (
    <section className='memory-workbench plugin-marketplace-workbench' aria-labelledby='plugin-source-title'>
      <aside className='memory-filters plugin-source-overview' aria-label='来源概览'>
        <div className='memory-filter-heading'>
          <div>
            <strong>来源概览</strong>
            <span>仅展示已校验的插件目录</span>
          </div>
        </div>
        <dl className='plugin-source-summary'>
          <div>
            <dt>
              <ShieldCheck size={14} /> 可用来源
            </dt>
            <dd>{verifiedCount}</dd>
          </div>
          <div>
            <dt>
              <AlertTriangle size={14} /> 需处理
            </dt>
            <dd>{attentionCount}</dd>
          </div>
          <div>
            <dt>
              <Puzzle size={14} /> 插件包
            </dt>
            <dd>{packageCount}</dd>
          </div>
        </dl>
        <p className='plugin-source-note'>只有验证通过的来源才会出现在插件目录中。</p>
      </aside>

      <main className='memory-visualization'>
        <header className='memory-visualization-toolbar'>
          <div className='plugin-source-toolbar-title'>
            <ShieldCheck size={14} />
            <strong id='plugin-source-title'>插件来源</strong>
          </div>
          <div className='memory-visualization-context'>
            {state.pluginMarketplace?.verifiedAt && (
              <span>上次检查 {formatTimestamp(state.pluginMarketplace.verifiedAt)}</span>
            )}
          </div>
        </header>
        <div className='plugin-marketplace-content plugin-source-content'>
          <MarketplaceMessages />
          {state.pluginMarketplaceStatus === 'loading' && !state.pluginMarketplace && (
            <StateView
              className='plugin-catalog-state'
              size='compact'
              role='status'
              icon={<LoaderCircle className='spin' size={22} />}
              title='正在检查来源'
              description='正在验证插件目录及其签名状态。'
            />
          )}
          <div className='plugin-source-grid'>
            {registries.map((registry) => (
              <article className={`plugin-registry ${registry.verified ? 'verified' : 'error'}`} key={registry.name}>
                <span>
                  {registry.verified ? (
                    registry.sourceKind === 'release-bundle' ? (
                      <PackageCheck size={18} />
                    ) : (
                      <ShieldCheck size={18} />
                    )
                  ) : (
                    <AlertTriangle size={18} />
                  )}
                </span>
                <div>
                  <header>
                    <strong>{registry.name}</strong>
                    <small>
                      {registry.verified
                        ? registry.sourceKind === 'release-bundle'
                          ? '发行包已校验'
                          : '已验证'
                        : registry.configured
                          ? '验证失败'
                          : '未配置'}
                    </small>
                  </header>
                  <details className='plugin-registry-details'>
                    <summary>技术信息</summary>
                    <code>{registry.url}</code>
                    {registry.metadata && (
                      <dl>
                        {registry.metadata.targetsVersion !== undefined && (
                          <div>
                            <dt>目录版本</dt>
                            <dd>v{registry.metadata.targetsVersion}</dd>
                          </div>
                        )}
                        <div>
                          <dt>插件数</dt>
                          <dd>{registry.metadata.packageTargets}</dd>
                        </div>
                        {registry.hostTarget && (
                          <div>
                            <dt>平台</dt>
                            <dd>{registry.hostTarget}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </details>
                  {registry.error && <p>{registry.error}</p>}
                </div>
              </article>
            ))}
          </div>
          {state.pluginMarketplace && registries.length === 0 && (
            <StateView
              className='plugin-catalog-state plugin-catalog-empty'
              size='compact'
              icon={<ShieldCheck size={22} />}
              title='还没有可用的插件来源'
              description='配置并验证来源后，可用插件会显示在市场中。'
            />
          )}
        </div>
      </main>
    </section>
  );
}

function MarketplaceCard({
  item,
  busy,
  activityKey,
  onPlan,
  onToggle,
}: {
  item: PluginMarketplaceItem;
  busy: boolean;
  activityKey?: string;
  onPlan: (action: PluginOperationAction) => void;
  onToggle: (enabled: boolean) => void;
}) {
  const isResearch = item.packageId === 'a3s/science';
  return (
    <article className='plugin-marketplace-card'>
      <header>
        <span className={`plugin-package-logo ${isResearch ? 'research' : ''}`} aria-hidden='true'>
          {isResearch ? <FlaskConical size={19} /> : <Puzzle size={18} />}
        </span>
        <div className='plugin-card-identity'>
          <h2>{item.displayName}</h2>
          <span>{item.registryName}</span>
        </div>
        {!item.installed ? (
          <IconButton
            className='plugin-card-install'
            label={`查看并安装 ${item.displayName}`}
            disabled={busy}
            onClick={() => onPlan('install')}
          >
            <Plus size={16} />
          </IconButton>
        ) : (
          <span className={`plugin-installed-badge ${item.enabled ? 'enabled' : ''}`}>
            <PackageCheck size={12} /> {item.enabled ? '已启用' : '已停用'}
          </span>
        )}
      </header>

      <p className='plugin-card-description'>{marketplaceDescription(item)}</p>

      <div className='plugin-package-integrity'>
        <span>v{item.version}</span>
        <span>{channelLabel(item.channel)}</span>
        <span>{formatBytes(item.length)}</span>
      </div>
      {item.installed && (
        <footer>
          {item.enabled && activityKey ? (
            <Button tone='primary' disabled={busy} onClick={() => navigatePlugin(activityKey)}>
              <ExternalLink size={13} /> {isResearch ? '打开科研' : '打开'}
            </Button>
          ) : item.enabled ? (
            <Button tone='primary' disabled>
              <RefreshCw className='spin' size={13} /> 正在激活
            </Button>
          ) : (
            <Button tone='primary' disabled={busy} onClick={() => onToggle(true)}>
              启用
            </Button>
          )}
          <Button disabled={busy} onClick={() => onPlan('upgrade')}>
            <Upload size={13} /> 升级
          </Button>
          {item.enabled && (
            <Button disabled={busy} onClick={() => onToggle(false)}>
              停用
            </Button>
          )}
          <Button
            tone='danger'
            className='plugin-card-uninstall'
            aria-label={`卸载 ${item.displayName}`}
            disabled={busy}
            onClick={() => onPlan('uninstall')}
          >
            <Trash2 size={13} /> 卸载
          </Button>
        </footer>
      )}
    </article>
  );
}

function OperationReviewDialog({ actions }: { actions: PluginActions }) {
  const state = useSnapshot(appState);
  const review = state.pluginOperationReview;
  if (!review) return null;
  const mutates = review.plan.plans.some((plan) => plan.mutates);
  const actionLabel = operationLabel(review.request.action);
  return (
    <Dialog
      title={`确认${actionLabel}`}
      description='请确认以下更改。'
      onClose={actions.dismissOperationReview}
      closeDisabled={state.pluginOperationStatus === 'loading'}
      className='plugin-operation-dialog'
      footer={
        <>
          <Button disabled={state.pluginOperationStatus === 'loading'} onClick={actions.dismissOperationReview}>
            取消
          </Button>
          <Button
            tone={review.request.action === 'uninstall' ? 'danger' : 'primary'}
            loading={state.pluginOperationStatus === 'loading'}
            disabled={!mutates}
            onClick={() => void actions.applyReviewedOperation()}
          >
            {mutates ? `确认${actionLabel}` : '无需更改'}
          </Button>
        </>
      }
    >
      <div className='plugin-operation-review'>
        <div className='plugin-review-assurance'>
          <ShieldCheck size={15} />
          <span>内容发生变化时，A3S 不会继续操作。</span>
        </div>
        <section>
          <h3>将进行</h3>
          {review.plan.plans.map((plan, index) => (
            <article key={`${plan.component}:${plan.action}:${index}`}>
              <span>{plan.mutates ? <CheckCircle2 size={14} /> : <PackageCheck size={14} />}</span>
              <div>
                <strong>{planActionLabel(plan.action)}</strong>
                <p>{plan.message}</p>
              </div>
            </article>
          ))}
        </section>
        <details className='plugin-operation-details'>
          <summary>技术信息</summary>
          <dl>
            <div>
              <dt>组件</dt>
              <dd>{review.request.componentId}</dd>
            </div>
            <div>
              <dt>校验值</dt>
              <dd>
                <code>{review.plan.planDigest}</code>
              </dd>
            </div>
            <div>
              <dt>命令</dt>
              <dd>
                <code>{review.plan.planCommand}</code>
              </dd>
            </div>
          </dl>
        </details>
      </div>
    </Dialog>
  );
}

function operationRequest(action: PluginOperationAction, item: PluginMarketplaceItem): PluginOperationRequest {
  if (action === 'install') {
    return { action, componentId: item.componentId, version: item.version, channel: item.channel };
  }
  return { action, componentId: item.componentId };
}

function marketplaceDescription(item: PluginMarketplaceItem): string {
  if (item.packageId === 'a3s/science') {
    return '跨学科科研工作台；生命科学场景可按需调用已验证的专业数据源。';
  }
  return `由 ${item.registryName} 发布。安装前会显示具体更改。`;
}

function operationLabel(action: PluginOperationAction): string {
  if (action === 'install') return '安装';
  if (action === 'upgrade') return '升级';
  return '卸载';
}

function channelLabel(channel: ChannelFilter): string {
  if (channel === 'all') return '全部';
  if (channel === 'stable') return '稳定版';
  if (channel === 'beta') return '测试版';
  return '每日版';
}

function planActionLabel(action: string): string {
  if (action === 'install') return '安装';
  if (action === 'upgrade') return '升级';
  if (action === 'uninstall') return '卸载';
  return '更新';
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
