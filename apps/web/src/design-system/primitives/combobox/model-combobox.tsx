import { BrainCircuit, Check, ChevronDown, Cpu, LoaderCircle, Search, Settings2, Wrench } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CatalogModel } from '../../../types/api';

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
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const selectModel = (model: CatalogModel) => {
    if (model.id !== value) onChange(model.id);
    close(true);
  };
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);
  useEffect(() => {
    if (activeSource !== 'all' && !sources.includes(activeSource)) setActiveSource('all');
  }, [activeSource, sources]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close(true);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
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
      if (!bounds || !root.current) return;
      const gap = 8;
      const viewportPadding = 16;
      const availableHeight =
        placement === 'top'
          ? bounds.top - gap - viewportPadding
          : window.innerHeight - bounds.bottom - gap - viewportPadding;
      root.current.style.setProperty('--ds-combobox-available-height', `${Math.max(0, availableHeight)}px`);
    };
    updateAvailableHeight();
    window.addEventListener('resize', updateAvailableHeight);
    window.addEventListener('scroll', updateAvailableHeight, true);
    return () => {
      window.removeEventListener('resize', updateAvailableHeight);
      window.removeEventListener('scroll', updateAvailableHeight, true);
    };
  }, [open, placement]);
  return (
    <div className={`ds-combobox ${compact ? 'compact' : ''} ${placement === 'top' ? 'open-up' : ''}`} ref={root}>
      <button
        ref={triggerRef}
        type='button'
        className='ds-combobox-trigger'
        aria-label={label}
        title={label}
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-busy={loading || undefined}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled || loading || !models.length}
        onClick={() => {
          setOpen(!open);
          setQuery('');
        }}
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
      {open && (
        <section className={`ds-combobox-popover${sourceTabs ? ' has-source-tabs' : ''}`}>
          {sourceTabs && sources.length > 0 && (
            <div className='ds-combobox-source-tabs' role='tablist' aria-label='模型 Provider'>
              <button
                type='button'
                role='tab'
                aria-selected={activeSource === 'all'}
                onClick={() => {
                  setActiveSource('all');
                  setActiveIndex(0);
                }}
              >
                全部
              </button>
              {sources.map((source) => (
                <button
                  type='button'
                  role='tab'
                  aria-selected={activeSource === source}
                  key={source}
                  onClick={() => {
                    setActiveSource(source);
                    setActiveIndex(0);
                  }}
                >
                  {source}
                </button>
              ))}
            </div>
          )}
          <label className='ds-combobox-search'>
            <Search size={14} />
            <input
              ref={inputRef}
              aria-label='搜索模型'
              role='combobox'
              aria-controls={listboxId}
              aria-expanded='true'
              aria-activedescendant={filtered[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
              placeholder='搜索名称或来源'
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
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
                  selectModel(filtered[activeIndex]);
                }
              }}
            />
          </label>
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
                onClick={() => selectModel(model)}
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
            {!filtered.length && <p>没有匹配的模型</p>}
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
        </section>
      )}
    </div>
  );
}
