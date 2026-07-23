import {
  workSpreadsheetChartAxisDefaultLabelPosition,
  workSpreadsheetChartAxisIsCategoryAxis,
  workSpreadsheetChartAxisIsValueAxis,
  workSpreadsheetChartAxisShowsMajorGridlinesByDefault,
} from '../work-spreadsheet-chart-axis';
import {
  type WorkSpreadsheetChartAxes,
  type WorkSpreadsheetChartAxis,
  type WorkSpreadsheetChartAxisPosition,
  type WorkSpreadsheetChartType,
} from '../work-types';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect, OfficeTextField } from './office-controls';

interface SpreadsheetChartAxisEditorProps {
  axes: WorkSpreadsheetChartAxes | undefined;
  chartType: WorkSpreadsheetChartType;
  showSecondaryAxes: boolean;
  onChange: (axes: WorkSpreadsheetChartAxes) => void;
}

const PRIMARY_AXES: Array<{ position: WorkSpreadsheetChartAxisPosition; label: string }> = [
  { position: 'bottom', label: '横坐标轴' },
  { position: 'left', label: '纵坐标轴' },
];

const SECONDARY_AXES: Array<{ position: WorkSpreadsheetChartAxisPosition; label: string }> = [
  { position: 'top', label: '次横坐标轴' },
  { position: 'right', label: '次纵坐标轴' },
];

export function SpreadsheetChartAxisEditor({
  axes,
  chartType,
  showSecondaryAxes,
  onChange,
}: SpreadsheetChartAxisEditorProps) {
  const items = showSecondaryAxes ? [...PRIMARY_AXES, ...SECONDARY_AXES] : PRIMARY_AXES;
  const updateAxis = (position: WorkSpreadsheetChartAxisPosition, changes: Partial<WorkSpreadsheetChartAxis>) => {
    onChange({
      ...axes,
      [position]: {
        ...axes?.[position],
        ...changes,
      },
    });
  };

  return (
    <section className='work-spreadsheet-chart-axes' aria-label='图表坐标轴设置'>
      <header>
        <strong>坐标轴</strong>
        <span>标题、刻度与显示方式</span>
      </header>
      <div>
        {items.map(({ position, label }) => {
          const axis = axes?.[position];
          const valueAxis = workSpreadsheetChartAxisIsValueAxis(chartType, position);
          const categoryAxis = workSpreadsheetChartAxisIsCategoryAxis(chartType, position);
          const labelPosition =
            axis?.labelPosition ?? workSpreadsheetChartAxisDefaultLabelPosition(chartType, position);
          const showMajorGridlines =
            axis?.showMajorGridlines ?? workSpreadsheetChartAxisShowsMajorGridlinesByDefault(chartType, position);
          const sourceLinked = axis?.numberFormatSourceLinked ?? !axis?.numberFormat;
          return (
            <fieldset key={position}>
              <legend>{label}</legend>
              <div className='work-office-field'>
                <span>标题</span>
                <OfficeTextField
                  aria-label={`${label}标题`}
                  value={axis?.title ?? ''}
                  maxLength={255}
                  onChange={(event) => updateAxis(position, { title: event.target.value })}
                />
              </div>
              <div className='work-office-field'>
                <span>标题引用（可选）</span>
                <OfficeTextField
                  aria-label={`${label}标题引用`}
                  value={axis?.titleReference ?? ''}
                  placeholder="'报告'!$D$1"
                  onChange={(event) => updateAxis(position, { titleReference: event.target.value })}
                />
              </div>
              <OfficeCheckbox
                className='axis-check'
                ariaLabel={`${label}逆序显示`}
                checked={axis?.reverseOrder === true}
                onCheckedChange={(reverseOrder) => updateAxis(position, { reverseOrder })}
              >
                逆序显示
              </OfficeCheckbox>
              <div className='work-office-field'>
                <span>标签位置</span>
                <OfficeSelect
                  ariaLabel={`${label}标签位置`}
                  value={labelPosition}
                  options={[
                    { value: 'nextTo', label: '轴旁' },
                    { value: 'high', label: '高位' },
                    { value: 'low', label: '低位' },
                    { value: 'none', label: '不显示' },
                  ]}
                  onValueChange={(value) =>
                    updateAxis(position, {
                      labelPosition: value as NonNullable<WorkSpreadsheetChartAxis['labelPosition']>,
                    })
                  }
                />
              </div>
              <div className='work-office-field'>
                <span>主要刻度线</span>
                <OfficeSelect
                  ariaLabel={`${label}主要刻度线`}
                  value={axis?.majorTickMark ?? 'none'}
                  options={[
                    { value: 'none', label: '无' },
                    { value: 'inside', label: '向内' },
                    { value: 'outside', label: '向外' },
                    { value: 'cross', label: '交叉' },
                  ]}
                  onValueChange={(value) =>
                    updateAxis(position, {
                      majorTickMark: value as NonNullable<WorkSpreadsheetChartAxis['majorTickMark']>,
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
                    ariaLabel={`${label}标签间隔`}
                    value={axis?.labelInterval ?? ''}
                    placeholder='自动'
                    onValueChange={(value) => updateAxis(position, { labelInterval: optionalInteger(value) })}
                  />
                </div>
              )}
              {valueAxis && (
                <>
                  <div className='work-office-field'>
                    <span>最小值（自动）</span>
                    <OfficeNumberField
                      step={0.1}
                      ariaLabel={`${label}最小值`}
                      value={axis?.minimum ?? ''}
                      onValueChange={(value) => updateAxis(position, { minimum: optionalNumber(value) })}
                    />
                  </div>
                  <div className='work-office-field'>
                    <span>最大值（自动）</span>
                    <OfficeNumberField
                      step={0.1}
                      ariaLabel={`${label}最大值`}
                      value={axis?.maximum ?? ''}
                      onValueChange={(value) => updateAxis(position, { maximum: optionalNumber(value) })}
                    />
                  </div>
                  <div className='work-office-field'>
                    <span>主单位（自动）</span>
                    <OfficeNumberField
                      min={0}
                      step={0.1}
                      ariaLabel={`${label}主单位`}
                      value={axis?.majorUnit ?? ''}
                      onValueChange={(value) => updateAxis(position, { majorUnit: optionalNumber(value) })}
                    />
                  </div>
                  <div className='work-office-field'>
                    <span>数字格式</span>
                    <OfficeTextField
                      aria-label={`${label}数字格式`}
                      value={axis?.numberFormat ?? ''}
                      maxLength={255}
                      placeholder='自动（如 #,##0 或 0.0%）'
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
                    ariaLabel={`${label}显示主要网格线`}
                    checked={showMajorGridlines}
                    onCheckedChange={(showMajorGridlines) => updateAxis(position, { showMajorGridlines })}
                  >
                    显示主要网格线
                  </OfficeCheckbox>
                  <OfficeCheckbox
                    className='axis-check'
                    ariaLabel={`${label}链接源数字格式`}
                    checked={sourceLinked}
                    onCheckedChange={(numberFormatSourceLinked) => updateAxis(position, { numberFormatSourceLinked })}
                  >
                    链接源数字格式
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
