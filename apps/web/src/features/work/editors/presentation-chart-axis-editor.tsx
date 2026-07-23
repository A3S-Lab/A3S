import { presentationChartAxes, withPresentationChartAxes } from '../work-presentation-chart-axes';
import {
  workSpreadsheetChartAxisDefaultLabelPosition,
  workSpreadsheetChartAxisIsCategoryAxis,
  workSpreadsheetChartAxisIsValueAxis,
  workSpreadsheetChartAxisShowsMajorGridlinesByDefault,
} from '../work-spreadsheet-chart-axis';
import type { WorkSlideChart, WorkSlideChartAxis, WorkSpreadsheetChartAxisPosition } from '../work-types';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect, OfficeTextField } from './office-controls';

const PRIMARY_AXES: Array<{ position: WorkSpreadsheetChartAxisPosition; label: string }> = [
  { position: 'bottom', label: '横轴' },
  { position: 'left', label: '纵轴' },
];

export function PresentationChartAxisEditor({
  chart,
  onChange,
}: {
  chart: WorkSlideChart;
  onChange: (chart: WorkSlideChart) => void;
}) {
  const axes = presentationChartAxes(chart);
  const updateAxis = (position: WorkSpreadsheetChartAxisPosition, changes: Partial<WorkSlideChartAxis>) => {
    onChange(
      withPresentationChartAxes(chart, {
        ...axes,
        [position]: { ...axes?.[position], ...changes },
      })
    );
  };

  return (
    <section className='work-spreadsheet-chart-axes work-presentation-chart-axes' aria-label='演示图表坐标轴设置'>
      <header>
        <strong>坐标轴</strong>
        <span>标题、范围、刻度与标签</span>
      </header>
      <div>
        {PRIMARY_AXES.map(({ position, label }) => {
          const axis = axes?.[position];
          const valueAxis = workSpreadsheetChartAxisIsValueAxis(chart.type, position);
          const categoryAxis = workSpreadsheetChartAxisIsCategoryAxis(chart.type, position);
          const labelPosition =
            axis?.labelPosition ?? workSpreadsheetChartAxisDefaultLabelPosition(chart.type, position);
          const showMajorGridlines =
            axis?.showMajorGridlines ?? workSpreadsheetChartAxisShowsMajorGridlinesByDefault(chart.type, position);
          const sourceLinked = axis?.numberFormatSourceLinked ?? !axis?.numberFormat;
          const ariaName = `演示图表${label}`;
          return (
            <fieldset key={position}>
              <legend>{label}</legend>
              <div className='work-office-field'>
                <span>标题</span>
                <OfficeTextField
                  aria-label={`${ariaName}标题`}
                  value={axis?.title ?? ''}
                  maxLength={255}
                  onChange={(event) => updateAxis(position, { title: event.target.value })}
                />
              </div>
              <OfficeCheckbox
                className='axis-check'
                ariaLabel={`${ariaName}逆序`}
                checked={axis?.reverseOrder === true}
                onCheckedChange={(reverseOrder) => updateAxis(position, { reverseOrder })}
              >
                逆序
              </OfficeCheckbox>
              <div className='work-office-field'>
                <span>标签位置</span>
                <OfficeSelect
                  ariaLabel={`${ariaName}标签位置`}
                  value={labelPosition}
                  options={[
                    { value: 'nextTo', label: '轴旁' },
                    { value: 'high', label: '高位' },
                    { value: 'low', label: '低位' },
                    { value: 'none', label: '不显示' },
                  ]}
                  onValueChange={(value) =>
                    updateAxis(position, {
                      labelPosition: value as NonNullable<WorkSlideChartAxis['labelPosition']>,
                    })
                  }
                />
              </div>
              <div className='work-office-field'>
                <span>主要刻度线</span>
                <OfficeSelect
                  ariaLabel={`${ariaName}主要刻度线`}
                  value={axis?.majorTickMark ?? 'none'}
                  options={[
                    { value: 'none', label: '无' },
                    { value: 'inside', label: '向内' },
                    { value: 'outside', label: '向外' },
                    { value: 'cross', label: '交叉' },
                  ]}
                  onValueChange={(value) =>
                    updateAxis(position, {
                      majorTickMark: value as NonNullable<WorkSlideChartAxis['majorTickMark']>,
                    })
                  }
                />
              </div>
              {categoryAxis && (
                <div className='work-office-field'>
                  <span>标签间隔</span>
                  <OfficeNumberField
                    min={1}
                    max={31_999}
                    step={1}
                    ariaLabel={`${ariaName}标签间隔`}
                    value={axis?.labelInterval ?? ''}
                    placeholder='自动'
                    onValueChange={(value) => updateAxis(position, { labelInterval: optionalInteger(value) })}
                  />
                </div>
              )}
              {valueAxis && (
                <>
                  <div className='work-office-field'>
                    <span>最小值</span>
                    <OfficeNumberField
                      step={0.1}
                      ariaLabel={`${ariaName}最小值`}
                      value={axis?.minimum ?? ''}
                      placeholder='自动'
                      onValueChange={(value) => updateAxis(position, { minimum: optionalNumber(value) })}
                    />
                  </div>
                  <div className='work-office-field'>
                    <span>最大值</span>
                    <OfficeNumberField
                      step={0.1}
                      ariaLabel={`${ariaName}最大值`}
                      value={axis?.maximum ?? ''}
                      placeholder='自动'
                      onValueChange={(value) => updateAxis(position, { maximum: optionalNumber(value) })}
                    />
                  </div>
                  <div className='work-office-field'>
                    <span>主单位</span>
                    <OfficeNumberField
                      min={0}
                      step={0.1}
                      ariaLabel={`${ariaName}主单位`}
                      value={axis?.majorUnit ?? ''}
                      placeholder='自动'
                      onValueChange={(value) => updateAxis(position, { majorUnit: optionalNumber(value) })}
                    />
                  </div>
                  <div className='work-office-field'>
                    <span>数字格式</span>
                    <OfficeTextField
                      aria-label={`${ariaName}数字格式`}
                      value={axis?.numberFormat ?? ''}
                      maxLength={255}
                      placeholder='#,##0 或 0.0%'
                      onChange={(event) => {
                        const numberFormat = event.target.value;
                        updateAxis(position, {
                          numberFormat,
                          numberFormatSourceLinked: numberFormat.trim() ? false : undefined,
                        });
                      }}
                    />
                  </div>
                  <OfficeCheckbox
                    className='axis-check'
                    ariaLabel={`${ariaName}主要网格线`}
                    checked={showMajorGridlines}
                    onCheckedChange={(showMajorGridlines) => updateAxis(position, { showMajorGridlines })}
                  >
                    主要网格线
                  </OfficeCheckbox>
                  <OfficeCheckbox
                    className='axis-check'
                    ariaLabel={`${ariaName}链接源数字格式`}
                    checked={sourceLinked}
                    onCheckedChange={(numberFormatSourceLinked) => updateAxis(position, { numberFormatSourceLinked })}
                  >
                    链接源格式
                  </OfficeCheckbox>
                </>
              )}
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function optionalInteger(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
}
