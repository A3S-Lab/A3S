import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  FileDiff,
  FileSearch,
  LoaderCircle,
  MessageSquareText,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, IconButton, StateView } from '../../../design-system/primitives';
import {
  appendTaskInstruction,
  appState,
  navigateTask,
  sessionTitle,
  showToast,
  switchActiveTask,
} from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { isFileEditorTabDirty, workspaceRelativePath } from '../workspace-state';
import { type CodeEditorNavigationAction, CodeNavigationMenu } from './code-navigation-menu';
import { LineEndingStatusControl } from './line-ending-status-control';
import type { MonacoCodeEditorHandle } from './monaco-code-editor';
import { workspaceEditorModelPath } from './monaco-editor-model-store';
import type { MonacoEditorStatus } from './monaco-editor-status';
import { WorkspaceEditorTabs } from './workspace-editor-tabs';
import { WorkspaceFileIcon } from './workspace-file-icon';

const MonacoCodeEditor = lazy(() =>
  import('./monaco-code-editor').then((module) => ({ default: module.MonacoCodeEditor }))
);
const MonacoDiffEditor = lazy(() =>
  import('./monaco-diff-editor').then((module) => ({ default: module.MonacoDiffEditor }))
);

export function WorkspaceEditor({ actions }: { actions: WorkspaceActions }) {
  const state = useSnapshot(appState);
  const rootRef = useRef<HTMLElement>(null);
  const previousTabIdsRef = useRef(state.editorTabs.map((tab) => tab.id));
  const previousActiveTabIdRef = useRef(state.activeEditorTabId);
  const [pendingEditorFocusTabId, setPendingEditorFocusTabId] = useState<string | null>(null);
  const activeTab = state.editorTabs.find((tab) => tab.id === state.activeEditorTabId);
  const dark =
    state.theme === 'dark' || (state.theme === 'system' && document.documentElement.dataset.theme === 'dark');

  useLayoutEffect(() => {
    const currentTabIds = state.editorTabs.map((tab) => tab.id);
    const removedTab = previousTabIdsRef.current.some((tabId) => !currentTabIds.includes(tabId));
    const activeTabChanged = previousActiveTabIdRef.current !== state.activeEditorTabId;
    previousTabIdsRef.current = currentTabIds;
    previousActiveTabIdRef.current = state.activeEditorTabId;
    if (!removedTab && !activeTabChanged) return;
    const activeElement = document.activeElement;
    const focusWasLost =
      !(activeElement instanceof HTMLElement) || activeElement === document.body || !activeElement.isConnected;
    if (!focusWasLost) return;
    const target = state.activeEditorTabId
      ? rootRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      : rootRef.current?.querySelector<HTMLElement>('.workspace-editor-empty button');
    target?.focus({ preventScroll: true });
  }, [state.activeEditorTabId, state.editorTabs]);

  const completeEditorFocusRequest = useCallback((tabId: string) => {
    setPendingEditorFocusTabId((pendingTabId) => (pendingTabId === tabId ? null : pendingTabId));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Node) || !rootRef.current?.contains(event.target)) {
        return;
      }
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 's' && activeTab?.kind === 'file') {
        event.preventDefault();
        if (appState.reviewIntent !== 'select-context') void actions.saveEditorTab(activeTab.id);
        return;
      }
      if (modifier && event.key.toLowerCase() === 'w' && activeTab) {
        event.preventDefault();
        const index = state.editorTabs.findIndex((tab) => tab.id === activeTab.id);
        const next = state.editorTabs[index + 1] ?? state.editorTabs[index - 1];
        const startedInEditor =
          event.target instanceof Element && event.target.closest('.monaco-editor-surface') !== null;
        actions.closeEditorTab(activeTab.id);
        if (startedInEditor && next && appState.activeEditorTabId === next.id) {
          setPendingEditorFocusTabId(next.id);
        }
        return;
      }
      if (event.ctrlKey && event.key === 'Tab' && state.editorTabs.length > 1) {
        event.preventDefault();
        const index = state.editorTabs.findIndex((tab) => tab.id === state.activeEditorTabId);
        const offset = event.shiftKey ? -1 : 1;
        const next = state.editorTabs[(index + offset + state.editorTabs.length) % state.editorTabs.length];
        const startedInEditor =
          event.target instanceof Element && event.target.closest('.monaco-editor-surface') !== null;
        setPendingEditorFocusTabId(startedInEditor ? next.id : null);
        actions.activateEditorTab(next.id);
        return;
      }
      if (event.ctrlKey && !event.metaKey && !event.altKey && event.code === 'Minus') {
        const navigate = event.shiftKey ? actions.navigateEditorForward : actions.navigateEditorBack;
        const available = event.shiftKey ? actions.canNavigateEditorForward : actions.canNavigateEditorBack;
        if (!available) return;
        event.preventDefault();
        void navigate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, activeTab, state.activeEditorTabId, state.editorTabs]);

  return (
    <main ref={rootRef} className='workspace-editor'>
      <ReviewContext />
      <WorkspaceEditorTabs actions={actions} />
      {!activeTab ? (
        <WorkspaceEditorEmpty />
      ) : (
        <section
          className={`workspace-editor-panel ${activeTab.kind === 'diff' ? 'diff-review' : ''}`}
          id='workspace-editor-active-panel'
          role='tabpanel'
          aria-label={
            activeTab.kind === 'diff' ? `差异 ${basename(activeTab.path)}` : `文件 ${basename(activeTab.path)}`
          }
        >
          {activeTab.kind === 'file' ? (
            <FileEditorContent
              actions={actions}
              dark={dark}
              focusRequested={pendingEditorFocusTabId === activeTab.id}
              onFocusRequestHandled={completeEditorFocusRequest}
            />
          ) : (
            <DiffEditorContent
              actions={actions}
              dark={dark}
              focusRequested={pendingEditorFocusTabId === activeTab.id}
              onFocusRequestHandled={completeEditorFocusRequest}
            />
          )}
        </section>
      )}
    </main>
  );
}

function EditorToolbar({
  actions,
  codeNavigation,
}: {
  actions: WorkspaceActions;
  codeNavigation?: { disabled: boolean; onSelect: (action: CodeEditorNavigationAction) => void };
}) {
  const state = useSnapshot(appState);
  const tab = state.editorTabs.find((candidate) => candidate.id === state.activeEditorTabId);
  if (!tab) return null;
  const relative = workspaceRelativePath(tab.path, state.workspaceRoot);
  const segments = relative.split('/').filter(Boolean);
  const selectingContext = state.reviewIntent === 'select-context';
  const dirty = tab.kind === 'file' && isFileEditorTabDirty(tab);
  return (
    <header className='workspace-editor-toolbar'>
      <div className='workspace-breadcrumbs' title={relative}>
        {tab.kind === 'diff' ? <FileDiff size={14} /> : <WorkspaceFileIcon path={tab.path} size={14} />}
        {segments.map((segment, index) => (
          <span key={`${segment}:${index}`}>
            {index > 0 && <ChevronRight size={11} />}
            <span>{segment}</span>
          </span>
        ))}
        {tab.kind === 'diff' && <em>{tab.staged ? '已暂存差异' : '工作树差异'}</em>}
        {dirty && <em className='workspace-unsaved-label'>未保存</em>}
      </div>
      <div className='workspace-editor-actions'>
        <IconButton
          label='返回上一个编辑位置'
          tooltip='返回上一个编辑位置 (Ctrl -)'
          disabled={!actions.canNavigateEditorBack}
          onClick={() => void actions.navigateEditorBack()}
        >
          <ArrowLeft size={14} />
        </IconButton>
        <IconButton
          label='前往下一个编辑位置'
          tooltip='前往下一个编辑位置 (Ctrl Shift -)'
          disabled={!actions.canNavigateEditorForward}
          onClick={() => void actions.navigateEditorForward()}
        >
          <ArrowRight size={14} />
        </IconButton>
        {codeNavigation && <CodeNavigationMenu {...codeNavigation} />}
        {tab.kind === 'diff' && (
          <IconButton
            label='打开文件'
            disabled={tab.loading}
            onClick={() => {
              void actions.selectFile({
                path: absoluteWorkspacePath(tab.path, state.workspaceRoot),
                isBinary: tab.isBinary,
              });
            }}
          >
            <FileCode2 size={14} />
          </IconButton>
        )}
        {tab.kind === 'file' && basename(tab.path) === 'config.acl' && !tab.isBinary && !selectingContext && (
          <IconButton label='验证配置' disabled={tab.loading} onClick={() => void actions.validateActiveConfig()}>
            <ShieldAlert size={14} />
          </IconButton>
        )}
        {tab.kind === 'file' && !tab.isBinary && !selectingContext && (
          <IconButton
            label={tab.saving ? '正在保存' : '保存文件'}
            disabled={!dirty || tab.loading || tab.saving}
            onClick={() => void actions.saveEditorTab(tab.id)}
          >
            {tab.saving ? <LoaderCircle className='spin' size={14} /> : <Save size={14} />}
          </IconButton>
        )}
      </div>
    </header>
  );
}

function FileEditorContent({
  actions,
  dark,
  focusRequested,
  onFocusRequestHandled,
}: {
  actions: WorkspaceActions;
  dark: boolean;
  focusRequested: boolean;
  onFocusRequestHandled: (tabId: string) => void;
}) {
  const state = useSnapshot(appState);
  const tab = state.editorTabs.find((candidate) => candidate.id === state.activeEditorTabId);
  const editorRef = useRef<MonacoCodeEditorHandle>(null);
  const [readyEditorModelPath, setReadyEditorModelPath] = useState<string | null>(null);
  const [intelligenceStatus, setIntelligenceStatus] = useState('代码导航连接中');
  const [editorStatus, setEditorStatus] = useState<{
    modelPath: string;
    value: MonacoEditorStatus | null;
  } | null>(null);
  useEffect(() => {
    setIntelligenceStatus('代码导航连接中');
  }, [tab?.id]);
  if (tab?.kind !== 'file') return null;
  const editorModelPath = workspaceEditorModelPath(state.editorModelScope, tab.path);
  const dirty = isFileEditorTabDirty(tab);
  const isConfig = basename(tab.path) === 'config.acl';
  const selectingContext = state.reviewIntent === 'select-context';
  const activeEditorStatus = editorStatus?.modelPath === editorModelPath ? editorStatus.value : null;
  const selectionStatus = activeEditorStatus ? editorSelectionStatus(activeEditorStatus) : null;
  const editorReady = readyEditorModelPath === editorModelPath;

  return (
    <>
      <EditorToolbar
        actions={actions}
        codeNavigation={
          !tab.isBinary && !tab.loading && !tab.loadError
            ? {
                disabled: !editorReady,
                onSelect: (action) => {
                  if (action === 'outline') editorRef.current?.showOutline();
                  else editorRef.current?.navigate(action);
                },
              }
            : undefined
        }
      />
      {isConfig && !tab.isBinary && tab.configValidation && (
        <section
          className={`config-validation ${tab.configValidation.valid ? 'valid' : 'invalid'}`}
          aria-label='配置验证结果'
        >
          <header>
            {tab.configValidation.valid ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}
            <strong>{tab.configValidation.valid ? '配置有效' : '配置存在问题'}</strong>
            {tab.configValidation.summary && (
              <span>
                {tab.configValidation.summary.providers} providers · {tab.configValidation.summary.models} models ·{' '}
                {tab.configValidation.summary.mcpServers} MCP
              </span>
            )}
            {!tab.configValidation.valid && (state.reviewSourceTaskId || state.activeSessionId) && (
              <Button
                className='config-validation-return'
                tone='primary'
                disabled={dirty}
                onClick={returnConfigFailureToTask}
              >
                <Wrench size={13} />
                添加修复指令并返回
              </Button>
            )}
          </header>
          {tab.configValidation.issues.length > 0 && (
            <ul>
              {tab.configValidation.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          {!tab.configValidation.valid && dirty && (
            <p className='config-validation-save-hint'>请先保存当前编辑，再把磁盘上的配置问题交给 Code 修复。</p>
          )}
        </section>
      )}
      <div className='workspace-editor-content'>
        {tab.loading ? (
          <EditorState icon={<LoaderCircle className='spin' size={18} />} title='正在读取文件' />
        ) : tab.loadError ? (
          <EditorState
            tone='error'
            icon={<FileCode2 size={22} />}
            title={`无法打开 ${basename(tab.path)}`}
            description={tab.loadError}
            action={
              <Button
                onClick={() =>
                  void actions.selectFile({
                    path: tab.path,
                    isBinary: tab.isBinary,
                    line: tab.location?.line,
                    column: tab.location?.column,
                  })
                }
              >
                <RotateCcw size={13} />
                重试
              </Button>
            }
          />
        ) : tab.isBinary ? (
          <EditorState
            icon={<FileCode2 size={24} />}
            title='二进制文件仅供识别'
            description='Web IDE 不会把二进制内容载入文本编辑器，也不会覆盖原文件。'
          />
        ) : (
          <Suspense
            fallback={<EditorState icon={<LoaderCircle className='spin' size={18} />} title='正在启动编辑器' />}
          >
            <MonacoCodeEditor
              ref={editorRef}
              path={tab.path}
              modelPath={editorModelPath}
              value={tab.draft}
              location={tab.location}
              readOnly={selectingContext}
              dark={dark}
              workspaceRoot={state.workspaceRoot}
              sessionId={state.activeSessionId}
              savedDocument={!dirty}
              onChange={(value) => actions.updateEditorDraft(tab.id, value)}
              onSave={() => void actions.saveEditorTab(tab.id)}
              onClose={() => actions.closeEditorTab(tab.id)}
              onNavigate={actions.selectFile}
              onStatusChange={setIntelligenceStatus}
              onEditorStatusChange={(value) => {
                setEditorStatus({ modelPath: editorModelPath, value });
                if (value) {
                  actions.updateEditorPosition?.(tab.id, {
                    line: value.lineNumber,
                    column: value.column,
                  });
                }
              }}
              onLocationApplied={() => actions.consumeEditorLocation(tab.id)}
              onReadyChange={(ready) => {
                setReadyEditorModelPath((readyModelPath) => {
                  if (ready) return editorModelPath;
                  return readyModelPath === editorModelPath ? null : readyModelPath;
                });
                if (ready && focusRequested && editorRef.current?.focus()) {
                  onFocusRequestHandled(tab.id);
                }
              }}
            />
          </Suspense>
        )}
      </div>
      <EditorStatusBar
        left={languageLabel(tab.path)}
        items={[
          selectingContext ? '只读' : dirty ? '未保存' : '已保存',
          ...(activeEditorStatus
            ? [
                `行 ${activeEditorStatus.lineNumber}，列 ${activeEditorStatus.column}`,
                ...(selectionStatus ? [selectionStatus] : []),
                'UTF-8',
                <LineEndingStatusControl
                  key='line-ending'
                  value={activeEditorStatus.lineEnding}
                  disabled={selectingContext}
                  onChange={(lineEnding) => editorRef.current?.setLineEnding(lineEnding)}
                />,
              ]
            : []),
          ...(!tab.isBinary && !tab.loading && !tab.loadError ? [intelligenceStatus] : []),
        ]}
      />
    </>
  );
}

function DiffEditorContent({
  actions,
  dark,
  focusRequested,
  onFocusRequestHandled,
}: {
  actions: WorkspaceActions;
  dark: boolean;
  focusRequested: boolean;
  onFocusRequestHandled: (tabId: string) => void;
}) {
  const state = useSnapshot(appState);
  const tab = state.editorTabs.find((candidate) => candidate.id === state.activeEditorTabId);
  if (tab?.kind !== 'diff') return null;
  return (
    <>
      <EditorToolbar actions={actions} />
      <div className='workspace-editor-content'>
        {tab.loading ? (
          <EditorState icon={<LoaderCircle className='spin' size={18} />} title='正在生成差异' />
        ) : tab.loadError ? (
          <EditorState
            tone='error'
            icon={<FileDiff size={22} />}
            title={`无法读取 ${basename(tab.path)} 的差异`}
            description={tab.loadError}
            action={
              <Button onClick={() => void actions.loadGitDiff(tab.path, tab.staged)}>
                <RotateCcw size={13} />
                重试
              </Button>
            }
          />
        ) : tab.isBinary ? (
          <EditorState
            icon={<FileDiff size={24} />}
            title='二进制文件已发生变化'
            description='该文件没有可供文本差异编辑器比较的内容。'
          />
        ) : tab.original === tab.modified ? (
          <EditorState icon={<CheckCircle2 size={22} />} title='没有可显示的文本差异' />
        ) : (
          <Suspense
            fallback={<EditorState icon={<LoaderCircle className='spin' size={18} />} title='正在启动差异编辑器' />}
          >
            <MonacoDiffEditor
              key={tab.id}
              path={tab.path}
              original={tab.original}
              modified={tab.modified}
              dark={dark}
              focusOnMount={focusRequested}
              onFocusOnMount={() => onFocusRequestHandled(tab.id)}
            />
          </Suspense>
        )}
      </div>
      <EditorStatusBar
        left={tab.staged ? '已暂存差异' : '工作树差异'}
        items={['只读', languageLabel(tab.path), '智能并排']}
      />
    </>
  );
}

function WorkspaceEditorEmpty() {
  const state = useSnapshot(appState);
  return (
    <section className='workspace-editor-empty' id='workspace-editor-active-panel'>
      <StateView
        className='workspace-editor-empty-content'
        icon={<FileCode2 size={30} />}
        title={state.reviewIntent === 'select-context' ? '选择一个上下文文件' : '打开文件开始工作'}
        description={
          state.reviewIntent === 'select-context'
            ? '从左侧资源管理器打开文件，确认内容后将它加入当前任务。'
            : '文件和差异会保留在同一标签栏，切换标签不会丢失草稿。'
        }
      >
        <div className='workspace-editor-shortcuts'>
          <Button
            tone='quiet'
            onClick={() => {
              appState.fileQuickOpenOpen = true;
            }}
          >
            <FileSearch size={13} />
            快速打开 <kbd>⌘/Ctrl P</kbd>
          </Button>
          <span>
            保存 <kbd>⌘/Ctrl S</kbd>
          </span>
          <span>
            关闭标签 <kbd>⌘/Ctrl W</kbd>
          </span>
          <span>
            切换标签 <kbd>Ctrl Tab</kbd>
          </span>
        </div>
      </StateView>
    </section>
  );
}

function EditorState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: 'neutral' | 'error';
}) {
  return (
    <StateView
      className='workspace-editor-state'
      size='compact'
      tone={tone === 'error' ? 'danger' : 'neutral'}
      role={tone === 'error' ? 'alert' : 'status'}
      icon={icon}
      title={title}
      description={description}
      actions={action}
    />
  );
}

function EditorStatusBar({ left, items }: { left: string; items: Array<string | React.ReactElement> }) {
  return (
    <footer className='workspace-editor-statusbar'>
      <span>{left}</span>
      <div>
        {items.map((item, index) =>
          typeof item === 'string' ? (
            <span key={`${item}:${index}`} title={item}>
              {item}
            </span>
          ) : (
            item
          )
        )}
      </div>
    </footer>
  );
}

function ReviewContext() {
  const state = useSnapshot(appState);
  const tab = state.editorTabs.find((candidate) => candidate.id === state.activeEditorTabId);
  const selectedPath = tab?.kind === 'file' ? workspaceRelativePath(tab.path, state.workspaceRoot) : null;
  if (state.reviewIntent === 'select-context') {
    const alreadyAdded = selectedPath ? state.composerContextFiles.includes(selectedPath) : false;
    return (
      <section className='review-context context-selection' aria-label='选择任务上下文'>
        <FileCode2 size={14} />
        <span>
          <small>任务上下文</small>
          <strong>{selectedPath ? `确认添加 ${selectedPath}` : '从左侧选择要交给 Agent 的文件'}</strong>
        </span>
        <Button
          tone='quiet'
          onClick={() => {
            appState.reviewIntent = 'review';
            navigateTask('conversation');
          }}
        >
          <ArrowLeft size={13} />
          取消
        </Button>
        <Button
          tone='primary'
          disabled={!selectedPath || alreadyAdded}
          onClick={() => {
            if (!selectedPath) return;
            if (!appState.composerContextFiles.includes(selectedPath)) {
              appState.composerContextFiles = [...appState.composerContextFiles, selectedPath];
            }
            appState.reviewIntent = 'review';
            navigateTask('conversation');
            showToast(`已添加上下文：${selectedPath}`, 'success');
          }}
        >
          <Plus size={13} />
          {alreadyAdded ? '已添加' : '添加并返回任务'}
        </Button>
      </section>
    );
  }
  const task = state.sessions.find((session) => session.sessionId === state.reviewSourceTaskId);
  if (!task) return null;
  return (
    <section className='review-context' aria-label='来源任务'>
      <MessageSquareText size={14} />
      <span>
        <small>来源任务</small>
        <strong>{sessionTitle(task)}</strong>
      </span>
      <Button
        tone='quiet'
        onClick={() => {
          if (appState.activeSessionId !== task.sessionId) switchActiveTask(task.sessionId);
          navigateTask('conversation');
        }}
      >
        <ArrowLeft size={13} />
        返回任务
      </Button>
    </section>
  );
}

function returnConfigFailureToTask() {
  const tab = appState.editorTabs.find((candidate) => candidate.id === appState.activeEditorTabId);
  if (tab?.kind !== 'file' || !tab.configValidation) return;
  const sourceTaskId = appState.sessions.some((task) => task.sessionId === appState.reviewSourceTaskId)
    ? appState.reviewSourceTaskId
    : appState.activeSessionId;
  if (!sourceTaskId) return;
  if (appState.activeSessionId !== sourceTaskId) switchActiveTask(sourceTaskId);
  const path = workspaceRelativePath(tab.path, appState.workspaceRoot);
  if (!appState.composerContextFiles.includes(path)) {
    appState.composerContextFiles = [...appState.composerContextFiles, path];
  }
  const request = [
    `请修复 ${path} 的配置问题，并在修改后重新验证。`,
    tab.configValidation.issues.length
      ? `验证问题：\n${tab.configValidation.issues.map((issue) => `- ${issue}`).join('\n')}`
      : '配置验证未通过。',
  ].join('\n\n');
  appendTaskInstruction(request);
  appState.reviewIntent = 'review';
  navigateTask('conversation');
}

function absoluteWorkspacePath(path: string, root: string): string {
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return path;
  const separator = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  return `${root.replace(/[\\/]$/, '')}${separator}${path}`;
}

function languageLabel(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  const labels: Record<string, string> = {
    acl: 'A3S ACL',
    css: 'CSS',
    go: 'Go',
    hcl: 'HCL',
    html: 'HTML',
    js: 'JavaScript',
    json: 'JSON',
    jsx: 'JavaScript React',
    md: 'Markdown',
    py: 'Python',
    rs: 'Rust',
    sh: 'Shell',
    toml: 'TOML',
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    yaml: 'YAML',
    yml: 'YAML',
  };
  return (extension && labels[extension]) || '纯文本';
}

function editorSelectionStatus(status: MonacoEditorStatus): string | null {
  if (status.selectedCharacters > 0) {
    const locations = status.selectionCount > 1 ? `（${status.selectionCount} 处）` : '';
    return `已选择 ${status.selectedCharacters} 个字符${locations}`;
  }
  return status.selectionCount > 1 ? `${status.selectionCount} 个光标` : null;
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}
