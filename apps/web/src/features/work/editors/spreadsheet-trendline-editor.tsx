import { Plus, Trash2 } from 'lucide-react';
import type { WorkSpreadsheetTrendline, WorkSpreadsheetTrendlineType } from '../work-types';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect, OfficeTextField } from './office-controls';

interface SpreadsheetTrendlineEditorProps {
  seriesNumber: number;
  trendlines: WorkSpreadsheetTrendline[];
  onChange: (trendlines: WorkSpreadsheetTrendline[]) => void;
}

export function SpreadsheetTrendlineEditor({ seriesNumber, trendlines, onChange }: SpreadsheetTrendlineEditorProps) {
  const replaceTrendline = (index: number, change: Partial<WorkSpreadsheetTrendline>) => {
    onChange(trendlines.map((trendline, candidate) => (candidate === index ? { ...trendline, ...change } : trendline)));
  };

  return (
    <section className='work-spreadsheet-trendlines' aria-label={`系列 ${seriesNumber} 趋势线`}>
      <header>
        <strong>趋势线</strong>
        <button
          type='button'
          aria-label={`添加系列 ${seriesNumber} 趋势线`}
          onClick={() => onChange([...trendlines, { type: 'linear' }])}
        >
          <Plus size={11} />
          添加趋势线
        </button>
      </header>
      {!trendlines.length && <p>可为同一系列叠加线性、多项式或移动平均等趋势分析。</p>}
      {trendlines.map((trendline, index) => {
        const trendlineNumber = index + 1;
        const labelPrefix = `系列 ${seriesNumber} 趋势线 ${trendlineNumber}`;
        const hasIntercept = trendline.intercept !== undefined;
        return (
          <fieldset key={`${seriesNumber}-${trendlineNumber}`}>
            <legend>趋势线 {trendlineNumber}</legend>
            <div className='work-office-field'>
              <span>类型</span>
              <OfficeSelect
                ariaLabel={`${labelPrefix} 类型`}
                value={trendline.type}
                options={[
                  { value: 'linear', label: '线性' },
                  { value: 'exponential', label: '指数' },
                  { value: 'logarithmic', label: '对数' },
                  { value: 'polynomial', label: '多项式' },
                  { value: 'power', label: '幂' },
                  { value: 'movingAverage', label: '移动平均' },
                ]}
                onValueChange={(value) =>
                  onChange(
                    trendlines.map((item, candidate) =>
                      candidate === index ? trendlineWithType(item, value as WorkSpreadsheetTrendlineType) : item
                    )
                  )
                }
              />
            </div>
            <div className='work-office-field'>
              <span>名称</span>
              <OfficeTextField
                aria-label={`${labelPrefix} 名称`}
                value={trendline.name ?? ''}
                maxLength={255}
                placeholder={`趋势线 ${trendlineNumber}`}
                onChange={(event) => replaceTrendline(index, { name: event.target.value })}
              />
            </div>
            {trendline.type === 'polynomial' && (
              <div className='work-office-field'>
                <span>阶数</span>
                <OfficeNumberField
                  ariaLabel={`${labelPrefix} 阶数`}
                  min={2}
                  max={6}
                  step={1}
                  value={trendline.order ?? 2}
                  onValueChange={(value) => replaceTrendline(index, { order: optionalNumber(value) })}
                />
              </div>
            )}
            {trendline.type === 'movingAverage' && (
              <div className='work-office-field'>
                <span>周期</span>
                <OfficeNumberField
                  ariaLabel={`${labelPrefix} 周期`}
                  min={2}
                  max={255}
                  step={1}
                  value={trendline.period ?? 2}
                  onValueChange={(value) => replaceTrendline(index, { period: optionalNumber(value) })}
                />
              </div>
            )}
            <div className='work-office-field'>
              <span>前推</span>
              <OfficeNumberField
                ariaLabel={`${labelPrefix} 前推`}
                min={0}
                step={0.1}
                value={trendline.forward ?? 0}
                onValueChange={(value) => replaceTrendline(index, { forward: optionalNumber(value) })}
              />
            </div>
            <div className='work-office-field'>
              <span>后推</span>
              <OfficeNumberField
                ariaLabel={`${labelPrefix} 后推`}
                min={0}
                step={0.1}
                value={trendline.backward ?? 0}
                onValueChange={(value) => replaceTrendline(index, { backward: optionalNumber(value) })}
              />
            </div>
            <OfficeCheckbox
              className='check intercept-toggle'
              ariaLabel={`${labelPrefix} 固定截距`}
              checked={hasIntercept}
              onCheckedChange={(checked) => replaceTrendline(index, { intercept: checked ? 0 : undefined })}
            >
              固定截距
            </OfficeCheckbox>
            <div className='work-office-field'>
              <span>截距</span>
              <OfficeNumberField
                ariaLabel={`${labelPrefix} 截距`}
                step={0.1}
                disabled={!hasIntercept}
                value={trendline.intercept ?? 0}
                onValueChange={(value) => replaceTrendline(index, { intercept: optionalNumber(value) })}
              />
            </div>
            <OfficeCheckbox
              className='check'
              ariaLabel={`${labelPrefix} 显示公式`}
              checked={trendline.displayEquation === true}
              onCheckedChange={(displayEquation) => replaceTrendline(index, { displayEquation })}
            >
              显示公式
            </OfficeCheckbox>
            <OfficeCheckbox
              className='check'
              ariaLabel={`${labelPrefix} 显示 R 方`}
              checked={trendline.displayRSquared === true}
              onCheckedChange={(displayRSquared) => replaceTrendline(index, { displayRSquared })}
            >
              显示 R²
            </OfficeCheckbox>
            <button
              type='button'
              className='remove-trendline'
              aria-label={`删除${labelPrefix}`}
              onClick={() => onChange(trendlines.filter((_, candidate) => candidate !== index))}
            >
              <Trash2 size={12} />
            </button>
          </fieldset>
        );
      })}
    </section>
  );
}

function trendlineWithType(
  trendline: WorkSpreadsheetTrendline,
  type: WorkSpreadsheetTrendlineType
): WorkSpreadsheetTrendline {
  const next = { ...trendline, type, order: undefined, period: undefined };
  if (type === 'polynomial') return { ...next, order: trendline.order ?? 2 };
  if (type === 'movingAverage') return { ...next, period: trendline.period ?? 2, intercept: undefined };
  return next;
}

function optionalNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value);
}
