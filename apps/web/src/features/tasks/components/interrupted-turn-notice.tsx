import { RotateCcw } from 'lucide-react';
import { Button } from '../../../design-system/primitives';
import { appendTaskInstruction } from '../../../state/app-state';

export function InterruptedTurnNotice({ instruction }: { instruction: string }) {
  return (
    <output className='interrupted-turn-notice' aria-label='未完成的任务请求'>
      <span className='interrupted-turn-icon'>
        <RotateCcw size={15} />
      </span>
      <div>
        <strong>这次请求没有完成</strong>
        <p>任务记录里没有找到 Code 的回复，可能在连接中断或页面关闭时停止。</p>
      </div>
      <Button tone='secondary' onClick={() => appendTaskInstruction(instruction)}>
        继续编辑
      </Button>
    </output>
  );
}
