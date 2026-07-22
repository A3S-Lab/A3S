import type { TaskView } from '../code/code-state';

type TaskContextView = Exclude<TaskView, 'conversation'>;

export const taskContextLauncherIds: Record<TaskContextView, string> = {
  review: 'task-context-workspace-launcher',
  activity: 'task-context-activity-launcher',
};

interface TaskContextFocusTarget {
  element: HTMLElement | null;
  elementId: string;
  fallbackId: string;
}

let focusTarget: TaskContextFocusTarget | null = null;

export function rememberTaskContextFocus(view: TaskContextView): void {
  const element = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  focusTarget = {
    element: element === document.body ? null : element,
    elementId: element?.id ?? '',
    fallbackId: taskContextLauncherIds[view],
  };
}

export function restoreTaskContextFocus(fallbackView: TaskContextView): void {
  const target = focusTarget;
  focusTarget = null;
  window.requestAnimationFrame(() => {
    const connectedTarget = target?.element?.isConnected ? target.element : null;
    const replacementTarget = target?.elementId ? document.getElementById(target.elementId) : null;
    const fallbackTarget = document.getElementById(target?.fallbackId ?? taskContextLauncherIds[fallbackView]);
    (connectedTarget ?? replacementTarget ?? fallbackTarget)?.focus({ preventScroll: true });
  });
}
