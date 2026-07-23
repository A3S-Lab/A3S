import { BrainCircuit, Database, Focus, ListTree, Network, RefreshCw, Settings2, Sparkles } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { Button, InlineNotice, PageHeader, StateView, Tabs } from '../../../design-system/primitives';
import { appState, navigateSettings } from '../../../state/app-state';
import type { CodeActions } from '../../code/use-code-controller';
import { EvolutionWorkbench } from '../components/evolution-workbench';
import { clearMemoryFilters, MemoryFiltersPanel } from '../components/memory-filters';
import { MemoryGraph } from '../components/memory-graph';
import { MemoryInspector } from '../components/memory-inspector';
import { MemoryTimeline } from '../components/memory-timeline';
import { filterMemoryEntries, projectMemoryGraph } from '../memory-projection';

export function MemoryPage({ actions }: { actions: CodeActions }) {
  const state = useSnapshot(appState);
  const data = state.memoryData ? appState.memoryData : null;

  useEffect(() => {
    if (state.memorySection === 'memory' && appState.memoryPhase === 'idle') void actions.loadMemory();
    if (state.memorySection === 'evolution' && appState.evolutionPhase === 'idle') void actions.loadEvolution();
  }, [actions, state.memorySection]);

  const filters = useMemo(
    () => ({
      query: state.memoryQuery,
      types: [...state.memoryTypeFilters],
      sources: [...state.memorySourceFilters],
      tiers: [...state.memoryTierFilters],
      signals: [...state.memorySignalFilters],
      lifecycle: [...state.memoryLifecycleFilters],
      timeRange: state.memoryTimeRange,
    }),
    [
      state.memoryLifecycleFilters,
      state.memoryQuery,
      state.memorySignalFilters,
      state.memorySourceFilters,
      state.memoryTierFilters,
      state.memoryTimeRange,
      state.memoryTypeFilters,
    ]
  );
  const entries = useMemo(() => (data ? filterMemoryEntries(data, filters) : []), [data, filters]);
  const selectedMemoryId = state.memoryInspector?.kind === 'memory' ? state.memoryInspector.id : undefined;
  const selectedEntityId = state.memoryInspector?.kind === 'entity' ? state.memoryInspector.id : undefined;
  const graph = useMemo(
    () => (data ? projectMemoryGraph(data, entries, state.memoryGraphScope, selectedMemoryId, selectedEntityId) : null),
    [data, entries, selectedEntityId, selectedMemoryId, state.memoryGraphScope]
  );
  const visibleMemoryIds = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);
  const inspectorOpen = Boolean(
    data &&
      state.memoryInspector &&
      (state.memoryInspector.kind === 'memory'
        ? data.entries.some((entry) => entry.id === state.memoryInspector?.id)
        : data.graph.entities.some((entity) => entity.id === state.memoryInspector?.id))
  );

  return (
    <section className='memory-page' aria-label='记忆与学习'>
      <PageHeader
        className='memory-page-header'
        icon={<BrainCircuit size={19} />}
        title='记忆'
        navigation={
          <Tabs
            ariaLabel='记忆页面'
            value={state.memorySection}
            className='memory-section-switcher'
            items={[
              { id: 'memory', label: '已保存', icon: <Database size={14} /> },
              {
                id: 'evolution',
                label: '学习',
                icon: <Sparkles size={14} />,
                badge:
                  state.memorySection === 'memory' && state.evolutionData && state.evolutionData.stats.ready > 0
                    ? state.evolutionData.stats.ready
                    : undefined,
              },
            ]}
            onChange={(section) => {
              appState.memorySection = section;
            }}
          />
        }
        actions={
          <>
            <Button tone='quiet' className='memory-settings-action' onClick={() => navigateSettings('context')}>
              <Settings2 size={14} /> 设置
            </Button>
            {state.memorySection === 'memory' ? (
              <Button
                tone='secondary'
                loading={state.memoryRefreshing}
                disabled={state.memoryPhase === 'loading' || state.memoryRefreshing}
                onClick={() => {
                  void actions.loadMemory(true);
                }}
              >
                {!state.memoryRefreshing && <RefreshCw size={14} />}
                刷新
              </Button>
            ) : (
              <Button
                tone='secondary'
                loading={state.evolutionRefreshing}
                disabled={
                  state.evolutionPhase === 'loading' || state.evolutionRefreshing || Boolean(state.evolutionBusyId)
                }
                onClick={() => {
                  void actions.scanEvolution();
                }}
              >
                {!state.evolutionRefreshing && <RefreshCw size={14} />}
                检查新内容
              </Button>
            )}
          </>
        }
      />

      {state.memorySection === 'evolution' ? (
        <EvolutionWorkbench actions={actions} />
      ) : (
        <>
          {state.memoryPhase === 'loading' && !data && <MemoryLoadingState />}
          {state.memoryPhase === 'error' && !data && (
            <MemoryErrorState
              error={state.memoryError}
              onRetry={() => {
                void actions.loadMemory(true);
              }}
            />
          )}
          {data && (
            <>
              {state.memoryError && (
                <InlineNotice
                  className='memory-stale-notice'
                  tone='warning'
                  role='status'
                  actions={
                    <Button tone='quiet' onClick={() => void actions.loadMemory(true)}>
                      重试
                    </Button>
                  }
                >
                  <span title={state.memoryError}>刷新失败，当前显示上次结果。</span>
                </InlineNotice>
              )}
              {data.stats.entries === 0 ? (
                <MemoryEmptyState />
              ) : (
                <>
                  <section className={`memory-workbench ${inspectorOpen ? 'with-inspector' : ''}`}>
                    <MemoryFiltersPanel data={data} />
                    <main className='memory-visualization'>
                      <header className='memory-visualization-toolbar'>
                        <Tabs
                          ariaLabel='记忆视图'
                          value={state.memoryView}
                          className='memory-view-switcher'
                          items={[
                            { id: 'graph', label: '关系图', icon: <Network size={14} /> },
                            { id: 'timeline', label: '按时间', icon: <ListTree size={14} /> },
                          ]}
                          onChange={(view) => {
                            appState.memoryView = view;
                          }}
                        />
                        <div className='memory-visualization-context'>
                          <span>
                            {entries.length === data.stats.entries
                              ? `${data.stats.entries} 条记忆`
                              : `${entries.length} / ${data.stats.entries} 条记忆`}
                          </span>
                          {state.memoryView === 'graph' && (
                            <fieldset className='memory-scope-switcher'>
                              <legend>显示范围</legend>
                              <button
                                type='button'
                                className={state.memoryGraphScope === 'balanced' ? 'active' : ''}
                                aria-pressed={state.memoryGraphScope === 'balanced'}
                                title='显示重要内容'
                                onClick={() => {
                                  appState.memoryGraphScope = 'balanced';
                                }}
                              >
                                <Focus size={14} /> 重点
                              </button>
                              <button
                                type='button'
                                className={state.memoryGraphScope === 'complete' ? 'active' : ''}
                                aria-pressed={state.memoryGraphScope === 'complete'}
                                title='显示全部内容'
                                onClick={() => {
                                  appState.memoryGraphScope = 'complete';
                                }}
                              >
                                <Database size={14} /> 全部
                              </button>
                            </fieldset>
                          )}
                        </div>
                      </header>
                      {entries.length === 0 ? (
                        <MemoryNoResults />
                      ) : state.memoryView === 'graph' && graph ? (
                        <MemoryGraph
                          graph={graph}
                          selectedMemoryId={selectedMemoryId}
                          selectedEntityId={selectedEntityId}
                          onSelectMemory={(id) => {
                            appState.memoryInspector = { kind: 'memory', id };
                          }}
                          onSelectEntity={(id) => {
                            appState.memoryInspector = { kind: 'entity', id };
                          }}
                          onClearSelection={() => {
                            appState.memoryInspector = null;
                          }}
                        />
                      ) : (
                        <MemoryTimeline
                          data={data}
                          entries={entries}
                          selectedMemoryId={selectedMemoryId}
                          onSelectMemory={(id) => {
                            appState.memoryInspector = { kind: 'memory', id };
                          }}
                        />
                      )}
                    </main>
                    {inspectorOpen && (
                      <>
                        <button
                          type='button'
                          className='memory-inspector-scrim'
                          aria-label='关闭详情面板'
                          onClick={() => {
                            appState.memoryInspector = null;
                          }}
                        />
                        <MemoryInspector
                          data={data}
                          selection={appState.memoryInspector}
                          visibleMemoryIds={visibleMemoryIds}
                          onClear={() => {
                            appState.memoryInspector = null;
                          }}
                          onFallbackFocus={() => {
                            document.getElementById('memory-graph-browser-toggle')?.focus();
                          }}
                          onSelectMemory={(id) => {
                            appState.memoryInspector = { kind: 'memory', id };
                          }}
                          onSelectEntity={(id) => {
                            appState.memoryInspector = { kind: 'entity', id };
                          }}
                        />
                      </>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function MemoryLoadingState() {
  return (
    <output className='memory-loading' aria-label='正在加载记忆'>
      <div className='memory-loading-summary'>
        {[0, 1, 2, 3].map((item) => (
          <i key={item} />
        ))}
      </div>
      <div className='memory-loading-workbench'>
        <i />
        <i />
        <i />
      </div>
      <span>正在加载记忆…</span>
    </output>
  );
}

function MemoryErrorState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <StateView
      className='memory-state-card'
      role='alert'
      tone='danger'
      icon={<BrainCircuit size={22} />}
      title='无法加载记忆'
      description='暂时无法读取，请稍后重试。'
      descriptionTitle={error || undefined}
      actions={
        <Button onClick={onRetry}>
          <RefreshCw size={14} />
          重新加载
        </Button>
      }
    />
  );
}

function MemoryEmptyState() {
  return (
    <StateView
      className='memory-state-card memory-empty'
      tone='info'
      icon={<BrainCircuit size={24} />}
      title='还没有记忆'
      description='完成任务后，A3S 会把值得保留的内容放在这里。'
      actions={
        <Button tone='secondary' onClick={() => navigateSettings('context')}>
          <Settings2 size={14} />
          查看记忆设置
        </Button>
      }
    />
  );
}

function MemoryNoResults() {
  return (
    <StateView
      className='memory-no-results'
      size='compact'
      icon={<BrainCircuit size={22} />}
      title='没有符合条件的记忆'
      description='调整搜索内容、时间或状态后再试。'
      actions={
        <Button tone='quiet' onClick={clearMemoryFilters}>
          清除全部筛选
        </Button>
      }
    />
  );
}
