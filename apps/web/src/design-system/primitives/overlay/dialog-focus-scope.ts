import { type KeyboardEvent, useCallback, useEffect, useRef } from 'react';

const focusableSelector = [
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'textarea:not(:disabled)',
  'select:not(:disabled)',
  'a[href]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface DialogFocusScopeOptions {
  onEscape?: () => void;
  escapeDisabled?: boolean;
  initialFocus?: () => HTMLElement | null;
  getActiveScope?: () => HTMLElement | null;
  restoreFocus?: boolean;
  restoreFocusTarget?: () => HTMLElement | null;
}

export function useDialogFocusScope<T extends HTMLElement>({
  onEscape,
  escapeDisabled = false,
  initialFocus,
  getActiveScope,
  restoreFocus = true,
  restoreFocusTarget,
}: DialogFocusScopeOptions = {}) {
  const scopeRef = useRef<T>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(
    restoreFocusTarget?.() ??
      (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  );
  const optionsRef = useRef<DialogFocusScopeOptions>({});
  optionsRef.current = { onEscape, escapeDisabled, initialFocus, getActiveScope, restoreFocus, restoreFocusTarget };

  const focusInitial = useCallback((scope = scopeRef.current as HTMLElement | null) => {
    if (!scope) return;
    const configured = optionsRef.current.initialFocus?.();
    const target = configured && isAvailable(configured) ? configured : defaultInitialFocus(scope);
    target?.focus();
  }, []);

  useEffect(() => {
    focusInitial();
    return () => {
      const restoreTarget = restoreFocusRef.current;
      if (optionsRef.current.restoreFocus === false || !restoreTarget?.isConnected) return;
      restoreTarget.focus();
      window.setTimeout(() => {
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
        const active = document.activeElement;
        if (
          restoreTarget.isConnected &&
          (active === document.body || !(active instanceof HTMLElement) || !active.isConnected)
        ) {
          restoreTarget.focus();
        }
      }, 0);
    };
  }, [focusInitial]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const options = optionsRef.current;
    if (event.key === 'Escape' && options.onEscape && !options.escapeDisabled) {
      event.preventDefault();
      event.stopPropagation();
      options.onEscape();
      return;
    }
    if (event.key !== 'Tab') {
      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && ['f', 'h', 'k', 'n', 'p', 's'].includes(event.key.toLocaleLowerCase())) event.preventDefault();
      if (commandKey || event.altKey) event.stopPropagation();
      return;
    }

    const scope = options.getActiveScope?.() ?? scopeRef.current;
    if (!scope) return;
    const focusable = focusableElements(scope);
    if (!focusable.length) {
      event.preventDefault();
      event.stopPropagation();
      scope.focus();
      return;
    }

    const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? activeIndex <= 0
        ? focusable.length - 1
        : activeIndex - 1
      : activeIndex < 0 || activeIndex >= focusable.length - 1
        ? 0
        : activeIndex + 1;
    event.preventDefault();
    event.stopPropagation();
    focusable[nextIndex]?.focus();
  }, []);

  return { scopeRef, handleKeyDown, focusInitial };
}

function defaultInitialFocus(scope: HTMLElement): HTMLElement | null {
  const configured = scope.querySelector<HTMLElement>('[data-autofocus]');
  if (configured && isAvailable(configured)) return configured;

  const field = scope.querySelector<HTMLElement>(
    'input:not(:disabled):not([type="hidden"]), textarea:not(:disabled), select:not(:disabled)'
  );
  if (field && isAvailable(field)) return field;

  const safeFooterAction = scope.querySelector<HTMLElement>(':scope > footer button:not(:disabled)');
  if (safeFooterAction && isAvailable(safeFooterAction)) return safeFooterAction;
  return focusableElements(scope)[0] ?? null;
}

function focusableElements(scope: HTMLElement): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(focusableSelector)].filter(isAvailable);
}

function isAvailable(element: HTMLElement): boolean {
  return !element.closest('[hidden], [inert], [aria-hidden="true"]');
}
