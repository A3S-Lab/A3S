import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../state/app-state';
import { useShellShortcuts } from './use-shell-shortcuts';

describe('shell location synchronization', () => {
  afterEach(() => {
    cleanup();
    appState.settingsOpen = false;
    appState.updateInstalling = false;
    appState.commandPaletteOpen = false;
    appState.sidebarOpen = true;
    window.history.replaceState(null, '', '#code/conversation');
  });

  it('updates the active Code route on browser hash navigation', () => {
    renderHook(() => useShellShortcuts(() => undefined));
    window.location.hash = '#code/activity';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(appState.taskView).toBe('activity');
    window.location.hash = '#code/review';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(appState.taskView).toBe('review');
  });

  it('updates system pages and returns to Code routes', () => {
    renderHook(() => useShellShortcuts(() => undefined));
    window.location.hash = '#settings';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(appState.settingsOpen).toBe(true);
    window.location.hash = '#code/conversation';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(appState.taskView).toBe('conversation');
  });

  it('opens Help inside Settings from the question-mark shortcut', () => {
    renderHook(() => useShellShortcuts(() => undefined));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', cancelable: true }));

    expect(appState.settingsOpen).toBe(true);
    expect(appState.settingsTab).toBe('help');
    expect(window.location.hash).toBe('#settings/help');
  });

  it('maps the legacy Help hash to the Settings Help tab', () => {
    renderHook(() => useShellShortcuts(() => undefined));
    window.location.hash = '#help';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(appState.settingsOpen).toBe(true);
    expect(appState.settingsTab).toBe('help');
    expect(window.location.hash).toBe('#settings/help');
  });

  it('normalizes a directly opened legacy Help URL on mount', () => {
    window.history.replaceState(null, '', '#help');

    renderHook(() => useShellShortcuts(() => undefined));

    expect(appState.settingsOpen).toBe(true);
    expect(appState.settingsTab).toBe('help');
    expect(window.location.hash).toBe('#settings/help');
  });

  it('does not let global shortcuts dismiss settings while an update is installing', () => {
    const newTask = vi.fn();
    appState.settingsOpen = true;
    window.history.replaceState(null, '', '#settings/general');
    appState.updateInstalling = true;
    renderHook(() => useShellShortcuts(newTask));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, cancelable: true }));

    expect(appState.settingsOpen).toBe(true);
    expect(newTask).not.toHaveBeenCalled();
  });

  it('leaves formatting shortcuts to content-editable task input', () => {
    appState.sidebarOpen = true;
    renderHook(() => useShellShortcuts(() => undefined));
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    document.body.append(editor);

    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }));

    expect(appState.sidebarOpen).toBe(true);
    editor.remove();
  });
});
