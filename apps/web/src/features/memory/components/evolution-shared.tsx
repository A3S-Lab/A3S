import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { Button, StateView } from '../../../design-system/primitives';
import type { EvolutionCandidate, EvolutionCandidateState, EvolutionKind } from '../../../types/api';
import { evolutionKindLabel, evolutionStateLabel } from '../evolution-format';

export function CandidateButton({
  candidate,
  selected,
  busy,
  onSelect,
}: {
  candidate: EvolutionCandidate;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type='button'
      className={`evolution-candidate${selected ? ' selected' : ''}`}
      aria-current={selected ? 'true' : undefined}
      aria-busy={busy || undefined}
      onClick={onSelect}
    >
      <span className='evolution-candidate-heading'>
        <KindBadge kind={candidate.kind} />
        <StateBadge state={candidate.state} />
        {candidate.updateAvailable && <i>有更新</i>}
      </span>
      <strong>{candidate.title}</strong>
    </button>
  );
}

export function EvolutionLoadingState() {
  return (
    <StateView
      className='evolution-loading'
      size='compact'
      role='status'
      icon={<Sparkles size={22} />}
      title='正在加载学习内容'
    />
  );
}

export function EvolutionErrorState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <StateView
      className='memory-state-card'
      role='alert'
      tone='danger'
      icon={<AlertTriangle size={22} />}
      title='无法加载学习内容'
      description='暂时无法读取，请稍后重试。'
      descriptionTitle={error || undefined}
      actions={
        <Button onClick={onRetry}>
          <RefreshCw size={14} />
          重新加载
        </Button>
      }
    />
  );
}

export function EvolutionEmptyState() {
  return (
    <StateView
      className='memory-state-card evolution-empty'
      tone='info'
      icon={<Sparkles size={24} />}
      title='还没有可确认的内容'
      description='完成更多任务后，A3S 会把稳定的偏好和做法列在这里。'
    />
  );
}

export function KindBadge({ kind }: { kind: EvolutionKind }) {
  return (
    <span className='evolution-kind-badge' data-kind={kind}>
      {evolutionKindLabel(kind)}
    </span>
  );
}

export function StateBadge({ state }: { state: EvolutionCandidateState }) {
  return (
    <span className='evolution-state-badge' data-state={state}>
      {evolutionStateLabel(state)}
    </span>
  );
}
