import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  FileDiff,
  LoaderCircle,
  MessageSquareText,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, IconButton } from '../../../design-system/primitives';
import type { WorkspaceActions } from '../workspace-actions';
import { isFileEditorTabDirty, workspaceRelativePath } from '../workspace-state';
import {
  appendTaskInstruction,
  appState,
  navigateTask,
  sessionTitle,
  showToast,
  switchActiveTask,
} from '../../../state/app-state';
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
  const activeTab = state.editorTabs.find((tab) => tab.id === state.activeEditorTabId);
  const dark =
    state.theme === 'dark' || (state.theme === 'system' && document.documentElement.dataset.theme === 'dark');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 's' && activeTab?.kind === 'file') {
        event.preventDefault();
        if (appState.reviewIntent !== 'select-context') void actions.saveEditorTab(activeTab.id);
        return;
      }
      if (modifier && event.key.toLowerCase() === 'w' && activeTab) {
        event.preventDefault();
        actions.closeEditorTab(activeTab.id);
        return;
      }
      if (event.ctrlKey && event.key === 'Tab' && state.editorTabs.length > 1) {
        event.preventDefault();
        const index = state.editorTabs.findIndex((tab) => tab.id === state.activeEditorTabId);
        const offset = event.shiftKey ? -1 : 1;
        const next = state.editorTabs[(index + offset + state.editorTabs.length) % state.editorTabs.length];
        actions.activateEditorTab(next.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, activeTab, state.activeEditorTabId, state.editorTabs]);

  return (
    <main className='workspace-editor'>
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
          <EditorToolbar actions={actions} />
          {activeTab.kind === 'file' ? (
            <FileEditorContent actions={actions} dark={dark} />
          ) : (
            <DiffEditorContent actions={actions} dark={dark} />
          )}
        </section>
      )}
    </main>
  );
}

function EditorToolbar({ actions }: { actions: WorkspaceActions }) {
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

function FileEditorContent({ actions, dark }: { actions: WorkspaceActions; dark: boolean }) {
  const state = useSnapshot(appState);
  const tab = state.editorTabs.find((candidate) => candidate.id === state.activeEditorTabId);
  const [intelligenceStatus, setIntelligenceStatus] = useState('代码导航连接中');
  useEffect(() => {
    setIntelligenceStatus('代码导航连接中');
  }, [tab?.id]);
  if (tab?.kind !== 'file') return null;
  const dirty = isFileEditorTabDirty(tab);
  const isConfig = basename(tab.path) === 'config.acl';
  const selectingContext = state.reviewIntent === 'select-context';

  return (
    <>
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
              key={tab.id}
              path={tab.path}
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
            />
          </Suspense>
        )}
      </div>
      <EditorStatusBar
        left={languageLabel(tab.path)}
        items={[
          selectingContext ? '只读' : dirty ? '未保存' : '已保存',
          'UTF-8',
          'LF',
          ...(!tab.isBinary && !tab.loading && !tab.loadError ? [intelligenceStatus] : []),
        ]}
      />
    </>
  );
}

function DiffEditorContent({ actions, dark }: { actions: WorkspaceActions; dark: boolean }) {
  const state = useSnapshot(appState);
  const tab = state.editorTabs.find((candidate) => candidate.id === state.activeEditorTabId);
  if (tab?.kind !== 'diff') return null;
  return (
    <>
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
      <div className='workspace-editor-empty-content'>
        <FileCode2 size={30} />
        <strong>{state.reviewIntent === 'select-context' ? '选择一个上下文文件' : '打开文件开始工作'}</strong>
        <p>
          {state.reviewIntent === 'select-context'
            ? '从左侧资源管理器打开文件，确认内容后将它加入当前任务。'
            : '文件和差异会保留在同一标签栏，切换标签不会丢失草稿。'}
        </p>
        <div className='workspace-editor-shortcuts'>
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
      </div>
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
    <div className={`workspace-editor-state ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {icon}
      <strong>{title}</strong>
      {description && <span>{description}</span>}
      {action}
    </div>
  );
}

function EditorStatusBar({ left, items }: { left: string; items: string[] }) {
  return (
    <footer className='workspace-editor-statusbar'>
      <span>{left}</span>
      <div>
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
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

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}
