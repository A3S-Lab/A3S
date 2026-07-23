import { type KeyboardEvent, type PointerEvent, useRef } from 'react';

export function OfficeSlider({
  ariaLabel,
  value,
  min,
  max,
  step = 1,
  onValueChange,
  disabled = false,
  className = '',
}: {
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const percentage = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const commit = (next: number) => onValueChange(roundSliderValue(Math.min(max, Math.max(min, next)), step));
  const commitPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return;
    commit(min + ((event.clientX - bounds.left) / bounds.width) * (max - min));
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      commit(value + step);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      commit(value - step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      commit(min);
    } else if (event.key === 'End') {
      event.preventDefault();
      commit(max);
    }
  };

  return (
    <div
      ref={trackRef}
      className={`work-office-slider ${disabled ? 'disabled' : ''} ${className}`.trim()}
      role='slider'
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKey}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        commitPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) commitPointer(event);
      }}
    >
      <span className='work-office-slider-fill' style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
      <span className='work-office-slider-thumb' style={{ left: `${Math.min(100, Math.max(0, percentage))}%` }} />
    </div>
  );
}

function roundSliderValue(value: number, step: number): number {
  const decimalPlaces = Math.max(0, (String(step).split('.')[1] ?? '').length);
  return Number((Math.round(value / step) * step).toFixed(decimalPlaces));
}
