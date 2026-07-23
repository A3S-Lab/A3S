import { AlertTriangle, CheckCircle2, FilePenLine, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, IconButton, InlineNotice } from '../../../design-system/primitives';
import type {
  WorkAgentProposalApplyResult,
  WorkAgentProposalRequest,
  WorkAgentProposalStatus,
} from '../work-agent-proposal';

export function WorkAgentProposalReview({
  request,
  status,
  onDismiss,
}: {
  request: WorkAgentProposalRequest;
  status: WorkAgentProposalStatus;
  onDismiss: () => void;
}) {
  const proposal = status.state === 'ready' ? status.proposal : null;
  const proposalRevision = proposal?.changes.map((change) => `${change.id}:${change.after}`).join('|') ?? '';
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<WorkAgentProposalApplyResult | null>(null);
  const [applyError, setApplyError] = useState('');

  useEffect(() => {
    setSelected(new Set(proposal?.changes.map((change) => change.id) ?? []));
    setResult(null);
    setApplyError('');
  }, [proposalRevision, request.id]);

  return (
    <section className={`work-agent-proposal-review ${status.state}`} aria-label='AI 修改建议审阅'>
      <header>
        <span aria-hidden='true'>
          <FilePenLine size={15} />
        </span>
        <div>
          <strong>{request.title}</strong>
          <small>{request.description}</small>
        </div>
        <IconButton label='关闭 AI 修改建议' onClick={onDismiss}>
          <X size={15} />
        </IconButton>
      </header>

      {status.state === 'waiting' && (
        <InlineNotice
          className='work-agent-proposal-notice'
          tone='info'
          role='status'
          icon={<LoaderCircle className={status.phase === 'response' ? 'spin' : undefined} size={15} />}
        >
          {status.phase === 'draft'
            ? '建议协议已加入 AI 助手草稿；发送后才会生成差异。'
            : '等待 AI 助手返回可验证的差异…'}
        </InlineNotice>
      )}

      {status.state === 'invalid' && (
        <InlineNotice
          className='work-agent-proposal-notice'
          tone='danger'
          role='alert'
          icon={<AlertTriangle size={15} />}
        >
          {status.message}
        </InlineNotice>
      )}

      {proposal && (
        <>
          <div className='work-agent-proposal-summary'>
            <p>{proposal.summary}</p>
            <Button
              tone='quiet'
              disabled={Boolean(result)}
              onClick={() =>
                setSelected(
                  selected.size === proposal.changes.length
                    ? new Set()
                    : new Set(proposal.changes.map((change) => change.id))
                )
              }
            >
              {selected.size === proposal.changes.length ? '取消全选' : '全选'}
            </Button>
          </div>
          <fieldset className='work-agent-proposal-changes' disabled={Boolean(result)}>
            <legend className='sr-only'>选择要应用的修改</legend>
            {proposal.changes.map((change) => (
              <label key={change.id}>
                <input
                  type='checkbox'
                  checked={selected.has(change.id)}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(change.id);
                      else next.delete(change.id);
                      return next;
                    });
                  }}
                />
                <span>
                  <strong>{change.label}</strong>
                  {change.reason && <small>{change.reason}</small>}
                  <del>{change.before || '（空白）'}</del>
                  <ins>{change.after || '（清空）'}</ins>
                </span>
              </label>
            ))}
          </fieldset>
          {result && (
            <InlineNotice
              className='work-agent-proposal-notice result'
              tone={result.conflicts.length ? 'warning' : 'success'}
              role='status'
              icon={result.conflicts.length ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            >
              已应用 {result.appliedTargetIds.length} 项
              {result.conflicts.length ? `；${result.conflicts.length} 项因原内容已变化而跳过。` : '。'}
            </InlineNotice>
          )}
          {applyError && (
            <InlineNotice
              className='work-agent-proposal-notice result'
              tone='danger'
              role='alert'
              icon={<AlertTriangle size={14} />}
            >
              {applyError}
            </InlineNotice>
          )}
          <footer>
            <Button tone='quiet' onClick={onDismiss}>
              {result ? '完成' : '取消'}
            </Button>
            {!result && (
              <Button
                tone='primary'
                disabled={!selected.size}
                onClick={() => {
                  setApplyError('');
                  try {
                    const changes = proposal.changes.filter((change) => selected.has(change.id));
                    setResult(request.apply(changes));
                  } catch (error) {
                    setApplyError(error instanceof Error ? error.message : '无法应用这些修改。');
                  }
                }}
              >
                应用 {selected.size} 项
              </Button>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
