import { Bug, FileCheck2, SearchCode, Sparkles } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { appendTaskInstruction, appState } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { TaskComposer } from './task-composer';

const starters = [
  {
    label: '修复问题',
    icon: Bug,
    content: '请修复以下问题：\n\n问题表现：\n影响范围：\n验收条件：',
  },
  {
    label: '实现功能',
    icon: Sparkles,
    content: '请实现以下功能：\n\n目标：\n范围与约束：\n验收条件：',
  },
  {
    label: '理解代码',
    icon: SearchCode,
    content: '请帮我理解这部分代码：\n\n关注范围：\n希望回答的问题：',
  },
  {
    label: '审阅变更',
    icon: FileCheck2,
    content: '请审阅当前工作区变更：\n\n重点关注：\n需要通过的检查：',
  },
] as const;

export function NewTaskPreparation({ actions }: { actions: TaskActions }) {
  const state = useSnapshot(appState);
  return (
    <main className='new-task-preparation'>
      <div className='new-task-preparation-inner'>
        <header className='new-task-welcome'>
          <span className='eyebrow'>A3S CODE</span>
          <h1>让 Code 完成一项工作</h1>
          <p>描述目标、范围、约束和你期待的结果，Code 会在同一任务中持续执行、验证并交付。</p>
        </header>
        <div className='task-starters'>
          {starters.map(({ label, icon: Icon, content }) => (
            <button
              type='button'
              key={label}
              disabled={Boolean(state.taskSubmissionState)}
              onClick={() => appendTaskInstruction(content)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
        <TaskComposer actions={actions} variant='preparation' />
        <p className='new-task-assurance'>草稿和运行参数保存在当前浏览器；发送后才会创建任务。</p>
      </div>
    </main>
  );
}
