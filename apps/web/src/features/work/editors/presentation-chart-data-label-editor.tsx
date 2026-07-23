import {
  normalizePresentationChartDataLabelPosition,
  presentationChartDataLabelPositionLabel,
  presentationChartDataLabelPositions,
} from '../work-presentation-charts';
import type { WorkSlideChartDataLabelPosition, WorkSlideChartDataLabels, WorkSlideChartType } from '../work-types';
import { OfficeCheckbox, OfficeSelect, OfficeTextField } from './office-controls';

export function PresentationChartDataLabelEditor({
  chartType,
  value,
  onChange,
}: {
  chartType: WorkSlideChartType;
  value?: WorkSlideChartDataLabels;
  onChange: (value: WorkSlideChartDataLabels | undefined) => void;
}) {
  const change = (patch: Partial<WorkSlideChartDataLabels>) => onChange({ ...value, ...patch });
  return (
    <section className='work-presentation-chart-data-labels' aria-label='演示图表数据标签'>
      <OfficeCheckbox
        className='check enable-data-labels'
        ariaLabel='显示演示图表数据标签'
        checked={value !== undefined}
        onCheckedChange={(checked) => onChange(checked ? { showValue: true } : undefined)}
      >
        数据标签
      </OfficeCheckbox>
      {value && (
        <div>
          <OfficeCheckbox
            className='check'
            ariaLabel='演示图表数据标签显示数值'
            checked={value.showValue === true}
            onCheckedChange={(showValue) => change({ showValue })}
          >
            数值
          </OfficeCheckbox>
          <OfficeCheckbox
            className='check'
            ariaLabel='演示图表数据标签显示分类名称'
            checked={value.showCategoryName === true}
            onCheckedChange={(showCategoryName) => change({ showCategoryName })}
          >
            分类
          </OfficeCheckbox>
          <OfficeCheckbox
            className='check'
            ariaLabel='演示图表数据标签显示系列名称'
            checked={value.showSeriesName === true}
            onCheckedChange={(showSeriesName) => change({ showSeriesName })}
          >
            系列
          </OfficeCheckbox>
          {(chartType === 'pie' || chartType === 'doughnut') && (
            <OfficeCheckbox
              className='check'
              ariaLabel='演示图表数据标签显示百分比'
              checked={value.showPercentage === true}
              onCheckedChange={(showPercentage) => change({ showPercentage })}
            >
              百分比
            </OfficeCheckbox>
          )}
          {chartType === 'bubble' && (
            <OfficeCheckbox
              className='check'
              ariaLabel='演示图表数据标签显示气泡大小'
              checked={value.showBubbleSize === true}
              onCheckedChange={(showBubbleSize) => change({ showBubbleSize })}
            >
              气泡大小
            </OfficeCheckbox>
          )}
          <div className='work-office-field'>
            <span>位置</span>
            <OfficeSelect
              ariaLabel='演示图表数据标签位置'
              value={normalizePresentationChartDataLabelPosition(value.position, chartType)}
              options={presentationChartDataLabelPositions(chartType).map((position) => ({
                value: position,
                label: presentationChartDataLabelPositionLabel(position),
              }))}
              onValueChange={(position) => change({ position: position as WorkSlideChartDataLabelPosition })}
            />
          </div>
          <div className='work-office-field'>
            <span>分隔符</span>
            <OfficeTextField
              aria-label='演示图表数据标签分隔符'
              value={value.separator ?? ', '}
              maxLength={64}
              onChange={(event) => change({ separator: event.target.value })}
            />
          </div>
        </div>
      )}
    </section>
  );
}
