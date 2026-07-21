import { Minus, Plus } from 'lucide-react';
import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface WorkOfficeRibbonTab<T extends string> {
  id: T;
  label: string;
}

export function WorkOfficeRibbon<T extends string>({
  ariaLabel,
  tabs,
  defaultTab,
  activeTab,
  onTabChange,
  panels,
  className = '',
  toolbarClassName = '',
}: {
  ariaLabel: string;
  tabs: readonly WorkOfficeRibbonTab<T>[];
  defaultTab: T;
  activeTab?: T;
  onTabChange?: (tab: T) => void;
  panels: Record<T, ReactNode>;
  className?: string;
  toolbarClassName?: string;
}) {
  const reactId = useId().replaceAll(':', '');
  const [internalTab, setInternalTab] = useState(defaultTab);
  const selectedTab = activeTab ?? internalTab;
  const selectedLabel = tabs.find((tab) => tab.id === selectedTab)?.label ?? tabs[0]?.label ?? '';
  const selectTab = (tab: T) => {
    if (activeTab === undefined) setInternalTab(tab);
    onTabChange?.(tab);
  };

  return (
    <section className={`work-office-ribbon ${className}`.trim()} aria-label={ariaLabel}>
      <div className='work-office-ribbon-tabs' role='tablist' aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <button
            type='button'
            id={`${reactId}-tab-${tab.id}`}
            key={tab.id}
            role='tab'
            aria-controls={`${reactId}-panel`}
            aria-selected={selectedTab === tab.id}
            tabIndex={selectedTab === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => {
              const next = nextRibbonTab(tabs, selectedTab, event.key);
              if (!next) return;
              event.preventDefault();
              selectTab(next);
              requestAnimationFrame(() => document.getElementById(`${reactId}-tab-${next}`)?.focus());
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`${reactId}-panel`}
        className='work-office-ribbon-panel'
        role='tabpanel'
        aria-labelledby={`${reactId}-tab-${selectedTab}`}
      >
        <div
          className={`work-office-toolbar ${toolbarClassName}`.trim()}
          role='toolbar'
          aria-label={`${selectedLabel}工具栏`}
        >
          {panels[selectedTab]}
        </div>
      </div>
    </section>
  );
}

export function WorkOfficeRibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className='work-office-ribbon-group' aria-label={label}>
      <div>{children}</div>
      <span aria-hidden='true'>{label}</span>
    </section>
  );
}

export function WorkOfficeRibbonButton({
  label,
  visibleLabel = label,
  badge,
  active = false,
  displayLabel = true,
  className = '',
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & {
  label: string;
  visibleLabel?: string;
  badge?: ReactNode;
  active?: boolean;
  displayLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      aria-label={label}
      aria-pressed={active || undefined}
      className={`${displayLabel ? 'with-label' : ''} ${active ? 'active' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
      {displayLabel && <span>{visibleLabel}</span>}
      {badge !== undefined && <small className='work-office-ribbon-badge'>{badge}</small>}
    </button>
  );
}

export function WorkOfficeStatusBar({
  children,
  controls,
  className = '',
}: {
  children: ReactNode;
  controls?: ReactNode;
  className?: string;
}) {
  return (
    <footer className={`work-office-status ${className}`.trim()}>
      <div className='work-office-status-info'>{children}</div>
      {controls && <div className='work-office-status-view'>{controls}</div>}
    </footer>
  );
}

export function WorkOfficeZoomControls({
  zoom,
  minimum = 50,
  maximum = 200,
  step = 10,
  decreaseLabel,
  increaseLabel,
  outputLabel,
  sliderLabel,
  onChange,
}: {
  zoom: number;
  minimum?: number;
  maximum?: number;
  step?: number;
  decreaseLabel: string;
  increaseLabel: string;
  outputLabel: string;
  sliderLabel: string;
  onChange: (zoom: number) => void;
}) {
  const clamp = (value: number) => Math.min(maximum, Math.max(minimum, Math.round(value)));
  return (
    <>
      <button
        type='button'
        aria-label={decreaseLabel}
        title={decreaseLabel}
        disabled={zoom <= minimum}
        onClick={() => onChange(clamp(zoom - step))}
      >
        <Minus size={13} />
      </button>
      <output aria-label={outputLabel}>{zoom}%</output>
      <input
        type='range'
        min={minimum}
        max={maximum}
        step={step}
        value={zoom}
        aria-label={sliderLabel}
        onChange={(event) => onChange(clamp(Number(event.target.value)))}
      />
      <button
        type='button'
        aria-label={increaseLabel}
        title={increaseLabel}
        disabled={zoom >= maximum}
        onClick={() => onChange(clamp(zoom + step))}
      >
        <Plus size={13} />
      </button>
    </>
  );
}

function nextRibbonTab<T extends string>(tabs: readonly WorkOfficeRibbonTab<T>[], current: T, key: string): T | null {
  const currentIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === current)
  );
  if (key === 'Home') return tabs[0]?.id ?? null;
  if (key === 'End') return tabs.at(-1)?.id ?? null;
  if (key === 'ArrowRight') return tabs[(currentIndex + 1) % tabs.length]?.id ?? null;
  if (key === 'ArrowLeft') return tabs[(currentIndex - 1 + tabs.length) % tabs.length]?.id ?? null;
  return null;
}
