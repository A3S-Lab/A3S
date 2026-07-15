import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { WorkspaceExplorer } from './workspace-explorer';

const file = {
  name: 'app.ts',
  path: '/repo/app.ts',
  isDirectory: false,
  isFile: true,
  size: 10,
  extension: 'ts',
  isBinary: false,
};

describe('WorkspaceExplorer context menu operations', () => {
  beforeEach(() => {
    appState.workspaceRoot = '/repo';
    appState.filesByDirectory = { '/repo': [file] };
    appState.directoryLoading = {};
    appState.directoryErrors = {};
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    appState.gitStatus = null;
  });

  afterEach(cleanup);

  it('starts an in-place rename from the file context menu', async () => {
    const renameWorkspaceEntry = vi.fn(async () => undefined);
    render(
      <WorkspaceExplorer actions={{ renameWorkspaceEntry } as unknown as WorkspaceActions} onOpenSearch={vi.fn()} />
    );

    expect(screen.queryByRole('button', { name: '重命名 app.ts' })).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'app.ts' }), { clientX: 48, clientY: 72 });
    expect(screen.getByRole('menu', { name: 'app.ts 操作' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: '文件或文件夹名称' });
    fireEvent.change(input, { target: { value: 'main.ts' } });
    fireEvent.click(screen.getByRole('button', { name: '确认文件操作' }));

    await waitFor(() => expect(renameWorkspaceEntry).toHaveBeenCalledWith('/repo/app.ts', 'main.ts'));
  });

  it('keeps a failed delete confirmation at the same tree row', async () => {
    const deleteWorkspaceEntry = vi.fn(async () => {
      throw new Error('delete failed');
    });
    render(
      <WorkspaceExplorer actions={{ deleteWorkspaceEntry } as unknown as WorkspaceActions} onOpenSearch={vi.fn()} />
    );

    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'app.ts' }), { clientX: 48, clientY: 72 });
    fireEvent.click(screen.getByRole('menuitem', { name: '删除' }));
    const confirmation = screen.getByRole('group', { name: '确认删除 app.ts' });
    expect(confirmation).toHaveTextContent('此操作无法撤销');
    fireEvent.click(screen.getByRole('button', { name: '确认删除 app.ts' }));

    await waitFor(() => expect(deleteWorkspaceEntry).toHaveBeenCalledWith('/repo/app.ts'));
    expect(screen.getByRole('group', { name: '确认删除 app.ts' })).toHaveTextContent('删除失败，请重试');
  });

  it('opens from the keyboard and restores focus when dismissed', () => {
    render(<WorkspaceExplorer actions={{} as WorkspaceActions} onOpenSearch={vi.fn()} />);
    const row = screen.getByRole('treeitem', { name: 'app.ts' });
    row.focus();

    fireEvent.keyDown(row, { key: 'F10', shiftKey: true });

    const menu = screen.getByRole('menu', { name: 'app.ts 操作' });
    expect(screen.getByRole('menuitem', { name: '打开文件' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(row).toHaveFocus();
  });
});
