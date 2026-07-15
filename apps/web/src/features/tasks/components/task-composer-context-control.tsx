import { Gauge, LoaderCircle, Minimize2 } from 'lucide-react';
import type { SessionControls } from '../../../types/api';
import { ComposerPopover } from './composer-popover';

export function TaskComposerContextControl({
  context,
  compacting,
  disabled,
  onCompact,
}: {
  context: NonNullable<SessionControls['context']>;
  compacting: boolean;
  disabled: boolean;
  onCompact: () => void;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(context.percent * 100)));
  return (
    <section className={`composer-context-status ${percent >= 80 ? 'warning' : ''}`} aria-label='上下文状态'>
      <ComposerPopover
        label={`上下文用量 ${percent}%`}
        panelLabel='上下文用量'
        className='composer-context-control'
        trigger={
          <>
            <Gauge size={14} />
            <span>上下文 {percent}%</span>
          </>
        }
      >
        <header className='composer-control-popover-header'>
          <Gauge size={15} />
          <span>
            <strong>上下文用量</strong>
            <small>当前任务已发送给模型的估算上下文</small>
          </span>
        </header>
        <div className='composer-context-summary'>
          <strong>{percent}%</strong>
          <span>
            约 {context.estimatedTokens.toLocaleString()} / {context.limitTokens.toLocaleString()} tokens
          </span>
        </div>
        <div
          className='composer-context-meter'
          role='progressbar'
          aria-label='上下文用量'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
        <p>
          {context.historyMessages} 条消息参与当前上下文
          {context.compacted ? '，较早内容已压缩。' : '。'}
        </p>
      </ComposerPopover>
      <button
        type='button'
        className='composer-context-compact'
        aria-label={compacting ? '正在压缩上下文' : '压缩上下文'}
        title='压缩上下文'
        disabled={disabled || compacting || context.historyMessages === 0}
        onClick={onCompact}
      >
        {compacting ? <LoaderCircle className='spin' size={13} /> : <Minimize2 size={13} />}
        <span>{compacting ? '压缩中' : '压缩'}</span>
      </button>
    </section>
  );
}
