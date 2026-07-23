import {
  Copy,
  FileText,
  FileType2,
  Folder,
  FolderPlus,
  Grid2X2,
  List,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Presentation,
  RotateCcw,
  Sheet,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { type CSSProperties, useMemo, useRef, useState } from 'react';
import { Button, IconButton, SearchField, StateView } from '../../../design-system/primitives';
import { OfficeSelect } from '../editors/office-controls';
import { WORK_TEMPLATES } from '../work-templates';
import type { WorkArtifact, WorkArtifactKind, WorkFolder, WorkLibraryView } from '../work-types';
import { workArtifactExtension, workArtifactKindLabel } from '../work-types';
import { WorkFileIcon } from './work-file-icon';
import { type WorkLibraryOperation, WorkLibraryOperationDialog } from './work-library-operation-dialog';
import { WorkSidebarOpenButton } from './work-sidebar-open-button';

interface WorkHomeProps {
  artifacts: WorkArtifact[];
  folders: WorkFolder[];
  view: WorkLibraryView;
  activeFolderId: string | null;
  loading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  onCreate: (templateId: string) => void;
  onOpen: (id: string) => void;
  onImport: () => void;
  onToggleFavorite: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onCopy: (id: string) => void;
  onMove: (id: string, folderId: string | null) => void;
  onRestore: (id: string) => void;
  onDelete: (artifact: WorkArtifact) => void;
  onOpenFolder: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onRestoreFolder: (id: string) => void;
  onDeleteFolder: (folder: WorkFolder) => void;
  onRetry: () => void;
}

export function WorkHome({
  artifacts,
  folders,
  view,
  activeFolderId,
  loading,
  error,
  sidebarOpen,
  onOpenSidebar,
  onCreate,
  onOpen,
  onImport,
  onToggleFavorite,
  onRename,
  onCopy,
  onMove,
  onRestore,
  onDelete,
  onOpenFolder,
  onCreateFolder,
  onRenameFolder,
  onRestoreFolder,
  onDeleteFolder,
  onRetry,
}: WorkHomeProps) {
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [operation, setOperation] = useState<WorkLibraryOperation | null>(null);
  const visibleArtifacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return artifacts.filter((artifact) => {
      if (view === 'trash') {
        return Boolean(artifact.trashedAt) && (!normalized || artifact.title.toLowerCase().includes(normalized));
      }
      if (artifact.trashedAt) return false;
      if (view === 'favorites' && !artifact.favorite) return false;
      if (view === 'folder' && (artifact.folderId ?? null) !== activeFolderId) return false;
      return !normalized || artifact.title.toLowerCase().includes(normalized);
    });
  }, [activeFolderId, artifacts, query, view]);
  const visibleFolders = useMemo(() => {
    if (view === 'trash') return folders.filter((folder) => folder.trashedAt);
    if (view !== 'home' && view !== 'folder') return [];
    const parentId = view === 'folder' ? activeFolderId : null;
    return folders.filter((folder) => !folder.trashedAt && (folder.parentId ?? null) === parentId);
  }, [activeFolderId, folders, view]);
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const heading =
    view === 'favorites'
      ? '收藏文件'
      : view === 'recent'
        ? '最近打开'
        : view === 'trash'
          ? '回收站'
          : view === 'folder'
            ? (activeFolder?.name ?? '文件夹')
            : '我的文档';
  const confirmOperation = (value?: string) => {
    if (!operation) return;
    if (operation.kind === 'create-folder' && value) onCreateFolder(value);
    else if (operation.kind === 'rename-folder' && value && value !== operation.folder.name) {
      onRenameFolder(operation.folder.id, value);
    } else if (operation.kind === 'rename-artifact' && value && value !== operation.artifact.title) {
      onRename(operation.artifact.id, value);
    } else if (operation.kind === 'delete-folder') onDeleteFolder(operation.folder);
    else if (operation.kind === 'delete-artifact') onDelete(operation.artifact);
    setOperation(null);
  };

  return (
    <section className='work-home'>
      <header className='work-home-header'>
        <div className='work-home-title'>
          {!sidebarOpen && <WorkSidebarOpenButton onOpen={onOpenSidebar} />}
          <h1>{heading}</h1>
        </div>
        <div className='work-home-header-actions'>
          <SearchField
            className='work-search'
            label='搜索文件'
            clearLabel='清除文件搜索'
            value={query}
            placeholder='搜索文件'
            onValueChange={setQuery}
          />
          <Button onClick={onImport}>
            <Upload size={15} />
            打开文件
          </Button>
          {(view === 'home' || view === 'folder') && (
            <Button onClick={() => setOperation({ kind: 'create-folder' })}>
              <FolderPlus size={15} />
              新建文件夹
            </Button>
          )}
        </div>
      </header>

      {view === 'home' && (
        <section className='work-template-section' aria-labelledby='work-template-title'>
          <div className='work-section-heading'>
            <div>
              <h2 id='work-template-title'>新建</h2>
              <span>从空白文件或实用模板开始</span>
            </div>
          </div>
          <div className='work-template-grid'>
            {WORK_TEMPLATES.map((template) => (
              <button
                type='button'
                className={`work-template-card ${template.kind}`}
                key={template.id}
                onClick={() => onCreate(template.id)}
              >
                <span
                  className='work-template-preview'
                  style={{ '--work-template-accent': template.accent } as CSSProperties}
                >
                  <TemplatePreview kind={template.kind} detailed={!template.id.startsWith('blank-')} />
                </span>
                <span className='work-template-copy'>
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {visibleFolders.length > 0 && (
        <section className='work-folder-section' aria-labelledby='work-folders-title'>
          <div className='work-section-heading'>
            <div>
              <h2 id='work-folders-title'>{view === 'trash' ? '已删除文件夹' : '文件夹'}</h2>
              <span>{visibleFolders.length} 个文件夹</span>
            </div>
          </div>
          <div className='work-folder-grid'>
            {visibleFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onOpen={() => onOpenFolder(folder.id)}
                onRename={() => setOperation({ kind: 'rename-folder', folder })}
                onRestore={() => onRestoreFolder(folder.id)}
                onDelete={() => setOperation({ kind: 'delete-folder', folder })}
              />
            ))}
          </div>
        </section>
      )}

      <section className='work-files-section' aria-labelledby='work-files-title'>
        <div className='work-section-heading'>
          <div>
            <h2 id='work-files-title'>{view === 'home' ? '最近文件' : heading}</h2>
            <span>{visibleArtifacts.length} 个文件</span>
          </div>
          <fieldset className='work-layout-toggle'>
            <legend className='sr-only'>文件布局</legend>
            <IconButton
              label='网格视图'
              selected={layout === 'grid'}
              className={layout === 'grid' ? 'active' : ''}
              onClick={() => setLayout('grid')}
            >
              <Grid2X2 size={14} />
            </IconButton>
            <IconButton
              label='列表视图'
              selected={layout === 'list'}
              className={layout === 'list' ? 'active' : ''}
              onClick={() => setLayout('list')}
            >
              <List size={15} />
            </IconButton>
          </fieldset>
        </div>

        {loading ? (
          <StateView
            className='work-home-state'
            size='compact'
            role='status'
            icon={<LoaderCircle className='spin' size={18} />}
            title='正在读取文件…'
          />
        ) : error ? (
          <StateView
            className='work-home-state'
            size='compact'
            tone='danger'
            role='alert'
            icon={<FileText size={22} />}
            title='无法读取 Work 文件'
            description={error}
            actions={<Button onClick={onRetry}>重试</Button>}
          />
        ) : visibleArtifacts.length ? (
          <div className={`work-artifact-${layout}`}>
            {visibleArtifacts.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                layout={layout}
                onOpen={() => onOpen(artifact.id)}
                onFavorite={() => onToggleFavorite(artifact.id)}
                onRename={() => setOperation({ kind: 'rename-artifact', artifact })}
                onCopy={() => onCopy(artifact.id)}
                onMove={(folderId) => onMove(artifact.id, folderId)}
                onRestore={() => onRestore(artifact.id)}
                onDelete={() => setOperation({ kind: 'delete-artifact', artifact })}
                folders={folders.filter((folder) => !folder.trashedAt)}
              />
            ))}
          </div>
        ) : (
          <StateView
            className='work-home-state'
            size='compact'
            icon={<FileText size={24} />}
            title={query ? '没有匹配的文件' : view === 'favorites' ? '还没有收藏文件' : '还没有文件'}
            description={query ? '换一个关键词试试' : '创建或打开一个 Office 文件开始工作'}
            actions={!query && <Button onClick={() => onCreate('blank-document')}>新建文字</Button>}
          />
        )}
      </section>
      {operation && (
        <WorkLibraryOperationDialog
          operation={operation}
          onClose={() => setOperation(null)}
          onConfirm={confirmOperation}
        />
      )}
    </section>
  );
}

function ArtifactCard({
  artifact,
  layout,
  onOpen,
  onFavorite,
  onRename,
  onCopy,
  onMove,
  onRestore,
  onDelete,
  folders,
}: {
  artifact: WorkArtifact;
  layout: 'grid' | 'list';
  onOpen: () => void;
  onFavorite: () => void;
  onRename: () => void;
  onCopy: () => void;
  onMove: (folderId: string | null) => void;
  onRestore: () => void;
  onDelete: () => void;
  folders: WorkFolder[];
}) {
  const trashed = Boolean(artifact.trashedAt);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };
  return (
    <article className={`work-artifact-card ${artifact.kind} ${layout}`}>
      <button type='button' className='work-artifact-open' onClick={onOpen} aria-label={`打开 ${artifact.title}`}>
        <span className='work-artifact-thumbnail'>
          <ArtifactPreview artifact={artifact} />
        </span>
        <span className='work-artifact-details'>
          <strong>{artifact.title}</strong>
          <small>
            {workArtifactKindLabel(artifact.kind)} · {formatRecentTime(artifact.updatedAt)}
          </small>
        </span>
      </button>
      <div className='work-artifact-actions'>
        {!trashed && (
          <IconButton
            label={artifact.favorite ? `取消收藏 ${artifact.title}` : `收藏 ${artifact.title}`}
            selected={artifact.favorite}
            className={artifact.favorite ? 'active' : ''}
            onClick={onFavorite}
          >
            <Star size={14} fill={artifact.favorite ? 'currentColor' : 'none'} />
          </IconButton>
        )}
        <details ref={menuRef}>
          <summary aria-label={`${artifact.title} 更多操作`}>
            <MoreHorizontal size={15} />
          </summary>
          <div>
            <span>
              {workArtifactExtension(artifact.kind).toUpperCase()} · 第 {artifact.revision} 版
            </span>
            {trashed ? (
              <>
                <button
                  type='button'
                  onClick={() => {
                    closeMenu();
                    onRestore();
                  }}
                >
                  <RotateCcw size={13} />
                  恢复
                </button>
                <button
                  type='button'
                  className='danger'
                  onClick={() => {
                    closeMenu();
                    onDelete();
                  }}
                >
                  <Trash2 size={13} />
                  永久删除
                </button>
              </>
            ) : (
              <>
                <button
                  type='button'
                  onClick={() => {
                    closeMenu();
                    onRename();
                  }}
                >
                  <Pencil size={13} />
                  重命名
                </button>
                <button
                  type='button'
                  onClick={() => {
                    closeMenu();
                    onCopy();
                  }}
                >
                  <Copy size={13} />
                  创建副本
                </button>
                <div className='work-move-control'>
                  <Folder size={13} />
                  <OfficeSelect
                    ariaLabel={`移动 ${artifact.title}`}
                    value={artifact.folderId ?? ''}
                    options={[
                      { value: '', label: '全部文件' },
                      ...folders.map((folder) => ({ value: folder.id, label: folder.name })),
                    ]}
                    onValueChange={(folderId) => {
                      closeMenu();
                      onMove(folderId || null);
                    }}
                  />
                </div>
                <button
                  type='button'
                  className='danger'
                  onClick={() => {
                    closeMenu();
                    onDelete();
                  }}
                >
                  <Trash2 size={13} />
                  移到回收站
                </button>
              </>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}

function FolderCard({
  folder,
  onOpen,
  onRename,
  onRestore,
  onDelete,
}: {
  folder: WorkFolder;
  onOpen: () => void;
  onRename: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const trashed = Boolean(folder.trashedAt);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };
  return (
    <article className='work-folder-card'>
      <button type='button' onClick={onOpen} disabled={trashed} aria-label={`打开文件夹 ${folder.name}`}>
        <WorkFileIcon path={folder.name} directory size={32} />
        <span>
          <strong>{folder.name}</strong>
          <small>{formatRecentTime(folder.updatedAt)}</small>
        </span>
      </button>
      <details ref={menuRef}>
        <summary aria-label={`${folder.name} 更多操作`}>
          <MoreHorizontal size={15} />
        </summary>
        <div>
          {trashed ? (
            <>
              <button
                type='button'
                onClick={() => {
                  closeMenu();
                  onRestore();
                }}
              >
                <RotateCcw size={13} />
                恢复
              </button>
              <button
                type='button'
                className='danger'
                onClick={() => {
                  closeMenu();
                  onDelete();
                }}
              >
                <Trash2 size={13} />
                永久删除
              </button>
            </>
          ) : (
            <>
              <button
                type='button'
                onClick={() => {
                  closeMenu();
                  onRename();
                }}
              >
                <Pencil size={13} />
                重命名
              </button>
              <button
                type='button'
                className='danger'
                onClick={() => {
                  closeMenu();
                  onDelete();
                }}
              >
                <Trash2 size={13} />
                移到回收站
              </button>
            </>
          )}
        </div>
      </details>
    </article>
  );
}

function TemplatePreview({ kind, detailed }: { kind: WorkArtifactKind; detailed: boolean }) {
  if (kind === 'spreadsheet') {
    return (
      <>
        <Sheet size={19} />
        <i className='sheet-grid'>
          {Array.from({ length: 12 }, (_, index) => (
            <b key={index} className={detailed && [0, 4, 8].includes(index) ? 'filled' : ''} />
          ))}
        </i>
      </>
    );
  }
  if (kind === 'presentation') {
    return (
      <>
        <Presentation size={19} />
        <i className='slide-block'>
          <b />
          <b />
          {detailed && <b />}
        </i>
      </>
    );
  }
  return (
    <>
      <FileText size={19} />
      <i className='document-lines'>
        <b />
        <b />
        <b />
        {detailed && <b />}
      </i>
    </>
  );
}

function ArtifactPreview({ artifact }: { artifact: WorkArtifact }) {
  if (artifact.kind === 'pdf') {
    return (
      <span className='artifact-pdf-preview'>
        <FileType2 size={29} />
        <strong>PDF</strong>
      </span>
    );
  }
  if (artifact.kind === 'spreadsheet') {
    return <TemplatePreview kind='spreadsheet' detailed />;
  }
  if (artifact.kind === 'presentation') {
    const slide = artifact.content.type === 'presentation' ? artifact.content.slides[0] : null;
    return (
      <span className='artifact-slide-preview' style={{ background: slide?.background ?? '#ffffff' }}>
        {(slide?.elements ?? []).slice(0, 4).map((element) => (
          <i
            key={element.id}
            style={{
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: `${element.width}%`,
              height: `${element.height}%`,
              background:
                element.type === 'image' && element.image
                  ? `center / cover url("${element.image.dataUrl}")`
                  : element.fill === 'transparent'
                    ? element.color
                    : element.fill,
            }}
          />
        ))}
      </span>
    );
  }
  return <TemplatePreview kind='document' detailed />;
}

function formatRecentTime(timestamp: number): string {
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return '刚刚';
  if (elapsed < 3_600_000) return `${Math.max(1, Math.floor(elapsed / 60_000))} 分钟前`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`;
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(timestamp);
}
