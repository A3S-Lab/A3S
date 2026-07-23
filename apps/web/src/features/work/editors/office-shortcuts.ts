const MODAL_DIALOG_SELECTOR = '[role="dialog"][aria-modal="true"]';
const OFFICE_SHORTCUT_IGNORE_SELECTOR = '[data-office-shortcuts="ignore"]';

export function isOfficeShortcutBlocked(target: EventTarget | null): boolean {
  if (typeof document === 'undefined') return false;
  if (
    target instanceof Element &&
    (target.closest(MODAL_DIALOG_SELECTOR) || target.closest(OFFICE_SHORTCUT_IGNORE_SELECTOR))
  ) {
    return true;
  }
  if (
    document.activeElement instanceof Element &&
    (document.activeElement.closest(MODAL_DIALOG_SELECTOR) ||
      document.activeElement.closest(OFFICE_SHORTCUT_IGNORE_SELECTOR))
  ) {
    return true;
  }
  return document.querySelector(MODAL_DIALOG_SELECTOR) !== null;
}
