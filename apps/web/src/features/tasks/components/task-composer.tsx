import {
  ArrowDown,
  ArrowUp,
  ListOrdered,
  LoaderCircle,
  Pause,
  Pencil,
  SearchCheck,
  Square,
  Target,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, Dialog, Field, IconButton } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { QueuedTurn } from '../../../types/api';
import type { TaskActions } from '../task-actions';
import { ComposerResourceChips } from './composer-resource-chips';
import { NewTaskWorkspaceControl } from './new-task-workspace-control';
import { TaskComposerTrailingControls } from './task-composer-controls';
import { TaskComposerGoalTiming } from './task-composer-goal-timing';
import { TaskComposerInput } from './task-composer-input';
import { TaskComposerModeControl } from './task-composer-mode-control';
import { TaskComposerResearchMode } from './task-composer-research-mode';
import { TaskComposerModelChangeNotice } from './task-composer-model-change-notice';

export function TaskComposer({
  actions,
  variant = 'active',
}: {
  actions: TaskActions;
  variant?: 'preparation' | 'active';
}) {
  const state = useSnapshot(appState);
  const [resourcesImporting, setResourcesImporting] = useState(false);
  const currentTask = state.sessions.find((session) => session.sessionId === state.activeSessionId);
  const workspaceRoot =
    currentTask?.workspace ||
    (state.activeProduct === 'work' ? state.workspaceRoot : '') ||
    (variant === 'preparation' ? state.newTaskConfig.workspace : '') ||
    state.workspaceRoot ||
    state.health?.workspace ||
    '';
  const currentTaskRunning = Boolean(state.streamingSessionId && state.activeSessionId === state.streamingSessionId);
  const anotherTaskRunning = Boolean(state.streamingSessionId && state.activeSessionId !== state.streamingSessionId);
  const submissionState = state.taskSubmissionState;
  const submitting = Boolean(submissionState);
  const turnQueue = state.activeSessionId ? state.turnQueues[state.activeSessionId] : undefined;
  const queue = turnQueue?.items ?? [];
  const addContext = (path: string) => {
    const normalized = workspaceContextPath(path, workspaceRoot);
    const currentFiles = appState.composerContextFiles;
    if (!normalized || currentFiles.includes(normalized)) return;
    appState.composerContextFiles = [...currentFiles, normalized];
  };
  const addSkill = (name: string) => {
    const currentSkills = appState.composerSkills;
    if (currentSkills.includes(name)) return;
    appState.composerSkills = [...currentSkills, name];
  };
  return (
    <div className={`task-composer-dock ${variant}`}>
      {queue.length > 0 && (
        <FollowUpQueue
          items={queue as unknown as QueuedTurn[]}
          sessionId={state.activeSessionId!}
          running={currentTaskRunning}
          paused={Boolean(turnQueue?.paused)}
          actions={actions}
        />
      )}
      <TaskComposerModelChangeNotice />
      <div
        className={`task-composer ${variant}${submitting ? ' submitting' : ''}${
          state.activeProduct !== 'work' && state.composerMode === 'deepResearch' ? ' deep-research' : ''
        }`}
        aria-busy={submitting}
      >
        <ComposerResourceChips
          files={state.composerContextFiles}
          skills={state.composerSkills}
          workspaceRoot={workspaceRoot}
          onRemoveFile={(path) => {
            appState.composerContextFiles = appState.composerContextFiles.filter((item) => item !== path);
          }}
          onRemoveSkill={(name) => {
            appState.composerSkills = appState.composerSkills.filter((item) => item !== name);
          }}
        />
        <TaskComposerInput
          key={`${state.activeSessionId ?? 'new'}:${submitting ? 'submitting' : 'ready'}`}
          value={state.composerValue}
          disabled={anotherTaskRunning || resourcesImporting || submitting}
          workspaceRoot={workspaceRoot}
          selectedFiles={state.composerContextFiles}
          selectedSkills={state.composerSkills}
          onChange={(value) => {
            appState.composerValue = value;
          }}
          onSubmit={() => {
            void actions.sendMessage();
          }}
          onAddFile={addContext}
          onAddSkill={addSkill}
          onImportingChange={setResourcesImporting}
        />
        <footer>
          <div>
            <TaskComposerModeControl actions={actions} />
            {state.activeProduct !== 'work' && (
              <TaskComposerResearchMode disabled={anotherTaskRunning || resourcesImporting || submitting} />
            )}
            {state.activeProduct !== 'work' && <TaskComposerGoalTiming actions={actions} />}
          </div>
          <div>
            <TaskComposerTrailingControls actions={actions} />
            {currentTaskRunning && (
              <span className='composer-run-state'>
                <LoaderCircle className='spin' size={13} />
                执行中
              </span>
            )}
            <button
              type='button'
              className={`composer-submit ${currentTaskRunning ? 'stop' : ''}`}
              aria-label={currentTaskRunning ? '停止任务' : submitting ? '正在提交任务' : '发送任务'}
              disabled={
                currentTaskRunning
                  ? false
                  : !state.composerValue.trim() || anotherTaskRunning || resourcesImporting || submitting
              }
              onClick={() => {
                void (currentTaskRunning ? actions.cancelMessage() : actions.sendMessage());
              }}
            >
              {currentTaskRunning ? (
                <Square size={14} fill='currentColor' />
              ) : submitting ? (
                <LoaderCircle className='spin' size={16} />
              ) : (
                <ArrowUp size={18} />
              )}
            </button>
          </div>
        </footer>
        {variant === 'preparation' && state.activeProduct !== 'work' && (
          <div className='composer-preparation-meta'>
            <NewTaskWorkspaceControl actions={actions} />
          </div>
        )}
        {anotherTaskRunning && (
          <div className='composer-running another-task'>
            <LoaderCircle className='spin' size={12} />
            另一个任务正在执行；当前草稿已保留。
            <button
              type='button'
              onClick={() => {
                if (state.streamingSessionId) void actions.selectSession(state.streamingSessionId);
              }}
            >
              返回正在执行的任务
            </button>
          </div>
        )}
        {submitting && (
          <output className='composer-running submission-pending'>
            <LoaderCircle className='spin' size={13} />
            {submissionState === 'creating' ? '正在创建任务并准备执行…' : '正在提交指令…'}
          </output>
        )}
      </div>
    </div>
  );
}

function FollowUpQueue({
  items,
  sessionId,
  running,
  paused,
  actions,
}: {
  items: QueuedTurn[];
  sessionId: string;
  running: boolean;
  paused: boolean;
  actions: TaskActions;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const move = (index: number, offset: number) => {
    const item = items[index];
    if (!item) return;
    void actions.moveQueuedMessage(sessionId, item.id, offset);
  };
  const startEditing = (item: QueuedTurn) => {
    setEditingId(item.id);
    setEditingValue(item.content);
  };
  const closeEditing = () => {
    setEditingId(null);
    setEditingValue('');
  };
  const saveEditing = () => {
    const content = editingValue.trim();
    if (!editingId || !content) return;
    void actions.updateQueuedMessage(sessionId, editingId, content).then(closeEditing);
  };
  return (
    <section className='follow-up-queue' aria-label='后续指令队列'>
      <header>
        <span>
          <ListOrdered size={13} />
          后续指令
        </span>
        <small>{running ? '当前执行完成后按顺序继续' : paused ? '队列已暂停，只有主动恢复才会继续' : '等待执行'}</small>
        {!running && (
          <Button
            onClick={() => {
              void actions.resumeQueue(sessionId);
            }}
          >
            {paused ? '恢复队列' : '执行下一条'}
          </Button>
        )}
        {running && !paused && (
          <Button
            tone='quiet'
            onClick={() => {
              void actions.pauseQueue(sessionId);
            }}
          >
            <Pause size={12} />
            暂停后续
          </Button>
        )}
        {running && paused && (
          <Button
            tone='quiet'
            onClick={() => {
              void actions.resumeQueue(sessionId);
            }}
          >
            恢复后续
          </Button>
        )}
      </header>
      {items.map((item, index) => (
        <div className={`follow-up-row ${item.kind === 'goalContinuation' ? 'goal-continuation' : ''}`} key={item.id}>
          <span>{index + 1}</span>
          <div>
            <strong>
              {item.kind === 'goalContinuation' && <Target size={13} />}
              {item.kind === 'goalContinuation' ? '继续推进目标' : item.content}
            </strong>
            {item.kind === 'goalContinuation' && <small>{item.content}</small>}
            {(item.contextFiles.length > 0 || item.skillNames?.length) && (
              <small>
                {[
                  item.contextFiles.length ? `${item.contextFiles.length} 个文件上下文` : '',
                  item.skillNames?.length ? `${item.skillNames.length} 个 Skill` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            )}
            {item.mode === 'deepResearch' && (
              <small className='queued-turn-mode'>
                <SearchCheck size={12} />
                深度研究
              </small>
            )}
          </div>
          {item.kind === 'user' && (
            <>
              <IconButton label={`提前第 ${index + 1} 条指令`} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp size={13} />
              </IconButton>
              <IconButton
                label={`后移第 ${index + 1} 条指令`}
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={13} />
              </IconButton>
              <IconButton label={`编辑第 ${index + 1} 条指令`} onClick={() => startEditing(item)}>
                <Pencil size={13} />
              </IconButton>
            </>
          )}
          <IconButton
            label={item.kind === 'goalContinuation' ? '暂停目标续跑' : `移除第 ${index + 1} 条指令`}
            onClick={() => {
              void (item.kind === 'goalContinuation'
                ? actions.updateGoalAction('pause')
                : actions.removeQueuedMessage(sessionId, item.id));
            }}
          >
            <X size={13} />
          </IconButton>
        </div>
      ))}
      {editingId && (
        <Dialog
          title='编辑后续指令'
          description='只更新这条队列指令；当前输入草稿和文件上下文不会改变。'
          onClose={closeEditing}
          footer={
            <>
              <Button tone='quiet' onClick={closeEditing}>
                取消
              </Button>
              <Button tone='primary' disabled={!editingValue.trim()} onClick={saveEditing}>
                保存队列指令
              </Button>
            </>
          }
        >
          <Field label='后续指令'>
            <textarea
              aria-label='编辑后续指令内容'
              value={editingValue}
              onChange={(event) => setEditingValue(event.target.value)}
              rows={4}
            />
          </Field>
        </Dialog>
      )}
    </section>
  );
}

function workspaceContextPath(path: string, root: string): string {
  const raw = path.trim().replace(/\\/g, '/');
  if (!raw) return '';
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/$/, '');
  const absolute = raw.startsWith('/') || /^[A-Za-z]:\//.test(raw);
  let relative = raw.replace(/^\.\//, '');
  if (absolute) {
    const caseInsensitive = /^[A-Za-z]:\//.test(normalizedRoot);
    const candidate = caseInsensitive ? raw.toLowerCase() : raw;
    const workspace = caseInsensitive ? normalizedRoot.toLowerCase() : normalizedRoot;
    if (candidate !== workspace && !candidate.startsWith(`${workspace}/`)) {
      return '';
    }
    relative = raw.slice(normalizedRoot.length).replace(/^\//, '');
  }
  const segments = relative.split('/').filter(Boolean);
  if (!segments.length || segments.includes('..')) {
    return '';
  }
  return segments.join('/');
}
