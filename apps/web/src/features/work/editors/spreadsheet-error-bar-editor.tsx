import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CollectionState } from '../../../design-system/primitives';
import {
  type WorkSpreadsheetChartType,
  type WorkSpreadsheetErrorBarDirection,
  type WorkSpreadsheetErrorBars,
  type WorkSpreadsheetErrorBarType,
  type WorkSpreadsheetErrorBarValueType,
  workSpreadsheetChartUsesNumericXAxis,
} from '../work-types';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect, OfficeTextField } from './office-controls';

interface SpreadsheetErrorBarEditorProps {
  chartType: WorkSpreadsheetChartType;
  seriesNumber: number;
  errorBars: WorkSpreadsheetErrorBars[];
  onChange: (errorBars: WorkSpreadsheetErrorBars[]) => void;
  customInput?: 'references' | 'values';
}

export function SpreadsheetErrorBarEditor({
  chartType,
  seriesNumber,
  errorBars,
  onChange,
  customInput = 'references',
}: SpreadsheetErrorBarEditorProps) {
  const replaceErrorBars = (index: number, change: Partial<WorkSpreadsheetErrorBars>) => {
    onChange(errorBars.map((item, candidate) => (candidate === index ? { ...item, ...change } : item)));
  };
  const hasDirection = (direction: WorkSpreadsheetErrorBarDirection) =>
    errorBars.some((item) => item.direction === direction);
  const addErrorBars = (direction: WorkSpreadsheetErrorBarDirection) =>
    onChange([...errorBars, { direction, barType: 'both', valueType: 'standardError' }]);

  return (
    <section className='work-spreadsheet-error-bars' aria-label={`系列 ${seriesNumber} 误差线`}>
      <header>
        <strong>误差线</strong>
        <div>
          {workSpreadsheetChartUsesNumericXAxis(chartType) && (
            <button
              type='button'
              aria-label={`添加系列 ${seriesNumber} X 误差线`}
              disabled={hasDirection('x')}
              onClick={() => addErrorBars('x')}
            >
              <Plus size={11} />X
            </button>
          )}
          <button
            type='button'
            aria-label={`添加系列 ${seriesNumber} Y 误差线`}
            disabled={hasDirection('y')}
            onClick={() => addErrorBars('y')}
          >
            <Plus size={11} />Y
          </button>
        </div>
      </header>
      {!errorBars.length && (
        <CollectionState className='work-spreadsheet-error-bars-empty' role='status'>
          添加固定值、百分比、统计或自定义范围误差线。
        </CollectionState>
      )}
      {errorBars.map((item, index) => {
        const errorBarNumber = index + 1;
        const labelPrefix = `系列 ${seriesNumber} 误差线 ${errorBarNumber}`;
        return (
          <fieldset key={`${seriesNumber}-${errorBarNumber}`}>
            <legend>
              {item.direction.toUpperCase()} 误差线 {errorBarNumber}
            </legend>
            <div className='work-office-field'>
              <span>方向</span>
              <OfficeSelect
                ariaLabel={`${labelPrefix} 方向`}
                value={item.direction}
                options={[
                  ...(workSpreadsheetChartUsesNumericXAxis(chartType) ? [{ value: 'x', label: 'X' } as const] : []),
                  { value: 'y', label: 'Y' },
                ]}
                onValueChange={(direction) =>
                  replaceErrorBars(index, { direction: direction as WorkSpreadsheetErrorBarDirection })
                }
              />
            </div>
            <div className='work-office-field'>
              <span>误差类型</span>
              <OfficeSelect
                ariaLabel={`${labelPrefix} 误差类型`}
                value={item.barType}
                options={[
                  { value: 'both', label: '双向' },
                  { value: 'plus', label: '正向' },
                  { value: 'minus', label: '负向' },
                ]}
                onValueChange={(barType) =>
                  replaceErrorBars(index, { barType: barType as WorkSpreadsheetErrorBarType })
                }
              />
            </div>
            <div className='work-office-field'>
              <span>计算方式</span>
              <OfficeSelect
                ariaLabel={`${labelPrefix} 计算方式`}
                value={item.valueType}
                options={[
                  { value: 'fixedValue', label: '固定值' },
                  { value: 'percentage', label: '百分比' },
                  { value: 'standardDeviation', label: '标准差' },
                  { value: 'standardError', label: '标准误差' },
                  { value: 'custom', label: '自定义范围' },
                ]}
                onValueChange={(valueType) =>
                  replaceErrorBars(index, errorBarsWithValueType(item, valueType as WorkSpreadsheetErrorBarValueType))
                }
              />
            </div>
            {(item.valueType === 'fixedValue' ||
              item.valueType === 'percentage' ||
              item.valueType === 'standardDeviation') && (
              <div className='work-office-field'>
                <span>{item.valueType === 'percentage' ? '百分比（%）' : '数值'}</span>
                <OfficeNumberField
                  ariaLabel={`${labelPrefix} 数值`}
                  min={0}
                  step={0.1}
                  value={item.value ?? (item.valueType === 'percentage' ? 5 : 1)}
                  onValueChange={(value) => replaceErrorBars(index, { value: optionalNumber(value) })}
                />
              </div>
            )}
            {item.valueType === 'custom' && item.barType !== 'minus' && customInput === 'references' && (
              <div className='work-office-field error-reference'>
                <span>正误差引用</span>
                <OfficeTextField
                  aria-label={`${labelPrefix} 正误差引用`}
                  value={item.plusReference ?? ''}
                  placeholder="'报告'!$C$2:$C$8"
                  onChange={(event) => replaceErrorBars(index, { plusReference: event.target.value })}
                />
              </div>
            )}
            {item.valueType === 'custom' && item.barType !== 'plus' && customInput === 'references' && (
              <div className='work-office-field error-reference'>
                <span>负误差引用</span>
                <OfficeTextField
                  aria-label={`${labelPrefix} 负误差引用`}
                  value={item.minusReference ?? ''}
                  placeholder="'报告'!$D$2:$D$8"
                  onChange={(event) => replaceErrorBars(index, { minusReference: event.target.value })}
                />
              </div>
            )}
            {item.valueType === 'custom' && item.barType !== 'minus' && customInput === 'values' && (
              <div className='work-office-field error-reference'>
                <span>正误差值</span>
                <CustomErrorValuesInput
                  label={`${labelPrefix} 正误差值`}
                  id={`work-error-values-${seriesNumber}-${errorBarNumber}-plus`}
                  values={item.plusValues}
                  reference={item.plusReference}
                  onCommit={(plusValues) =>
                    replaceErrorBars(index, {
                      plusValues,
                      plusReference: undefined,
                    })
                  }
                />
                {item.plusReference && <small title={item.plusReference}>已保留导入引用：{item.plusReference}</small>}
              </div>
            )}
            {item.valueType === 'custom' && item.barType !== 'plus' && customInput === 'values' && (
              <div className='work-office-field error-reference'>
                <span>负误差值</span>
                <CustomErrorValuesInput
                  label={`${labelPrefix} 负误差值`}
                  id={`work-error-values-${seriesNumber}-${errorBarNumber}-minus`}
                  values={item.minusValues}
                  reference={item.minusReference}
                  onCommit={(minusValues) =>
                    replaceErrorBars(index, {
                      minusValues,
                      minusReference: undefined,
                    })
                  }
                />
                {item.minusReference && (
                  <small title={item.minusReference}>已保留导入引用：{item.minusReference}</small>
                )}
              </div>
            )}
            <OfficeCheckbox
              className='check'
              ariaLabel={`${labelPrefix} 显示端帽`}
              checked={item.showEndCaps !== false}
              onCheckedChange={(showEndCaps) => replaceErrorBars(index, { showEndCaps })}
            >
              显示端帽
            </OfficeCheckbox>
            <button
              type='button'
              className='remove-error-bars'
              aria-label={`删除${labelPrefix}`}
              onClick={() => onChange(errorBars.filter((_, candidate) => candidate !== index))}
            >
              <Trash2 size={12} />
            </button>
          </fieldset>
        );
      })}
    </section>
  );
}

function errorBarsWithValueType(
  errorBars: WorkSpreadsheetErrorBars,
  valueType: WorkSpreadsheetErrorBarValueType
): Partial<WorkSpreadsheetErrorBars> {
  if (valueType === 'standardError' || valueType === 'custom') return { valueType, value: undefined };
  return { valueType, value: errorBars.value ?? (valueType === 'percentage' ? 5 : 1) };
}

function optionalNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value);
}

function CustomErrorValuesInput({
  label,
  id,
  values,
  reference,
  onCommit,
}: {
  label: string;
  id: string;
  values: number[] | undefined;
  reference: string | undefined;
  onCommit: (values: number[] | undefined) => void;
}) {
  const serialized = values?.join(', ') ?? '';
  const [draft, setDraft] = useState(serialized);
  useEffect(() => setDraft(serialized), [serialized]);
  return (
    <OfficeTextField
      id={id}
      aria-label={label}
      value={draft}
      placeholder={reference ? '已保留导入引用；输入数值可替换' : '1, 2, 1.5'}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(parseCustomValues(draft))}
    />
  );
}

function parseCustomValues(value: string): number[] | undefined {
  const values = value
    .split(/[\s,;，；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 256)
    .map(Number)
    .filter(Number.isFinite)
    .map((item) => Math.max(0, item));
  return values.length ? values : undefined;
}
