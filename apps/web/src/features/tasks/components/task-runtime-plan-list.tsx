import { CheckCircle2, Circle, CircleStop, LoaderCircle } from 'lucide-react';
import type { ExecutionPlanTask } from '../../../types/api';
import { formatPlanCountSummary } from './task-runtime-presentation';

export function TaskRuntimePlanList({ steps }: { steps: readonly ExecutionPlanTask[] }) {
  return (
    <section className='task-runtime-section task-runtime-plan' aria-label='任务列表'>
      <header>
        <strong>计划</strong>
        <span>{formatPlanCountSummary(steps)}</span>
      </header>
      <ol aria-label='任务列表'>
        {steps.map((step) => (
          <li
            className={stepStatusClass(step.status)}
            key={step.id}
            aria-label={`${step.content}，${stepStatusLabel(step.status)}`}
          >
            <StepStatusIcon status={step.status} />
            <span title={step.content}>{step.content}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StepStatusIcon({ status }: { status: string }) {
  if (status === 'completed' || status === 'done') return <CheckCircle2 size={13} />;
  if (status === 'in_progress') return <LoaderCircle className='spin' size={13} />;
  if (status === 'failed') return <CircleStop size={13} />;
  return <Circle size={13} />;
}

function stepStatusClass(status: string) {
  if (status === 'done') return 'completed';
  if (status === 'cancelled' || status === 'skipped') return 'skipped';
  return status;
}

function stepStatusLabel(status: string) {
  if (status === 'completed' || status === 'done') return '已完成';
  if (status === 'in_progress') return '进行中';
  if (status === 'failed') return '失败';
  if (status === 'cancelled' || status === 'skipped') return '已中断';
  return '待执行';
}
