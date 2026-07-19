import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, codeApi } from '../../../lib/api';
import { appState, switchActiveTask } from '../../../state/app-state';
import { WorkspacePage } from '../../code/pages/workspace-page';
import { useWorkspaceController } from '../use-workspace-controller';
import type { WorkspaceActions } from '../workspace-actions';
import { DEFAULT_WORKSPACE_SEARCH_EXCLUDE_PATTERN } from '../workspace-search';
import { fileEditorTabId, type WorkspaceFileEditorTab } from '../workspace-state';
import { clearWorkspaceEditorModels, workspaceEditorModelPath } from './monaco-editor-model-store';
import { WorkspaceEditor } from './workspace-editor';
import { WorkspaceExplorer } from './workspace-explorer';
import { WorkspaceSearchPanel } from './workspace-search-panel';

describe('Workspace review flow', () => {
  afterEach(() => {
    cleanup();
    appState.fileLoadError = null;
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    appState.pendingEditorTabCloseId = null;
    appState.fileConflict = null;
    appState.workspaceSearchResults = [];
    appState.workspaceSearchQuery = '';
    appState.workspaceSearchScope = 'source';
    appState.workspaceSearchResultScope = null;
    appState.workspaceSearchResultRoot = null;
    appState.workspaceSearchResultsTruncated = false;
    appState.workspaceSearchLoading = false;
    appState.workspaceSearchError = null;
    appState.workspaceReplaceLoading = false;
    appState.filesByDirectory = {};
    appState.expandedDirectories = {};
    appState.directoryLoading = {};
    appState.directoryErrors = {};
    appState.workspaceSnapshotsByTask = {};
    appState.workspaceGeneration = 0;
    appState.activeSessionId = null;
    appState.sessions = [];
    appState.draftsByTask = {};
    clearWorkspaceEditorModels();
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

  it('opens binary metadata without requesting text content', async () => {
    const readFile = vi.spyOn(codeApi, 'readFile');
    const hook = renderHook(() => useWorkspaceController());

    await act(() => hook.result.current.selectFile({ path: '/repo/logo.png', isBinary: true }));

    expect(readFile).not.toHaveBeenCalled();
    expect(activeFileTab()).toMatchObject({
      path: '/repo/logo.png',
      isBinary: true,
      loading: false,
      loadError: null,
    });
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

  it('closes a tab group in order without skipping dirty-file decisions', () => {
    const first = setOpenFileTab('/repo/first.ts', 'saved', 'first draft');
    const clean: WorkspaceFileEditorTab = {
      ...first,
      id: fileEditorTabId('/repo/clean.ts'),
      path: '/repo/clean.ts',
      content: 'clean',
      draft: 'clean',
    };
    const last: WorkspaceFileEditorTab = {
      ...first,
      id: fileEditorTabId('/repo/last.ts'),
      path: '/repo/last.ts',
      content: 'saved',
      draft: 'last draft',
    };
    appState.editorTabs = [first, clean, last];
    appState.activeEditorTabId = first.id;
    const hook = renderHook(() => useWorkspaceController());

    act(() => hook.result.current.closeEditorTabs(appState.editorTabs.map((tab) => tab.id)));

    expect(appState.editorTabs.map((tab) => tab.id)).toEqual([first.id, last.id]);
    expect(appState.pendingEditorTabCloseId).toBe(first.id);

    act(() => hook.result.current.confirmEditorTabClose());
    expect(appState.editorTabs.map((tab) => tab.id)).toEqual([last.id]);
    expect(appState.pendingEditorTabCloseId).toBe(last.id);

    act(() => hook.result.current.cancelEditorTabClose());
    expect(appState.editorTabs.map((tab) => tab.id)).toEqual([last.id]);
    expect(appState.pendingEditorTabCloseId).toBeNull();
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
    appState.workspaceSearchResultScope = 'source';
    appState.workspaceSearchResultRoot = '/repo';
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
    appState.workspaceSearchResultScope = 'source';
    appState.workspaceSearchResultRoot = '/repo';
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
    expect(searchWorkspace).toHaveBeenCalledWith('target', { scope: 'source' });
  });

  it('searches the source scope by default', () => {
    appState.workspaceRoot = '/repo';
    const searchWorkspace = vi.fn(async () => undefined);

    render(<WorkspaceSearchPanel actions={{ searchWorkspace } as unknown as WorkspaceActions} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: '全局搜索内容' }), { target: { value: 'target' } });
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));

    expect(searchWorkspace).toHaveBeenCalledWith('target', { scope: 'source' });
    expect(screen.getByRole('checkbox', { name: '包含依赖与构建目录' })).not.toBeChecked();
  });

  it('reruns the current query when dependency and build directories are included', () => {
    appState.workspaceRoot = '/repo';
    appState.workspaceSearchQuery = 'target';
    appState.workspaceSearchScope = 'source';
    appState.workspaceSearchResultScope = 'source';
    appState.workspaceSearchResultRoot = '/repo';
    appState.workspaceSearchResults = [
      {
        path: '/repo/src/app.ts',
        matches: [{ line: 1, column: 1, text: 'target', matchStart: 0, matchEnd: 6 }],
      },
    ];
    const searchWorkspace = vi.fn(async () => undefined);

    render(<WorkspaceSearchPanel actions={{ searchWorkspace } as unknown as WorkspaceActions} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: '包含依赖与构建目录' }));

    expect(searchWorkspace).toHaveBeenCalledWith('target', { scope: 'all' });
    expect(screen.getByRole('button', { name: '替换全部' })).toBeDisabled();
    expect(screen.getByText('搜索范围已变化；重新搜索后才能替换。')).toBeInTheDocument();
  });

  it('does not offer replacement when the displayed results reached the safety limit', () => {
    appState.workspaceRoot = '/repo';
    appState.workspaceSearchQuery = 'target';
    appState.workspaceSearchResultScope = 'source';
    appState.workspaceSearchResultRoot = '/repo';
    appState.workspaceSearchResultsTruncated = true;
    appState.workspaceSearchResults = [
      {
        path: '/repo/src/app.ts',
        matches: [{ line: 1, column: 1, text: 'target', matchStart: 0, matchEnd: 6 }],
      },
    ];

    render(<WorkspaceSearchPanel actions={{} as WorkspaceActions} onClose={vi.fn()} />);

    expect(screen.getByText('结果超过 300 处；请缩小搜索范围后再替换。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '替换全部' })).toBeDisabled();
  });

  it('preserves the selected search scope when the panel is reopened', async () => {
    appState.workspaceRoot = '/repo';
    const searchWorkspace = vi.fn(async (_query: string, options: { scope: 'source' | 'all' }) => {
      appState.workspaceSearchScope = options.scope;
    });
    const actions = { searchWorkspace } as unknown as WorkspaceActions;
    const first = render(<WorkspaceSearchPanel actions={actions} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: '包含依赖与构建目录' }));
    await waitFor(() => expect(appState.workspaceSearchScope).toBe('all'));
    first.unmount();
    render(<WorkspaceSearchPanel actions={actions} onClose={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: '包含依赖与构建目录' })).toBeChecked();
  });

  it('blocks workspace replacement when the reviewed scope contains unsaved edits', () => {
    appState.workspaceRoot = '/repo';
    appState.workspaceSearchQuery = 'oldValue';
    appState.workspaceSearchLoading = false;
    appState.workspaceSearchResultScope = 'source';
    appState.workspaceSearchResultRoot = '/repo';
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
    expect(screen.getByText('target', { selector: 'mark' })).toBeInTheDocument();
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
    tab.revision = 'sha256:original';
    appState.fileConflict = null;
    const writeFile = vi.spyOn(codeApi, 'writeFile').mockRejectedValue(new ApiError('file changed', 412));
    const readFile = vi
      .spyOn(codeApi, 'readFile')
      .mockResolvedValue({ content: 'external edit', revision: 'sha256:external' });
    const hook = renderHook(() => useWorkspaceController());
    await act(() => hook.result.current.saveEditorTab(tab.id));
    expect(writeFile).toHaveBeenCalledWith('/repo/app.ts', 'local edit', {
      expectedRevision: 'sha256:original',
    });
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(writeFile.mock.invocationCallOrder[0]).toBeLessThan(readFile.mock.invocationCallOrder[0]);
    expect(appState.fileConflict).toEqual({
      tabId: tab.id,
      path: '/repo/app.ts',
      diskContent: 'external edit',
      diskRevision: 'sha256:external',
    });
    expect(activeFileTab()?.draft).toBe('local edit');
    await act(() => hook.result.current.resolveFileConflict('reload'));
    expect(activeFileTab()?.content).toBe('external edit');
    expect(activeFileTab()?.draft).toBe('external edit');
    expect(activeFileTab()?.revision).toBe('sha256:external');
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

  it('excludes dependency and build directories from workspace search by default', async () => {
    appState.workspaceRoot = '/repo';
    const searchWorkspace = vi.spyOn(codeApi, 'searchWorkspace').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());

    await act(() => hook.result.current.searchWorkspace(' target ', { scope: 'source' }));

    expect(searchWorkspace).toHaveBeenCalledWith('/repo', 'target', {
      excludePattern: DEFAULT_WORKSPACE_SEARCH_EXCLUDE_PATTERN,
      maxResults: 301,
    });
    expect(appState.workspaceSearchQuery).toBe('target');
    expect(appState.workspaceSearchScope).toBe('source');
    expect(appState.workspaceSearchResultScope).toBe('source');
    expect(appState.workspaceSearchResultRoot).toBe('/repo');
    hook.unmount();
  });

  it('can deliberately search dependency and build directories', async () => {
    appState.workspaceRoot = '/repo';
    const searchWorkspace = vi.spyOn(codeApi, 'searchWorkspace').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());

    await act(() => hook.result.current.searchWorkspace('target', { scope: 'all' }));

    expect(searchWorkspace).toHaveBeenCalledWith('/repo', 'target', { maxResults: 301 });
    expect(appState.workspaceSearchScope).toBe('all');
    expect(appState.workspaceSearchResultScope).toBe('all');
    hook.unmount();
  });

  it('keeps one overflow match only as a replacement-safety signal', async () => {
    appState.workspaceRoot = '/repo';
    const matches = Array.from({ length: 301 }, (_, index) => ({
      line: index + 1,
      column: 1,
      text: 'target',
      matchStart: 0,
      matchEnd: 6,
    }));
    vi.spyOn(codeApi, 'searchWorkspace').mockResolvedValue([{ path: '/repo/src/app.ts', matches }]);
    const hook = renderHook(() => useWorkspaceController());

    await act(() => hook.result.current.searchWorkspace('target', { scope: 'source' }));

    expect(appState.workspaceSearchResults[0]?.matches).toHaveLength(300);
    expect(appState.workspaceSearchResultsTruncated).toBe(true);
    hook.unmount();
  });

  it('keeps the latest search scope when an older request finishes last', async () => {
    appState.workspaceRoot = '/repo';
    type SearchResults = Awaited<ReturnType<typeof codeApi.searchWorkspace>>;
    let resolveSource!: (results: SearchResults) => void;
    let resolveAll!: (results: SearchResults) => void;
    const sourceResponse = new Promise<SearchResults>((resolve) => {
      resolveSource = resolve;
    });
    const allResponse = new Promise<SearchResults>((resolve) => {
      resolveAll = resolve;
    });
    vi.spyOn(codeApi, 'searchWorkspace').mockImplementation((_root, _query, options) =>
      options?.excludePattern ? sourceResponse : allResponse
    );
    const hook = renderHook(() => useWorkspaceController());

    const sourceRequest = hook.result.current.searchWorkspace('target', { scope: 'source' });
    const allRequest = hook.result.current.searchWorkspace('target', { scope: 'all' });
    await act(async () => {
      resolveAll([
        {
          path: '/repo/node_modules/pkg/index.ts',
          matches: [{ line: 1, column: 1, text: 'target', matchStart: 0, matchEnd: 6 }],
        },
      ]);
      await allRequest;
    });
    await act(async () => {
      resolveSource([
        {
          path: '/repo/src/app.ts',
          matches: [{ line: 2, column: 1, text: 'target', matchStart: 0, matchEnd: 6 }],
        },
      ]);
      await sourceRequest;
    });

    expect(appState.workspaceSearchResultScope).toBe('all');
    expect(appState.workspaceSearchResults.map((result) => result.path)).toEqual(['/repo/node_modules/pkg/index.ts']);
    hook.unmount();
  });

  it('walks backward and forward through file locations without reloading open drafts', async () => {
    appState.workspaceRoot = '/repo';
    const source = setOpenFileTab('/repo/source.ts', 'source saved', 'source draft');
    const readFile = vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: 'target saved' });
    const hook = renderHook(() => useWorkspaceController());

    expect(hook.result.current.canNavigateEditorBack).toBe(false);
    expect(hook.result.current.canNavigateEditorForward).toBe(false);
    act(() => hook.result.current.updateEditorPosition(source.id, { line: 4, column: 7 }));
    await act(() => hook.result.current.selectFile({ path: '/repo/target.ts', isBinary: false, line: 12, column: 4 }));

    expect(hook.result.current.canNavigateEditorBack).toBe(true);
    expect(hook.result.current.canNavigateEditorForward).toBe(false);
    act(() => hook.result.current.updateEditorPosition(fileEditorTabId('/repo/target.ts'), { line: 12, column: 4 }));
    await act(() => hook.result.current.navigateEditorBack());

    expect(activeFileTab()?.path).toBe('/repo/source.ts');
    expect(activeFileTab()?.draft).toBe('source draft');
    expect(activeFileTab()?.location).toEqual({ line: 4, column: 7 });
    expect(hook.result.current.canNavigateEditorBack).toBe(false);
    expect(hook.result.current.canNavigateEditorForward).toBe(true);

    await act(() => hook.result.current.navigateEditorForward());

    expect(activeFileTab()?.path).toBe('/repo/target.ts');
    expect(activeFileTab()?.location).toEqual({ line: 12, column: 4 });
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(hook.result.current.canNavigateEditorBack).toBe(true);
    expect(hook.result.current.canNavigateEditorForward).toBe(false);
    hook.unmount();
  });

  it('does not add a navigation entry when the active file is selected without a target location', async () => {
    appState.workspaceRoot = '/repo';
    const tab = setOpenFileTab('/repo/app.ts', 'saved');
    const hook = renderHook(() => useWorkspaceController());
    act(() => hook.result.current.updateEditorPosition(tab.id, { line: 3, column: 2 }));

    await act(() => hook.result.current.selectFile({ path: '/repo/app.ts', isBinary: false }));

    expect(hook.result.current.canNavigateEditorBack).toBe(false);
    expect(hook.result.current.canNavigateEditorForward).toBe(false);
    hook.unmount();
  });

  it('starts a new location branch after going back', async () => {
    appState.workspaceRoot = '/repo';
    const source = setOpenFileTab('/repo/source.ts', 'source');
    vi.spyOn(codeApi, 'readFile').mockImplementation(async (path) => ({ content: `content for ${path}` }));
    const hook = renderHook(() => useWorkspaceController());
    act(() => hook.result.current.updateEditorPosition(source.id, { line: 2, column: 3 }));
    await act(() => hook.result.current.selectFile({ path: '/repo/first-target.ts', isBinary: false }));
    await act(() => hook.result.current.navigateEditorBack());

    expect(hook.result.current.canNavigateEditorForward).toBe(true);
    await act(() => hook.result.current.selectFile({ path: '/repo/new-target.ts', isBinary: false }));

    expect(activeFileTab()?.path).toBe('/repo/new-target.ts');
    expect(hook.result.current.canNavigateEditorBack).toBe(true);
    expect(hook.result.current.canNavigateEditorForward).toBe(false);
    hook.unmount();
  });

  it('clears editor location history when the workspace changes', async () => {
    appState.workspaceRoot = '/repo';
    setOpenFileTab('/repo/source.ts', 'source');
    vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: 'target' });
    const hook = renderHook(() => useWorkspaceController());
    await act(() => hook.result.current.selectFile({ path: '/repo/target.ts', isBinary: false }));
    expect(hook.result.current.canNavigateEditorBack).toBe(true);

    act(() => {
      appState.workspaceRoot = '/other';
    });

    await waitFor(() => expect(hook.result.current.canNavigateEditorBack).toBe(false));
    expect(hook.result.current.canNavigateEditorForward).toBe(false);
    hook.unmount();
  });

  it('clears editor location history when switching between tasks in the same workspace', async () => {
    appState.sessions = [taskSession('task-a', '/repo'), taskSession('task-b', '/repo')];
    appState.activeSessionId = 'task-a';
    appState.workspaceRoot = '/repo';
    setOpenFileTab('/repo/source.ts', 'source');
    vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: 'target' });
    const hook = renderHook(() => useWorkspaceController());
    await act(() => hook.result.current.selectFile({ path: '/repo/target.ts', isBinary: false }));
    expect(hook.result.current.canNavigateEditorBack).toBe(true);

    act(() => {
      switchActiveTask('task-b');
    });

    await waitFor(() => expect(hook.result.current.canNavigateEditorBack).toBe(false));
    expect(hook.result.current.canNavigateEditorForward).toBe(false);
    hook.unmount();
  });

  it('drops an unreadable closed history target without replacing the active editor', async () => {
    appState.workspaceRoot = '/repo';
    const source = setOpenFileTab('/repo/source.ts', 'source');
    const readFile = vi.spyOn(codeApi, 'readFile').mockResolvedValueOnce({ content: 'target' });
    const hook = renderHook(() => useWorkspaceController());
    act(() => hook.result.current.updateEditorPosition(source.id, { line: 2, column: 3 }));
    await act(() => hook.result.current.selectFile({ path: '/repo/target.ts', isBinary: false }));
    act(() => hook.result.current.closeEditorTab(source.id));
    readFile.mockRejectedValueOnce(new Error('missing'));

    await act(() => hook.result.current.navigateEditorBack());

    expect(activeFileTab()?.path).toBe('/repo/target.ts');
    expect(hook.result.current.canNavigateEditorBack).toBe(false);
    expect(hook.result.current.canNavigateEditorForward).toBe(false);
    hook.unmount();
  });

  it('rebases the open file and conflict state when a parent directory is renamed', async () => {
    appState.editorModelScope = 'rename-scope';
    const tab = setOpenFileTab('/repo/src/app.ts', 'saved', 'saved', { line: 2, column: 1 });
    const modelPath = workspaceEditorModelPath(appState.editorModelScope, tab.path);
    appState.fileConflict = {
      tabId: tab.id,
      path: '/repo/src/app.ts',
      diskContent: 'external',
      diskRevision: null,
    };
    vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());
    await act(() => hook.result.current.renameWorkspaceEntry('/repo/src', 'lib'));
    expect(activeFileTab()?.path).toBe('/repo/lib/app.ts');
    expect(activeFileTab()?.location).toEqual({ line: 2, column: 1 });
    expect(appState.activeEditorTabId).toBe(fileEditorTabId('/repo/lib/app.ts'));
    expect(appState.fileConflict?.path).toBe('/repo/lib/app.ts');
    expect(workspaceEditorModelPath(appState.editorModelScope, '/repo/lib/app.ts')).toBe(modelPath);
    hook.unmount();
  });

  it('rebases saved navigation locations when a parent directory is renamed', async () => {
    appState.workspaceRoot = '/repo';
    const source = setOpenFileTab('/repo/src/source.ts', 'source');
    vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: 'target' });
    vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());
    act(() => hook.result.current.updateEditorPosition(source.id, { line: 6, column: 5 }));
    await act(() => hook.result.current.selectFile({ path: '/repo/target.ts', isBinary: false }));

    await act(() => hook.result.current.renameWorkspaceEntry('/repo/src', 'lib'));
    await act(() => hook.result.current.navigateEditorBack());

    expect(activeFileTab()?.path).toBe('/repo/lib/source.ts');
    expect(activeFileTab()?.location).toEqual({ line: 6, column: 5 });
    hook.unmount();
  });

  it('prunes deleted paths from editor location history', async () => {
    appState.workspaceRoot = '/repo';
    const source = setOpenFileTab('/repo/source.ts', 'source');
    vi.spyOn(codeApi, 'readFile').mockImplementation(async (path) => ({ content: `content for ${path}` }));
    vi.spyOn(codeApi, 'deletePath').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const hook = renderHook(() => useWorkspaceController());
    act(() => hook.result.current.updateEditorPosition(source.id, { line: 3, column: 4 }));
    await act(() => hook.result.current.selectFile({ path: '/repo/deleted/target.ts', isBinary: false }));
    await act(() => hook.result.current.selectFile({ path: '/repo/current.ts', isBinary: false }));

    await act(() => hook.result.current.deleteWorkspaceEntry('/repo/deleted'));
    await act(() => hook.result.current.navigateEditorBack());

    expect(activeFileTab()?.path).toBe('/repo/source.ts');
    expect(activeFileTab()?.location).toEqual({ line: 3, column: 4 });
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
    const consumeEditorLocation = (tabId: string) => {
      const tab = appState.editorTabs.find((candidate) => candidate.id === tabId);
      if (tab?.kind === 'file') tab.location = null;
    };

    render(<WorkspaceEditor actions={{ consumeEditorLocation } as WorkspaceActions} />);
    const editor = screen.getByRole('textbox', { name: '编辑 app.ts' }) as HTMLTextAreaElement;
    expect(editor).toHaveFocus();
    expect(editor.selectionStart).toBe(5);
    expect(activeFileTab()?.location).toBeNull();
  });

  it('exposes saved-document code navigation from the file toolbar', async () => {
    appState.reviewIntent = 'review';
    appState.workspaceRoot = '/repo';
    setOpenFileTab('/repo/src/app.ts', 'export const value = target;');
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
      workspaceRevision: 2,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });
    const navigate = vi.spyOn(codeApi, 'codeNavigation').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });

    render(
      <WorkspaceEditor
        actions={
          {
            selectFile: vi.fn(async () => true),
            updateEditorDraft: vi.fn(),
          } as unknown as WorkspaceActions
        }
      />
    );

    const trigger = await screen.findByRole('button', { name: '代码导航' });
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu', { name: '代码导航' });
    expect(within(menu).getByRole('menuitem', { name: /转到定义/ })).toHaveTextContent('F12');
    expect(within(menu).getByRole('menuitem', { name: /转到声明/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /查找引用/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /转到实现/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /文件符号大纲/ })).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: /转到定义/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('src/app.ts', 0, 0, 'definition', expect.any(Object)));
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
    revision: null,
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

function taskSession(sessionId: string, workspace: string) {
  return {
    sessionId,
    workspace,
    cwd: workspace,
    model: 'codex/gpt',
    followDefaultModel: false,
    permissionMode: 'default',
    state: 'idle',
    createdAt: 1,
  };
}
