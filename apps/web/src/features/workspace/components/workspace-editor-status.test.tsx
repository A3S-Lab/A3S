import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as monaco from 'monaco-editor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../../lib/api';
import { appState } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { fileEditorTabId, type WorkspaceFileEditorTab } from '../workspace-state';
import { rebaseWorkspaceEditorModelPath } from './monaco-editor-model-store';
import { WorkspaceEditor } from './workspace-editor';

const testMonaco = monaco as unknown as {
  __cursorSelectionListeners: Array<() => void>;
  __position: { lineNumber: number; column: number };
  __selections: Array<{ selectedText: string; isEmpty: () => boolean }>;
};

describe('Workspace editor status bar', () => {
  beforeEach(() => {
    appState.workspaceRoot = '/repo';
    appState.reviewIntent = 'review';
    testMonaco.__cursorSelectionListeners.splice(0);
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue({
      state: 'ready',
      capabilities: {
        documentSymbols: true,
        workspaceSymbols: true,
        definition: true,
        declaration: true,
        references: true,
        implementations: true,
        diagnostics: true,
      },
      languages: [],
      message: null,
    });
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 1,
      document: { revision: 1, contentHash: 'hash', stale: false },
    });
  });

  afterEach(() => {
    cleanup();
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    vi.restoreAllMocks();
  });

  it('shows the live cursor, selection, and actual model line ending', async () => {
    openFile('/repo/app.ts', 'first\r\nsecond');
    render(<WorkspaceEditor actions={editorActions()} />);

    expect(await screen.findByText('行 1，列 1')).toBeInTheDocument();
    expect(screen.getByText('CRLF')).toBeInTheDocument();
    expect(screen.queryByText('LF')).not.toBeInTheDocument();

    act(() => {
      testMonaco.__position = { lineNumber: 2, column: 4 };
      testMonaco.__selections = [
        { selectedText: 'A😀', isEmpty: () => false },
        { selectedText: 'two', isEmpty: () => false },
      ];
      for (const listener of testMonaco.__cursorSelectionListeners) listener();
    });

    await waitFor(() => expect(screen.getByText('行 2，列 4')).toBeInTheDocument());
    expect(screen.getByText('已选择 6 个字符（2 处）')).toBeInTheDocument();
  });

  it('does not claim text encoding or line endings for a binary file', () => {
    openFile('/repo/image.png', '', true);
    render(<WorkspaceEditor actions={editorActions()} />);

    expect(screen.getByText('二进制文件仅供识别')).toBeInTheDocument();
    expect(screen.queryByText('UTF-8')).not.toBeInTheDocument();
    expect(screen.queryByText('LF')).not.toBeInTheDocument();
    expect(screen.queryByText('CRLF')).not.toBeInTheDocument();
    expect(screen.queryByText(/^行 \d/)).not.toBeInTheDocument();
  });

  it('changes the model line ending from the status menu and marks the tab dirty', async () => {
    openFile('/repo/app.ts', 'first\nsecond');
    render(<WorkspaceEditor actions={editorActions()} />);

    const trigger = await screen.findByRole('button', { name: '换行符 LF' });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu', { name: '选择换行符序列' });
    expect(within(menu).getByRole('menuitemradio', { name: /^LF，/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /^CRLF，/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: '换行符 CRLF' })).toBeInTheDocument());
    expect(screen.getAllByText('未保存')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '保存文件' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: '编辑 app.ts' })).toHaveFocus();
  });

  it('keeps line-ending conversion unavailable in read-only context review', async () => {
    appState.reviewIntent = 'select-context';
    openFile('/repo/app.ts', 'first\nsecond');
    render(<WorkspaceEditor actions={editorActions()} />);

    expect(await screen.findByRole('button', { name: '换行符 LF' })).toBeDisabled();
    expect(screen.queryByRole('menu', { name: '选择换行符序列' })).not.toBeInTheDocument();
  });

  it('keeps model status and code navigation ready after an open file is renamed', async () => {
    appState.editorModelScope = 'rename-status-scope';
    openFile('/repo/app.ts', 'export const value = 1;\n');
    render(<WorkspaceEditor actions={editorActions()} />);

    expect(await screen.findByText('行 1，列 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '代码导航' })).toBeEnabled();

    act(() => {
      const tab = appState.editorTabs[0] as WorkspaceFileEditorTab;
      rebaseWorkspaceEditorModelPath(appState.editorModelScope, tab.path, '/repo/app.rs');
      tab.path = '/repo/app.rs';
      tab.id = fileEditorTabId(tab.path);
      appState.activeEditorTabId = tab.id;
    });

    expect(await screen.findByRole('textbox', { name: '编辑 app.rs' })).toBeInTheDocument();
    expect(screen.getByText('行 1，列 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '代码导航' })).toBeEnabled();
  });
});

function openFile(path: string, content: string, isBinary = false): void {
  const tab: WorkspaceFileEditorTab = {
    id: fileEditorTabId(path),
    kind: 'file',
    path,
    content,
    draft: content,
    revision: null,
    isBinary,
    location: null,
    loading: false,
    loadError: null,
    saving: false,
    configValidation: null,
  };
  appState.editorTabs = [tab];
  appState.activeEditorTabId = tab.id;
}

function editorActions(): WorkspaceActions {
  return {
    updateEditorDraft: vi.fn((tabId: string, value: string) => {
      const tab = appState.editorTabs.find((candidate) => candidate.id === tabId);
      if (tab?.kind === 'file') tab.draft = value;
    }),
    selectFile: vi.fn(async () => true),
    saveEditorTab: vi.fn(async () => true),
    closeEditorTab: vi.fn(),
  } as unknown as WorkspaceActions;
}
