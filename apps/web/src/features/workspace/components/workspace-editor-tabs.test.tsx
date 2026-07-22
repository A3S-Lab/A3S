import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { fileEditorTabId, type WorkspaceFileEditorTab } from '../workspace-state';
import { WorkspaceEditorTabs } from './workspace-editor-tabs';

describe('Workspace editor tabs', () => {
  beforeEach(() => {
    appState.workspaceRoot = '/repo';
    appState.editorTabs = [
      fileTab('/repo/crates/acl/src/lib.rs'),
      fileTab('/repo/crates/code/src/lib.rs'),
      fileTab('/repo/README.md'),
    ];
    appState.activeEditorTabId = fileEditorTabId('/repo/crates/acl/src/lib.rs');
  });

  afterEach(() => {
    cleanup();
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
  });

  it('renders duplicate filenames with visible and accessible unique parent suffixes', () => {
    const activateEditorTab = vi.fn();
    const closeEditorTab = vi.fn();
    const actions = { activateEditorTab, closeEditorTab } as unknown as WorkspaceActions;
    render(<WorkspaceEditorTabs actions={actions} />);

    const acl = screen.getByRole('tab', { name: 'lib.rs，acl/src' });
    const code = screen.getByRole('tab', { name: 'lib.rs，code/src' });
    const readme = screen.getByRole('tab', { name: 'README.md' });

    expect(acl).toHaveAttribute('title', 'crates/acl/src/lib.rs');
    expect(within(acl).getByText('acl/src')).toBeInTheDocument();
    expect(within(code).getByText('code/src')).toBeInTheDocument();
    expect(readme.querySelector('.workspace-tab-detail')).toBeNull();

    fireEvent.click(code);
    expect(activateEditorTab).toHaveBeenCalledWith(fileEditorTabId('/repo/crates/code/src/lib.rs'));

    fireEvent.click(screen.getByRole('button', { name: '关闭 lib.rs，acl/src' }));
    expect(closeEditorTab).toHaveBeenCalledWith(fileEditorTabId('/repo/crates/acl/src/lib.rs'));
  });

  it('keeps each tab and its close action as sibling controls', () => {
    const actions = {
      activateEditorTab: vi.fn(),
      closeEditorTab: vi.fn(),
    } as unknown as WorkspaceActions;
    render(<WorkspaceEditorTabs actions={actions} />);

    const tab = screen.getByRole('tab', { name: 'lib.rs，acl/src' });
    const close = screen.getByRole('button', { name: '关闭 lib.rs，acl/src' });

    expect(tab.tagName).toBe('BUTTON');
    expect(tab).not.toContainElement(close);
    expect(close.closest('[role="tab"]')).toBeNull();
  });

  it('offers Chinese tab operations and closes tabs to the right as one safe request', () => {
    const closeEditorTabs = vi.fn();
    const actions = {
      activateEditorTab: vi.fn(),
      closeEditorTab: vi.fn(),
      closeEditorTabs,
    } as unknown as WorkspaceActions;
    render(<WorkspaceEditorTabs actions={actions} />);

    fireEvent.contextMenu(screen.getByRole('tab', { name: 'lib.rs，code/src' }), {
      clientX: 120,
      clientY: 32,
    });

    const menu = screen.getByRole('menu', { name: 'lib.rs，code/src 标签页操作' });
    expect(menu).toHaveTextContent('关闭');
    expect(menu).toHaveTextContent('关闭其他标签页');
    expect(menu).toHaveTextContent('关闭右侧标签页');
    expect(menu).toHaveTextContent('关闭全部标签页');
    expect(menu).toHaveTextContent('复制相对路径');
    expect(within(menu).getByRole('menuitem', { name: '关闭' })).toHaveAttribute(
      'aria-keyshortcuts',
      expect.stringMatching(/^(Meta|Control)\+W$/)
    );
    fireEvent.click(within(menu).getByRole('menuitem', { name: '关闭右侧标签页' }));

    expect(closeEditorTabs).toHaveBeenCalledWith([fileEditorTabId('/repo/README.md')]);
  });

  it('copies a relative path and supports keyboard dismissal with focus restoration', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const actions = {
      activateEditorTab: vi.fn(),
      closeEditorTab: vi.fn(),
      closeEditorTabs: vi.fn(),
    } as unknown as WorkspaceActions;
    render(<WorkspaceEditorTabs actions={actions} />);
    const tab = screen.getByRole('tab', { name: 'README.md' });
    tab.focus();
    fireEvent.keyDown(tab, { key: 'F10', shiftKey: true });

    expect(screen.getByRole('menuitem', { name: '关闭' })).toHaveFocus();
    fireEvent.click(screen.getByRole('menuitem', { name: '复制相对路径' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('README.md'));
    expect(tab).toHaveFocus();

    fireEvent.keyDown(tab, { key: 'F10', shiftKey: true });
    const menu = screen.getByRole('menu', { name: 'README.md 标签页操作' });
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(tab).toHaveFocus();
  });

  it('supports automatic arrow, Home, End, and Delete navigation', async () => {
    const activateEditorTab = vi.fn((tabId: string) => {
      appState.activeEditorTabId = tabId;
    });
    const closeEditorTab = vi.fn();
    const actions = { activateEditorTab, closeEditorTab } as unknown as WorkspaceActions;
    render(<WorkspaceEditorTabs actions={actions} />);

    const acl = screen.getByRole('tab', { name: 'lib.rs，acl/src' });
    acl.focus();
    fireEvent.keyDown(acl, { key: 'End' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'README.md' })).toHaveFocus());

    fireEvent.keyDown(screen.getByRole('tab', { name: 'README.md' }), { key: 'Home' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'lib.rs，acl/src' })).toHaveFocus());

    fireEvent.keyDown(screen.getByRole('tab', { name: 'lib.rs，acl/src' }), { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'README.md' })).toHaveFocus());

    fireEvent.keyDown(screen.getByRole('tab', { name: 'README.md' }), { key: 'Delete' });
    expect(closeEditorTab).toHaveBeenCalledWith(fileEditorTabId('/repo/README.md'));
  });

  it('focuses a boundary target even when that tab is already selected', async () => {
    appState.activeEditorTabId = fileEditorTabId('/repo/README.md');
    const activateEditorTab = vi.fn((tabId: string) => {
      appState.activeEditorTabId = tabId;
    });
    const actions = { activateEditorTab, closeEditorTab: vi.fn() } as unknown as WorkspaceActions;
    render(<WorkspaceEditorTabs actions={actions} />);

    const inactive = screen.getByRole('tab', { name: 'lib.rs，acl/src' });
    inactive.focus();
    fireEvent.keyDown(inactive, { key: 'End' });

    await waitFor(() => expect(screen.getByRole('tab', { name: 'README.md' })).toHaveFocus());
    expect(activateEditorTab).toHaveBeenCalledWith(fileEditorTabId('/repo/README.md'));
  });
});

function fileTab(path: string): WorkspaceFileEditorTab {
  return {
    id: fileEditorTabId(path),
    kind: 'file',
    path,
    content: '',
    draft: '',
    revision: null,
    isBinary: false,
    location: null,
    loading: false,
    loadError: null,
    saving: false,
    configValidation: null,
  };
}
