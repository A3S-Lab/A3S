import { useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { CodeActions } from '../../code/use-code-controller';
import {
  EvolutionCandidateDetail,
  EvolutionConfirmationDialog,
  type EvolutionConfirmation,
} from './evolution-candidate-detail';
import { CandidateButton, EvolutionEmptyState, EvolutionErrorState, EvolutionLoadingState } from './evolution-shared';

type EvolutionActions = Pick<
  CodeActions,
  'loadEvolution' | 'materializeEvolution' | 'rejectEvolution' | 'reopenEvolution' | 'rollbackEvolution'
>;

export function EvolutionWorkbench({ actions }: { actions: EvolutionActions }) {
  const state = useSnapshot(appState);
  const data = state.evolutionData ? appState.evolutionData : null;
  const [showAll, setShowAll] = useState(false);
  const [confirmation, setConfirmation] = useState<EvolutionConfirmation | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const actionableCandidates = useMemo(
    () => data?.candidates.filter((candidate) => candidate.state === 'ready' || candidate.updateAvailable) ?? [],
    [data]
  );
  const candidates = useMemo(
    () => (showAll && data ? data.candidates : actionableCandidates),
    [actionableCandidates, data, showAll]
  );
  const actionableCount = actionableCandidates.length;
  const selected = useMemo(
    () => candidates.find((candidate) => candidate.id === state.evolutionSelectedId) ?? candidates[0] ?? null,
    [candidates, state.evolutionSelectedId]
  );

  if (state.evolutionPhase === 'loading' && !data) return <EvolutionLoadingState />;
  if (state.evolutionPhase === 'error' && !data) {
    return (
      <EvolutionErrorState
        error={state.evolutionError}
        onRetry={() => {
          void actions.loadEvolution(true);
        }}
      />
    );
  }
  if (!data) return null;

  return (
    <div className='evolution-surface'>
      {state.evolutionError && (
        <output className='memory-stale-notice'>
          <span title={state.evolutionError}>更新失败，当前显示上次结果。</span>
          <button type='button' onClick={() => void actions.loadEvolution(true)}>
            重试
          </button>
        </output>
      )}
      {data.candidates.length === 0 ? (
        <EvolutionEmptyState />
      ) : (
        <section className='evolution-workbench'>
          <aside className='evolution-candidate-browser' aria-label='学习内容'>
            <header>
              <div>
                <strong>{showAll ? '全部内容' : '待处理'}</strong>
                <span>{candidates.length} 项</span>
              </div>
              {(showAll || candidates.length < data.candidates.length) && (
                <button
                  type='button'
                  onClick={() => {
                    const nextShowAll = !showAll;
                    const nextCandidates = nextShowAll ? data.candidates : actionableCandidates;
                    const nextSelected =
                      nextCandidates.find((candidate) => candidate.id === selected?.id) ?? nextCandidates[0];
                    if (nextSelected) appState.evolutionSelectedId = nextSelected.id;
                    setShowAll(nextShowAll);
                  }}
                >
                  {showAll ? `只看待处理 ${actionableCount}` : `查看全部 ${data.candidates.length}`}
                </button>
              )}
            </header>
            <div className='evolution-candidate-list'>
              {candidates.map((candidate) => (
                <CandidateButton
                  key={candidate.id}
                  candidate={candidate}
                  selected={candidate.id === selected?.id}
                  busy={candidate.id === state.evolutionBusyId}
                  onSelect={() => {
                    appState.evolutionSelectedId = candidate.id;
                  }}
                />
              ))}
            </div>
          </aside>
          {selected ? (
            <EvolutionCandidateDetail
              candidate={selected}
              busy={state.evolutionBusyId === selected.id}
              onMaterialize={() => void actions.materializeEvolution(selected.id)}
              onReject={() => {
                setRejectionReason('');
                setConfirmation({ action: 'reject', candidate: selected });
              }}
              onReopen={() => void actions.reopenEvolution(selected.id)}
              onRollback={(version) => setConfirmation({ action: 'rollback', candidate: selected, version })}
            />
          ) : (
            <div className='evolution-detail-placeholder'>目前没有需要处理的内容</div>
          )}
        </section>
      )}
      {confirmation && (
        <EvolutionConfirmationDialog
          confirmation={confirmation}
          busy={state.evolutionBusyId === confirmation.candidate.id}
          rejectionReason={rejectionReason}
          onReasonChange={setRejectionReason}
          onClose={() => setConfirmation(null)}
          onConfirm={async () => {
            if (confirmation.action === 'reject') {
              await actions.rejectEvolution(confirmation.candidate.id, rejectionReason.trim() || undefined);
            } else {
              await actions.rollbackEvolution(confirmation.candidate.id, confirmation.version);
            }
            if (!appState.evolutionError) setConfirmation(null);
          }}
        />
      )}
    </div>
  );
}
