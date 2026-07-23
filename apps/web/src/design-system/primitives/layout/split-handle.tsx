import { useEffect, useRef } from 'react';

type SplitOrientation = 'vertical' | 'horizontal';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.round(Math.min(maximum, Math.max(minimum, value)));
}

export function SplitHandle({
  label,
  value,
  min,
  max,
  onChange,
  onCommit,
  defaultValue,
  orientation = 'vertical',
  direction = 'normal',
  step = 20,
  disabled = false,
  valueText,
  className = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  defaultValue?: number;
  orientation?: SplitOrientation;
  direction?: 'normal' | 'reverse';
  step?: number;
  disabled?: boolean;
  valueText?: (value: number) => string;
  className?: string;
}) {
  const elementRef = useRef<HTMLHRElement>(null);
  const valueRef = useRef(value);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(
    () => () => {
      cleanupDragRef.current?.();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    []
  );

  const apply = (next: number) => {
    const normalized = clamp(next, min, max);
    valueRef.current = normalized;
    onChange(normalized);
    return normalized;
  };
  const schedule = (next: number) => {
    pendingRef.current = clamp(next, min, max);
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (pendingRef.current === null) return;
      const pending = pendingRef.current;
      pendingRef.current = null;
      apply(pending);
    });
  };
  const flush = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (pendingRef.current === null) return valueRef.current;
    const pending = pendingRef.current;
    pendingRef.current = null;
    return apply(pending);
  };
  const updateAndCommit = (next: number) => {
    const normalized = apply(next);
    onCommit?.(normalized);
  };

  return (
    <hr
      ref={elementRef}
      className={`ds-split-handle${className ? ` ${className}` : ''}`}
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText?.(value)}
      aria-disabled={disabled || undefined}
      onDoubleClick={() => {
        if (disabled || defaultValue === undefined) return;
        updateAndCommit(defaultValue);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        const multiplier = direction === 'reverse' ? -1 : 1;
        let next: number | null = null;
        if (orientation === 'vertical' && event.key === 'ArrowLeft') next = valueRef.current - step * multiplier;
        if (orientation === 'vertical' && event.key === 'ArrowRight') next = valueRef.current + step * multiplier;
        if (orientation === 'horizontal' && event.key === 'ArrowUp') next = valueRef.current - step * multiplier;
        if (orientation === 'horizontal' && event.key === 'ArrowDown') next = valueRef.current + step * multiplier;
        if (event.key === 'Home') next = min;
        if (event.key === 'End') next = max;
        if (next === null) return;
        event.preventDefault();
        updateAndCommit(next);
      }}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        event.preventDefault();
        cleanupDragRef.current?.();
        const element = event.currentTarget;
        const pointerId = event.pointerId;
        const startCoordinate = orientation === 'vertical' ? event.clientX : event.clientY;
        const startValue = valueRef.current;
        const multiplier = direction === 'reverse' ? -1 : 1;
        const resizeAttribute = orientation;

        element.setPointerCapture?.(pointerId);
        document.documentElement.dataset.dsResizing = resizeAttribute;

        const move = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== pointerId) return;
          const coordinate = orientation === 'vertical' ? moveEvent.clientX : moveEvent.clientY;
          schedule(startValue + (coordinate - startCoordinate) * multiplier);
        };
        const finish = (finishEvent: PointerEvent) => {
          if (finishEvent.pointerId !== pointerId) return;
          const coordinate = orientation === 'vertical' ? finishEvent.clientX : finishEvent.clientY;
          schedule(startValue + (coordinate - startCoordinate) * multiplier);
          const committed = flush();
          cleanup();
          onCommit?.(committed);
        };
        const cleanup = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', finish);
          window.removeEventListener('pointercancel', finish);
          if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture?.(pointerId);
          if (document.documentElement.dataset.dsResizing === resizeAttribute) {
            delete document.documentElement.dataset.dsResizing;
          }
          cleanupDragRef.current = null;
        };
        cleanupDragRef.current = cleanup;
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
      }}
    />
  );
}
