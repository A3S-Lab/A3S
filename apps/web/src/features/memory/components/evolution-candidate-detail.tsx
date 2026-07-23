import {
  AlertTriangle,
  Ban,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  FileText,
  History,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button, CollectionState, Dialog, Field, InlineNotice } from '../../../design-system/primitives';
import type { EvolutionAuditEvent, EvolutionCandidate, EvolutionVersion } from '../../../types/api';
import { evolutionAuditLabel, evolutionSourceLabel, formatEvolutionDate } from '../evolution-format';
import { KindBadge, StateBadge } from './evolution-shared';

export type EvolutionConfirmation =
  | { action: 'reject'; candidate: EvolutionCandidate }
  | { action: 'rollback'; candidate: EvolutionCandidate; version: number };

export function EvolutionCandidateDetail({
  candidate,
  busy,
  onMaterialize,
  onReject,
  onReopen,
  onRollback,
}: {
  candidate: EvolutionCandidate;
  busy: boolean;
  onMaterialize: () => void;
  onReject: () => void;
  onReopen: () => void;
  onRollback: (version: number) => void;
}) {
  const rollbackVersions = candidate.versions.filter((version) => version.version !== candidate.currentVersion);
  const canMaterialize = candidate.state !== 'rejected' && candidate.state !== 'materialized';
  const canUpdate = candidate.state === 'materialized' && candidate.updateAvailable;
  const canReject = candidate.state !== 'rejected' && candidate.state !== 'materialized';
  return (
    <main className='evolution-detail' aria-label='学习详情'>
      <header className='evolution-detail-header'>
        <div>
          <span className='evolution-detail-badges'>
            <KindBadge kind={candidate.kind} />
            <StateBadge state={candidate.state} />
          </span>
          <h2>{candidate.title}</h2>
          <p>{candidate.summary}</p>
        </div>
        <div className='evolution-detail-actions'>
          {candidate.state === 'rejected' ? (
            <Button disabled={busy} onClick={onReopen}>
              <RefreshCw size={14} /> 重新考虑
            </Button>
          ) : (
            <>
              {canReject && (
                <Button tone='quiet' disabled={busy} onClick={onReject}>
                  <Ban size={14} /> 忽略
                </Button>
              )}
              {(canMaterialize || canUpdate) && (
                <Button loading={busy} disabled={busy} onClick={onMaterialize}>
                  <Sparkles size={14} /> {canUpdate ? '保存更新' : '保存'}
                </Button>
              )}
            </>
          )}
        </div>
      </header>
      {candidate.hasConflicts && (
        <InlineNotice
          className='evolution-conflict-notice'
          tone='warning'
          role='note'
          icon={<AlertTriangle size={16} />}
        >
          相关记忆互相矛盾，请确认后再保存。
        </InlineNotice>
      )}
      <section className='evolution-section'>
        <header>
          <BookOpen size={14} />
          <h3>建议做法</h3>
        </header>
        {candidate.instructions.length ? (
          <ol className='evolution-instructions'>
            {candidate.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
        ) : (
          <CollectionState className='evolution-muted' role='status'>
            还没有明确的做法。
          </CollectionState>
        )}
      </section>
      <section className='evolution-section'>
        <header>
          <FileText size={14} />
          <h3>为什么学到它</h3>
        </header>
        <div className='evolution-evidence-list'>
          {candidate.evidence.map((evidence) => (
            <article key={evidence.id}>
              <header>
                <span>{evolutionSourceLabel(evidence.source)}</span>
                {evidence.explicitSignal && <i>你明确说过</i>}
                <time dateTime={evidence.timestamp}>{formatEvolutionDate(evidence.timestamp)}</time>
              </header>
              <p>{evidence.content}</p>
            </article>
          ))}
        </div>
      </section>
      <details className='memory-technical-details evolution-history'>
        <summary>
          <span>
            <History size={14} /> 历史记录
          </span>
          <ChevronDown size={14} aria-hidden='true' />
        </summary>
        <div className='evolution-history-content'>
          <section className='evolution-section evolution-versions'>
            <header>
              <History size={14} />
              <h3>保存记录</h3>
            </header>
            {candidate.versions.length === 0 ? (
              <CollectionState className='evolution-muted' role='status'>
                还没有保存记录。
              </CollectionState>
            ) : (
              <div className='evolution-version-list'>
                {candidate.currentVersion != null && (
                  <article className='evolution-baseline-version'>
                    <span className='evolution-version-number'>保存前</span>
                    <div>
                      <strong>回到保存前</strong>
                      <small>删除当前保存内容，旧版本仍可恢复</small>
                    </div>
                    <Button tone='quiet' disabled={busy} onClick={() => onRollback(0)}>
                      <RotateCcw size={13} /> 撤销保存
                    </Button>
                  </article>
                )}
                {[...candidate.versions].reverse().map((version) => (
                  <VersionRow
                    key={version.version}
                    version={version}
                    current={version.version === candidate.currentVersion}
                    busy={busy}
                    canRollback={rollbackVersions.some((item) => item.version === version.version)}
                    onRollback={() => onRollback(version.version)}
                  />
                ))}
              </div>
            )}
          </section>
          <section className='evolution-section'>
            <header>
              <Clock size={14} />
              <h3>修改记录</h3>
            </header>
            {candidate.audit.length ? (
              <ul className='evolution-audit-list'>
                {[...candidate.audit].reverse().map((event, index) => (
                  <AuditRow key={`${event.at}-${event.action}-${index}`} event={event} />
                ))}
              </ul>
            ) : (
              <CollectionState className='evolution-muted' role='status'>
                还没有修改记录。
              </CollectionState>
            )}
          </section>
        </div>
      </details>
    </main>
  );
}

function VersionRow({
  version,
  current,
  busy,
  canRollback,
  onRollback,
}: {
  version: EvolutionVersion;
  current: boolean;
  busy: boolean;
  canRollback: boolean;
  onRollback: () => void;
}) {
  return (
    <article className={current ? 'current' : ''}>
      <span className='evolution-version-number'>第 {version.version} 版</span>
      <div>
        <strong>
          {current ? '正在使用' : '之前保存'} {version.automatic && <i>自动保存</i>}
        </strong>
        <small>
          {formatEvolutionDate(version.createdAt)} · {version.evidenceIds.length} 条来源
        </small>
      </div>
      {canRollback && (
        <Button tone='quiet' disabled={busy} onClick={onRollback}>
          <RotateCcw size={13} /> 恢复这一版
        </Button>
      )}
    </article>
  );
}

function AuditRow({ event }: { event: EvolutionAuditEvent }) {
  return (
    <li>
      <span>
        <Check size={11} />
      </span>
      <div>
        <strong>
          {evolutionAuditLabel(event.action)}
          {event.version ? ` · 第 ${event.version} 版` : ''}
        </strong>
      </div>
      <time dateTime={event.at}>{formatEvolutionDate(event.at)}</time>
    </li>
  );
}

export function EvolutionConfirmationDialog({
  confirmation,
  busy,
  rejectionReason,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  confirmation: EvolutionConfirmation;
  busy: boolean;
  rejectionReason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const rejecting = confirmation.action === 'reject';
  const undoingSave = confirmation.action === 'rollback' && confirmation.version === 0;
  return (
    <Dialog
      title={rejecting ? '忽略这项内容？' : undoingSave ? '撤销保存？' : `恢复第 ${confirmation.version} 版？`}
      description={
        rejecting
          ? '它不会再自动出现，你之后仍可重新考虑。'
          : undoingSave
            ? '这项内容会取消保存，之后仍可恢复。'
            : '恢复旧版本后，现在的版本仍会保留。'
      }
      onClose={onClose}
      closeDisabled={busy}
      className='evolution-confirmation-dialog'
      footer={
        <>
          <Button tone='quiet' disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button tone={rejecting ? 'danger' : 'secondary'} loading={busy} onClick={() => void onConfirm()}>
            {rejecting ? <Ban size={14} /> : <RotateCcw size={14} />}
            {rejecting ? '确认忽略' : undoingSave ? '确认撤销' : '确认恢复'}
          </Button>
        </>
      }
    >
      <div className='evolution-confirmation-copy'>
        <strong>{confirmation.candidate.title}</strong>
        <p>{confirmation.candidate.summary}</p>
      </div>
      {rejecting && (
        <Field className='evolution-rejection-reason' label='忽略原因（可选）'>
          <textarea
            data-autofocus
            rows={3}
            maxLength={240}
            value={rejectionReason}
            placeholder='为什么不需要这项内容'
            onChange={(event) => onReasonChange(event.target.value)}
          />
        </Field>
      )}
    </Dialog>
  );
}
