import { createWorkSlideTransition } from '../work-presentation-transition';
import { Button } from '../../../design-system/primitives';
import type {
  WorkSlideTransition,
  WorkSlideTransitionDirection,
  WorkSlideTransitionSpeed,
  WorkSlideTransitionType,
} from '../work-types';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect } from './office-controls';

export function PresentationTransitionPanel({
  transition,
  onChange,
  onApplyToAll,
}: {
  transition: WorkSlideTransition | undefined;
  onChange: (transition: WorkSlideTransition | undefined) => void;
  onApplyToAll: () => void;
}) {
  const update = (patch: Partial<WorkSlideTransition>) => {
    if (transition) onChange({ ...transition, ...patch });
  };
  return (
    <section className='work-presentation-transition-panel' aria-label='幻灯片切换设置'>
      <strong>切换</strong>
      <div className='work-office-field'>
        <span>效果</span>
        <OfficeSelect
          ariaLabel='幻灯片切换效果'
          value={transition?.type ?? 'none'}
          options={[
            { value: 'none', label: '无' },
            { value: 'fade', label: '淡化' },
            { value: 'push', label: '推进' },
            { value: 'wipe', label: '擦除' },
            { value: 'split', label: '分割' },
            { value: 'cut', label: '切换' },
          ]}
          onValueChange={(type) => {
            onChange(
              type === 'none' ? undefined : createWorkSlideTransition(type as WorkSlideTransitionType, transition)
            );
          }}
        />
      </div>
      {(transition?.type === 'push' || transition?.type === 'wipe') && (
        <div className='work-office-field'>
          <span>方向</span>
          <OfficeSelect
            ariaLabel='切换方向'
            value={transition.direction ?? 'left'}
            options={[
              { value: 'left', label: '向左' },
              { value: 'right', label: '向右' },
              { value: 'up', label: '向上' },
              { value: 'down', label: '向下' },
            ]}
            onValueChange={(direction) => update({ direction: direction as WorkSlideTransitionDirection })}
          />
        </div>
      )}
      {transition?.type === 'split' && (
        <>
          <div className='work-office-field'>
            <span>方向</span>
            <OfficeSelect
              ariaLabel='切换方向'
              value={transition.direction ?? 'out'}
              options={[
                { value: 'out', label: '向外' },
                { value: 'in', label: '向内' },
              ]}
              onValueChange={(direction) => update({ direction: direction as WorkSlideTransitionDirection })}
            />
          </div>
          <div className='work-office-field'>
            <span>分割方式</span>
            <OfficeSelect
              ariaLabel='分割方式'
              value={transition.orientation ?? 'horizontal'}
              options={[
                { value: 'horizontal', label: '水平' },
                { value: 'vertical', label: '垂直' },
              ]}
              onValueChange={(orientation) => update({ orientation: orientation as 'horizontal' | 'vertical' })}
            />
          </div>
        </>
      )}
      <div className='work-office-field'>
        <span>速度</span>
        <OfficeSelect
          ariaLabel='切换速度'
          disabled={!transition}
          value={transition?.speed ?? 'medium'}
          options={[
            { value: 'fast', label: '快速' },
            { value: 'medium', label: '中速' },
            { value: 'slow', label: '慢速' },
          ]}
          onValueChange={(speed) => update({ speed: speed as WorkSlideTransitionSpeed })}
        />
      </div>
      <OfficeCheckbox
        className='toggle'
        ariaLabel='单击鼠标后换片'
        disabled={!transition}
        checked={transition?.advanceOnClick ?? true}
        onCheckedChange={(advanceOnClick) => update({ advanceOnClick })}
      >
        单击鼠标后
      </OfficeCheckbox>
      <OfficeCheckbox
        className='toggle'
        ariaLabel='自动换片'
        disabled={!transition}
        checked={transition?.advanceAfterMs !== undefined}
        onCheckedChange={(checked) => update({ advanceAfterMs: checked ? 5000 : undefined })}
      >
        自动换片
      </OfficeCheckbox>
      <div className='work-office-field'>
        <span>秒数</span>
        <OfficeNumberField
          ariaLabel='自动换片秒数'
          min={0.25}
          max={3600}
          step={0.25}
          disabled={!transition || transition.advanceAfterMs === undefined}
          value={transition?.advanceAfterMs === undefined ? '' : transition.advanceAfterMs / 1000}
          onValueChange={(value) =>
            update({
              advanceAfterMs: Math.max(250, Math.min(3_600_000, Number(value) * 1000)),
            })
          }
        />
      </div>
      <Button size='compact' onClick={onApplyToAll}>
        应用切换效果到全部幻灯片
      </Button>
    </section>
  );
}
