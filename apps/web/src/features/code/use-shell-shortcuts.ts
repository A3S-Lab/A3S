import { useEventListener } from 'ahooks';
import { useEffect } from 'react';
import { appState, closeSettings, navigateSettings, navigateTask } from '../../state/app-state';
import { settingsTabFromHash } from '../settings/settings-state';

export function useShellShortcuts(newTask: () => void) {
  const syncLocation = () => {
    const settingsTab = settingsTabFromHash(window.location.hash);
    if (settingsTab) {
      if (window.location.hash === '#help') {
        navigateSettings('help');
        return;
      }
      appState.settingsOpen = true;
      appState.settingsTab = settingsTab;
      return;
    }
    if (window.location.hash === '#settings') {
      appState.settingsOpen = true;
      return;
    }
    const view = window.location.hash.match(/^#code\/(conversation|review|activity)$/)?.[1];
    if (view === 'conversation' || view === 'review' || view === 'activity') {
      appState.settingsOpen = false;
      appState.taskView = view;
    }
  };
  useEffect(syncLocation, []);
  useEventListener('hashchange', syncLocation);
  useEventListener('keydown', (event) => {
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const target = event.target;
    const isEditing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.contentEditable === 'true' ||
          target.closest('[contenteditable="true"]') !== null));
    if (appState.settingsOpen) {
      const shellShortcut = modifier && ['n', 'b', 'k', ','].includes(key);
      if (shellShortcut || (event.key === '?' && !modifier && !isEditing)) event.preventDefault();
      if (modifier && event.key === ',') navigateSettings('general');
      else if (event.key === '?' && !modifier && !isEditing) navigateSettings('help');
      else if (event.key === 'Escape' && !appState.updateInstalling) closeSettings();
      return;
    }
    if (modifier && key === 'n') {
      event.preventDefault();
      newTask();
      navigateTask('conversation');
      return;
    }
    if (modifier && key === 'b' && !isEditing) {
      event.preventDefault();
      appState.sidebarOpen = !appState.sidebarOpen;
      return;
    }
    if (modifier && event.key === ',') {
      event.preventDefault();
      navigateSettings('general');
      return;
    }
    if (modifier && key === 'k') {
      event.preventDefault();
      appState.commandPaletteOpen = !appState.commandPaletteOpen;
      return;
    }
    if (event.key === 'Escape') {
      if (appState.commandPaletteOpen) {
        appState.commandPaletteOpen = false;
      }
      return;
    }
    if (event.key === '?' && !event.metaKey && !event.ctrlKey && !isEditing) {
      event.preventDefault();
      navigateSettings('help');
    }
  });
}
