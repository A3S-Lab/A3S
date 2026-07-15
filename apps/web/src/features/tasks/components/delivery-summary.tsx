import { AlertTriangle, ArrowRight, CheckCircle2, FileDiff, RotateCcw, Wrench } from 'lucide-react';
import { Button, StatusBadge } from '../../../design-system/primitives';
import { appendTaskInstruction, appState, navigateTask, switchActiveTask } from '../../../state/app-state';
import type { AgentEvent, VerificationSummary } from '../../../types/api';

export function DeliverySummary({ sessionId, events }: { sessionId: string; events: AgentEvent[] }) {
  const completed = [...events].reverse().find((event) => event.type === 'agent_end');
  if (!completed) return null;
  const verification = completed.verification_summary;
  if (!verification || verification.report_count === 0) return null;
  const metrics = projectDeliveryMetrics(verification);
  const completion = metrics.required ? Math.round((metrics.passed / metrics.required) * 100) : 0;
  const reviewReady = verification.status === 'passed' && metrics.failed === 0 && metrics.pending === 0;
  const reviewChanges = () => {
    appState.reviewSourceTaskId = sessionId;
    appState.reviewIntent = 'review';
    appState.gitStatus = null;
    navigateTask('review');
  };
  const continueCorrection = () => {
    const failed = verification?.failed_subjects ?? [];
    const pending = verification?.pending_subjects ?? [];
    if (appState.activeSessionId !== sessionId) switchActiveTask(sessionId);
    appendTaskInstruction(
      [
        '请根据最新交付证据，安全完成剩余修正和验证工作。',
        failed.length ? `失败检查：\n${failed.map((subject) => `- ${subject}`).join('\n')}` : '',
        pending.length ? `待完成检查：\n${pending.map((subject) => `- ${subject}`).join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    );
    navigateTask('conversation');
  };
  return (
    <section className='delivery-summary' aria-label='任务交付摘要'>
      <header>
        <span>{reviewReady ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span>
        <div>
          <small>交付状态</small>
          <strong>{reviewReady ? '任务已可审阅' : '任务完成，仍需验证'}</strong>
        </div>
        <StatusBadge tone={reviewReady ? 'success' : 'warning'}>{reviewReady ? '可审阅' : '需验证'}</StatusBadge>
      </header>
      <div
        className='delivery-progress'
        role='progressbar'
        aria-label='交付检查完成度'
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion}
        aria-valuetext={metrics.required ? `${metrics.passed}/${metrics.required} 项必需检查已通过` : '暂无必需检查'}
      >
        <span style={{ width: `${completion}%` }} />
      </div>
      {verification && (
        <div className='delivery-metrics'>
          <span>
            <strong>{metrics.passed}</strong> 已通过
          </span>
          <span>
            <strong>{metrics.pending}</strong> 待检查
          </span>
          <span>
            <strong>{metrics.failed}</strong> 失败
          </span>
          <span>
            <strong>{metrics.risks}</strong> 风险
          </span>
        </div>
      )}
      {(verification?.failed_subjects?.length || verification?.pending_subjects?.length) && (
        <div className='delivery-warnings'>
          {verification.failed_subjects?.map((subject) => (
            <p key={`failed-${subject}`}>
              <AlertTriangle size={12} />
              失败：{subject}
            </p>
          ))}
          {verification.pending_subjects?.map((subject) => (
            <p key={`pending-${subject}`}>
              <RotateCcw size={12} />
              待检查：{subject}
            </p>
          ))}
        </div>
      )}
      <footer>
        <span>
          <FileDiff size={13} />
          进入审阅核对交付与当前工作区差异
        </span>
        <div className='delivery-actions'>
          {!reviewReady && (
            <Button tone='primary' onClick={continueCorrection}>
              <Wrench size={14} />
              继续修正
            </Button>
          )}
          <Button tone={reviewReady ? 'primary' : 'secondary'} onClick={reviewChanges}>
            审阅变更
            <ArrowRight size={14} />
          </Button>
        </div>
      </footer>
    </section>
  );
}

export function projectDeliveryMetrics(verification: VerificationSummary) {
  const required = nonNegativeInteger(verification.required_check_count);
  const failed = Math.min(required, nonNegativeInteger(verification.failed_check_count));
  const pending = Math.min(required - failed, nonNegativeInteger(verification.pending_required_check_count));
  return {
    passed: required - failed - pending,
    pending,
    failed,
    risks: nonNegativeInteger(verification.residual_risk_count),
    required,
  };
}

function nonNegativeInteger(value: number): number {
  return Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0));
}
