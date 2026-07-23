import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkArtifact } from '../work-templates';
import { WorkHome } from './work-home';

describe('Work file center', () => {
  afterEach(cleanup);

  it('restores the collapsed office sidebar from the document library', () => {
    const onOpenSidebar = vi.fn();
    render(
      <WorkHome
        artifacts={[]}
        folders={[]}
        view='home'
        activeFolderId={null}
        loading={false}
        error={null}
        sidebarOpen={false}
        onOpenSidebar={onOpenSidebar}
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onImport={vi.fn()}
        onToggleFavorite={vi.fn()}
        onRename={vi.fn()}
        onCopy={vi.fn()}
        onMove={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onOpenFolder={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onRestoreFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '展开办公侧边栏' }));
    expect(onOpenSidebar).toHaveBeenCalledTimes(1);
  });

  it('starts every Office artifact type from the home surface', () => {
    const create = vi.fn();
    render(
      <WorkHome
        artifacts={[]}
        folders={[]}
        view='home'
        activeFolderId={null}
        loading={false}
        error={null}
        sidebarOpen={true}
        onOpenSidebar={vi.fn()}
        onCreate={create}
        onOpen={vi.fn()}
        onImport={vi.fn()}
        onToggleFavorite={vi.fn()}
        onRename={vi.fn()}
        onCopy={vi.fn()}
        onMove={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onOpenFolder={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onRestoreFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /空白文字/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /空白表格/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /空白演示/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /季度计划/ }));
    expect(create).toHaveBeenCalledWith('quarterly-plan');
  });

  it('searches and opens persisted artifacts', () => {
    const open = vi.fn();
    const document = createWorkArtifact('project-brief');
    const spreadsheet = createWorkArtifact('quarterly-plan');
    render(
      <WorkHome
        artifacts={[document, spreadsheet]}
        folders={[]}
        view='recent'
        activeFolderId={null}
        loading={false}
        error={null}
        sidebarOpen={true}
        onOpenSidebar={vi.fn()}
        onCreate={vi.fn()}
        onOpen={open}
        onImport={vi.fn()}
        onToggleFavorite={vi.fn()}
        onRename={vi.fn()}
        onCopy={vi.fn()}
        onMove={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onOpenFolder={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onRestoreFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索文件' }), {
      target: { value: '季度' },
    });
    expect(screen.queryByRole('button', { name: `打开 ${document.title}` })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `打开 ${spreadsheet.title}` }));
    expect(open).toHaveBeenCalledWith(spreadsheet.id);
  });

  it('separates trashed files and exposes explicit recovery', () => {
    const restore = vi.fn();
    const active = createWorkArtifact('project-brief');
    const trashed = { ...createWorkArtifact('quarterly-plan'), trashedAt: Date.now() };
    render(
      <WorkHome
        artifacts={[active, trashed]}
        folders={[]}
        view='trash'
        activeFolderId={null}
        loading={false}
        error={null}
        sidebarOpen={true}
        onOpenSidebar={vi.fn()}
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onImport={vi.fn()}
        onToggleFavorite={vi.fn()}
        onRename={vi.fn()}
        onCopy={vi.fn()}
        onMove={vi.fn()}
        onRestore={restore}
        onDelete={vi.fn()}
        onOpenFolder={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onRestoreFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: `打开 ${active.title}` })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(`${trashed.title} 更多操作`));
    fireEvent.click(screen.getByRole('button', { name: '恢复' }));
    expect(restore).toHaveBeenCalledWith(trashed.id);
  });

  it('uses in-product dialogs and custom menus for library operations', () => {
    const artifact = createWorkArtifact('project-brief');
    const folder = {
      id: 'folder-plans',
      name: '计划',
      parentId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revision: 1,
      trashedAt: null,
    };
    const createFolder = vi.fn();
    const rename = vi.fn();
    const move = vi.fn();
    const remove = vi.fn();
    const { container } = render(
      <WorkHome
        artifacts={[artifact]}
        folders={[folder]}
        view='home'
        activeFolderId={null}
        loading={false}
        error={null}
        sidebarOpen={true}
        onOpenSidebar={vi.fn()}
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onImport={vi.fn()}
        onToggleFavorite={vi.fn()}
        onRename={rename}
        onCopy={vi.fn()}
        onMove={move}
        onRestore={vi.fn()}
        onDelete={remove}
        onOpenFolder={vi.fn()}
        onCreateFolder={createFolder}
        onRenameFolder={vi.fn()}
        onRestoreFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(container.querySelector('select')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '新建文件夹' }));
    fireEvent.change(screen.getByRole('textbox', { name: '文件夹名称' }), { target: { value: '归档' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));
    expect(createFolder).toHaveBeenCalledWith('归档');

    const artifactMenu = screen.getByLabelText(`${artifact.title} 更多操作`).closest('details');
    if (!artifactMenu) throw new Error('Expected artifact action menu');
    fireEvent.click(screen.getByLabelText(`${artifact.title} 更多操作`));
    fireEvent.click(within(artifactMenu).getByRole('button', { name: '重命名' }));
    fireEvent.change(screen.getByRole('textbox', { name: '文件名称' }), { target: { value: '项目方案 2026' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(rename).toHaveBeenCalledWith(artifact.id, '项目方案 2026');

    fireEvent.click(screen.getByLabelText(`${artifact.title} 更多操作`));
    fireEvent.click(within(artifactMenu).getByRole('combobox', { name: `移动 ${artifact.title}` }));
    fireEvent.click(screen.getByRole('option', { name: '计划' }));
    expect(move).toHaveBeenCalledWith(artifact.id, folder.id);

    fireEvent.click(screen.getByLabelText(`${artifact.title} 更多操作`));
    fireEvent.click(within(artifactMenu).getByRole('button', { name: '移到回收站' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确认移到回收站' }));
    expect(remove).toHaveBeenCalledWith(artifact);
  });
});
