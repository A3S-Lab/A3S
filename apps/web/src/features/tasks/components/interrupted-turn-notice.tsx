import { RotateCcw } from 'lucide-react';
import { Button, InlineNotice } from '../../../design-system/primitives';
import { appendTaskInstruction } from '../../../state/app-state';

export function InterruptedTurnNotice({ instruction }: { instruction: string }) {
  return (
    <output className='interrupted-turn-status' aria-label='未完成的任务请求'>
      <InlineNotice
        className='interrupted-turn-notice'
        tone='warning'
        icon={<RotateCcw size={15} />}
        title='这次请求没有完成'
        actions={
          <Button tone='secondary' onClick={() => appendTaskInstruction(instruction)}>
            继续编辑
          </Button>
        }
      >
        任务记录里没有找到 Code 的回复，可能在连接中断或页面关闭时停止。
      </InlineNotice>
    </output>
  );
}
