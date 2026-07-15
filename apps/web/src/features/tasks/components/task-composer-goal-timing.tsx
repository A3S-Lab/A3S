import { CheckCircle2, Target } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import { newTaskDraftKey } from '../task-state';
import { formatElapsedDuration } from './task-runtime-projection';
import { useLiveNow } from './use-live-now';

export function TaskComposerGoalTiming() {
  const state = useSnapshot(appState);
  const sessionId = state.activeSessionId;
  const stateKey = sessionId ?? newTaskDraftKey;
  const controls = sessionId ? state.sessionControls[sessionId] : undefined;
  const goal = (sessionId ? controls?.goal : state.newTaskConfig.goal)?.trim() ?? '';
  const timing = state.goalTimings[stateKey]?.goal === goal ? state.goalTimings[stateKey] : undefined;
  const now = useLiveNow(Boolean(timing && !timing.completedAt));

  if (!goal || !timing) return null;

  const elapsed = formatElapsedDuration((timing.completedAt ?? now) - timing.startedAt);
  return (
    <span
      className={`composer-goal-timing ${timing.completedAt ? 'completed' : ''}`}
      role='timer'
      aria-label={`目标执行耗时 ${elapsed}`}
      title={goal}
    >
      {timing.completedAt ? <CheckCircle2 size={13} /> : <Target size={13} />}
      <span>目标</span>
      <time>{elapsed}</time>
    </span>
  );
}
