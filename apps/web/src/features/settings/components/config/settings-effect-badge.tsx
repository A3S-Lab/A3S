import { CircleDot, RefreshCw, Sparkles } from 'lucide-react';
import type { ConfigEffect } from '../../../../types/api';

const labels = {
  immediate: '立即生效',
  newTasks: '新任务生效',
  restartRequired: '重启后生效',
} as const;

export function SettingsEffectBadge({ effect }: { effect?: ConfigEffect | null }) {
  if (!effect) return null;
  const Icon = effect.scope === 'restartRequired' ? RefreshCw : effect.scope === 'newTasks' ? Sparkles : CircleDot;
  return (
    <span className={`settings-effect ${effect.scope}`} title={effect.description}>
      <Icon size={12} />
      {labels[effect.scope]}
    </span>
  );
}
