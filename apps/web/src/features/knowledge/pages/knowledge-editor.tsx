import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Save,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import {
  Button,
  CollectionState,
  IconButton,
  InlineNotice,
  SearchField,
  StateView,
} from '../../../design-system/primitives';
import { codeApi } from '../../../lib/api';
import { appState, formatApiError, showToast } from '../../../state/app-state';
import type { PersonalKnowledgeBase, WorkspaceEntry } from '../../../types/api';
import { localPathBasename } from '../../work/work-local-files';

const StreamingMarkdown = lazy(() => import('../../tasks/components/streaming-markdown'));

export function KnowledgeEditor({
  knowledgeBase,
  onBack,
  onRefreshKnowledge,
}: {
  knowledgeBase: PersonalKnowledgeBase;
  onBack: () => void;
  onRefreshKnowledge: () => void;
}) {
  const state = useSnapshot(appState);
  const [directories, setDirectories] = useState<Record<string, WorkspaceEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [loadingDirectories, setLoadingDirectories] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [draft, setDraft] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const fileRequest = useRef(0);
  const dirty = activePath !== null && content !== draft;

  const loadDirectory = useCallback(async (path: string) => {
    setLoadingDirectories((current) => new Set(current).add(path));
    try {
      const entries = (await codeApi.readDir(path)).filter((entry) => !isHiddenKnowledgeEntry(entry));
      setDirectories((current) => ({ ...current, [path]: entries }));
      return entries;
    } catch (loadError) {
      setError(formatApiError(loadError));
      return [];
    } finally {
      setLoadingDirectories((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
    }
  }, []);

  const openFile = useCallback(async (entry: WorkspaceEntry) => {
    if (!isEditableKnowledgeFile(entry)) {
      setError('当前编辑器仅支持 Markdown、纯文本和常见结构化文本文件。');
      return;
    }
    const request = ++fileRequest.current;
    setActivePath(entry.path);
    setLoadingFile(true);
    setError(null);
    try {
      const result = await codeApi.readFile(entry.path);
      if (request !== fileRequest.current) return;
      setContent(result.content);
      setDraft(result.content);
    } catch (loadError) {
      if (request === fileRequest.current) setError(formatApiError(loadError));
    } finally {
      if (request === fileRequest.current) setLoadingFile(false);
    }
  }, []);

  useEffect(() => {
    fileRequest.current += 1;
    setDirectories({});
    setExpanded(new Set([knowledgeBase.path]));
    setActivePath(null);
    setContent('');
    setDraft('');
    setError(null);
    void loadDirectory(knowledgeBase.path).then((entries) => {
      const first =
        entries.find((entry) => entry.name.toLocaleLowerCase() === 'readme.md') ??
        entries.find(isEditableKnowledgeFile);
      if (first) void openFile(first);
    });
  }, [knowledgeBase.path, loadDirectory, openFile]);

  const save = async () => {
    if (!activePath || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await codeApi.writeFile(activePath, draft);
      setContent(draft);
      showToast('笔记已保存。', 'success');
      onRefreshKnowledge();
    } catch (saveError) {
      setError(formatApiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  const activeName = activePath ? localPathBasename(activePath) : null;
  const dark =
    state.theme === 'dark' || (state.theme === 'system' && document.documentElement.dataset.theme === 'dark');

  return (
    <section className='knowledge-editor' aria-label={`${knowledgeBase.name} 知识库编辑器`}>
      <header className='knowledge-editor-header'>
        <IconButton className='knowledge-editor-back' label='返回我的知识库' onClick={onBack}>
          <ArrowLeft size={17} />
        </IconButton>
        <span className='knowledge-editor-mark'>
          <FolderOpen size={17} />
        </span>
        <div className='knowledge-editor-identity'>
          <h1>{knowledgeBase.name}</h1>
          <span title={knowledgeBase.path}>{knowledgeBase.path}</span>
        </div>
        <div className='knowledge-editor-actions'>
          <Button
            tone='quiet'
            className={previewOpen ? 'active' : ''}
            aria-label={previewOpen ? '关闭 Markdown 预览' : '打开 Markdown 预览'}
            aria-pressed={previewOpen}
            onClick={() => setPreviewOpen((open) => !open)}
          >
            {previewOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            预览
          </Button>
          <Button
            tone='primary'
            aria-label='保存笔记'
            disabled={!dirty || saving || loadingFile}
            loading={saving}
            onClick={() => void save()}
          >
            {!saving && <Save size={15} />}
            {saving ? '保存中' : '保存'}
          </Button>
        </div>
      </header>

      <div className='knowledge-editor-workbench'>
        <aside className='knowledge-vault-explorer' aria-label='知识库文件导航'>
          <header>
            <div>
              <strong>文件</strong>
              <span>{knowledgeBase.sourceCount + knowledgeBase.conceptCount} 项知识内容</span>
            </div>
            <IconButton
              label='刷新知识库文件'
              disabled={loadingDirectories.has(knowledgeBase.path)}
              onClick={() => void loadDirectory(knowledgeBase.path)}
            >
              <RefreshCw className={loadingDirectories.has(knowledgeBase.path) ? 'spin' : ''} size={14} />
            </IconButton>
          </header>
          <SearchField
            className='knowledge-vault-search'
            size='compact'
            label='筛选知识库文件'
            value={query}
            placeholder='筛选文件'
            onValueChange={setQuery}
          />
          <div className='knowledge-vault-tree' role='tree' aria-label='知识库文件'>
            <KnowledgeDirectoryTree
              path={knowledgeBase.path}
              depth={0}
              query={query.trim().toLocaleLowerCase()}
              activePath={activePath}
              directories={directories}
              expanded={expanded}
              loading={loadingDirectories}
              onToggle={(entry) => {
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(entry.path)) next.delete(entry.path);
                  else next.add(entry.path);
                  return next;
                });
                if (!directories[entry.path]) void loadDirectory(entry.path);
              }}
              onOpen={openFile}
            />
          </div>
        </aside>

        <main className={`knowledge-note-workspace ${previewOpen ? 'with-preview' : ''}`}>
          {error && (
            <InlineNotice
              className='knowledge-editor-error'
              tone='danger'
              role='alert'
              actions={
                <Button tone='quiet' onClick={() => setError(null)}>
                  关闭
                </Button>
              }
            >
              {error}
            </InlineNotice>
          )}
          {!activePath ? (
            <StateView
              className='knowledge-note-state'
              size='compact'
              icon={<FilePlus2 size={25} />}
              title='选择一篇笔记开始编辑'
              description='在左侧展开目录并选择 Markdown 文件。'
            />
          ) : loadingFile ? (
            <StateView
              className='knowledge-note-state'
              size='compact'
              role='status'
              icon={<LoaderCircle className='spin' size={22} />}
              title='正在读取笔记…'
            />
          ) : (
            <>
              <section className='knowledge-note-source'>
                <header>
                  <FileText size={14} />
                  <strong>{activeName}</strong>
                  <span>{dirty ? '未保存' : '已保存'}</span>
                </header>
                <textarea
                  value={draft}
                  aria-label={`编辑 ${activeName}`}
                  spellCheck
                  data-theme={dark ? 'dark' : 'light'}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </section>
              {previewOpen && (
                <section className='knowledge-note-preview' aria-label='Markdown 预览'>
                  <header>阅读视图</header>
                  <div className='execution-markdown'>
                    <Suspense fallback={<p>{draft}</p>}>
                      <StreamingMarkdown content={draft} streaming={false} />
                    </Suspense>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </section>
  );
}

function KnowledgeDirectoryTree({
  path,
  depth,
  query,
  activePath,
  directories,
  expanded,
  loading,
  onToggle,
  onOpen,
}: {
  path: string;
  depth: number;
  query: string;
  activePath: string | null;
  directories: Record<string, WorkspaceEntry[]>;
  expanded: Set<string>;
  loading: Set<string>;
  onToggle: (entry: WorkspaceEntry) => void;
  onOpen: (entry: WorkspaceEntry) => void;
}) {
  const entries = useMemo(
    () =>
      [...(directories[path] ?? [])]
        .filter((entry) => !query || entry.isDirectory || entry.name.toLocaleLowerCase().includes(query))
        .sort(
          (left, right) => Number(right.isDirectory) - Number(left.isDirectory) || left.name.localeCompare(right.name)
        ),
    [directories, path, query]
  );
  return (
    <div>
      {loading.has(path) && !directories[path] && (
        <CollectionState
          className='knowledge-vault-state'
          role='status'
          icon={<LoaderCircle className='spin' size={13} />}
        >
          正在读取…
        </CollectionState>
      )}
      {entries.map((entry) => {
        const open = entry.isDirectory && expanded.has(entry.path);
        return (
          <div key={entry.path}>
            <button
              type='button'
              role='treeitem'
              aria-level={depth + 1}
              aria-expanded={entry.isDirectory ? open : undefined}
              aria-selected={!entry.isDirectory && activePath === entry.path}
              className={activePath === entry.path ? 'active' : ''}
              style={{ paddingLeft: 8 + depth * 13 }}
              onClick={() => (entry.isDirectory ? onToggle(entry) : onOpen(entry))}
            >
              <span>{entry.isDirectory ? open ? <ChevronDown size={12} /> : <ChevronRight size={12} /> : null}</span>
              {entry.isDirectory ? open ? <FolderOpen size={15} /> : <Folder size={15} /> : <FileText size={14} />}
              <strong title={entry.path}>{entry.name}</strong>
            </button>
            {entry.isDirectory && open && (
              <KnowledgeDirectoryTree
                path={entry.path}
                depth={depth + 1}
                query={query}
                activePath={activePath}
                directories={directories}
                expanded={expanded}
                loading={loading}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            )}
          </div>
        );
      })}
      {!loading.has(path) && directories[path] && entries.length === 0 && (
        <CollectionState className='knowledge-vault-state' role='status'>
          目录为空
        </CollectionState>
      )}
    </div>
  );
}

function isHiddenKnowledgeEntry(entry: WorkspaceEntry): boolean {
  return entry.name === '.a3s' || entry.name === '.obsidian' || entry.name === '.git' || entry.name === '.DS_Store';
}

function isEditableKnowledgeFile(entry: WorkspaceEntry): boolean {
  if (!entry.isFile || entry.isBinary) return false;
  return ['md', 'mdx', 'txt', 'json', 'yaml', 'yml', 'csv', 'tsv'].includes(
    (entry.extension ?? '').toLocaleLowerCase()
  );
}
