import { CheckCircle2, CirclePause, RotateCcw, Target } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { Button, InlineNotice } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { newTaskDraftKey } from '../task-state';
import { formatElapsedDuration } from './task-runtime-projection';
import { useLiveNow } from './use-live-now';

export function TaskComposerGoalTiming({ actions }: { actions?: TaskActions } = {}) {
  const state = useSnapshot(appState);
  const sessionId = state.activeSessionId;
  const stateKey = sessionId ?? newTaskDraftKey;
  const controls = sessionId ? state.sessionControls[sessionId] : undefined;
  const goal = (sessionId ? controls?.goal : state.newTaskConfig.goal)?.trim() ?? '';
  const localTiming = state.goalTimings[stateKey]?.goal === goal ? state.goalTimings[stateKey] : undefined;
  const goalState = controls?.goalState;
  const startedAt = goalState?.startedAt || localTiming?.startedAt;
  const completedAt = goalState?.completedAt || localTiming?.completedAt;
  const status = goalState?.status ?? (completedAt ? 'achieved' : 'active');
  const now = useLiveNow(Boolean(startedAt && status !== 'achieved' && status !== 'paused'));

  if (!goal || !startedAt) return null;

  const elapsed = formatElapsedDuration(Math.max(0, (completedAt ?? now) - startedAt));
  const statusLabel = goalStatusLabel(status);
  const progress = goalState?.progressPercent ?? 0;
  return (
    <details className={`composer-goal-control ${status}`}>
      <summary
        className='composer-goal-timing'
        aria-label={`目标执行耗时 ${elapsed}`}
        title={`${statusLabel}：${goal}`}
      >
        {status === 'achieved' ? (
          <CheckCircle2 size={13} />
        ) : status === 'paused' ? (
          <CirclePause size={13} />
        ) : (
          <Target size={13} />
        )}
        <span>{statusLabel}</span>
        <time>{elapsed}</time>
      </summary>
      <section className='composer-goal-popover' aria-label='持续目标状态'>
        <header>
          <span>持续目标</span>
          <strong>{statusLabel}</strong>
        </header>
        <p>{goal}</p>
        {goalState && (
          <>
            <div
              className='composer-goal-progress'
              role='progressbar'
              aria-label='目标进度'
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <dl>
              <div>
                <dt>已运行</dt>
                <dd>{elapsed}</dd>
              </div>
              <div>
                <dt>尝试次数</dt>
                <dd>{goalState.attempts}</dd>
              </div>
              <div>
                <dt>当前进度</dt>
                <dd>{progress}%</dd>
              </div>
            </dl>
            {goalState.lastError && (
              <InlineNotice className='composer-goal-error' tone='danger' role='alert' title='目标执行遇到问题'>
                {goalState.lastError}
              </InlineNotice>
            )}
          </>
        )}
        {sessionId && actions && status !== 'achieved' && (
          <footer>
            {status === 'paused' ? (
              <Button tone='quiet' onClick={() => void actions.updateGoalAction('resume')}>
                <RotateCcw size={12} />
                继续目标
              </Button>
            ) : (
              <Button tone='quiet' onClick={() => void actions.updateGoalAction('pause')}>
                <CirclePause size={12} />
                暂停目标
              </Button>
            )}
            {status === 'retrying' && (
              <Button tone='secondary' onClick={() => void actions.updateGoalAction('retry')}>
                立即重试
              </Button>
            )}
          </footer>
        )}
        <small>输入 /goal clear 可清除目标</small>
      </section>
    </details>
  );
}

function goalStatusLabel(status: string): string {
  if (status === 'achieved') return '目标已完成';
  if (status === 'paused') return '目标已暂停';
  if (status === 'retrying') return '目标重试中';
  return '目标执行中';
}
