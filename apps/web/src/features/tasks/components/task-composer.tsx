import { ArrowDown, ArrowUp, ListOrdered, LoaderCircle, Pencil, Square, X } from 'lucide-react';
import { useState } from 'react';
import { useSnapshot } from 'valtio';
import type { TaskActions } from '../task-actions';
import { Button, Dialog } from '../../../design-system/primitives';
import { appState, reportTaskPersistenceResult } from '../../../state/app-state';
import { persistPausedQueues, persistQueuedPrompts, type QueuedPrompt } from '../task-state';
import { TaskComposerTrailingControls } from './task-composer-controls';
import { ComposerResourceChips } from './composer-resource-chips';
import { TaskComposerInput } from './task-composer-input';
import { TaskComposerGoalTiming } from './task-composer-goal-timing';
import { TaskComposerModelChangeNotice } from './task-composer-model-change-notice';
import { TaskComposerModeControl } from './task-composer-mode-control';
import { NewTaskWorkspaceControl } from './new-task-workspace-control';

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
    (variant === 'preparation' ? state.newTaskConfig.workspace : '') ||
    state.workspaceRoot ||
    state.health?.workspace ||
    '';
  const currentTaskRunning = Boolean(state.streamingSessionId && state.activeSessionId === state.streamingSessionId);
  const anotherTaskRunning = Boolean(state.streamingSessionId && state.activeSessionId !== state.streamingSessionId);
  const queue = state.activeSessionId ? (state.queuedPrompts[state.activeSessionId] ?? []) : [];
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
          items={queue as QueuedPrompt[]}
          sessionId={state.activeSessionId!}
          running={currentTaskRunning}
          paused={Boolean(state.pausedQueues[state.activeSessionId!])}
          actions={actions}
        />
      )}
      <TaskComposerModelChangeNotice />
      <div className={`task-composer ${variant}`}>
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
          value={state.composerValue}
          disabled={anotherTaskRunning || resourcesImporting}
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
            <TaskComposerGoalTiming />
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
              aria-label={currentTaskRunning ? '停止任务' : '发送任务'}
              disabled={
                currentTaskRunning ? false : !state.composerValue.trim() || anotherTaskRunning || resourcesImporting
              }
              onClick={() => {
                void (currentTaskRunning ? actions.cancelMessage() : actions.sendMessage());
              }}
            >
              {currentTaskRunning ? <Square size={14} fill='currentColor' /> : <ArrowUp size={18} />}
            </button>
          </div>
        </footer>
        {variant === 'preparation' && (
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
  items: QueuedPrompt[];
  sessionId: string;
  running: boolean;
  paused: boolean;
  actions: TaskActions;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const persistQueue = () => {
    if (!appState.queuedPrompts[sessionId]?.length) delete appState.pausedQueues[sessionId];
    reportTaskPersistenceResult(persistQueuedPrompts(appState.queuedPrompts));
    reportTaskPersistenceResult(persistPausedQueues(appState.pausedQueues));
  };
  const move = (index: number, offset: number) => {
    const queue = appState.queuedPrompts[sessionId];
    const target = index + offset;
    if (!queue || target < 0 || target >= queue.length) return;
    [queue[index], queue[target]] = [queue[target], queue[index]];
    persistQueue();
  };
  const startEditing = (item: QueuedPrompt) => {
    setEditingId(item.id);
    setEditingValue(item.content);
  };
  const closeEditing = () => {
    setEditingId(null);
    setEditingValue('');
  };
  const saveEditing = () => {
    const item = appState.queuedPrompts[sessionId]?.find((entry) => entry.id === editingId);
    const content = editingValue.trim();
    if (!item || !content) return;
    item.content = content;
    persistQueue();
    closeEditing();
  };
  return (
    <section className='follow-up-queue' aria-label='后续指令队列'>
      <header>
        <span>
          <ListOrdered size={13} />
          后续指令
        </span>
        <small>{running ? '当前执行完成后按顺序继续' : paused ? '队列已暂停，只有主动恢复才会继续' : '等待执行'}</small>
        {!running && paused && (
          <Button
            onClick={() => {
              void actions.resumeQueue(sessionId);
            }}
          >
            恢复队列
          </Button>
        )}
      </header>
      {items.map((item, index) => (
        <div className='follow-up-row' key={item.id}>
          <span>{index + 1}</span>
          <div>
            <strong>{item.content}</strong>
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
          </div>
          <button
            type='button'
            aria-label={`提前第 ${index + 1} 条指令`}
            disabled={index === 0}
            onClick={() => move(index, -1)}
          >
            <ArrowUp size={13} />
          </button>
          <button
            type='button'
            aria-label={`后移第 ${index + 1} 条指令`}
            disabled={index === items.length - 1}
            onClick={() => move(index, 1)}
          >
            <ArrowDown size={13} />
          </button>
          <button type='button' aria-label={`编辑第 ${index + 1} 条指令`} onClick={() => startEditing(item)}>
            <Pencil size={13} />
          </button>
          <button
            type='button'
            aria-label={`移除第 ${index + 1} 条指令`}
            onClick={() => {
              appState.queuedPrompts[sessionId] = appState.queuedPrompts[sessionId].filter(
                (entry) => entry.id !== item.id
              );
              persistQueue();
            }}
          >
            <X size={13} />
          </button>
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
          <label className='ds-field'>
            <span>后续指令</span>
            <textarea
              aria-label='编辑后续指令内容'
              value={editingValue}
              onChange={(event) => setEditingValue(event.target.value)}
              rows={4}
            />
          </label>
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
