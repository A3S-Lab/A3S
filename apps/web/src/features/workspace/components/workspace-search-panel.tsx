import { FileSearch, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import {
  Button,
  Dialog,
  Field,
  IconButton,
  InlineNotice,
  SearchField,
  StateView,
} from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { workspaceSearchMatchPreview, type WorkspaceSearchScope } from '../workspace-search';
import { isFileEditorTabDirty } from '../workspace-state';

export function WorkspaceSearchPanel({ actions, onClose }: { actions: WorkspaceActions; onClose: () => void }) {
  const state = useSnapshot(appState);
  const [query, setQuery] = useState(() => appState.workspaceSearchQuery);
  const [scope, setScope] = useState<WorkspaceSearchScope>(() => appState.workspaceSearchScope);
  const [replacement, setReplacement] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const files = state.workspaceSearchResults;
  const searchedQuery = state.workspaceSearchQuery;
  const queryCurrent = Boolean(searchedQuery && searchedQuery === query.trim());
  const scopeCurrent = state.workspaceSearchResultScope === scope;
  const rootCurrent = state.workspaceSearchResultRoot === state.workspaceRoot;
  const resultsCurrent = queryCurrent && scopeCurrent && rootCurrent;
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
  const search = (nextScope = scope) => {
    if (query.trim()) void actions.searchWorkspace(query.trim(), { scope: nextScope });
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
        <div className='workspace-search-actions'>
          <span className='eyebrow'>SEARCH</span>
          <strong>全局搜索</strong>
        </div>
        <IconButton label='关闭全局搜索' onClick={onClose}>
          <X size={15} />
        </IconButton>
      </header>
      <div className='workspace-search-form'>
        <SearchField
          ref={inputRef}
          size='compact'
          label='全局搜索内容'
          clearLabel='清除全局搜索'
          value={query}
          onValueChange={setQuery}
          onKeyDown={(event) => {
            if (event.key === 'Enter') search();
          }}
          placeholder='搜索工作区内容'
        />
        <Field className='workspace-replace-field' label='替换为'>
          <input
            aria-label='替换为'
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            placeholder='替换为'
          />
        </Field>
        <div>
          <Button
            tone='primary'
            disabled={!query.trim()}
            loading={state.workspaceSearchLoading}
            onClick={() => search()}
          >
            搜索
          </Button>
          <Button
            disabled={
              !matchCount || !resultsCurrent || state.workspaceSearchLoading || state.workspaceSearchResultsTruncated
            }
            onClick={() => setReplaceOpen(true)}
          >
            替换全部
          </Button>
        </div>
        <label className='workspace-search-scope'>
          <input
            type='checkbox'
            aria-label='包含依赖与构建目录'
            checked={scope === 'all'}
            onChange={(event) => {
              const nextScope = event.currentTarget.checked ? 'all' : 'source';
              setScope(nextScope);
              void actions.searchWorkspace(query.trim(), { scope: nextScope });
            }}
          />
          <span>
            包含依赖与构建目录
            <small>默认忽略版本库元数据、依赖缓存和构建产物</small>
          </span>
        </label>
        {searchedQuery && !resultsCurrent && (
          <InlineNotice className='workspace-search-notice' tone='warning' role='note'>
            {!queryCurrent
              ? `当前结果来自“${searchedQuery}”；重新搜索后才能替换。`
              : !scopeCurrent
                ? '搜索范围已变化；重新搜索后才能替换。'
                : '工作区已变化；重新搜索后才能替换。'}
          </InlineNotice>
        )}
        {resultsCurrent && state.workspaceSearchResultsTruncated && (
          <InlineNotice className='workspace-search-notice' tone='warning' role='note'>
            结果超过 300 处；请缩小搜索范围后再替换。
          </InlineNotice>
        )}
      </div>
      <div className='workspace-search-results'>
        {state.fileLoadError && files.some((file) => file.path === state.fileLoadError?.selection.path) && (
          <InlineNotice
            className='workspace-search-notice'
            tone='danger'
            role='alert'
            title={`无法打开 ${relativePath(state.fileLoadError.selection.path, state.workspaceRoot)}`}
            actions={
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
            }
          >
            {state.fileLoadError.message} 搜索结果仍保留，可以重试或选择其他文件。
          </InlineNotice>
        )}
        {state.workspaceSearchLoading ? (
          <StateView
            className='workspace-search-state'
            size='compact'
            role='status'
            icon={<LoaderCircle className='spin' size={18} />}
            title='正在搜索'
          />
        ) : (
          <>
            {state.workspaceSearchError && files.length > 0 && (
              <InlineNotice
                className='workspace-search-notice'
                tone='danger'
                role='alert'
                title='搜索失败'
                actions={
                  <Button tone='quiet' onClick={() => search()}>
                    重新搜索
                  </Button>
                }
              >
                {state.workspaceSearchError} 当前仍显示上一次结果。
              </InlineNotice>
            )}
            {state.workspaceSearchError && files.length === 0 && (
              <StateView
                className='workspace-search-state search-error'
                size='compact'
                tone='danger'
                role='alert'
                icon={<FileSearch size={22} />}
                title='搜索失败'
                description={`${state.workspaceSearchError} 可以检查连接后重新搜索。`}
                actions={
                  <Button tone='primary' onClick={() => search()}>
                    重新搜索
                  </Button>
                }
              />
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
                {file.matches.map((match) => {
                  const preview = workspaceSearchMatchPreview(match, searchedQuery);
                  return (
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
                      <code>
                        {preview.before}
                        {preview.match && <mark>{preview.match}</mark>}
                        {preview.after}
                      </code>
                    </button>
                  );
                })}
              </section>
            ))}
            {!files.length && !state.workspaceSearchError && (
              <StateView
                className='workspace-search-state'
                size='compact'
                icon={<FileSearch size={22} />}
                title={searchedQuery ? `“${searchedQuery}”没有匹配结果` : '搜索整个工作区'}
                description={searchedQuery ? '修改关键词后重新搜索。' : '结果会按文件和行号分组。'}
              />
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
          {dirtyInScope && (
            <InlineNotice tone='warning' role='alert' title='替换已暂停'>
              替换范围包含未保存文件，请先保存或放弃编辑。
            </InlineNotice>
          )}
        </Dialog>
      )}
    </aside>
  );
}

function relativePath(path: string, root: string) {
  return path.startsWith(root) ? path.slice(root.length).replace(/^[/\\]/, '') : path;
}
