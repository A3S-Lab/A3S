import { FolderInput, LibraryBig, Plus, RefreshCw } from 'lucide-react';
import { SidebarProductHeader } from '../../../components/sidebar-product-header';
import { Button } from '../../../design-system/primitives';

interface KnowledgeSidebarProps {
  count: number;
  libraryActive: boolean;
  refreshing: boolean;
  onShowLibrary: () => void;
  onCollapse: () => void;
  onCreate: () => void;
  onImport: () => void;
  onRefresh: () => void;
}

export function KnowledgeSidebar({
  count,
  libraryActive,
  refreshing,
  onShowLibrary,
  onCollapse,
  onCreate,
  onImport,
  onRefresh,
}: KnowledgeSidebarProps) {
  return (
    <aside className='work-sidebar knowledge-sidebar' aria-label='知识导航'>
      <SidebarProductHeader title='知识' onCollapse={onCollapse} />

      <nav aria-label='知识库范围'>
        <span className='work-sidebar-section-label'>知识库</span>
        <button
          type='button'
          className={libraryActive ? 'active' : ''}
          aria-label={`我的知识库 ${count}`}
          aria-current={libraryActive ? 'page' : undefined}
          onClick={onShowLibrary}
        >
          <LibraryBig size={16} />
          <span>我的知识库</span>
          <small>{count}</small>
        </button>
      </nav>

      <section className='work-sidebar-create knowledge-sidebar-quick-actions' aria-label='快速操作'>
        <span>快速操作</span>
        <Button tone='quiet' onClick={onCreate}>
          <Plus size={15} />
          新建
        </Button>
        <Button tone='quiet' onClick={onImport}>
          <FolderInput size={15} />
          导入
        </Button>
        <Button tone='quiet' loading={refreshing} onClick={onRefresh}>
          {!refreshing && <RefreshCw size={15} />}
          {refreshing ? '刷新中…' : '刷新'}
        </Button>
      </section>
    </aside>
  );
}
