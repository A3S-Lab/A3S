import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceEntry } from '../../../types/api';
import type { WorkFilesActions } from '../use-work-files-controller';
import { WorkFilesView } from './work-files-view';
import { WorkFilesWorkspace } from './work-files-workspace';

const report: WorkspaceEntry = {
  name: 'Report.docx',
  path: '/docs/Report.docx',
  isDirectory: false,
  isFile: true,
  size: 1024,
  mtimeMs: 10,
  extension: 'docx',
  isBinary: false,
};

const archive: WorkspaceEntry = {
  name: 'Archive',
  path: '/docs/Archive',
  isDirectory: true,
  isFile: false,
  isBinary: false,
  size: 0,
  mtimeMs: 10,
};

function actions(overrides: Partial<WorkFilesActions> = {}): WorkFilesActions {
  return {
    rootPath: '/docs',
    recentRootPaths: ['/docs'],
    currentPath: '/docs',
    entries: [report],
    visibleEntries: [report],
    selectedPaths: new Set<string>(),
    selectedEntries: [],
    loading: false,
    error: null,
    query: '',
    searchScope: 'folder',
    searchLoading: false,
    searchError: null,
    searchTruncated: false,
    searchUnreadableDirectories: 0,
    layout: 'grid',
    sort: { key: 'name', direction: 'ascending' },
    favoritePaths: [],
    selectionFocusPath: null,
    operationPaths: new Set<string>(),
    dropImporting: false,
    canGoBack: false,
    canGoForward: false,
    canGoUp: false,
    setQuery: vi.fn(),
    setSearchScope: vi.fn(),
    setLayout: vi.fn(),
    setSort: vi.fn(),
    selectRoot: vi.fn(async (path: string) => path),
    pickRoot: vi.fn(async () => null),
    navigateTo: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    goUp: vi.fn(),
    refresh: vi.fn(),
    selectEntry: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    toggleFavoritePath: vi.fn(),
    createFolder: vi.fn(),
    renameEntry: vi.fn(),
    duplicateEntry: vi.fn(),
    deleteEntries: vi.fn(),
    moveEntries: vi.fn(),
    importDroppedItems: vi.fn(),
    ...overrides,
  } as WorkFilesActions;
}

describe('Work Finder file view', () => {
  afterEach(cleanup);

  it('restores the collapsed office sidebar from the file toolbar', () => {
    const onOpenSidebar = vi.fn();
    render(
      <WorkFilesWorkspace
        actions={actions()}
        openingPath={null}
        copilotOpen={false}
        sidebarOpen={false}
        onOpenFile={vi.fn()}
        onAgentRequest={vi.fn()}
        onOpenSidebar={onOpenSidebar}
        onToggleCopilot={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '展开办公侧边栏' }));
    expect(onOpenSidebar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '切换工作区，当前 docs' })).toBeInTheDocument();
  });

  it('opens supported Office files explicitly as Work copies', () => {
    const openFile = vi.fn();
    render(
      <WorkFilesView
        actions={actions()}
        openingPath={null}
        createFolderRequest={0}
        onOpenFile={openFile}
        onQuickLook={vi.fn()}
        onAgentRequest={vi.fn()}
      />
    );

    const item = screen.getByRole('option', { name: /Report.docx/ });
    fireEvent.contextMenu(item, { clientX: 30, clientY: 40 });
    fireEvent.click(screen.getByRole('menuitem', { name: '打开' }));
    expect(openFile).toHaveBeenCalledWith(report);
  });

  it('requires an in-product confirmation before permanently deleting local entries', async () => {
    const deleteEntries = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkFilesView
        actions={actions({
          entries: [report, archive],
          visibleEntries: [report, archive],
          selectedPaths: new Set([report.path, archive.path]),
          selectedEntries: [report, archive],
          deleteEntries,
        })}
        openingPath={null}
        createFolderRequest={0}
        onOpenFile={vi.fn()}
        onQuickLook={vi.fn()}
        onAgentRequest={vi.fn()}
      />
    );

    fireEvent.contextMenu(screen.getByRole('option', { name: /Report.docx/ }), { clientX: 30, clientY: 40 });
    fireEvent.click(screen.getByRole('menuitem', { name: '永久删除 2 项' }));
    expect(screen.getByRole('dialog', { name: '永久删除 2 项' })).toBeInTheDocument();
    expect(deleteEntries).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '确认永久删除' }));
    await waitFor(() => expect(deleteEntries).toHaveBeenCalledWith([report, archive]));
  });

  it('creates native Office files from the current-folder context menu', () => {
    const onCreateArtifact = vi.fn();
    render(
      <WorkFilesView
        actions={actions()}
        openingPath={null}
        createFolderRequest={0}
        onOpenFile={vi.fn()}
        onQuickLook={vi.fn()}
        onAgentRequest={vi.fn()}
        onCreateArtifact={onCreateArtifact}
      />
    );

    fireEvent.contextMenu(screen.getByRole('listbox', { name: '本地文件' }), { clientX: 40, clientY: 60 });
    fireEvent.click(screen.getByRole('menuitem', { name: '新建文字文档' }));
    expect(onCreateArtifact).toHaveBeenCalledWith('blank-document');
  });

  it('prefills a selection-aware Copilot request without sending it', () => {
    const onAgentRequest = vi.fn();
    render(
      <WorkFilesView
        actions={actions({
          selectedPaths: new Set([report.path]),
          selectedEntries: [report],
        })}
        openingPath={null}
        createFolderRequest={0}
        onOpenFile={vi.fn()}
        onQuickLook={vi.fn()}
        onAgentRequest={onAgentRequest}
      />
    );

    fireEvent.contextMenu(screen.getByRole('option', { name: /Report.docx/ }), { clientX: 30, clientY: 40 });
    fireEvent.click(screen.getByRole('menuitem', { name: '总结文件' }));
    expect(onAgentRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceRoot: '',
        paths: ['/docs/Report.docx'],
        instruction: expect.stringContaining('总结'),
      })
    );
  });

  it('switches between current-folder and whole-workspace search and shows result locations', () => {
    const setSearchScope = vi.fn();
    const nestedReport = { ...report, path: '/docs/Reports/Report.docx' };
    const { rerender } = render(
      <WorkFilesWorkspace
        actions={actions({
          currentPath: '/docs/Reports',
          entries: [],
          visibleEntries: [nestedReport],
          query: 'report',
          searchScope: 'workspace',
          setSearchScope,
        })}
        openingPath={null}
        copilotOpen={false}
        sidebarOpen={true}
        onOpenFile={vi.fn()}
        onAgentRequest={vi.fn()}
        onOpenSidebar={vi.fn()}
        onToggleCopilot={vi.fn()}
      />
    );

    expect(screen.getByRole('option', { name: /Report.docx/ })).toHaveTextContent('Reports');
    fireEvent.click(screen.getByRole('radio', { name: '仅搜索当前文件夹 Reports' }));
    expect(setSearchScope).toHaveBeenCalledWith('folder');
    rerender(
      <WorkFilesWorkspace
        actions={actions({
          currentPath: '/docs/Reports',
          entries: [],
          visibleEntries: [nestedReport],
          query: 'report',
          searchScope: 'folder',
          setSearchScope,
        })}
        openingPath={null}
        copilotOpen={false}
        sidebarOpen={true}
        onOpenFile={vi.fn()}
        onAgentRequest={vi.fn()}
        onOpenSidebar={vi.fn()}
        onToggleCopilot={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: '搜索全部文件 docs' }));
    expect(setSearchScope).toHaveBeenCalledWith('workspace');
  });

  it('sorts with an in-product menu instead of a system select', () => {
    const setSort = vi.fn();
    const { container } = render(
      <WorkFilesWorkspace
        actions={actions({ setSort })}
        openingPath={null}
        copilotOpen={false}
        sidebarOpen={true}
        onOpenFile={vi.fn()}
        onAgentRequest={vi.fn()}
        onOpenSidebar={vi.fn()}
        onToggleCopilot={vi.fn()}
      />
    );

    expect(container.querySelector('select')).toBeNull();
    fireEvent.click(screen.getByRole('combobox', { name: '排序方式' }));
    fireEvent.click(screen.getByRole('option', { name: '修改日期' }));
    expect(setSort).toHaveBeenCalledWith({ key: 'modified', direction: 'ascending' });
  });

  it('opens Quick Look from the Space key and the contextual action', () => {
    const onQuickLook = vi.fn();
    const selectedActions = actions({
      selectedPaths: new Set([report.path]),
      selectedEntries: [report],
    });
    render(
      <WorkFilesView
        actions={selectedActions}
        openingPath={null}
        createFolderRequest={0}
        onOpenFile={vi.fn()}
        onQuickLook={onQuickLook}
        onAgentRequest={vi.fn()}
      />
    );

    fireEvent.keyDown(screen.getByRole('listbox', { name: '本地文件' }), { key: ' ' });
    expect(onQuickLook).toHaveBeenCalledWith(report);

    onQuickLook.mockClear();
    fireEvent.contextMenu(screen.getByRole('option', { name: /Report.docx/ }), { clientX: 30, clientY: 40 });
    fireEvent.click(screen.getByRole('menuitem', { name: '快速查看' }));
    expect(onQuickLook).toHaveBeenCalledWith(report);
  });

  it('opens Quick Look for the selected item from the Finder toolbar', async () => {
    render(
      <WorkFilesWorkspace
        actions={actions({
          entries: [archive],
          visibleEntries: [archive],
          selectedPaths: new Set([archive.path]),
          selectedEntries: [archive],
        })}
        openingPath={null}
        copilotOpen={false}
        sidebarOpen={true}
        onOpenFile={vi.fn()}
        onAgentRequest={vi.fn()}
        onOpenSidebar={vi.fn()}
        onToggleCopilot={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '快速查看所选项目' }));

    expect(screen.getByRole('dialog', { name: 'Archive' })).toBeInTheDocument();
    expect(await screen.findByText('快速查看不会读取文件夹内的内容；打开文件夹后可以继续浏览。')).toBeInTheDocument();
  });

  it('moves selected files to an ancestor breadcrumb', () => {
    const nestedReport = { ...report, path: '/docs/Reports/Report.docx' };
    const moveEntries = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkFilesWorkspace
        actions={actions({
          currentPath: '/docs/Reports',
          entries: [nestedReport],
          visibleEntries: [nestedReport],
          selectedPaths: new Set([nestedReport.path]),
          selectedEntries: [nestedReport],
          moveEntries,
          canGoUp: true,
        })}
        openingPath={null}
        copilotOpen={false}
        sidebarOpen={true}
        onOpenFile={vi.fn()}
        onAgentRequest={vi.fn()}
        onOpenSidebar={vi.fn()}
        onToggleCopilot={vi.fn()}
      />
    );
    const dataTransfer = {
      dropEffect: 'none',
      types: ['application/x-a3s-work-local-paths'],
      getData: vi.fn(() => JSON.stringify([nestedReport.path])),
    };
    const rootBreadcrumb = screen.getByRole('button', { name: 'docs' });

    fireEvent.dragOver(rootBreadcrumb, { dataTransfer });
    expect(rootBreadcrumb).toHaveClass('drop-target');
    fireEvent.drop(rootBreadcrumb, { dataTransfer });
    expect(moveEntries).toHaveBeenCalledWith([nestedReport.path], '/docs');
  });

  it('imports operating-system files into ancestor breadcrumbs', () => {
    const importDroppedItems = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkFilesWorkspace
        actions={actions({
          currentPath: '/docs/Reports',
          entries: [report],
          visibleEntries: [report],
          importDroppedItems,
          canGoUp: true,
        })}
        openingPath={null}
        copilotOpen={false}
        sidebarOpen={true}
        onOpenFile={vi.fn()}
        onAgentRequest={vi.fn()}
        onOpenSidebar={vi.fn()}
        onToggleCopilot={vi.fn()}
      />
    );
    const dataTransfer = operatingSystemDrop();
    const rootBreadcrumb = screen.getByRole('button', { name: 'docs' });

    fireEvent.dragOver(rootBreadcrumb, { dataTransfer });
    expect(rootBreadcrumb).toHaveClass('drop-target');
    fireEvent.drop(rootBreadcrumb, { dataTransfer });
    expect(importDroppedItems).toHaveBeenCalledWith(dataTransfer, '/docs');
  });

  it('moves dragged selections into folders and exposes sidebar favorites in the context menu', () => {
    const moveEntries = vi.fn();
    const toggleFavoritePath = vi.fn();
    const finderActions = actions({
      entries: [archive, report],
      visibleEntries: [archive, report],
      moveEntries,
      toggleFavoritePath,
    });
    render(
      <WorkFilesView
        actions={finderActions}
        openingPath={null}
        createFolderRequest={0}
        onOpenFile={vi.fn()}
        onQuickLook={vi.fn()}
        onAgentRequest={vi.fn()}
      />
    );
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      get types() {
        return [...data.keys()];
      },
      setData: vi.fn((type: string, value: string) => data.set(type, value)),
      getData: vi.fn((type: string) => data.get(type) ?? ''),
    };
    const reportItem = screen.getByRole('option', { name: /Report.docx/ });
    const archiveItem = screen.getByRole('option', { name: /Archive/ });

    fireEvent.dragStart(reportItem, { dataTransfer });
    fireEvent.dragOver(archiveItem, { dataTransfer });
    expect(archiveItem).toHaveClass('drop-target');
    fireEvent.drop(archiveItem, { dataTransfer });
    expect(moveEntries).toHaveBeenCalledWith(['/docs/Report.docx'], '/docs/Archive');

    fireEvent.contextMenu(archiveItem, { clientX: 30, clientY: 40 });
    fireEvent.click(screen.getByRole('menuitem', { name: '添加到侧边栏' }));
    expect(toggleFavoritePath).toHaveBeenCalledWith('/docs/Archive');
  });

  it('supports Finder arrow selection and command-up navigation', () => {
    const selectEntry = vi.fn();
    const goUp = vi.fn();
    render(
      <WorkFilesView
        actions={actions({
          entries: [archive, report],
          visibleEntries: [archive, report],
          selectedPaths: new Set([archive.path]),
          selectedEntries: [archive],
          selectionFocusPath: archive.path,
          layout: 'list',
          selectEntry,
          goUp,
        })}
        openingPath={null}
        createFolderRequest={0}
        onOpenFile={vi.fn()}
        onQuickLook={vi.fn()}
        onAgentRequest={vi.fn()}
      />
    );
    const listbox = screen.getByRole('listbox', { name: '本地文件' });

    fireEvent.keyDown(listbox, { key: 'ArrowDown', shiftKey: true });
    expect(selectEntry).toHaveBeenCalledWith(report, { range: true });
    expect(screen.getByRole('option', { name: /Report.docx/ })).toHaveFocus();

    fireEvent.keyDown(listbox, { key: 'ArrowUp', metaKey: true });
    expect(goUp).toHaveBeenCalledTimes(1);
  });

  it('imports operating-system drops into visible folders and the current folder background', () => {
    const importDroppedItems = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkFilesView
        actions={actions({
          entries: [archive, report],
          visibleEntries: [archive, report],
          importDroppedItems,
        })}
        openingPath={null}
        createFolderRequest={0}
        onOpenFile={vi.fn()}
        onQuickLook={vi.fn()}
        onAgentRequest={vi.fn()}
      />
    );
    const archiveItem = screen.getByRole('option', { name: /Archive/ });
    const listbox = screen.getByRole('listbox', { name: '本地文件' });
    const folderDrop = operatingSystemDrop();

    fireEvent.dragOver(archiveItem, { dataTransfer: folderDrop });
    expect(archiveItem).toHaveClass('external-drop-target');
    fireEvent.drop(archiveItem, { dataTransfer: folderDrop });
    expect(importDroppedItems).toHaveBeenCalledWith(folderDrop, '/docs/Archive');

    const backgroundDrop = operatingSystemDrop();
    fireEvent.dragOver(listbox, { dataTransfer: backgroundDrop });
    expect(screen.getByRole('status')).toHaveTextContent('松开放入当前文件夹');
    fireEvent.drop(listbox, { dataTransfer: backgroundDrop });
    expect(importDroppedItems).toHaveBeenCalledWith(backgroundDrop, '/docs');
  });
});

function operatingSystemDrop(): DataTransfer {
  const file = {
    name: 'notes.txt',
    size: 3,
    webkitRelativePath: '',
    arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
  } as File;
  return {
    types: ['Files'],
    items: [],
    files: [file],
    dropEffect: 'none',
  } as unknown as DataTransfer;
}
