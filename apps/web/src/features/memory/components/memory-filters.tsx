import { ChevronDown, FilterX, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, SearchField } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { MemoryForgetSignal, MemoryOverview, MemoryTier } from '../../../types/api';
import { forgetSignalLabel, memorySourceLabel, memoryTypeLabel, tierLabel } from '../memory-format';
import { countActiveMemoryFilters, memoryTypeCounts } from '../memory-projection';
import type { MemoryLifecycleFilter, MemoryTimeRange } from '../memory-state';

export function MemoryFiltersPanel({ data }: { data: MemoryOverview }) {
  const state = useSnapshot(appState);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const types = useMemo(() => memoryTypeCounts(data.entries), [data]);
  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of data.graph.events) counts.set(event.source, (counts.get(event.source) ?? 0) + 1);
    return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }, [data]);
  const filters = {
    query: state.memoryQuery,
    types: [...state.memoryTypeFilters],
    sources: [...state.memorySourceFilters],
    tiers: [...state.memoryTierFilters],
    signals: [...state.memorySignalFilters],
    lifecycle: [...state.memoryLifecycleFilters],
    timeRange: state.memoryTimeRange,
  };
  const activeCount = countActiveMemoryFilters(filters);
  const advancedCount =
    state.memorySourceFilters.length +
    state.memoryTierFilters.length +
    state.memorySignalFilters.length +
    state.memoryLifecycleFilters.length;

  const clearAll = () => {
    clearMemoryFilters();
    setMoreFiltersOpen(false);
  };

  return (
    <aside className='memory-filters' aria-label='记忆筛选'>
      <div className='memory-filter-heading'>
        <strong>筛选</strong>
        {activeCount > 0 && (
          <Button tone='quiet' className='memory-filter-clear' onClick={clearAll}>
            <FilterX size={13} /> 清除
          </Button>
        )}
      </div>
      <SearchField
        className='memory-search'
        size='compact'
        label='搜索记忆'
        clearLabel='清除搜索'
        value={state.memoryQuery}
        placeholder='搜索记忆'
        onValueChange={(value) => {
          appState.memoryQuery = value;
        }}
      />
      <FilterGroup title='时间'>
        <div className='memory-filter-segments'>
          {(
            [
              ['all', '全部'],
              ['7d', '7 天'],
              ['30d', '30 天'],
              ['90d', '90 天'],
            ] as Array<[MemoryTimeRange, string]>
          ).map(([value, label]) => (
            <button
              type='button'
              className={state.memoryTimeRange === value ? 'active' : ''}
              aria-pressed={state.memoryTimeRange === value}
              key={value}
              onClick={() => {
                appState.memoryTimeRange = value;
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title='类型'>
        <div className='memory-filter-options'>
          {types.map(([type, count]) => (
            <FilterOption
              key={type}
              label={memoryTypeLabel(type)}
              count={count}
              pressed={state.memoryTypeFilters.includes(type)}
              tone={type}
              onClick={() => {
                appState.memoryTypeFilters = toggleValue(appState.memoryTypeFilters, type);
              }}
            />
          ))}
        </div>
      </FilterGroup>
      <button
        type='button'
        className='memory-more-filters-toggle'
        aria-expanded={moreFiltersOpen}
        aria-controls='memory-more-filters'
        onClick={() => setMoreFiltersOpen((open) => !open)}
      >
        <span>
          <SlidersHorizontal size={13} />
          更多筛选
        </span>
        {advancedCount > 0 && <small>已选 {advancedCount} 项</small>}
        <ChevronDown size={14} aria-hidden='true' />
      </button>
      {moreFiltersOpen && (
        <div className='memory-more-filters' id='memory-more-filters'>
          <FilterGroup title='保存期限'>
            <div className='memory-filter-options'>
              {(['short', 'mid', 'long'] as MemoryTier[]).map((tier) => (
                <FilterOption
                  key={tier}
                  label={tierLabel(tier)}
                  count={data.graph.stats[tier]}
                  pressed={state.memoryTierFilters.includes(tier)}
                  tone={tier}
                  onClick={() => {
                    appState.memoryTierFilters = toggleValue(appState.memoryTierFilters, tier);
                  }}
                />
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title='状态'>
            <div className='memory-filter-options'>
              {(['protected', 'candidate', 'cooling', 'keep'] as MemoryForgetSignal[]).map((signal) => {
                const count = data.graph.events.filter((event) => event.forget === signal).length;
                return (
                  <FilterOption
                    key={signal}
                    label={forgetSignalLabel(signal)}
                    count={count}
                    pressed={state.memorySignalFilters.includes(signal)}
                    tone={signal}
                    onClick={() => {
                      appState.memorySignalFilters = toggleValue(appState.memorySignalFilters, signal);
                    }}
                  />
                );
              })}
              <FilterOption
                label='有冲突'
                count={data.graph.stats.conflicts}
                pressed={state.memoryLifecycleFilters.includes('conflicts')}
                tone='conflicts'
                onClick={() => {
                  appState.memoryLifecycleFilters = toggleValue<MemoryLifecycleFilter>(
                    appState.memoryLifecycleFilters,
                    'conflicts'
                  );
                }}
              />
            </div>
          </FilterGroup>
          {sources.length > 0 && (
            <FilterGroup title='来源'>
              <div className='memory-filter-options source-options'>
                {sources.map(([source, count]) => (
                  <FilterOption
                    key={source}
                    label={memorySourceLabel(source)}
                    count={count}
                    pressed={state.memorySourceFilters.includes(source)}
                    tone='source'
                    onClick={() => {
                      appState.memorySourceFilters = toggleValue(appState.memorySourceFilters, source);
                    }}
                  />
                ))}
              </div>
            </FilterGroup>
          )}
        </div>
      )}
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='memory-filter-group'>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function FilterOption({
  label,
  count,
  pressed,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  pressed: boolean;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button type='button' className={pressed ? 'active' : ''} aria-pressed={pressed} data-tone={tone} onClick={onClick}>
      <i aria-hidden='true' />
      <span>{label}</span>
      <small>{count}</small>
    </button>
  );
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function clearMemoryFilters(): void {
  appState.memoryQuery = '';
  appState.memoryTypeFilters = [];
  appState.memorySourceFilters = [];
  appState.memoryTierFilters = [];
  appState.memorySignalFilters = [];
  appState.memoryLifecycleFilters = [];
  appState.memoryTimeRange = 'all';
}
