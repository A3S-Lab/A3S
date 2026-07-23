import {
  ArrowDownAZ,
  ArrowDownZA,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  FolderOpen,
  FolderPlus,
  Grid2X2,
  List,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Button,
  IconButton,
  SearchField,
  SegmentedControl,
  StateView,
  StatusBadge,
} from '../../../design-system/primitives';
import type { WorkspaceEntry } from '../../../types/api';
import { hasDraggedWorkspaceFiles } from '../../workspace/workspace-drop-import';
import { OfficeSelect } from '../editors/office-controls';
import type { WorkFilesActions } from '../use-work-files-controller';
import type { WorkAgentRequest } from '../work-agent-request';
import {
  canMoveLocalPaths,
  hasWorkLocalFileDragData,
  localPathBasename,
  readWorkLocalFileDragData,
  type WorkFilesSortKey,
  workBreadcrumbs,
} from '../work-local-files';
import { WorkFilesView } from './work-files-view';
import { WorkQuickLook } from './work-quick-look';
import { WorkSidebarOpenButton } from './work-sidebar-open-button';
import { WorkWorkspaceSwitcher } from './work-workspace-switcher';

export function WorkFilesWorkspace({
  actions,
  openingPath,
  copilotOpen,
  sidebarOpen,
  onOpenFile,
  onAgentRequest,
  onCreateArtifact,
  onOpenSidebar,
  onToggleCopilot,
}: {
  actions: WorkFilesActions;
  openingPath: string | null;
  copilotOpen: boolean;
  sidebarOpen: boolean;
  onOpenFile: (entry: WorkspaceEntry) => void | Promise<void>;
  onAgentRequest: (request: WorkAgentRequest) => void | Promise<void>;
  onCreateArtifact?: (templateId: string) => void;
  onOpenSidebar: () => void;
  onToggleCopilot: () => void;
}) {
  const [createFolderRequest, setCreateFolderRequest] = useState(0);
  const [quickLookPath, setQuickLookPath] = useState<string | null>(null);
  const [breadcrumbDropPath, setBreadcrumbDropPath] = useState<string | null>(null);
  const [breadcrumbDropCopies, setBreadcrumbDropCopies] = useState(false);
  const workspaceSearching = actions.searchScope === 'workspace' && Boolean(actions.query.trim());
  const quickLookEntry = quickLookPath
    ? (actions.visibleEntries.find((entry) => entry.path === quickLookPath) ?? null)
    : null;
  const quickLookIndex = quickLookEntry
    ? actions.visibleEntries.findIndex((entry) => entry.path === quickLookEntry.path)
    : -1;
  const previousQuickLookEntry = quickLookIndex > 0 ? actions.visibleEntries[quickLookIndex - 1] : null;
  const nextQuickLookEntry =
    quickLookIndex >= 0 && quickLookIndex < actions.visibleEntries.length - 1
      ? actions.visibleEntries[quickLookIndex + 1]
      : null;
  useEffect(() => {
    setQuickLookPath(null);
  }, [actions.currentPath]);
  useEffect(() => {
    if (quickLookPath && !actions.visibleEntries.some((entry) => entry.path === quickLookPath)) setQuickLookPath(null);
  }, [actions.visibleEntries, quickLookPath]);
  if (!actions.rootPath) {
    return (
      <main className='work-files-onboarding'>
        {!sidebarOpen && (
          <div className='work-files-onboarding-toolbar'>
            <WorkSidebarOpenButton onOpen={onOpenSidebar} />
            <WorkWorkspaceSwitcher
              rootPath={actions.rootPath}
              recentPaths={actions.recentRootPaths}
              variant='compact'
              onSelect={actions.selectRoot}
              onPick={actions.pickRoot}
            />
          </div>
        )}
        <StateView
          className='work-files-onboarding-state'
          tone='info'
          icon={<FolderOpen size={26} />}
          title='打开本地文件夹'
          description='在这里浏览、编辑和整理本地文件。'
          actions={
            <Button tone='primary' onClick={() => void actions.pickRoot()}>
              <FolderOpen size={16} />
              选择文件夹
            </Button>
          }
        />
      </main>
    );
  }

  const breadcrumbs = workBreadcrumbs(actions.rootPath, actions.currentPath);
  return (
    <main className='work-files-workspace'>
      <header className='work-files-toolbar'>
        {!sidebarOpen && (
          <>
            <WorkSidebarOpenButton onOpen={onOpenSidebar} />
            <WorkWorkspaceSwitcher
              rootPath={actions.rootPath}
              recentPaths={actions.recentRootPaths}
              variant='compact'
              onSelect={actions.selectRoot}
              onPick={actions.pickRoot}
            />
          </>
        )}
        <div className='work-files-history-actions'>
          <IconButton label='后退' disabled={!actions.canGoBack} onClick={actions.goBack}>
            <ChevronLeft size={17} />
          </IconButton>
          <IconButton label='前进' disabled={!actions.canGoForward} onClick={actions.goForward}>
            <ChevronRight size={17} />
          </IconButton>
          <IconButton label='上一级文件夹' disabled={!actions.canGoUp} onClick={actions.goUp}>
            <ChevronUp size={17} />
          </IconButton>
        </div>
        <nav className='work-files-breadcrumbs' aria-label='当前文件夹路径' title={actions.currentPath}>
          {breadcrumbs.map((breadcrumb, index) => (
            <span key={breadcrumb.path}>
              {index > 0 && <ChevronRight size={12} aria-hidden='true' />}
              <button
                type='button'
                className={
                  breadcrumbDropPath === breadcrumb.path
                    ? `drop-target ${breadcrumbDropCopies ? 'external-drop-target' : ''}`
                    : ''
                }
                aria-current={index === breadcrumbs.length - 1 ? 'location' : undefined}
                onClick={() => actions.navigateTo(breadcrumb.path)}
                onDragOver={(event) => {
                  if (hasDraggedWorkspaceFiles(event.dataTransfer)) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = actions.dropImporting ? 'none' : 'copy';
                    setBreadcrumbDropPath(breadcrumb.path);
                    setBreadcrumbDropCopies(true);
                    return;
                  }
                  if (!hasWorkLocalFileDragData(event.dataTransfer)) return;
                  const paths = readWorkLocalFileDragData(event.dataTransfer);
                  if (paths.length && !canMoveLocalPaths(paths, breadcrumb.path)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setBreadcrumbDropPath(breadcrumb.path);
                  setBreadcrumbDropCopies(false);
                }}
                onDragLeave={() => {
                  setBreadcrumbDropPath(null);
                  setBreadcrumbDropCopies(false);
                }}
                onDrop={(event) => {
                  if (hasDraggedWorkspaceFiles(event.dataTransfer)) {
                    event.preventDefault();
                    event.stopPropagation();
                    setBreadcrumbDropPath(null);
                    setBreadcrumbDropCopies(false);
                    if (actions.dropImporting) return;
                    void Promise.resolve(actions.importDroppedItems(event.dataTransfer, breadcrumb.path)).catch(
                      () => undefined
                    );
                    return;
                  }
                  const paths = readWorkLocalFileDragData(event.dataTransfer);
                  setBreadcrumbDropPath(null);
                  setBreadcrumbDropCopies(false);
                  if (!canMoveLocalPaths(paths, breadcrumb.path)) return;
                  event.preventDefault();
                  void Promise.resolve(actions.moveEntries(paths, breadcrumb.path)).catch(() => undefined);
                }}
              >
                {breadcrumb.label}
              </button>
            </span>
          ))}
        </nav>
        <SearchField
          className='work-files-search'
          size='compact'
          label={workspaceSearching ? '搜索全部文件' : '搜索当前文件夹'}
          clearLabel='清除文件搜索'
          placeholder='搜索'
          value={actions.query}
          onValueChange={actions.setQuery}
        />
        <div className='work-files-toolbar-actions'>
          <IconButton
            label='新建文件夹'
            disabled={actions.loading || actions.dropImporting || Boolean(actions.error)}
            onClick={() => setCreateFolderRequest((value) => value + 1)}
          >
            <FolderPlus size={16} />
          </IconButton>
          <IconButton
            label='刷新当前文件夹'
            disabled={actions.loading || actions.dropImporting}
            onClick={() => void actions.refresh()}
          >
            <RefreshCw className={actions.loading || actions.dropImporting ? 'spin' : ''} size={15} />
          </IconButton>
          <IconButton
            label='快速查看所选项目'
            disabled={actions.selectedEntries.length !== 1}
            onClick={() => setQuickLookPath(actions.selectedEntries[0]?.path ?? null)}
          >
            <Eye size={15} />
          </IconButton>
          <OfficeSelect
            className='work-files-sort-select'
            ariaLabel='排序方式'
            value={actions.sort.key}
            options={[
              { value: 'name', label: '名称' },
              { value: 'modified', label: '修改日期' },
              { value: 'size', label: '大小' },
              { value: 'kind', label: '种类' },
            ]}
            onValueChange={(key) =>
              actions.setSort({
                ...actions.sort,
                key: key as WorkFilesSortKey,
              })
            }
          />
          <IconButton
            label={actions.sort.direction === 'ascending' ? '切换为降序' : '切换为升序'}
            onClick={() =>
              actions.setSort({
                ...actions.sort,
                direction: actions.sort.direction === 'ascending' ? 'descending' : 'ascending',
              })
            }
          >
            {actions.sort.direction === 'ascending' ? <ArrowDownAZ size={15} /> : <ArrowDownZA size={15} />}
          </IconButton>
          <fieldset className='work-files-layout-toggle'>
            <legend className='sr-only'>文件布局</legend>
            <IconButton
              label='图标视图'
              selected={actions.layout === 'grid'}
              className={actions.layout === 'grid' ? 'active' : ''}
              onClick={() => actions.setLayout('grid')}
            >
              <Grid2X2 size={15} />
            </IconButton>
            <IconButton
              label='列表视图'
              selected={actions.layout === 'list'}
              className={actions.layout === 'list' ? 'active' : ''}
              onClick={() => actions.setLayout('list')}
            >
              <List size={16} />
            </IconButton>
          </fieldset>
          <Button
            tone='quiet'
            className={`work-copilot-toggle ${copilotOpen ? 'active' : ''}`}
            aria-label={copilotOpen ? '关闭 Work AI 助手' : '打开 Work AI 助手'}
            aria-pressed={copilotOpen}
            onClick={onToggleCopilot}
          >
            <Sparkles size={15} />
            <span>AI 助手</span>
          </Button>
        </div>
      </header>
      {actions.query.trim() && (
        <section className='work-files-search-scope' aria-label='文件搜索范围与状态'>
          <span>搜索范围</span>
          <SegmentedControl<'folder' | 'workspace'>
            ariaLabel='搜索范围'
            value={actions.searchScope}
            size='compact'
            className='work-files-search-scope-control'
            items={[
              {
                id: 'folder',
                label: localPathBasename(actions.currentPath),
                ariaLabel: `仅搜索当前文件夹 ${localPathBasename(actions.currentPath)}`,
              },
              {
                id: 'workspace',
                label: '全部文件',
                ariaLabel: `搜索全部文件 ${localPathBasename(actions.rootPath)}`,
              },
            ]}
            onChange={actions.setSearchScope}
          />
          {workspaceSearching && actions.searchError && (
            <output aria-label='文件搜索失败'>
              <StatusBadge tone='danger'>搜索失败：{actions.searchError}</StatusBadge>
            </output>
          )}
          {workspaceSearching && !actions.searchError && actions.searchTruncated && (
            <output aria-label='搜索结果已截断'>
              <StatusBadge tone='warning'>结果较多，仅显示前一部分。</StatusBadge>
            </output>
          )}
          {workspaceSearching && actions.searchUnreadableDirectories > 0 && (
            <output aria-label='搜索已跳过文件夹'>
              <StatusBadge tone='warning'>
                已跳过 {actions.searchUnreadableDirectories} 个无法读取的文件夹。
              </StatusBadge>
            </output>
          )}
        </section>
      )}
      {actions.error && !actions.loading ? (
        <StateView
          className='work-files-load-state'
          tone='danger'
          role='alert'
          icon={<FolderOpen size={24} />}
          title='无法读取这个文件夹'
          description={actions.error}
          actions={
            <>
              <Button tone='primary' onClick={() => void actions.refresh()}>
                重试
              </Button>
              <Button onClick={() => void actions.pickRoot()}>选择其他文件夹</Button>
            </>
          }
        />
      ) : (
        <WorkFilesView
          actions={actions}
          openingPath={openingPath}
          createFolderRequest={createFolderRequest}
          onOpenFile={onOpenFile}
          onQuickLook={(entry) => setQuickLookPath(entry.path)}
          onAgentRequest={(request) =>
            onAgentRequest({
              ...request,
              workspaceRoot: actions.rootPath,
            })
          }
          onCreateArtifact={onCreateArtifact}
        />
      )}
      {(actions.loading || actions.dropImporting || actions.searchLoading) && (
        <output className='work-files-loading' aria-live='polite'>
          <span />
          {actions.dropImporting
            ? '正在复制拖入项目…'
            : actions.searchLoading
              ? '正在搜索全部文件…'
              : '正在读取文件夹…'}
        </output>
      )}
      {quickLookEntry && (
        <WorkQuickLook
          entry={quickLookEntry}
          previousEntry={previousQuickLookEntry}
          nextEntry={nextQuickLookEntry}
          onNavigate={(entry) => {
            actions.selectEntry(entry);
            setQuickLookPath(entry.path);
          }}
          onOpen={(entry) => {
            if (entry.isDirectory) actions.navigateTo(entry.path);
            else void onOpenFile(entry);
          }}
          onClose={() => setQuickLookPath(null)}
        />
      )}
    </main>
  );
}
