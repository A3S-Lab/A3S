import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspacePage } from '../../code/pages/workspace-page';
import { appState } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { WorkspaceExplorer } from './workspace-explorer';
import { WorkspaceEditor } from './workspace-editor';
import { WorkspaceSearchPanel } from './workspace-search-panel';
import { useWorkspaceController } from '../use-workspace-controller';
import { codeApi } from '../../../lib/api';
import { fileEditorTabId, type WorkspaceFileEditorTab } from '../workspace-state';

describe('Workspace review flow', () => {
  afterEach(() => {
    cleanup();
    appState.fileLoadError = null;
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    appState.pendingEditorTabCloseId = null;
    appState.fileConflict = null;
    appState.workspaceSearchError = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requires an explicit decision before closing an unsaved editor tab', () => {
    appState.workspaceRoot = '/repo';
    appState.filesByDirectory = { '/repo': [] };
    appState.gitStatusLoading = false;
    appState.gitStatus = { isGitRepo: true, branch: 'main', files: [] };
    const tab = setOpenFileTab('/repo/current.ts', 'saved', 'unsaved');
    appState.pendingEditorTabCloseId = tab.id;
    const cancelEditorTabClose = vi.fn();
    const confirmEditorTabClose = vi.fn();
    const actions = {
      cancelEditorTabClose,
      confirmEditorTabClose,
      saveEditorTab: vi.fn(async () => true),
      refreshGitStatus: vi.fn(),
    } as unknown as WorkspaceActions;
    render(<WorkspacePage actions={actions} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: '保存文件更改？' })).toBeInTheDocument();
    expect(within(dialog).getByText('current.ts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(cancelEditorTabClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '不保存' }));
    expect(confirmEditorTabClose).toHaveBeenCalledTimes(1);
  });

  it('opens another file in a new tab without discarding the current draft', async () => {
    const current = setOpenFileTab('/repo/current.ts', 'saved', 'unsaved');
    vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: 'next file' });
    const hook = renderHook(() => useWorkspaceController());

    await act(() => hook.result.current.selectFile({ path: '/repo/next.ts', isBinary: false }));

    expect(appState.editorTabs).toHaveLength(2);
    const preserved = appState.editorTabs.find((tab) => tab.id === current.id);
    expect(preserved?.kind === 'file' ? preserved.draft : null).toBe('unsaved');
    expect(appState.activeEditorTabId).toBe(fileEditorTabId('/repo/next.ts'));
    hook.unmount();
  });

  it('keeps independent drafts while switching tabs and only guards dirty tab closure', async () => {
    const first = setOpenFileTab('/repo/first.ts', 'first saved', 'first draft');
    vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: 'second saved' });
    const hook = renderHook(() => useWorkspaceController());
    await act(() => hook.result.current.selectFile({ path: '/repo/second.ts', isBinary: false }));
    const secondId = fileEditorTabId('/repo/second.ts');

    act(() => hook.result.current.updateEditorDraft(secondId, 'second draft'));
    act(() => hook.result.current.activateEditorTab(first.id));

    expect(activeFileTab()?.draft).toBe('first draft');
    act(() => hook.result.current.closeEditorTab(secondId));
    expect(appState.pendingEditorTabCloseId).toBe(secondId);
    expect(appState.editorTabs).toHaveLength(2);
    act(() => hook.result.current.confirmEditorTabClose());
    expect(appState.editorTabs.map((tab) => tab.id)).toEqual([first.id]);
    hook.unmount();
  });

  it('opens a complete Monaco diff as another editor tab', async () => {
    setOpenFileTab('/repo/app.ts', 'const value = 1;\n');
    vi.spyOn(codeApi, 'gitDiff').mockResolvedValue({
      path: 'app.ts',
      staged: false,
      content: '@@ -1 +1 @@',
      original: 'const value = 1;\n',
      modified: 'const value = 2;\n',
      isBinary: false,
    });
    const hook = renderHook(() => useWorkspaceController());
    await act(() => hook.result.current.loadGitDiff('app.ts', false));

    expect(appState.editorTabs).toHaveLength(2);
    const diff = appState.editorTabs.find((tab) => tab.kind === 'diff');
    expect(diff?.kind === 'diff' ? [diff.original, diff.modified] : null).toEqual([
      'const value = 1;\n',
      'const value = 2;\n',
    ]);
    render(<WorkspaceEditor actions={hook.result.current} />);
    expect(await screen.findByText('const value = 1;')).toBeInTheDocument();
    expect(await screen.findByText('const value = 2;')).toBeInTheDocument();
    hook.unmount();
  });

  it('rejects path traversal names before creating a workspace entry', () => {
    appState.workspaceRoot = '/repo';
    appState.filesByDirectory = { '/repo': [] };
    const createWorkspaceEntry = vi.fn(async () => undefined);
    render(
      <WorkspaceExplorer actions={{ createWorkspaceEntry } as unknown as WorkspaceActions} onOpenSearch={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: '新建文件' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '文件或文件夹名称' }), {
      target: { value: '../secret' },
    });
    expect(screen.getByRole('alert', { name: '名称不能包含路径分隔符。' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认文件操作' })).toBeDisabled();
    expect(createWorkspaceEntry).not.toHaveBeenCalled();
  });

  it('keeps loaded parent directories when filtering for a nested file', () => {
    appState.workspaceRoot = '/repo';
    appState.filesByDirectory = {
      '/repo': [
        {
          name: 'src',
          path: '/repo/src',
          isDirectory: true,
          isFile: false,
          size: 0,
          isBinary: false,
        },
      ],
      '/repo/src': [
        {
          name: 'app.tsx',
          path: '/repo/src/app.tsx',
          isDirectory: false,
          isFile: true,
          size: 20,
          extension: 'tsx',
          isBinary: false,
        },
      ],
    };
    appState.expandedDirectories = { '/repo/src': true };

    render(<WorkspaceExplorer actions={{} as WorkspaceActions} onOpenSearch={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox', { name: '筛选文件' }), { target: { value: 'app.tsx' } });

    expect(screen.getByRole('treeitem', { name: 'src' })).toHaveAttribute('aria-level', '1');
    expect(screen.getByRole('treeitem', { name: 'app.tsx' })).toHaveAttribute('aria-level', '2');
    expect(screen.queryByText('没有匹配文件')).not.toBeInTheDocument();
  });

  it('shows a directory-load failure in place and keeps retry available', () => {
    appState.workspaceRoot = '/repo';
    appState.filesByDirectory = { '/repo': [] };
    appState.directoryLoading = { '/repo': false };
    appState.directoryErrors = { '/repo': 'Permission denied' };
    const refreshDirectory = vi.fn(async () => undefined);

    render(<WorkspaceExplorer actions={{ refreshDirectory } as unknown as WorkspaceActions} onOpenSearch={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Permission denied');
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(refreshDirectory).toHaveBeenCalledWith('/repo');
    expect(screen.queryByText('目录为空')).not.toBeInTheDocument();
  });

  it('keeps the reviewed replacement scope open when replacement fails', async () => {
    appState.workspaceRoot = '/repo';
    appState.workspaceSearchQuery = 'oldValue';
    appState.workspaceSearchLoading = false;
    appState.workspaceReplaceLoading = false;
    appState.workspaceSearchResults = [
      {
        path: '/repo/app.ts',
        matches: [{ line: 1, column: 1, text: 'oldValue', matchStart: 0, matchEnd: 8 }],
      },
    ];
    const replaceWorkspace = vi.fn(async () => {
      throw new Error('replacement failed');
    });
    render(<WorkspaceSearchPanel actions={{ replaceWorkspace } as unknown as WorkspaceActions} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: '全局搜索内容' }), { target: { value: 'oldValue' } });
    fireEvent.change(screen.getByRole('textbox', { name: '替换为' }), { target: { value: 'newValue' } });
    fireEvent.click(screen.getByRole('button', { name: '替换全部' }));
    fireEvent.click(screen.getByRole('button', { name: '确认替换' }));
    await waitFor(() => expect(replaceWorkspace).toHaveBeenCalledWith('oldValue', 'newValue', ['/repo/app.ts']));
    expect(screen.getByRole('heading', { name: '替换工作区内容' })).toBeInTheDocument();
  });

  it('never applies a newly typed query to stale search results', () => {
    appState.workspaceRoot = '/repo';
    appState.workspaceSearchQuery = 'oldValue';
    appState.workspaceSearchLoading = false;
    appState.workspaceSearchResults = [
      {
        path: '/repo/app.ts',
        matches: [{ line: 1, column: 1, text: 'oldValue', matchStart: 0, matchEnd: 8 }],
      },
    ];
    render(<WorkspaceSearchPanel actions={{} as WorkspaceActions} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: '全局搜索内容' }), { target: { value: 'newValue' } });
    expect(screen.getByText('当前结果来自“oldValue”；重新搜索后才能替换。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '替换全部' })).toBeDisabled();
  });

  it('keeps a failed workspace search distinguishable from zero matches', () => {
    appState.workspaceRoot = '/repo';
    appState.workspaceSearchQuery = '';
    appState.workspaceSearchLoading = false;
    appState.workspaceSearchError = 'Search backend unavailable';
    appState.workspaceSearchResults = [];
    const searchWorkspace = vi.fn(async () => undefined);

    render(<WorkspaceSearchPanel actions={{ searchWorkspace } as unknown as WorkspaceActions} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: '全局搜索内容' }), { target: { value: 'target' } });
    expect(screen.getByRole('alert')).toHaveTextContent('搜索失败');
    expect(screen.queryByText(/没有匹配结果/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新搜索' }));
    expect(searchWorkspace).toHaveBeenCalledWith('target');
  });

  it('blocks workspace replacement when the reviewed scope contains unsaved edits', () => {
    appState.workspaceRoot = '/repo';
    appState.workspaceSearchQuery = 'oldValue';
    appState.workspaceSearchLoading = false;
    appState.workspaceSearchResults = [
      {
        path: '/repo/app.ts',
        matches: [{ line: 1, column: 1, text: 'oldValue', matchStart: 0, matchEnd: 8 }],
      },
    ];
    setOpenFileTab('/repo/app.ts', 'oldValue', 'local unsaved edit');
    render(<WorkspaceSearchPanel actions={{} as WorkspaceActions} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '替换全部' }));
    expect(screen.getByText('替换范围包含未保存文件，请先保存或放弃编辑。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认替换' })).toBeDisabled();
  });

  it('opens a search match at its line and returns to the editor', async () => {
    appState.workspaceRoot = '/repo';
    appState.workspaceSearchQuery = 'target';
    appState.workspaceSearchResults = [
      {
        path: '/repo/app.ts',
        matches: [{ line: 8, column: 4, text: 'target', matchStart: 3, matchEnd: 9 }],
      },
    ];
    const selectFile = vi.fn(async () => true);
    const onClose = vi.fn();
    render(<WorkspaceSearchPanel actions={{ selectFile } as unknown as WorkspaceActions} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '打开 app.ts 第 8 行' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(selectFile).toHaveBeenCalledWith({ path: '/repo/app.ts', isBinary: false, line: 8, column: 4 });
  });

  it('keeps search open when the selected result cannot be opened', async () => {
    appState.workspaceRoot = '/repo';
    appState.workspaceSearchQuery = 'target';
    appState.workspaceSearchResults = [
      {
        path: '/repo/app.ts',
        matches: [{ line: 8, column: 4, text: 'target', matchStart: 3, matchEnd: 9 }],
      },
    ];
    const selectFile = vi.fn(async () => false);
    const onClose = vi.fn();
    render(<WorkspaceSearchPanel actions={{ selectFile } as unknown as WorkspaceActions} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '打开 app.ts 第 8 行' }));

    await waitFor(() => expect(selectFile).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('complementary', { name: '全局搜索与替换' })).toBeInTheDocument();
  });

  it('keeps a failed file target visible with an in-context retry', () => {
    appState.workspaceRoot = '/repo';
    appState.workspaceSearchQuery = 'target';
    appState.workspaceSearchResults = [
      {
        path: '/repo/app.ts',
        matches: [{ line: 8, column: 4, text: 'target', matchStart: 3, matchEnd: 9 }],
      },
    ];
    appState.fileLoadError = {
      selection: { path: '/repo/app.ts', isBinary: false, line: 8, column: 4 },
      message: 'Permission denied',
    };
    const selectFile = vi.fn(async () => false);
    render(<WorkspaceSearchPanel actions={{ selectFile } as unknown as WorkspaceActions} onClose={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('无法打开 app.ts');
    fireEvent.click(screen.getByRole('button', { name: '重试打开' }));
    expect(selectFile).toHaveBeenCalledWith({ path: '/repo/app.ts', isBinary: false, line: 8, column: 4 });
  });

  it('detects external file changes before saving and preserves both versions', async () => {
    const tab = setOpenFileTab('/repo/app.ts', 'original', 'local edit');
    appState.fileConflict = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 200, data: { path: '/repo/app.ts', content: 'external edit' } }), {
            status: 200,
          })
      )
    );
    const hook = renderHook(() => useWorkspaceController());
    await act(() => hook.result.current.saveEditorTab(tab.id));
    expect(appState.fileConflict).toEqual({
      tabId: tab.id,
      path: '/repo/app.ts',
      diskContent: 'external edit',
    });
    expect(activeFileTab()?.draft).toBe('local edit');
    await act(() => hook.result.current.resolveFileConflict('reload'));
    expect(activeFileTab()?.content).toBe('external edit');
    expect(activeFileTab()?.draft).toBe('external edit');
    hook.unmount();
  });

  it('does not discard a dirty draft when the same file is selected again', async () => {
    setOpenFileTab('/repo/app.ts', 'saved', 'local edit');
    const readFile = vi.spyOn(codeApi, 'readFile');
    const hook = renderHook(() => useWorkspaceController());
    await act(() => hook.result.current.selectFile({ path: '/repo/app.ts', isBinary: false, line: 3, column: 2 }));
    expect(readFile).not.toHaveBeenCalled();
    expect(activeFileTab()?.draft).toBe('local edit');
    expect(activeFileTab()?.location).toEqual({ line: 3, column: 2 });
    hook.unmount();
  });

  it('rebases the open file and conflict state when a parent directory is renamed', async () => {
    const tab = setOpenFileTab('/repo/src/app.ts', 'saved', 'saved', { line: 2, column: 1 });
    appState.fileConflict = { tabId: tab.id, path: '/repo/src/app.ts', diskContent: 'external' };
    vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());
    await act(() => hook.result.current.renameWorkspaceEntry('/repo/src', 'lib'));
    expect(activeFileTab()?.path).toBe('/repo/lib/app.ts');
    expect(activeFileTab()?.location).toEqual({ line: 2, column: 1 });
    expect(appState.activeEditorTabId).toBe(fileEditorTabId('/repo/lib/app.ts'));
    expect(appState.fileConflict?.path).toBe('/repo/lib/app.ts');
    hook.unmount();
  });

  it('returns a reviewed file to the same task as explicit context', () => {
    appState.workspaceRoot = '/repo';
    appState.reviewIntent = 'select-context';
    appState.taskView = 'review';
    setOpenFileTab('/repo/src/app.ts', 'export const app = true;');
    appState.composerContextFiles = [];

    render(<WorkspaceEditor actions={{} as WorkspaceActions} />);
    expect(screen.getByRole('textbox', { name: '编辑 app.ts' })).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: '添加并返回任务' }));

    expect(appState.composerContextFiles).toEqual(['src/app.ts']);
    expect(appState.reviewIntent).toBe('review');
    expect(appState.taskView).toBe('conversation');
  });

  it('places the editor caret at the selected search match', () => {
    appState.reviewIntent = 'review';
    setOpenFileTab('/repo/app.ts', 'one\ntarget', 'one\ntarget', { line: 2, column: 2 });

    render(<WorkspaceEditor actions={{} as WorkspaceActions} />);
    const editor = screen.getByRole('textbox', { name: '编辑 app.ts' }) as HTMLTextAreaElement;
    expect(editor).toHaveFocus();
    expect(editor.selectionStart).toBe(5);
  });

  it('never exposes a binary file as editable text', () => {
    appState.reviewIntent = 'review';
    setOpenFileTab('/repo/image.png', '', '', null, true);

    render(<WorkspaceEditor actions={{} as WorkspaceActions} />);
    expect(screen.getByText('二进制文件仅供识别')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '编辑 image.png' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存文件' })).not.toBeInTheDocument();
  });

  it('invalidates configuration evidence as soon as the file changes', async () => {
    appState.reviewIntent = 'review';
    const tab = setOpenFileTab('/repo/config.acl', 'valid config');
    tab.configValidation = { valid: true, issues: [] };

    const updateEditorDraft = (tabId: string, content: string) => {
      const current = appState.editorTabs.find((candidate) => candidate.id === tabId);
      if (current?.kind !== 'file') return;
      current.draft = content;
      current.configValidation = null;
    };
    render(<WorkspaceEditor actions={{ updateEditorDraft } as WorkspaceActions} />);
    expect(screen.getByText('配置有效')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '编辑 config.acl' }), {
      target: { value: 'changed config' },
    });
    expect(activeFileTab()?.configValidation).toBeNull();
    await waitFor(() => expect(screen.queryByText('配置有效')).not.toBeInTheDocument());
  });

  it('returns configuration failures to the same task with evidence and file context', () => {
    const task = {
      sessionId: 'task-config',
      workspace: '/repo',
      cwd: '/repo',
      model: 'codex/gpt',
      followDefaultModel: false,
      permissionMode: 'default',
      state: 'connected',
      title: 'Repair config',
      createdAt: 1,
    };
    appState.sessions = [task];
    appState.activeSessionId = task.sessionId;
    appState.reviewSourceTaskId = task.sessionId;
    appState.reviewIntent = 'review';
    appState.taskView = 'review';
    appState.workspaceRoot = '/repo';
    const tab = setOpenFileTab('/repo/config.acl', 'broken config');
    tab.configValidation = { valid: false, issues: ['Missing default model'] };
    appState.composerValue = 'Keep this draft';
    appState.composerContextFiles = [];

    render(<WorkspaceEditor actions={{} as WorkspaceActions} />);
    fireEvent.click(screen.getByRole('button', { name: '添加修复指令并返回' }));

    expect(appState.activeSessionId).toBe(task.sessionId);
    expect(appState.taskView).toBe('conversation');
    expect(appState.composerValue).toContain('Keep this draft');
    expect(appState.composerValue).toContain('Missing default model');
    expect(appState.composerContextFiles).toEqual(['config.acl']);
  });

  it('keeps Git changes reachable from compact desktop review', () => {
    appState.workspaceRoot = '/repo';
    appState.filesByDirectory = { '/repo': [] };
    appState.gitStatusLoading = false;
    appState.gitStatus = { isGitRepo: true, branch: 'main', files: [] };
    const actions = { refreshGitStatus: vi.fn() } as unknown as WorkspaceActions;

    render(<WorkspacePage actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: '工作区变更' }));
    expect(screen.getByRole('complementary', { name: '变更与 Git' })).toHaveClass('compact-open');
    expect(screen.getByRole('complementary', { name: '变更与 Git' }).closest('.workspace-page')).toHaveClass(
      'changes-open'
    );
    expect(screen.queryByRole('button', { name: '工作区变更' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭工作区变更' }));
    expect(screen.getByRole('complementary', { name: '变更与 Git' })).not.toHaveClass('compact-open');
    expect(screen.getByRole('button', { name: '工作区变更' })).toBeInTheDocument();
  });
});

function setOpenFileTab(
  path: string,
  content: string,
  draft = content,
  location: { line: number; column: number } | null = null,
  isBinary = false
): WorkspaceFileEditorTab {
  const tab: WorkspaceFileEditorTab = {
    id: fileEditorTabId(path),
    kind: 'file',
    path,
    content,
    draft,
    isBinary,
    location,
    loading: false,
    loadError: null,
    saving: false,
    configValidation: null,
  };
  appState.editorTabs = [tab];
  appState.activeEditorTabId = tab.id;
  return appState.editorTabs[0] as WorkspaceFileEditorTab;
}

function activeFileTab(): WorkspaceFileEditorTab | null {
  const tab = appState.editorTabs.find((candidate) => candidate.id === appState.activeEditorTabId);
  return tab?.kind === 'file' ? tab : null;
}
