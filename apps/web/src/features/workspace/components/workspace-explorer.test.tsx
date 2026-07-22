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

describe('WorkspaceExplorer', () => {
  beforeEach(() => {
    appState.workspaceRoot = '/repo';
    appState.filesByDirectory = { '/repo': [file] };
    appState.expandedDirectories = {};
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
    const renameItem = screen.getByRole('menuitem', { name: '重命名' });
    expect(renameItem).toHaveTextContent('F2');
    expect(renameItem).toHaveAttribute('aria-keyshortcuts', 'F2');
    fireEvent.click(renameItem);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: '文件或文件夹名称' });
    fireEvent.change(input, { target: { value: 'main.ts' } });
    fireEvent.click(screen.getByRole('button', { name: '确认文件操作' }));

    await waitFor(() => expect(renameWorkspaceEntry).toHaveBeenCalledWith('/repo/app.ts', 'main.ts'));
  });

  it('associates an invalid inline name with the workspace name field', () => {
    render(<WorkspaceExplorer actions={{} as WorkspaceActions} onOpenSearch={vi.fn()} />);

    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'app.ts' }), { clientX: 48, clientY: 72 });
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }));
    const input = screen.getByRole('textbox', { name: '文件或文件夹名称' });
    fireEvent.change(input, { target: { value: 'invalid/name.ts' } });

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('名称不能包含路径分隔符。');
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('starts an in-place rename with F2 on the focused file row', () => {
    render(<WorkspaceExplorer actions={{} as WorkspaceActions} onOpenSearch={vi.fn()} />);
    const row = screen.getByRole('treeitem', { name: 'app.ts' });
    row.focus();

    fireEvent.keyDown(row, { key: 'F2' });

    const input = screen.getByRole('textbox', { name: '文件或文件夹名称' });
    expect(input).toHaveValue('app.ts');
    expect(input).toHaveFocus();
  });

  it('opens the in-place delete confirmation with Delete without deleting immediately', async () => {
    const deleteWorkspaceEntry = vi.fn(async () => undefined);
    render(
      <WorkspaceExplorer actions={{ deleteWorkspaceEntry } as unknown as WorkspaceActions} onOpenSearch={vi.fn()} />
    );
    const row = screen.getByRole('treeitem', { name: 'app.ts' });
    row.focus();

    fireEvent.keyDown(row, { key: 'Delete' });

    expect(screen.getByRole('group', { name: '确认删除 app.ts' })).toBeInTheDocument();
    expect(deleteWorkspaceEntry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确认删除 app.ts' }));
    await waitFor(() => expect(deleteWorkspaceEntry).toHaveBeenCalledWith('/repo/app.ts'));
  });

  it('keeps keyboard focus inside the tree when rename and delete are cancelled', () => {
    render(<WorkspaceExplorer actions={{} as WorkspaceActions} onOpenSearch={vi.fn()} />);
    let row = screen.getByRole('treeitem', { name: 'app.ts' });
    row.focus();

    fireEvent.keyDown(row, { key: 'F2' });
    const renameInput = screen.getByRole('textbox', { name: '文件或文件夹名称' });
    expect(renameInput).toHaveFocus();
    fireEvent.keyDown(renameInput, { key: 'Escape' });
    row = screen.getByRole('treeitem', { name: 'app.ts' });
    expect(row).toHaveFocus();

    fireEvent.keyDown(row, { key: 'Delete' });
    const cancelDelete = screen.getByRole('button', { name: '取消' });
    expect(cancelDelete).toHaveFocus();
    fireEvent.click(cancelDelete);
    expect(screen.getByRole('treeitem', { name: 'app.ts' })).toHaveFocus();
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

  it('passes binary directory metadata through the tree selection path', async () => {
    const selectFile = vi.fn(async () => true);
    appState.filesByDirectory = {
      '/repo': [
        {
          ...file,
          name: 'logo.png',
          path: '/repo/logo.png',
          extension: 'png',
          isBinary: true,
        },
      ],
    };
    render(<WorkspaceExplorer actions={{ selectFile } as unknown as WorkspaceActions} onOpenSearch={vi.fn()} />);

    fireEvent.click(screen.getByRole('treeitem', { name: 'logo.png' }));

    await waitFor(() =>
      expect(selectFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/repo/logo.png',
          isBinary: true,
        })
      )
    );
  });

  it('uses one roving tab stop and moves focus through visible rows without opening files', () => {
    const selectFile = vi.fn(async () => true);
    appState.filesByDirectory = {
      '/repo': [directory('/repo/src'), textFile('/repo/README.md')],
      '/repo/src': [textFile('/repo/src/app.ts'), directory('/repo/src/nested')],
      '/repo/src/nested': [textFile('/repo/src/nested/model.ts')],
    };
    appState.expandedDirectories = { '/repo/src': true };
    render(<WorkspaceExplorer actions={{ selectFile } as unknown as WorkspaceActions} onOpenSearch={vi.fn()} />);

    const src = screen.getByRole('treeitem', { name: 'src' });
    const app = screen.getByRole('treeitem', { name: 'app.ts' });
    const nested = screen.getByRole('treeitem', { name: 'nested' });
    const readme = screen.getByRole('treeitem', { name: 'README.md' });
    expect(src).toHaveAttribute('tabindex', '0');
    expect(app).toHaveAttribute('tabindex', '-1');
    expect(nested).toHaveAttribute('tabindex', '-1');
    expect(readme).toHaveAttribute('tabindex', '-1');

    src.focus();
    fireEvent.keyDown(src, { key: 'ArrowDown' });
    expect(app).toHaveFocus();
    fireEvent.keyDown(app, { key: 'ArrowDown' });
    expect(nested).toHaveFocus();
    fireEvent.keyDown(nested, { key: 'ArrowDown' });
    expect(readme).toHaveFocus();
    fireEvent.keyDown(readme, { key: 'ArrowDown' });
    expect(readme).toHaveFocus();

    fireEvent.keyDown(readme, { key: 'Home' });
    expect(src).toHaveFocus();
    fireEvent.keyDown(src, { key: 'ArrowUp' });
    expect(src).toHaveFocus();
    fireEvent.keyDown(src, { key: 'End' });
    expect(readme).toHaveFocus();
    expect(screen.getAllByRole('treeitem').filter((row) => row.tabIndex === 0)).toEqual([readme]);
    expect(selectFile).not.toHaveBeenCalled();
  });

  it('uses the visible active editor path as the initial tree tab stop', () => {
    appState.filesByDirectory = { '/repo': [file, textFile('/repo/README.md')] };
    appState.editorTabs = [
      {
        id: 'readme',
        kind: 'file',
        path: '/repo/README.md',
        content: '',
        draft: '',
        revision: null,
        isBinary: false,
        location: null,
        loading: false,
        loadError: null,
        saving: false,
        configValidation: null,
      },
    ];
    appState.activeEditorTabId = 'readme';
    render(<WorkspaceExplorer actions={{} as WorkspaceActions} onOpenSearch={vi.fn()} />);

    expect(screen.getByRole('treeitem', { name: 'app.ts' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toHaveAttribute('tabindex', '0');
  });

  it('opens and collapses directories with horizontal arrows and moves between parent and first child', async () => {
    appState.filesByDirectory = {
      '/repo': [directory('/repo/src'), textFile('/repo/README.md')],
      '/repo/src': [textFile('/repo/src/app.ts'), directory('/repo/src/nested')],
    };
    const toggleDirectory = vi.fn(async (path: string) => {
      appState.expandedDirectories[path] = !appState.expandedDirectories[path];
    });
    render(<WorkspaceExplorer actions={{ toggleDirectory } as unknown as WorkspaceActions} onOpenSearch={vi.fn()} />);

    const src = screen.getByRole('treeitem', { name: 'src' });
    src.focus();
    fireEvent.keyDown(src, { key: 'ArrowRight' });

    await waitFor(() => expect(screen.getByRole('treeitem', { name: 'app.ts' })).toBeInTheDocument());
    expect(src).toHaveFocus();
    expect(toggleDirectory).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(src, { key: 'ArrowRight' });
    const app = screen.getByRole('treeitem', { name: 'app.ts' });
    expect(app).toHaveFocus();
    fireEvent.keyDown(app, { key: 'ArrowLeft' });
    expect(src).toHaveFocus();

    fireEvent.keyDown(src, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: 'app.ts' })).not.toBeInTheDocument());
    expect(src).toHaveFocus();
    expect(toggleDirectory).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(src, { key: 'ArrowLeft' });
    expect(src).toHaveFocus();
    expect(toggleDirectory).toHaveBeenCalledTimes(2);
  });

  it('navigates query-expanded ancestors without mutating their saved expansion state', () => {
    const toggleDirectory = vi.fn(async () => undefined);
    appState.filesByDirectory = {
      '/repo': [directory('/repo/src'), textFile('/repo/README.md')],
      '/repo/src': [textFile('/repo/src/app.ts'), directory('/repo/src/domain')],
      '/repo/src/domain': [textFile('/repo/src/domain/model.ts')],
    };
    render(<WorkspaceExplorer actions={{ toggleDirectory } as unknown as WorkspaceActions} onOpenSearch={vi.fn()} />);

    fireEvent.change(screen.getByRole('searchbox', { name: '筛选文件' }), { target: { value: 'model' } });
    const src = screen.getByRole('treeitem', { name: 'src' });
    const domain = screen.getByRole('treeitem', { name: 'domain' });
    const model = screen.getByRole('treeitem', { name: 'model.ts' });
    expect(screen.queryByRole('treeitem', { name: 'app.ts' })).not.toBeInTheDocument();

    src.focus();
    fireEvent.keyDown(src, { key: 'ArrowRight' });
    expect(domain).toHaveFocus();
    fireEvent.keyDown(domain, { key: 'ArrowRight' });
    expect(model).toHaveFocus();
    fireEvent.keyDown(model, { key: 'ArrowLeft' });
    expect(domain).toHaveFocus();
    fireEvent.keyDown(domain, { key: 'ArrowLeft' });
    expect(src).toHaveFocus();
    expect(toggleDirectory).not.toHaveBeenCalled();
  });
});

function directory(path: string) {
  return {
    name: path.split('/').pop() ?? path,
    path,
    isDirectory: true,
    isFile: false,
    size: 0,
    isBinary: false,
  };
}

function textFile(path: string) {
  return {
    name: path.split('/').pop() ?? path,
    path,
    isDirectory: false,
    isFile: true,
    size: 10,
    extension: path.split('.').pop(),
    isBinary: false,
  };
}
