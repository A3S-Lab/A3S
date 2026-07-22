import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../../lib/api';
import { appState } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import {
  diffEditorTabId,
  fileEditorTabId,
  type WorkspaceDiffEditorTab,
  type WorkspaceFileEditorTab,
} from '../workspace-state';
import { WorkspaceEditor } from './workspace-editor';

describe('Workspace editor keyboard scope', () => {
  beforeEach(() => {
    appState.workspaceRoot = '/repo';
    appState.reviewIntent = 'review';
    appState.reviewSourceTaskId = null;
    appState.editorTabs = [fileTab('/repo/first.ts'), fileTab('/repo/second.ts')];
    appState.activeEditorTabId = fileEditorTabId('/repo/first.ts');
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

  it('does not consume editor shortcuts while focus is outside the workspace editor', () => {
    const actions = keyboardActions();
    render(
      <>
        <textarea aria-label='任务指令' />
        <WorkspaceEditor actions={actions.value} />
      </>
    );
    const taskInput = screen.getByRole('textbox', { name: '任务指令' });
    taskInput.focus();

    expect(fireEvent.keyDown(taskInput, { key: 's', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(taskInput, { key: 'w', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(taskInput, { key: 'Tab', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(taskInput, { key: '-', code: 'Minus', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(taskInput, { key: '_', code: 'Minus', ctrlKey: true, shiftKey: true })).toBe(true);

    expect(actions.save).not.toHaveBeenCalled();
    expect(actions.close).not.toHaveBeenCalled();
    expect(actions.activate).not.toHaveBeenCalled();
    expect(actions.back).not.toHaveBeenCalled();
    expect(actions.forward).not.toHaveBeenCalled();
  });

  it('retains save, close, tab switching, and location history shortcuts inside the workspace editor', async () => {
    const actions = keyboardActions();
    render(<WorkspaceEditor actions={actions.value} />);
    const editor = await screen.findByRole('textbox', { name: '编辑 first.ts' });
    editor.focus();

    expect(fireEvent.keyDown(editor, { key: 's', ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: 'w', ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: 'Tab', ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: '-', code: 'Minus', ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: '_', code: 'Minus', ctrlKey: true, shiftKey: true })).toBe(false);

    expect(actions.save).toHaveBeenCalledWith(fileEditorTabId('/repo/first.ts'));
    expect(actions.close).toHaveBeenCalledWith(fileEditorTabId('/repo/first.ts'));
    expect(actions.activate).toHaveBeenCalledWith(fileEditorTabId('/repo/second.ts'));
    expect(actions.back).toHaveBeenCalledTimes(1);
    expect(actions.forward).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '返回上一个编辑位置' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '前往下一个编辑位置' })).toBeEnabled();
  });

  it('keeps Monaco focus in the next editor after Ctrl+Tab starts in the document', async () => {
    const actions = keyboardActions({ activateTab: true });
    render(<WorkspaceEditor actions={actions.value} />);
    const firstEditor = await screen.findByRole('textbox', { name: '编辑 first.ts' });
    firstEditor.focus();

    fireEvent.keyDown(firstEditor, { key: 'Tab', ctrlKey: true });

    const secondEditor = await screen.findByRole('textbox', { name: '编辑 second.ts' });
    await waitFor(() => expect(secondEditor).toHaveFocus());
    expect(appState.activeEditorTabId).toBe(fileEditorTabId('/repo/second.ts'));
  });

  it('keeps Monaco focus when Ctrl+Shift+Tab wraps to the final editor', async () => {
    appState.editorTabs = [fileTab('/repo/first.ts'), fileTab('/repo/second.ts'), fileTab('/repo/third.ts')];
    const actions = keyboardActions({ activateTab: true });
    render(<WorkspaceEditor actions={actions.value} />);
    const firstEditor = await screen.findByRole('textbox', { name: '编辑 first.ts' });
    firstEditor.focus();

    fireEvent.keyDown(firstEditor, { key: 'Tab', ctrlKey: true, shiftKey: true });

    const thirdEditor = await screen.findByRole('textbox', { name: '编辑 third.ts' });
    await waitFor(() => expect(thirdEditor).toHaveFocus());
    expect(appState.activeEditorTabId).toBe(fileEditorTabId('/repo/third.ts'));
  });

  it('moves focus into the modified diff editor when Ctrl+Tab starts in Monaco', async () => {
    appState.editorTabs = [fileTab('/repo/first.ts'), diffTab('/repo/second.ts')];
    const actions = keyboardActions({ activateTab: true });
    render(<WorkspaceEditor actions={actions.value} />);
    const firstEditor = await screen.findByRole('textbox', { name: '编辑 first.ts' });
    firstEditor.focus();

    fireEvent.keyDown(firstEditor, { key: 'Tab', ctrlKey: true });

    const diffEditor = await screen.findByTestId('monaco-diff-editor');
    await waitFor(() => expect(diffEditor).toHaveFocus());
    expect(appState.activeEditorTabId).toBe(diffEditorTabId('/repo/second.ts', false));
  });

  it('does not move focus into Monaco when Ctrl+Tab starts from a connected workspace control', async () => {
    const actions = keyboardActions({ activateTab: true });
    render(<WorkspaceEditor actions={actions.value} />);
    const backButton = screen.getByRole('button', { name: '返回上一个编辑位置' });
    backButton.focus();

    fireEvent.keyDown(backButton, { key: 'Tab', ctrlKey: true });

    await screen.findByRole('textbox', { name: '编辑 second.ts' });
    expect(appState.activeEditorTabId).toBe(fileEditorTabId('/repo/second.ts'));
    expect(backButton).toHaveFocus();
  });

  it('does not let a newly mounted diff editor steal focus from a workspace control', async () => {
    appState.editorTabs = [fileTab('/repo/first.ts'), diffTab('/repo/second.ts')];
    const actions = keyboardActions({ activateTab: true });
    render(<WorkspaceEditor actions={actions.value} />);
    const backButton = screen.getByRole('button', { name: '返回上一个编辑位置' });
    backButton.focus();

    fireEvent.keyDown(backButton, { key: 'Tab', ctrlKey: true });

    const diffEditor = await screen.findByTestId('monaco-diff-editor');
    expect(appState.activeEditorTabId).toBe(diffEditorTabId('/repo/second.ts', false));
    expect(diffEditor).not.toHaveFocus();
    expect(screen.getByRole('tab', { name: 'second.ts（工作树）' })).toHaveFocus();
  });

  it('keeps editing focus in the successor document when a keyboard close removes the active editor', async () => {
    const actions = keyboardActions({ removeClosedTab: true });
    render(<WorkspaceEditor actions={actions.value} />);
    const editor = await screen.findByRole('textbox', { name: '编辑 first.ts' });
    editor.focus();

    fireEvent.keyDown(editor, { key: 'w', ctrlKey: true });

    await waitFor(() => expect(screen.getByRole('textbox', { name: '编辑 second.ts' })).toHaveFocus());
    expect(appState.activeEditorTabId).toBe(fileEditorTabId('/repo/second.ts'));
  });

  it('moves focus to Quick Open when keyboard close removes the final tab', async () => {
    appState.editorTabs = [fileTab('/repo/first.ts')];
    appState.activeEditorTabId = fileEditorTabId('/repo/first.ts');
    const actions = keyboardActions({ removeClosedTab: true });
    render(<WorkspaceEditor actions={actions.value} />);
    const editor = await screen.findByRole('textbox', { name: '编辑 first.ts' });
    editor.focus();

    fireEvent.keyDown(editor, { key: 'w', ctrlKey: true });

    await waitFor(() => expect(screen.getByRole('button', { name: /快速打开/ })).toHaveFocus());
    expect(appState.activeEditorTabId).toBeNull();
  });

  it('does not steal focus from a connected control when a tab closes elsewhere', async () => {
    const actions = keyboardActions({ removeClosedTab: true });
    render(
      <>
        <button type='button'>Explorer action</button>
        <WorkspaceEditor actions={actions.value} />
      </>
    );
    const explorerAction = screen.getByRole('button', { name: 'Explorer action' });
    explorerAction.focus();

    act(() => actions.value.closeEditorTab(fileEditorTabId('/repo/first.ts')));

    await waitFor(() => expect(appState.activeEditorTabId).toBe(fileEditorTabId('/repo/second.ts')));
    expect(explorerAction).toHaveFocus();
  });
});

function fileTab(path: string): WorkspaceFileEditorTab {
  return {
    id: fileEditorTabId(path),
    kind: 'file',
    path,
    content: 'export const value = 1;\n',
    draft: 'export const value = 1;\n',
    revision: null,
    isBinary: false,
    location: null,
    loading: false,
    loadError: null,
    saving: false,
    configValidation: null,
  };
}

function diffTab(path: string): WorkspaceDiffEditorTab {
  return {
    id: diffEditorTabId(path, false),
    kind: 'diff',
    path,
    staged: false,
    original: 'export const value = 1;\n',
    modified: 'export const value = 2;\n',
    unified: '@@ -1 +1 @@\n',
    isBinary: false,
    loading: false,
    loadError: null,
  };
}

function keyboardActions({
  removeClosedTab = false,
  activateTab = false,
}: {
  removeClosedTab?: boolean;
  activateTab?: boolean;
} = {}): {
  value: WorkspaceActions;
  save: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  activate: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
} {
  const save = vi.fn(async () => true);
  const close = vi.fn((tabId: string) => {
    if (!removeClosedTab) return;
    const previousTabs = [...appState.editorTabs];
    const index = previousTabs.findIndex((tab) => tab.id === tabId);
    const nextActive = previousTabs[index + 1] ?? previousTabs[index - 1] ?? null;
    appState.editorTabs = previousTabs.filter((tab) => tab.id !== tabId);
    appState.activeEditorTabId = nextActive?.id ?? null;
  });
  const activate = vi.fn((tabId: string) => {
    if (activateTab) appState.activeEditorTabId = tabId;
  });
  const back = vi.fn(async () => true);
  const forward = vi.fn(async () => true);
  return {
    value: {
      canNavigateEditorBack: true,
      canNavigateEditorForward: true,
      navigateEditorBack: back,
      navigateEditorForward: forward,
      updateEditorPosition: vi.fn(),
      saveEditorTab: save,
      closeEditorTab: close,
      activateEditorTab: activate,
      selectFile: vi.fn(async () => true),
      updateEditorDraft: vi.fn(),
    } as unknown as WorkspaceActions,
    save,
    close,
    activate,
    back,
    forward,
  };
}
