import { Calculator, RefreshCw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, CollectionState } from '../../../design-system/primitives';
import { spreadsheetFormulaAnalysis } from '../work-spreadsheet-formula-analysis';
import { effectiveSpreadsheetCalculationSettings } from '../work-spreadsheet-formulas';
import type { WorkSpreadsheetCalculationSettings, WorkSpreadsheetContent } from '../work-types';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect } from './office-controls';

interface SpreadsheetFormulaPanelProps {
  content: WorkSpreadsheetContent;
  canRecalculateSelection: boolean;
  onChange: (content: WorkSpreadsheetContent) => void;
  onRecalculate: (scope: 'workbook' | 'selection') => boolean;
}

export function SpreadsheetFormulaPanel({
  content,
  canRecalculateSelection,
  onChange,
  onRecalculate,
}: SpreadsheetFormulaPanelProps) {
  const [settings, setSettings] = useState(() => effectiveSpreadsheetCalculationSettings(content.calculation));
  const [status, setStatus] = useState('');
  const { summary, diagnostics } = useMemo(() => spreadsheetFormulaAnalysis(content), [content]);

  useEffect(() => {
    setSettings(effectiveSpreadsheetCalculationSettings(content.calculation));
  }, [content.calculation]);

  const update = <Key extends keyof WorkSpreadsheetCalculationSettings>(
    key: Key,
    value: WorkSpreadsheetCalculationSettings[Key]
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setStatus('');
  };
  const save = () => {
    onChange({
      ...content,
      calculation: effectiveSpreadsheetCalculationSettings(settings),
    });
    setStatus('计算设置已保存。');
  };
  const recalculate = (scope: 'workbook' | 'selection') => {
    const started = onRecalculate(scope);
    setStatus(
      started ? (scope === 'workbook' ? '已重新计算工作簿。' : '已重新计算当前选区。') : '表格尚未准备好，请稍后重试。'
    );
  };

  return (
    <div className='work-spreadsheet-formula-manager'>
      <aside aria-label='公式统计'>
        <FormulaStat label='公式单元格' value={summary.formulaCells} />
        <FormulaStat
          label='缓存错误'
          value={summary.cachedErrorCells}
          tone={summary.cachedErrorCells ? 'error' : undefined}
        />
        <FormulaStat label='传统数组' value={summary.arrayRanges} />
        <FormulaStat label='动态数组' value={summary.dynamicArrayRanges} />
        <FormulaStat label='模拟运算表' value={summary.dataTableRanges} />
        <FormulaStat
          label='兼容性问题'
          value={diagnostics.filter((item) => item.severity !== 'info').length}
          tone={diagnostics.some((item) => item.severity === 'error') ? 'error' : undefined}
        />
      </aside>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className='work-spreadsheet-calculation-fields'>
          <div className='work-office-field'>
            <span>计算模式</span>
            <OfficeSelect
              ariaLabel='计算模式'
              value={settings.mode}
              options={[
                { value: 'automatic', label: '自动' },
                { value: 'automatic-except-data-tables', label: '自动（模拟运算表除外）' },
                { value: 'manual', label: '手动' },
              ]}
              onValueChange={(mode) => update('mode', mode as WorkSpreadsheetCalculationSettings['mode'])}
            />
          </div>
          <div className='work-office-field'>
            <span>最大迭代次数</span>
            <OfficeNumberField
              ariaLabel='最大迭代次数'
              min={1}
              max={10_000}
              step={1}
              disabled={!settings.iterativeCalculation}
              value={settings.maximumIterations}
              onValueChange={(value) => update('maximumIterations', Number(value))}
            />
          </div>
          <div className='work-office-field'>
            <span>最大更改值</span>
            <OfficeNumberField
              ariaLabel='最大更改值'
              min={0.000000000001}
              step={0.000001}
              disabled={!settings.iterativeCalculation}
              value={settings.maximumChange}
              onValueChange={(value) => update('maximumChange', Number(value))}
            />
          </div>
          <OfficeCheckbox
            className='toggle'
            ariaLabel='打开工作簿时完整重算'
            checked={settings.fullCalculationOnLoad}
            onCheckedChange={(checked) => update('fullCalculationOnLoad', checked)}
          >
            打开工作簿时完整重算
          </OfficeCheckbox>
          <OfficeCheckbox
            className='toggle'
            ariaLabel='强制完整计算'
            checked={settings.forceFullCalculation}
            onCheckedChange={(checked) => update('forceFullCalculation', checked)}
          >
            强制完整计算
          </OfficeCheckbox>
          <OfficeCheckbox
            className='toggle'
            ariaLabel='使用迭代计算'
            checked={settings.iterativeCalculation}
            onCheckedChange={(checked) => update('iterativeCalculation', checked)}
          >
            使用迭代计算
          </OfficeCheckbox>
          <OfficeCheckbox
            className='toggle'
            ariaLabel='使用完整精度'
            checked={settings.fullPrecision}
            onCheckedChange={(checked) => update('fullPrecision', checked)}
          >
            使用完整精度
          </OfficeCheckbox>
          <div className='actions'>
            {status && <span className='status'>{status}</span>}
            <Button tone='secondary' disabled={!canRecalculateSelection} onClick={() => recalculate('selection')}>
              <RefreshCw size={12} />
              重新计算当前选区
            </Button>
            <Button tone='secondary' onClick={() => recalculate('workbook')}>
              <Calculator size={12} />
              重新计算工作簿
            </Button>
            <Button type='submit' tone='primary'>
              <Save size={12} />
              保存计算设置
            </Button>
          </div>
        </div>
        <section className='work-spreadsheet-formula-diagnostics' aria-label='公式兼容性诊断'>
          <header>
            <strong>公式兼容性诊断</strong>
            <span>{diagnostics.length ? `${diagnostics.length} 项` : '未发现问题'}</span>
          </header>
          <div>
            {diagnostics.map((diagnostic) => (
              <article className={diagnostic.severity} key={diagnostic.code}>
                <strong>{diagnostic.title}</strong>
                <p>{diagnostic.message}</p>
                {diagnostic.locations.length > 0 && (
                  <small>
                    {diagnostic.locations.slice(0, 4).join('、')}
                    {diagnostic.locations.length > 4 ? ` 等 ${diagnostic.locations.length} 处` : ''}
                  </small>
                )}
              </article>
            ))}
            {!diagnostics.length && (
              <CollectionState className='work-office-collection-empty' role='status'>
                当前公式可由 Work 直接计算，也没有缓存错误或分组冲突。
              </CollectionState>
            )}
          </div>
        </section>
      </form>
    </div>
  );
}

function FormulaStat({ label, value, tone }: { label: string; value: number; tone?: 'error' }) {
  return (
    <div className={tone}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
