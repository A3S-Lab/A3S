import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../lib/api';
import type { WorkspaceEntry } from '../../types/api';
import { useWorkFilesController } from './use-work-files-controller';
import { readWorkLocalFileBinding, saveWorkLocalFileBinding } from './work-local-file-binding';

const folder: WorkspaceEntry = {
  name: 'Reports',
  path: '/docs/Reports',
  isDirectory: true,
  isFile: false,
  size: 0,
  mtimeMs: 10,
  extension: null,
  isBinary: false,
};

const report: WorkspaceEntry = {
  name: 'Plan.docx',
  path: '/docs/Plan.docx',
  isDirectory: false,
  isFile: true,
  size: 10,
  mtimeMs: 11,
  extension: 'docx',
  isBinary: false,
};

const archive: WorkspaceEntry = {
  name: 'Archive',
  path: '/docs/Archive',
  isDirectory: true,
  isFile: false,
  size: 0,
  mtimeMs: 12,
  extension: null,
  isBinary: false,
};

describe('Work local file controller', () => {
  beforeEach(() => {
    localStorage.removeItem('a3s-work.local-files');
    localStorage.removeItem('a3s-work.local-file-bindings.v1');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('uses the A3S Code default workspace until the user chooses a Work override', async () => {
    const readDir = vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const { result, rerender } = renderHook(({ defaultRoot }) => useWorkFilesController(defaultRoot), {
      initialProps: { defaultRoot: '/code-default' },
    });

    await waitFor(() => expect(readDir).toHaveBeenCalledWith('/code-default'));
    expect(result.current.rootPath).toBe('/code-default');
    expect(result.current.currentPath).toBe('/code-default');
    expect(JSON.parse(localStorage.getItem('a3s-work.local-files') ?? '{}')).toMatchObject({
      rootPath: '/code-default',
      rootSource: 'default',
    });

    rerender({ defaultRoot: '/next-code-default' });
    await waitFor(() => expect(result.current.rootPath).toBe('/next-code-default'));
    expect(readDir).toHaveBeenCalledWith('/next-code-default');
  });

  it('keeps a user-selected Work workspace when the Code default changes', async () => {
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    const pickWorkspaceDirectory = vi
      .spyOn(codeApi, 'pickWorkspaceDirectory')
      .mockResolvedValue({ cancelled: false, path: '/work-choice' });
    const { result, rerender } = renderHook(({ defaultRoot }) => useWorkFilesController(defaultRoot), {
      initialProps: { defaultRoot: '/code-default' },
    });

    await act(async () => {
      await result.current.pickRoot();
    });
    expect(pickWorkspaceDirectory).toHaveBeenCalledWith('/code-default');
    expect(result.current.rootPath).toBe('/work-choice');

    rerender({ defaultRoot: '/next-code-default' });
    await waitFor(() => expect(result.current.rootPath).toBe('/work-choice'));
    expect(JSON.parse(localStorage.getItem('a3s-work.local-files') ?? '{}')).toMatchObject({
      rootPath: '/work-choice',
      rootSource: 'user',
    });
    expect(result.current.recentRootPaths).toEqual(['/work-choice', '/code-default']);
  });

  it('switches among recent Work workspaces without replacing the current root on failure', async () => {
    localStorage.setItem(
      'a3s-work.local-files',
      JSON.stringify({
        rootPath: '/docs',
        rootSource: 'user',
        recentRootPaths: ['/docs', '/archive'],
        currentPath: '/docs',
        layout: 'grid',
        sort: { key: 'name', direction: 'ascending' },
      })
    );
    const readDir = vi.spyOn(codeApi, 'readDir').mockImplementation(async (path) => {
      if (path === '/missing') throw new Error('not found');
      return [];
    });
    const { result } = renderHook(() => useWorkFilesController());
    await waitFor(() => expect(readDir).toHaveBeenCalledWith('/docs'));

    await act(async () => {
      expect(await result.current.selectRoot('/archive')).toBe('/archive');
    });
    await waitFor(() => expect(result.current.rootPath).toBe('/archive'));
    expect(result.current.recentRootPaths).toEqual(['/archive', '/docs']);

    await act(async () => {
      expect(await result.current.selectRoot('/missing')).toBeNull();
    });
    expect(result.current.rootPath).toBe('/archive');
    expect(result.current.recentRootPaths).toEqual(['/archive', '/docs']);
  });

  it('persists a picked root and maintains Finder-style navigation history', async () => {
    vi.spyOn(codeApi, 'pickWorkspaceDirectory').mockResolvedValue({ cancelled: false, path: '/docs' });
    vi.spyOn(codeApi, 'readDir').mockImplementation(async (path) => (path === '/docs' ? [folder] : []));
    const { result } = renderHook(() => useWorkFilesController());

    await act(async () => {
      await result.current.pickRoot();
    });
    await waitFor(() => expect(result.current.visibleEntries).toEqual([folder]));
    expect(result.current.rootPath).toBe('/docs');

    act(() => result.current.navigateTo('/docs/Reports'));
    await waitFor(() => expect(result.current.currentPath).toBe('/docs/Reports'));
    expect(result.current.canGoBack).toBe(true);

    act(() => result.current.goBack());
    expect(result.current.currentPath).toBe('/docs');
    act(() => result.current.goForward());
    expect(result.current.currentPath).toBe('/docs/Reports');

    const stored = JSON.parse(localStorage.getItem('a3s-work.local-files') ?? '{}');
    expect(stored.rootPath).toBe('/docs');
  });

  it('switches from current-folder filtering to bounded whole-workspace search', async () => {
    localStorage.setItem(
      'a3s-work.local-files',
      JSON.stringify({
        rootPath: '/docs',
        currentPath: '/docs',
        layout: 'grid',
        sort: { key: 'name', direction: 'ascending' },
      })
    );
    const budget = {
      ...report,
      name: 'Budget.xlsx',
      path: '/docs/Reports/Budget.xlsx',
      extension: 'xlsx',
    };
    vi.spyOn(codeApi, 'readDir').mockImplementation(async (path) => {
      if (path === '/docs') return [folder, report];
      if (path === '/docs/Reports') return [budget];
      return [];
    });
    const { result } = renderHook(() => useWorkFilesController());
    await waitFor(() => expect(result.current.visibleEntries).toEqual([folder, report]));

    act(() => result.current.setQuery('budget'));
    expect(result.current.visibleEntries).toEqual([]);

    act(() => result.current.setSearchScope('workspace'));
    await waitFor(() => expect(result.current.visibleEntries).toEqual([budget]));
    expect(JSON.parse(localStorage.getItem('a3s-work.local-files') ?? '{}').searchScope).toBe('workspace');

    act(() => result.current.navigateTo('/docs/Reports'));
    expect(result.current.query).toBe('');
    await waitFor(() => expect(result.current.visibleEntries).toEqual([budget]));
  });

  it('creates and renames real filesystem entries before refreshing the directory', async () => {
    localStorage.setItem(
      'a3s-work.local-files',
      JSON.stringify({
        rootPath: '/docs',
        currentPath: '/docs',
        layout: 'grid',
        sort: { key: 'name', direction: 'ascending' },
      })
    );
    const readDir = vi.spyOn(codeApi, 'readDir').mockResolvedValue([folder]);
    const createDirectory = vi.spyOn(codeApi, 'createDirectory').mockResolvedValue({ success: true });
    const renamePath = vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    saveWorkLocalFileBinding({
      artifactId: 'artifact-report',
      path: '/docs/Reports/Plan.docx',
      fingerprint: 'sha256:plan',
      size: 10,
      updatedAt: Date.now(),
    });
    const { result } = renderHook(() => useWorkFilesController());
    await waitFor(() => expect(readDir).toHaveBeenCalledWith('/docs'));

    await act(async () => {
      await result.current.createFolder('Ideas');
    });
    expect(createDirectory).toHaveBeenCalledWith('/docs/Ideas');

    await act(async () => {
      await result.current.renameEntry(folder, 'Research');
    });
    expect(renamePath).toHaveBeenCalledWith('/docs/Reports', '/docs/Research');
    expect(readWorkLocalFileBinding('artifact-report')?.path).toBe('/docs/Research/Plan.docx');
    expect(readDir.mock.calls.filter(([path]) => path === '/docs').length).toBeGreaterThanOrEqual(3);
  });

  it('permanently deletes confirmed entries and clears related local state', async () => {
    localStorage.setItem(
      'a3s-work.local-files',
      JSON.stringify({
        rootPath: '/docs',
        currentPath: '/docs',
        favoritePaths: ['/docs/Reports'],
        layout: 'grid',
        sort: { key: 'name', direction: 'ascending' },
      })
    );
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([folder, report]);
    const deletePath = vi.spyOn(codeApi, 'deletePath').mockResolvedValue({ success: true });
    saveWorkLocalFileBinding({
      artifactId: 'artifact-report',
      path: '/docs/Reports/Plan.docx',
      fingerprint: 'sha256:plan',
      size: 10,
      updatedAt: Date.now(),
    });
    const { result } = renderHook(() => useWorkFilesController());
    await waitFor(() => expect(result.current.visibleEntries).toHaveLength(2));

    await act(async () => {
      await result.current.deleteEntries([folder, report]);
    });

    expect(deletePath.mock.calls).toEqual([['/docs/Reports'], ['/docs/Plan.docx']]);
    expect(readWorkLocalFileBinding('artifact-report')).toBeNull();
    expect(result.current.favoritePaths).toEqual([]);
    expect(result.current.selectedPaths).toEqual(new Set());
  });

  it('persists Finder sidebar favorites and rebases them after folder moves', async () => {
    localStorage.setItem(
      'a3s-work.local-files',
      JSON.stringify({
        rootPath: '/docs',
        currentPath: '/docs',
        layout: 'grid',
        sort: { key: 'name', direction: 'ascending' },
      })
    );
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([archive, folder, report]);
    vi.spyOn(codeApi, 'pathExists').mockResolvedValue({ exists: false });
    const renamePath = vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    saveWorkLocalFileBinding({
      artifactId: 'artifact-report',
      path: '/docs/Reports/Bound.docx',
      fingerprint: 'sha256:bound',
      size: 10,
      updatedAt: Date.now(),
    });
    const { result } = renderHook(() => useWorkFilesController());
    await waitFor(() => expect(result.current.visibleEntries).toHaveLength(3));

    act(() => result.current.toggleFavoritePath(folder.path));
    expect(result.current.favoritePaths).toEqual(['/docs/Reports']);
    expect(JSON.parse(localStorage.getItem('a3s-work.local-files') ?? '{}').favoritePaths).toEqual(['/docs/Reports']);

    await act(async () => {
      await result.current.moveEntries([folder.path, report.path], archive.path);
    });

    expect(renamePath.mock.calls).toEqual([
      ['/docs/Reports', '/docs/Archive/Reports'],
      ['/docs/Plan.docx', '/docs/Archive/Plan.docx'],
    ]);
    expect(result.current.favoritePaths).toEqual(['/docs/Archive/Reports']);
    expect(readWorkLocalFileBinding('artifact-report')?.path).toBe('/docs/Archive/Reports/Bound.docx');
  });

  it('rejects drag moves into descendants or occupied destinations before changing files', async () => {
    localStorage.setItem(
      'a3s-work.local-files',
      JSON.stringify({
        rootPath: '/docs',
        currentPath: '/docs',
        layout: 'grid',
        sort: { key: 'name', direction: 'ascending' },
      })
    );
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([archive, folder, report]);
    const pathExists = vi.spyOn(codeApi, 'pathExists').mockResolvedValue({ exists: true });
    const renamePath = vi.spyOn(codeApi, 'renamePath').mockResolvedValue({ success: true });
    const { result } = renderHook(() => useWorkFilesController());
    await waitFor(() => expect(result.current.visibleEntries).toHaveLength(3));

    await expect(result.current.moveEntries([folder.path], '/docs/Reports/Child')).rejects.toThrow(
      '不能将文件夹移动到自身内部'
    );
    await expect(result.current.moveEntries([report.path], archive.path)).rejects.toThrow('已存在');
    expect(pathExists).toHaveBeenCalledWith('/docs/Archive/Plan.docx');
    expect(renamePath).not.toHaveBeenCalled();
  });

  it('imports operating-system drops into the current folder and selects the new roots', async () => {
    localStorage.setItem(
      'a3s-work.local-files',
      JSON.stringify({
        rootPath: '/docs',
        currentPath: '/docs',
        layout: 'grid',
        sort: { key: 'name', direction: 'ascending' },
      })
    );
    const notes: WorkspaceEntry = {
      name: 'notes.txt',
      path: '/docs/notes.txt',
      isDirectory: false,
      isFile: true,
      size: 3,
      mtimeMs: 13,
      extension: 'txt',
      isBinary: false,
    };
    const readDir = vi.spyOn(codeApi, 'readDir').mockResolvedValueOnce([archive]).mockResolvedValue([archive, notes]);
    vi.spyOn(codeApi, 'pathExists').mockResolvedValue({ exists: false });
    const writeBinaryFile = vi.spyOn(codeApi, 'writeBinaryFile').mockResolvedValue({ success: true });
    const file = {
      name: 'notes.txt',
      size: 3,
      webkitRelativePath: '',
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    } as File;
    const dataTransfer = {
      types: ['Files'],
      items: [],
      files: [file],
      dropEffect: 'none',
    } as unknown as DataTransfer;
    const { result } = renderHook(() => useWorkFilesController());
    await waitFor(() => expect(result.current.visibleEntries).toEqual([archive]));

    await act(async () => {
      await result.current.importDroppedItems(dataTransfer, '/docs');
    });

    expect(writeBinaryFile).toHaveBeenCalledWith('/docs/notes.txt', Uint8Array.from([1, 2, 3]), false);
    expect(readDir.mock.calls.filter(([path]) => path === '/docs')).toHaveLength(2);
    expect(result.current.selectedPaths).toEqual(new Set(['/docs/notes.txt']));
    expect(result.current.selectionFocusPath).toBe('/docs/notes.txt');
    expect(result.current.dropImporting).toBe(false);
  });

  it('rejects operating-system drops outside the selected root without writing', async () => {
    localStorage.setItem(
      'a3s-work.local-files',
      JSON.stringify({
        rootPath: '/docs',
        currentPath: '/docs',
        layout: 'grid',
        sort: { key: 'name', direction: 'ascending' },
      })
    );
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([archive]);
    const writeBinaryFile = vi.spyOn(codeApi, 'writeBinaryFile');
    const dataTransfer = {
      types: ['Files'],
      items: [],
      files: [],
    } as unknown as DataTransfer;
    const { result } = renderHook(() => useWorkFilesController());
    await waitFor(() => expect(result.current.visibleEntries).toEqual([archive]));

    await expect(result.current.importDroppedItems(dataTransfer, '/outside')).rejects.toThrow('只能拖入当前本地根目录');
    expect(writeBinaryFile).not.toHaveBeenCalled();
    expect(result.current.dropImporting).toBe(false);
  });
});
