import { FileSearch, LoaderCircle, Replace, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, Dialog, IconButton } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { isFileEditorTabDirty } from '../workspace-state';

export function WorkspaceSearchPanel({ actions, onClose }: { actions: WorkspaceActions; onClose: () => void }) {
  const state = useSnapshot(appState);
  const [query, setQuery] = useState(() => appState.workspaceSearchQuery);
  const [replacement, setReplacement] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const files = state.workspaceSearchResults;
  const searchedQuery = state.workspaceSearchQuery;
  const resultsCurrent = Boolean(searchedQuery && searchedQuery === query.trim());
  const matchCount = files.reduce((count, file) => count + file.matches.length, 0);
  const dirtyInScope = Boolean(
    state.editorTabs.some(
      (tab) => tab.kind === 'file' && files.some((file) => file.path === tab.path) && isFileEditorTabDirty(tab)
    )
  );
  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => restoreFocusRef.current?.focus();
  }, []);
  const search = () => {
    if (query.trim()) void actions.searchWorkspace(query.trim());
  };
  const replace = async () => {
    try {
      await actions.replaceWorkspace(
        searchedQuery,
        replacement,
        files.map((file) => file.path)
      );
      setReplaceOpen(false);
    } catch {
      // Keep the reviewed scope open so the user can retry safely.
    }
  };
  return (
    <aside
      className='workspace-search-panel'
      aria-label='全局搜索与替换'
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !replaceOpen) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header>
        <div>
          <span className='eyebrow'>SEARCH</span>
          <strong>全局搜索</strong>
        </div>
        <IconButton label='关闭全局搜索' onClick={onClose}>
          <X size={15} />
        </IconButton>
      </header>
      <div className='workspace-search-form'>
        <label>
          <Search size={14} />
          <input
            ref={inputRef}
            aria-label='全局搜索内容'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') search();
            }}
            placeholder='搜索工作区内容'
          />
        </label>
        <label>
          <Replace size={14} />
          <input
            aria-label='替换为'
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            placeholder='替换为'
          />
        </label>
        <div>
          <Button tone='primary' disabled={!query.trim()} loading={state.workspaceSearchLoading} onClick={search}>
            搜索
          </Button>
          <Button disabled={!matchCount || !resultsCurrent} onClick={() => setReplaceOpen(true)}>
            替换全部
          </Button>
        </div>
        {searchedQuery && !resultsCurrent && (
          <p className='search-scope-notice'>当前结果来自“{searchedQuery}”；重新搜索后才能替换。</p>
        )}
      </div>
      <div className='workspace-search-results'>
        {state.fileLoadError && files.some((file) => file.path === state.fileLoadError?.selection.path) && (
          <div className='workspace-file-load-error' role='alert'>
            <div>
              <strong>无法打开 {relativePath(state.fileLoadError.selection.path, state.workspaceRoot)}</strong>
              <span>{state.fileLoadError.message} 搜索结果仍保留，可以重试或选择其他文件。</span>
            </div>
            <Button
              onClick={() => {
                const selection = appState.fileLoadError?.selection;
                if (!selection) return;
                void actions.selectFile(selection).then((selected) => {
                  if (selected) onClose();
                });
              }}
            >
              重试打开
            </Button>
          </div>
        )}
        {state.workspaceSearchLoading ? (
          <div className='workspace-search-empty'>
            <LoaderCircle className='spin' size={18} />
            正在搜索
          </div>
        ) : (
          <>
            {state.workspaceSearchError && (
              <div className='workspace-search-empty search-error' role='alert'>
                <FileSearch size={22} />
                <strong>搜索失败</strong>
                <p>
                  {state.workspaceSearchError} {files.length ? '当前仍显示上一次结果。' : '可以检查连接后重新搜索。'}
                </p>
                <Button tone='primary' onClick={search}>
                  重新搜索
                </Button>
              </div>
            )}
            {files.map((file) => (
              <section key={file.path}>
                <button
                  type='button'
                  aria-label={`打开 ${relativePath(file.path, state.workspaceRoot)}`}
                  onClick={() => {
                    void actions.selectFile({ path: file.path, isBinary: false }).then((selected) => {
                      if (selected) onClose();
                    });
                  }}
                >
                  <FileSearch size={13} />
                  <strong>{relativePath(file.path, state.workspaceRoot)}</strong>
                  <span>{file.matches.length}</span>
                </button>
                {file.matches.map((match) => (
                  <button
                    type='button'
                    className='workspace-search-match'
                    aria-label={`打开 ${relativePath(file.path, state.workspaceRoot)} 第 ${match.line} 行`}
                    key={`${match.line}:${match.column}`}
                    onClick={() => {
                      void actions
                        .selectFile({
                          path: file.path,
                          isBinary: false,
                          line: match.line,
                          column: match.column,
                        })
                        .then((selected) => {
                          if (selected) onClose();
                        });
                    }}
                  >
                    <span>{match.line}</span>
                    <code>{match.text.trim()}</code>
                  </button>
                ))}
              </section>
            ))}
            {!files.length && !state.workspaceSearchError && (
              <div className='workspace-search-empty'>
                <FileSearch size={22} />
                <strong>{searchedQuery ? `“${searchedQuery}”没有匹配结果` : '搜索整个工作区'}</strong>
                <p>{searchedQuery ? '修改关键词后重新搜索。' : '结果会按文件和行号分组。'}</p>
              </div>
            )}
          </>
        )}
      </div>
      {replaceOpen && (
        <Dialog
          title='替换工作区内容'
          description={`将在 ${files.length} 个文件中替换“${searchedQuery}”的 ${matchCount} 处匹配。`}
          closeDisabled={state.workspaceReplaceLoading}
          onClose={() => setReplaceOpen(false)}
          footer={
            <>
              <Button tone='quiet' disabled={state.workspaceReplaceLoading} onClick={() => setReplaceOpen(false)}>
                取消
              </Button>
              <Button
                tone='danger'
                disabled={dirtyInScope}
                loading={state.workspaceReplaceLoading}
                onClick={() => {
                  void replace();
                }}
              >
                确认替换
              </Button>
            </>
          }
        >
          <p>
            <code>{searchedQuery}</code> → <code>{replacement || '空文本'}</code>
          </p>
          {dirtyInScope && <p className='destructive-warning'>替换范围包含未保存文件，请先保存或放弃编辑。</p>}
        </Dialog>
      )}
    </aside>
  );
}

function relativePath(path: string, root: string) {
  return path.startsWith(root) ? path.slice(root.length).replace(/^[/\\]/, '') : path;
}
