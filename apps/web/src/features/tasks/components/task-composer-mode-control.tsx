import { Check, ChevronDown, ListChecks, ShieldCheck, Zap } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { ComposerPopover } from './composer-popover';
import { updateNewTaskConfig } from './task-composer-config';

const EXECUTION_MODES = [
  {
    id: 'default',
    label: '按需确认',
    description: '正常推进任务，敏感操作前向你确认',
    icon: ShieldCheck,
  },
  {
    id: 'plan',
    label: '只读规划',
    description: '只分析和制定计划，不修改工作区',
    icon: ListChecks,
  },
  {
    id: 'auto',
    label: '自动执行',
    description: '在当前安全边界内连续完成任务',
    icon: Zap,
  },
] as const;

export function TaskComposerModeControl({ actions }: { actions: TaskActions }) {
  const state = useSnapshot(appState);
  const task = state.sessions.find((item) => item.sessionId === state.activeSessionId);
  const value = task ? task.permissionMode : state.newTaskConfig.permissionMode;
  const selected = EXECUTION_MODES.find((mode) => mode.id === value) ?? EXECUTION_MODES[0];
  const SelectedIcon = selected.icon;
  const disabled = Boolean(state.streamingSessionId || state.taskConfigSaving || state.taskSubmissionState);

  return (
    <ComposerPopover
      label={`执行模式：${selected.label}`}
      panelLabel='选择执行模式'
      className='composer-mode-control'
      disabled={disabled}
      trigger={
        <>
          <SelectedIcon className='composer-mode-selected-icon' size={16} />
          <span>{selected.label}</span>
          <ChevronDown className='composer-mode-chevron' size={13} />
        </>
      }
    >
      {(close) => (
        <>
          <header className='composer-control-popover-header'>
            <SelectedIcon size={15} />
            <span>
              <strong>执行模式</strong>
              <small>决定 Code 如何推进当前任务</small>
            </span>
          </header>
          <div className='composer-mode-options' role='listbox' aria-label='执行模式'>
            {EXECUTION_MODES.map((mode) => {
              const Icon = mode.icon;
              const active = mode.id === value;
              return (
                <button
                  type='button'
                  role='option'
                  aria-selected={active}
                  key={mode.id}
                  onClick={() => {
                    close();
                    if (active) return;
                    if (task) void actions.updatePermissionMode(mode.id);
                    else updateNewTaskConfig({ permissionMode: mode.id });
                  }}
                >
                  <span>
                    <Icon size={15} />
                  </span>
                  <span>
                    <strong>{mode.label}</strong>
                    <small>{mode.description}</small>
                  </span>
                  {active && <Check size={15} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </ComposerPopover>
  );
}
