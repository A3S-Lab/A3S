import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkSidebar } from './work-sidebar';

describe('Work Finder sidebar', () => {
  it('switches real workspaces and keeps favorite folder actions available', async () => {
    const onOpenLocalFavorite = vi.fn();
    const onRemoveLocalFavorite = vi.fn();
    const onMoveLocalEntries = vi.fn();
    const onImportLocalDrop = vi.fn();
    const onCollapse = vi.fn();
    const onSelectWorkspace = vi.fn(async (path: string) => path);
    const onPickWorkspace = vi.fn(async () => '/projects/new');
    const { container } = render(
      <WorkSidebar
        surface='files'
        localRootName='docs'
        localRootPath='/docs'
        localCurrentPath='/docs/Reports'
        recentRootPaths={['/docs', '/clients/acme']}
        localFavoritePaths={['/docs/Reports']}
        view='home'
        totalCount={0}
        favoriteCount={0}
        trashCount={0}
        folders={[]}
        activeFolderId={null}
        onChangeView={vi.fn()}
        onOpenFolder={vi.fn()}
        onOpenLocalFiles={vi.fn()}
        onSelectWorkspace={onSelectWorkspace}
        onPickWorkspace={onPickWorkspace}
        onOpenLocalFavorite={onOpenLocalFavorite}
        onRemoveLocalFavorite={onRemoveLocalFavorite}
        onMoveLocalEntries={onMoveLocalEntries}
        onImportLocalDrop={onImportLocalDrop}
        onCollapse={onCollapse}
        onCreate={vi.fn()}
        onImport={vi.fn()}
      />
    );
    expect(container.querySelector('.work-workspace-switcher')).toHaveClass('variant-sidebar');
    expect(container.querySelector('.work-workspace-switcher')).not.toHaveClass('sidebar');
    expect(screen.getByText('办公')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '切换工作区，当前 docs' }));
    expect(screen.getByRole('region', { name: '选择办公工作区' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /acme/ }));
    await waitFor(() => expect(onSelectWorkspace).toHaveBeenCalledWith('/clients/acme'));

    fireEvent.click(screen.getByRole('button', { name: '切换工作区，当前 docs' }));
    fireEvent.click(screen.getByRole('button', { name: '打开其他文件夹' }));
    await waitFor(() => expect(onPickWorkspace).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button', { name: '收起办公侧边栏' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收起办公侧边栏' }));
    expect(onCollapse).toHaveBeenCalledTimes(1);
    const dataTransfer = {
      dropEffect: 'none',
      types: ['application/x-a3s-work-local-paths'],
      getData: vi.fn(() => JSON.stringify(['/docs/Plan.docx'])),
    };
    const favorite = screen.getByRole('button', { name: '打开收藏文件夹 Reports' });

    fireEvent.click(favorite);
    expect(onOpenLocalFavorite).toHaveBeenCalledWith('/docs/Reports');
    fireEvent.dragOver(favorite, { dataTransfer });
    fireEvent.drop(favorite, { dataTransfer });
    expect(onMoveLocalEntries).toHaveBeenCalledWith(['/docs/Plan.docx'], '/docs/Reports');

    fireEvent.click(screen.getByRole('button', { name: '从侧边栏移除 Reports' }));
    expect(onRemoveLocalFavorite).toHaveBeenCalledWith('/docs/Reports');

    const systemDrop = {
      dropEffect: 'none',
      types: ['Files'],
      items: [],
      files: [{ name: 'notes.txt' }],
    } as unknown as DataTransfer;
    fireEvent.dragOver(favorite, { dataTransfer: systemDrop });
    fireEvent.drop(favorite, { dataTransfer: systemDrop });
    expect(onImportLocalDrop).toHaveBeenCalledWith(systemDrop, '/docs/Reports');
  });
});
