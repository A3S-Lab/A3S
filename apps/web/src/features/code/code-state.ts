import type { HealthResponse } from '../../types/api';

export type ThemePreference = 'system' | 'light' | 'dark';
export type BootPhase = 'loading' | 'ready' | 'error';
export type ServiceStatus = 'connected' | 'checking' | 'disconnected';
export type TaskView = 'conversation' | 'review' | 'activity';
export interface ToastState {
  id: number;
  tone: 'info' | 'success' | 'error';
  message: string;
}
export interface CodeShellState {
  bootPhase: BootPhase;
  bootError: string | null;
  serviceStatus: ServiceStatus;
  serviceError: string | null;
  health: HealthResponse | null;
  theme: ThemePreference;
  sidebarOpen: boolean;
  taskView: TaskView;
  settingsOpen: boolean;
  commandPaletteOpen: boolean;
  toast: ToastState | null;
}

function readTaskView(): TaskView {
  const view = window.location.hash.match(/^#code\/(conversation|review|activity)$/)?.[1];
  return view === 'review' || view === 'activity' ? view : 'conversation';
}
function readTheme(): ThemePreference {
  try {
    const value = localStorage.getItem('a3s-code-web.theme');
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
}
function readSettingsOpen() {
  return (
    window.location.hash === '#help' ||
    window.location.hash === '#settings' ||
    window.location.hash.startsWith('#settings/')
  );
}
export function createCodeShellState(): CodeShellState {
  return {
    bootPhase: 'loading',
    bootError: null,
    serviceStatus: 'checking',
    serviceError: null,
    health: null,
    theme: readTheme(),
    sidebarOpen: true,
    taskView: readTaskView(),
    settingsOpen: readSettingsOpen(),
    commandPaletteOpen: false,
    toast: null,
  };
}
