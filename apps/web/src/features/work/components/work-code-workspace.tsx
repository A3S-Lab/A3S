import { ArrowLeft, Braces, LoaderCircle, MessageSquareText, RefreshCw, Save, Sparkles, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, Dialog, InlineNotice } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { WorkspaceEntry } from '../../../types/api';
import { MonacoCodeEditor } from '../../workspace/components/monaco-code-editor';
import { workspaceEditorModelPath } from '../../workspace/components/monaco-editor-model-store';
import type { MonacoEditorStatus } from '../../workspace/components/monaco-editor-status';
import type { WorkCodeActions } from '../use-work-code-controller';
import type { WorkAgentRequest } from '../work-agent-request';
import { localPathBasename, relativeLocalPath, workFileExtension } from '../work-local-files';
import { WorkFileIcon } from './work-file-icon';
import { WorkIdeExplorer } from './work-ide-explorer';

const StreamingMarkdown = lazy(() => import('../../tasks/components/streaming-markdown'));

export function WorkCodeWorkspace({
  actions,
  rootPath,
  assistantOpen,
  onBack,
  onOpenEntry,
  onToggleAssistant,
  onAgentRequest,
}: {
  actions: WorkCodeActions;
  rootPath: string;
  assistantOpen: boolean;
  onBack: () => void;
  onOpenEntry: (entry: WorkspaceEntry) => void | Promise<void>;
  onToggleAssistant: () => void;
  onAgentRequest: (request: WorkAgentRequest) => void | Promise<void>;
}) {
  const state = useSnapshot(appState);
  const [intelligenceStatus, setIntelligenceStatus] = useState('代码导航连接中');
  const [editorStatus, setEditorStatus] = useState<MonacoEditorStatus | null>(null);
  const tab = actions.activeTab;
  const dark =
    state.theme === 'dark' || (state.theme === 'system' && document.documentElement.dataset.theme === 'dark');

  useEffect(() => {
    setIntelligenceStatus('代码导航连接中');
    setEditorStatus(null);
  }, [tab?.path]);

  return (
    <section className='work-code-workspace' aria-label='Work WebIDE'>
      <header className='work-code-header'>
        <button type='button' className='work-code-back' aria-label='返回 Work 文件管理器' onClick={onBack}>
          <ArrowLeft size={17} />
        </button>
        <span className='work-code-brand-mark'>
          <Braces size={17} />
        </span>
        <div className='work-code-identity'>
          <strong>Work WebIDE</strong>
          <span title={rootPath}>{localPathBasename(rootPath)}</span>
        </div>
        <div className='work-code-header-actions'>
          {tab && (
            <button
              type='button'
              disabled={tab.loading}
              onClick={() =>
                void onAgentRequest({
                  workspaceRoot: rootPath,
                  paths: [tab.path],
                  instruction: '请查看当前代码文件，并回答我的问题：',
                })
              }
            >
              <MessageSquareText size={15} />
              询问 AI 助手
            </button>
          )}
          <button
            type='button'
            className={assistantOpen ? 'active' : ''}
            aria-label={assistantOpen ? '关闭 Work AI 助手' : '打开 Work AI 助手'}
            aria-pressed={assistantOpen}
            onClick={onToggleAssistant}
          >
            <Sparkles size={15} />
            AI 助手
          </button>
        </div>
      </header>
      <div className='work-code-layout'>
        <WorkIdeExplorer rootPath={rootPath} activePath={actions.activePath} onOpenFile={onOpenEntry} />
        <main className='work-code-editor'>
          <nav className='work-code-tabs' aria-label='WebIDE 编辑器标签'>
            {actions.tabs.map((candidate) => {
              const dirty = candidate.content !== candidate.draft;
              return (
                <div className={candidate.path === actions.activePath ? 'active' : ''} key={candidate.path}>
                  <button
                    type='button'
                    role='tab'
                    aria-selected={candidate.path === actions.activePath}
                    onClick={() => actions.activateTab(candidate.path)}
                  >
                    <WorkFileIcon path={candidate.path} size={14} />
                    <span title={candidate.path}>{localPathBasename(candidate.path)}</span>
                    {dirty && (
                      <>
                        <i aria-hidden='true' />
                        <span className='sr-only'>未保存</span>
                      </>
                    )}
                  </button>
                  <button
                    type='button'
                    aria-label={`关闭 ${localPathBasename(candidate.path)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      actions.closeTab(candidate.path);
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </nav>
          {!tab ? (
            <section className='work-code-empty'>
              <Braces size={32} />
              <strong>打开一个代码或文本文件</strong>
              <p>支持多标签、语法高亮、代码导航、诊断、保存冲突保护，以及 Markdown 实时预览。</p>
            </section>
          ) : (
            <section className='work-code-panel' aria-label={`编辑 ${localPathBasename(tab.path)}`}>
              <header className='work-code-toolbar'>
                <span title={tab.path}>{relativeLocalPath(tab.path, rootPath)}</span>
                <button
                  type='button'
                  aria-label={tab.saving ? '正在保存代码文件' : '保存代码文件'}
                  disabled={tab.loading || tab.saving || tab.content === tab.draft}
                  onClick={() => void actions.saveFile(tab.path)}
                >
                  {tab.saving ? <LoaderCircle className='spin' size={14} /> : <Save size={14} />}
                  {tab.saving ? '保存中' : '保存'}
                </button>
              </header>
              {tab.loading ? (
                <EditorState icon={<LoaderCircle className='spin' size={18} />} text='正在读取文件…' />
              ) : tab.loadError ? (
                <EditorState
                  icon={<RefreshCw size={18} />}
                  text={tab.loadError}
                  action={() => void actions.openFile({ path: tab.path, isBinary: false })}
                />
              ) : (
                <div className={`work-code-surface ${isMarkdown(tab.path) ? 'markdown-split' : ''}`}>
                  <section
                    className='work-code-source-pane'
                    aria-label={isMarkdown(tab.path) ? 'Markdown 编辑区' : '代码编辑区'}
                  >
                    <MonacoCodeEditor
                      path={tab.path}
                      modelPath={workspaceEditorModelPath('work', tab.path)}
                      value={tab.draft}
                      location={tab.location}
                      readOnly={false}
                      dark={dark}
                      workspaceRoot={rootPath}
                      sessionId={state.activeSessionId}
                      savedDocument={tab.content === tab.draft}
                      onChange={(value) => actions.updateDraft(tab.path, value)}
                      onSave={() => void actions.saveFile(tab.path)}
                      onClose={() => actions.closeTab(tab.path)}
                      onNavigate={actions.openFile}
                      onStatusChange={setIntelligenceStatus}
                      onEditorStatusChange={setEditorStatus}
                      onAssistantRequest={(request) =>
                        onAgentRequest({
                          workspaceRoot: rootPath,
                          paths: [tab.path],
                          instruction: request.instruction,
                          selection: request.selection,
                        })
                      }
                    />
                  </section>
                  {isMarkdown(tab.path) && (
                    <section className='work-markdown-preview' aria-label='Markdown 实时预览'>
                      <header>实时预览</header>
                      <div className='execution-markdown'>
                        <Suspense fallback={<p>{tab.draft}</p>}>
                          <StreamingMarkdown content={tab.draft} streaming={false} />
                        </Suspense>
                      </div>
                    </section>
                  )}
                </div>
              )}
              <output className='work-code-statusbar' aria-label='编辑器状态'>
                <span className='work-code-statusbar-group'>
                  <span>
                    {isMarkdown(tab.path)
                      ? 'Markdown'
                      : workFileExtension(tab.path).toLocaleUpperCase() || 'Plain Text'}
                  </span>
                  <span>{tab.draft.split(/\r?\n/).length} 行</span>
                  {editorStatus && <span>{`行 ${editorStatus.lineNumber}，列 ${editorStatus.column}`}</span>}
                  {editorStatus && editorStatus.selectedCharacters > 0 && (
                    <span>{`已选择 ${editorStatus.selectedCharacters} 个字符`}</span>
                  )}
                  {isMarkdown(tab.path) && <span>左侧编辑 · 右侧实时预览</span>}
                </span>
                <span className='work-code-statusbar-group'>
                  <span>{tab.content === tab.draft ? '已保存' : '未保存'}</span>
                  <span>UTF-8</span>
                  <span>{editorStatus?.lineEnding ?? 'LF'}</span>
                  {!tab.loading && !tab.loadError && <span>{intelligenceStatus}</span>}
                </span>
              </output>
            </section>
          )}
        </main>
      </div>
      {actions.conflict && (
        <section className='work-code-conflict' role='alert' aria-label='代码文件保存冲突'>
          <div>
            <strong>文件已在其他应用中修改</strong>
            <span>{actions.conflict.path}</span>
          </div>
          <button type='button' onClick={() => void actions.resolveConflict('reload')}>
            载入磁盘版本
          </button>
          <button type='button' className='primary' onClick={() => void actions.resolveConflict('overwrite')}>
            保留当前编辑
          </button>
          <button type='button' aria-label='关闭保存冲突提示' onClick={actions.dismissConflict}>
            <X size={14} />
          </button>
        </section>
      )}
      {actions.closeRequest && (
        <Dialog
          title='放弃未保存的更改？'
          description={actions.closeRequest.message}
          onClose={actions.dismissCloseRequest}
          footer={
            <>
              <Button tone='quiet' onClick={actions.dismissCloseRequest}>
                继续编辑
              </Button>
              <Button tone='danger' onClick={actions.confirmCloseRequest}>
                放弃更改
              </Button>
            </>
          }
        >
          <InlineNotice className='work-library-operation-warning' tone='danger' role='alert'>
            此操作无法撤销。
          </InlineNotice>
        </Dialog>
      )}
    </section>
  );
}

function EditorState({ icon, text, action }: { icon: React.ReactNode; text: string; action?: () => void }) {
  return (
    <output className='work-code-editor-state'>
      {icon}
      <strong>{text}</strong>
      {action && (
        <button type='button' onClick={action}>
          重试
        </button>
      )}
    </output>
  );
}

function isMarkdown(path: string): boolean {
  return ['md', 'markdown', 'mdx'].includes(workFileExtension(path));
}
