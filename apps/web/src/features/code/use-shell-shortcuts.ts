import { useEventListener } from 'ahooks';
import { useEffect } from 'react';
import { appState, closeSettings, navigateSettings, navigateTask } from '../../state/app-state';
import { settingsChannelFromHash, settingsTabFromHash } from '../settings/settings-state';

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
      const settingsChannel = settingsChannelFromHash(window.location.hash);
      if (settingsChannel) appState.settingsChannel = settingsChannel;
      return;
    }
    if (window.location.hash === '#settings') {
      appState.settingsOpen = true;
      return;
    }
    if (window.location.hash === '#plugins') {
      appState.settingsOpen = false;
      appState.activeProduct = 'plugins';
      return;
    }
    if (window.location.hash === '#knowledge') {
      appState.settingsOpen = false;
      appState.activeProduct = 'knowledge';
      appState.commandPaletteOpen = false;
      return;
    }
    const pluginKey = pluginKeyFromHash(window.location.hash);
    if (pluginKey) {
      appState.settingsOpen = false;
      appState.activeProduct = 'plugin';
      appState.activePluginKey = pluginKey;
      return;
    }
    if (window.location.hash === '#code/memory') {
      appState.settingsOpen = false;
      appState.activeProduct = 'code';
      appState.codeSurface = 'memory';
      return;
    }
    const view = window.location.hash.match(/^#code\/(conversation|review|activity)$/)?.[1];
    if (view === 'conversation' || view === 'review' || view === 'activity') {
      appState.settingsOpen = false;
      appState.activeProduct = 'code';
      appState.codeSurface = 'tasks';
      if (view === 'conversation') appState.workspacePresentation = 'docked';
      appState.taskView = view;
      return;
    }
    if (window.location.hash.startsWith('#work')) {
      appState.settingsOpen = false;
      appState.activeProduct = 'work';
      appState.commandPaletteOpen = false;
      appState.fileQuickOpenOpen = false;
    }
  };
  useEffect(syncLocation, []);
  useEventListener('hashchange', syncLocation);
  useEventListener(
    'keydown',
    (event) => {
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
      const isMonacoEditor = target instanceof HTMLElement && target.closest('.monaco-editor') !== null;
      if (appState.settingsOpen) {
        const shellShortcut = modifier && ['n', 'b', 'k', ','].includes(key);
        if (shellShortcut || (event.key === '?' && !modifier && !isEditing)) event.preventDefault();
        if (modifier && event.key === ',') navigateSettings('general');
        else if (event.key === '?' && !modifier && !isEditing) navigateSettings('help');
        else if (event.key === 'Escape' && !appState.updateInstalling) closeSettings();
        return;
      }
      if (appState.activeProduct !== 'code') {
        if (modifier && event.key === ',') {
          event.preventDefault();
          navigateSettings('general');
        } else if (event.key === '?' && !modifier && !isEditing) {
          event.preventDefault();
          navigateSettings('help');
        }
        return;
      }
      if (modifier && key === 'p' && appState.activeSessionId && appState.workspaceRoot) {
        event.preventDefault();
        appState.commandPaletteOpen = false;
        appState.fileQuickOpenOpen = true;
        return;
      }
      if (event.key === 'Escape' && appState.fileQuickOpenOpen) {
        event.preventDefault();
        appState.fileQuickOpenOpen = false;
        return;
      }
      if (modifier && key === 'n') {
        event.preventDefault();
        appState.fileQuickOpenOpen = false;
        newTask();
        navigateTask('conversation');
        return;
      }
      if (modifier && key === 'b' && (!isEditing || isMonacoEditor)) {
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
        appState.fileQuickOpenOpen = false;
        appState.commandPaletteOpen = !appState.commandPaletteOpen;
        return;
      }
      if (event.key === 'Escape') {
        if (appState.commandPaletteOpen) appState.commandPaletteOpen = false;
        return;
      }
      if (event.key === '?' && !modifier && !isEditing) {
        event.preventDefault();
        navigateSettings('help');
      }
    },
    { capture: true }
  );
}

function pluginKeyFromHash(hash: string): string | null {
  const encoded = hash.match(/^#plugin\/([^/]+)$/)?.[1];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}
