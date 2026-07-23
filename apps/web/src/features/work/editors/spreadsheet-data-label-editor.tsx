import {
  normalizeWorkSpreadsheetDataLabelPosition,
  type WorkSpreadsheetChartType,
  type WorkSpreadsheetDataLabelPosition,
  type WorkSpreadsheetDataLabels,
} from '../work-types';
import { OfficeCheckbox, OfficeSelect, OfficeTextField } from './office-controls';

interface SpreadsheetDataLabelEditorProps {
  chartType: WorkSpreadsheetChartType;
  seriesNumber: number;
  value?: WorkSpreadsheetDataLabels;
  onChange: (value: WorkSpreadsheetDataLabels | undefined) => void;
}

export function SpreadsheetDataLabelEditor({
  chartType,
  seriesNumber,
  value,
  onChange,
}: SpreadsheetDataLabelEditorProps) {
  const labelPrefix = `系列 ${seriesNumber} 数据标签`;
  const change = (update: Partial<WorkSpreadsheetDataLabels>) => onChange({ ...value, ...update });

  return (
    <section className='work-spreadsheet-data-labels' aria-label={labelPrefix}>
      <OfficeCheckbox
        className='check enable-data-labels'
        ariaLabel={`系列 ${seriesNumber} 显示数据标签`}
        checked={Boolean(value)}
        onCheckedChange={(checked) => onChange(checked ? { showValue: true } : undefined)}
      >
        显示数据标签
      </OfficeCheckbox>
      {value && (
        <div>
          <OfficeCheckbox
            className='check'
            ariaLabel={`${labelPrefix}显示数值`}
            checked={value.showValue === true}
            onCheckedChange={(showValue) => change({ showValue })}
          >
            数值
          </OfficeCheckbox>
          <OfficeCheckbox
            className='check'
            ariaLabel={`${labelPrefix}显示分类名称`}
            checked={value.showCategoryName === true}
            onCheckedChange={(showCategoryName) => change({ showCategoryName })}
          >
            分类名称
          </OfficeCheckbox>
          <OfficeCheckbox
            className='check'
            ariaLabel={`${labelPrefix}显示系列名称`}
            checked={value.showSeriesName === true}
            onCheckedChange={(showSeriesName) => change({ showSeriesName })}
          >
            系列名称
          </OfficeCheckbox>
          {(chartType === 'pie' || chartType === 'doughnut') && (
            <OfficeCheckbox
              className='check'
              ariaLabel={`${labelPrefix}显示百分比`}
              checked={value.showPercentage === true}
              onCheckedChange={(showPercentage) => change({ showPercentage })}
            >
              百分比
            </OfficeCheckbox>
          )}
          {chartType === 'bubble' && (
            <OfficeCheckbox
              className='check'
              ariaLabel={`${labelPrefix}显示气泡大小`}
              checked={value.showBubbleSize === true}
              onCheckedChange={(showBubbleSize) => change({ showBubbleSize })}
            >
              气泡大小
            </OfficeCheckbox>
          )}
          <div className='work-office-field data-label-position'>
            <span>位置</span>
            <OfficeSelect
              ariaLabel={`${labelPrefix}位置`}
              value={normalizeWorkSpreadsheetDataLabelPosition(value.position)}
              options={[
                { value: 'bestFit', label: '最佳匹配' },
                { value: 'center', label: '居中' },
                { value: 'insideBase', label: '内侧基部' },
                { value: 'insideEnd', label: '内侧末端' },
                { value: 'outsideEnd', label: '外侧末端' },
                { value: 'left', label: '左侧' },
                { value: 'right', label: '右侧' },
                { value: 'above', label: '上方' },
                { value: 'below', label: '下方' },
              ]}
              onValueChange={(position) => change({ position: position as WorkSpreadsheetDataLabelPosition })}
            />
          </div>
          <div className='work-office-field data-label-separator'>
            <span>分隔符</span>
            <OfficeTextField
              aria-label={`${labelPrefix}分隔符`}
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
