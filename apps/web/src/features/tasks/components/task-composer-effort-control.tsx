import { BrainCircuit, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { ComposerPopover } from './composer-popover';
import { effortDescription, effortLabel, updateNewTaskConfig } from './task-composer-config';

export function TaskComposerEffortControl({ actions }: { actions: TaskActions }) {
  const state = useSnapshot(appState);
  const task = state.sessions.find((item) => item.sessionId === state.activeSessionId);
  const controls = task ? state.sessionControls[task.sessionId] : undefined;
  const controlsError = task ? state.sessionControlsErrors[task.sessionId] : undefined;
  const value = task ? controls?.effort || state.activeEffort : state.newTaskConfig.effort;
  const levels = state.effortLevels;
  const selectedIndex = Math.max(
    0,
    levels.findIndex((item) => item.id === value)
  );
  const [previewIndex, setPreviewIndex] = useState(selectedIndex);
  const committedValue = useRef(value);
  const selected = levels[selectedIndex];
  const preview = levels[Math.min(previewIndex, Math.max(0, levels.length - 1))] ?? selected;
  const label = effortLabel(value, selected?.label ?? value);
  const busy = Boolean(state.streamingSessionId || state.taskConfigSaving);
  const disabled = Boolean(!levels.length || controlsError || busy);

  useEffect(() => {
    setPreviewIndex(selectedIndex);
    committedValue.current = value;
  }, [selectedIndex, value]);

  const commit = (index: number) => {
    const level = levels[index];
    if (!level || level.id === committedValue.current) return;
    committedValue.current = level.id;
    if (task) {
      void actions.updateEffort(level.id).finally(() => {
        const current = appState.sessionControls[task.sessionId]?.effort || appState.activeEffort;
        committedValue.current = current;
        setPreviewIndex(
          Math.max(
            0,
            levels.findIndex((item) => item.id === current)
          )
        );
      });
    } else updateNewTaskConfig({ effort: level.id });
  };

  return (
    <ComposerPopover
      label={`Effort：${label}`}
      panelLabel='选择 Effort'
      className='composer-effort-control'
      disabled={disabled}
      trigger={
        <>
          <BrainCircuit size={14} />
          <span>Effort · {label}</span>
          <ChevronDown size={13} />
        </>
      }
    >
      <header className='composer-control-popover-header'>
        <BrainCircuit size={15} />
        <span>
          <strong>Effort</strong>
          <small>数值越高，Code 会投入更多时间进行推理和验证</small>
        </span>
      </header>
      <section className='composer-effort-slider'>
        <div>
          <strong>{preview ? effortLabel(preview.id, preview.label) : label}</strong>
          <small>{effortDescription(preview?.id ?? value)}</small>
        </div>
        <input
          type='range'
          aria-label='Effort'
          aria-valuetext={preview ? effortLabel(preview.id, preview.label) : label}
          min={0}
          max={Math.max(0, levels.length - 1)}
          step={1}
          value={previewIndex}
          onChange={(event) => setPreviewIndex(event.currentTarget.valueAsNumber)}
          onPointerUp={(event) => commit(event.currentTarget.valueAsNumber)}
          onKeyUp={(event) => commit(event.currentTarget.valueAsNumber)}
          onBlur={(event) => commit(event.currentTarget.valueAsNumber)}
        />
        <div className='composer-effort-ticks' aria-hidden='true'>
          {levels.map((level, index) => (
            <span className={index === previewIndex ? 'active' : ''} key={level.id}>
              {effortLabel(level.id, level.label)}
            </span>
          ))}
        </div>
      </section>
    </ComposerPopover>
  );
}
