import { BrainCircuit, Check, ChevronDown, Cpu, LoaderCircle, Settings2, Wrench } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CatalogModel } from '../../../types/api';
import { CollectionState } from '../feedback/collection-state';
import { SearchField } from '../form/search-field';
import { Tabs } from '../navigation/tabs';
import { Popover } from '../overlay/popover';

export function ModelCombobox({
  models,
  value,
  defaultModel,
  disabled,
  loading = false,
  compact = false,
  placement = 'bottom',
  label = '选择模型',
  sourceTabs = false,
  configureLabel = '配置模型',
  onConfigure,
  onChange,
}: {
  models: readonly CatalogModel[];
  value: string;
  defaultModel?: string | null;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  placement?: 'top' | 'bottom';
  label?: string;
  sourceTabs?: boolean;
  configureLabel?: string;
  onConfigure?: () => void;
  onChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeSource, setActiveSource] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const listboxId = useId();
  const current = models.find((model) => model.id === value);
  const sources = useMemo(() => Array.from(new Set(models.map((model) => model.source))), [models]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return models.filter(
      (model) =>
        (activeSource === 'all' || model.source === activeSource) &&
        `${model.source} ${model.name} ${model.id}`.toLowerCase().includes(normalizedQuery)
    );
  }, [activeSource, models, query]);
  const selectModel = (model: CatalogModel, close: () => void) => {
    if (model.id !== value) onChange(model.id);
    close();
  };
  useEffect(() => {
    if (activeSource !== 'all' && !sources.includes(activeSource)) setActiveSource('all');
  }, [activeSource, sources]);
  useEffect(() => {
    if (!open) return;
    setActiveIndex(
      Math.max(
        0,
        filtered.findIndex((model) => model.id === value)
      )
    );
    inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(Math.max(0, filtered.length - 1));
  }, [activeIndex, filtered.length]);
  useLayoutEffect(() => {
    if (!open) return;
    const updateAvailableHeight = () => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds || !panelRef.current) return;
      const gap = 8;
      const viewportPadding = 16;
      const availableHeight =
        placement === 'top'
          ? bounds.top - gap - viewportPadding
          : window.innerHeight - bounds.bottom - gap - viewportPadding;
      panelRef.current.style.setProperty('--ds-combobox-available-height', `${Math.max(0, availableHeight)}px`);
    };
    updateAvailableHeight();
    window.addEventListener('resize', updateAvailableHeight);
    window.addEventListener('scroll', updateAvailableHeight, true);
    return () => {
      window.removeEventListener('resize', updateAvailableHeight);
      window.removeEventListener('scroll', updateAvailableHeight, true);
    };
  }, [open, placement]);

  const sourceItems = [{ id: 'all', label: '全部' }, ...sources.map((source) => ({ id: source, label: source }))];

  return (
    <Popover
      label={label}
      panelLabel={`选择${label}`}
      panelRole='dialog'
      placement={placement === 'top' ? 'top-end' : 'bottom-end'}
      className={`ds-combobox${compact ? ' compact' : ''}`}
      panelClassName={`ds-combobox-popover${sourceTabs ? ' has-source-tabs' : ''}`}
      panelRef={panelRef}
      disabled={disabled || loading || !models.length}
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setQuery('');
        setOpen(nextOpen);
      }}
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          ref={(element) => {
            triggerProps.ref(element);
            triggerRef.current = element;
          }}
          className='ds-combobox-trigger'
          title={label}
          aria-busy={loading || undefined}
        >
          <span className='ds-combobox-model-mark' aria-hidden='true'>
            {loading ? <LoaderCircle className='spin' size={13} /> : <Cpu size={13} />}
          </span>
          <span className='ds-combobox-trigger-copy'>
            <strong>{current?.name || value || '未配置模型'}</strong>
            {current && <small>{current.source}</small>}
          </span>
          <ChevronDown size={14} />
        </button>
      )}
    >
      {(close) => (
        <>
          {sourceTabs && sources.length > 0 && (
            <Tabs
              ariaLabel='模型 Provider'
              value={activeSource}
              items={sourceItems}
              size='compact'
              className='ds-combobox-source-tabs'
              onChange={(source) => {
                setActiveSource(source);
                setActiveIndex(0);
              }}
            />
          )}
          <SearchField
            ref={inputRef}
            className='ds-combobox-search'
            label='搜索模型'
            role='combobox'
            aria-controls={listboxId}
            aria-expanded='true'
            aria-activedescendant={filtered[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
            placeholder='搜索名称或来源'
            value={query}
            onValueChange={(nextQuery) => {
              setQuery(nextQuery);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(0, Math.min(index + 1, filtered.length - 1)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter' && filtered[activeIndex]) {
                event.preventDefault();
                selectModel(filtered[activeIndex], close);
              }
            }}
          />
          <div id={listboxId} role='listbox' aria-label='可用模型'>
            {filtered.map((model, index) => (
              <button
                type='button'
                role='option'
                aria-selected={model.id === value}
                className={index === activeIndex ? 'active' : ''}
                id={`${listboxId}-${index}`}
                key={model.id}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectModel(model, close)}
              >
                <span className='ds-combobox-model-mark' aria-hidden='true'>
                  <Cpu size={13} />
                </span>
                <span className='ds-combobox-option-copy'>
                  <strong>{model.name}</strong>
                  <small>{model.source}</small>
                </span>
                <i>
                  {model.reasoning && <BrainCircuit size={12} />}
                  {model.toolCall && <Wrench size={12} />}
                </i>
                <em>
                  {model.id === defaultModel && '默认'}
                  {model.id === value && <Check size={15} />}
                </em>
              </button>
            ))}
            {!filtered.length && <CollectionState role='status'>没有匹配的模型</CollectionState>}
          </div>
          {onConfigure && (
            <footer className='ds-combobox-footer'>
              <button
                type='button'
                onClick={() => {
                  close();
                  onConfigure();
                }}
              >
                <Settings2 size={14} />
                {configureLabel}
              </button>
            </footer>
          )}
        </>
      )}
    </Popover>
  );
}
