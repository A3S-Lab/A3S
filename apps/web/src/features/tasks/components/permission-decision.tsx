import { ShieldAlert } from 'lucide-react';
import { Button, InlineNotice } from '../../../design-system/primitives';
import type { TaskActions } from '../task-actions';
import {
  type ToolCallProjection,
  toolArgumentSummary,
  toolFilePath,
  toolOperationLabel,
  toolRiskSummary,
} from './tool-call-projection';

export type ToolDecisionState = 'approving' | 'denying' | 'approved' | 'denied';

export function PermissionDecision({
  call,
  sessionId,
  decision,
  error,
  actions,
}: {
  call: ToolCallProjection;
  sessionId: string;
  decision?: ToolDecisionState;
  error?: string;
  actions: TaskActions;
}) {
  const decided = decision === 'approved' || decision === 'denied';
  const target = toolArgumentSummary(call);
  const scope = call.scope || toolFilePath(call) || '当前任务的工作区';
  return (
    <section className='tool-call-permission' aria-label='工具权限确认'>
      <header>
        <span className='tool-call-permission-icon'>
          <ShieldAlert size={15} />
        </span>
        <span>
          <strong>需要你的确认</strong>
          <small>只影响当前这一次操作</small>
        </span>
      </header>
      <dl>
        <div>
          <dt>即将执行</dt>
          <dd>
            {toolOperationLabel(call)}
            {target ? `：${target}` : ''}
          </dd>
        </div>
        <div>
          <dt>为什么需要</dt>
          <dd>{call.reason || '当前执行模式要求在工具运行前得到你的确认。'}</dd>
        </div>
        <div>
          <dt>影响范围</dt>
          <dd>{scope}</dd>
        </div>
        <div>
          <dt>需要注意</dt>
          <dd>{call.risk || toolRiskSummary(call)}</dd>
        </div>
        {call.timeoutMs !== undefined && (
          <div>
            <dt>确认时限</dt>
            <dd>{Math.max(1, Math.ceil(call.timeoutMs / 1000))} 秒</dd>
          </div>
        )}
      </dl>
      {error && (
        <InlineNotice className='tool-call-decision-error' tone='danger' role='alert' title='确认未提交'>
          {error}。你可以重新选择。
        </InlineNotice>
      )}
      {decided ? (
        <output className={`tool-call-decision ${decision}`}>
          {decision === 'approved' ? '已允许一次，操作继续执行。' : '已拒绝，本次操作不会执行。'}
        </output>
      ) : (
        <footer>
          <Button
            tone='quiet'
            loading={decision === 'denying'}
            disabled={decision === 'approving'}
            onClick={() => void actions.confirmToolUse(sessionId, call.id, false)}
          >
            拒绝
          </Button>
          <Button
            tone='primary'
            loading={decision === 'approving'}
            disabled={decision === 'denying'}
            onClick={() => void actions.confirmToolUse(sessionId, call.id, true)}
          >
            允许一次
          </Button>
        </footer>
      )}
    </section>
  );
}
