import { SearchCheck } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';

export function TaskComposerResearchMode({ disabled = false }: { disabled?: boolean }) {
  const state = useSnapshot(appState);
  const active = state.composerMode === 'deepResearch';
  const label = `深度研究模式：${active ? '已开启' : '关闭'}`;

  return (
    <button
      type='button'
      className={`composer-quick-trigger composer-research-mode${active ? ' active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={active ? '将使用网页与工作区证据生成可追溯研究报告' : '开启深度研究'}
      disabled={disabled}
      onClick={() => {
        appState.composerMode = active ? 'standard' : 'deepResearch';
      }}
    >
      <SearchCheck size={15} />
      <span>深度研究</span>
    </button>
  );
}
