import type { Selection } from '@fortune-sheet/core';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, CollectionState, InlineNotice, StateView } from '../../../design-system/primitives';
import { normalizeWorkSpreadsheetChartAxes } from '../work-spreadsheet-chart-axis';
import {
  normalizeWorkSpreadsheetChartLayout,
  workSpreadsheetChartSupportsSeriesAnalysis,
} from '../work-spreadsheet-chart-layout';
import { normalizeWorkSpreadsheetChartSeriesStyle } from '../work-spreadsheet-chart-series-style';
import { validateSpreadsheetChartSeriesTrendlines } from '../work-spreadsheet-chart-validation';
import { createSpreadsheetChartFromSelection, parseSpreadsheetChartReference } from '../work-spreadsheet-charts';
import {
  normalizeWorkSpreadsheetBubbleScale,
  normalizeWorkSpreadsheetBubbleSizeRepresents,
  normalizeWorkSpreadsheetChartAxisGroup,
  normalizeWorkSpreadsheetCombinationSeriesType,
  normalizeWorkSpreadsheetDataLabels,
  normalizeWorkSpreadsheetDoughnutHoleSize,
  normalizeWorkSpreadsheetErrorBars,
  normalizeWorkSpreadsheetRadarStyle,
  normalizeWorkSpreadsheetScatterStyle,
  normalizeWorkSpreadsheetTrendline,
  type WorkSpreadsheetBubbleSizeRepresents,
  type WorkSpreadsheetChart,
  type WorkSpreadsheetChartAxisGroup,
  type WorkSpreadsheetChartType,
  type WorkSpreadsheetCombinationSeriesType,
  type WorkSpreadsheetContent,
  type WorkSpreadsheetRadarStyle,
  type WorkSpreadsheetScatterStyle,
  workSpreadsheetChartSupportsAxes,
  workSpreadsheetChartSupportsErrorBars,
  workSpreadsheetChartSupportsTrendlines,
  workSpreadsheetChartTypeLabel,
  workSpreadsheetChartUsesNumericXAxis,
} from '../work-types';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect, OfficeTextField } from './office-controls';
import { SpreadsheetChartAxisEditor } from './spreadsheet-chart-axis-editor';
import {
  type ChartDraft,
  type ChartListItem,
  chartDraft,
  chartDraftWithType,
  chartKey,
  newChartSeries,
  replaceSeries,
  validateChartAxes,
  validateSeriesErrorBars,
} from './spreadsheet-chart-draft';
import { SpreadsheetChartLayoutEditor } from './spreadsheet-chart-layout-editor';
import { SpreadsheetChartSeriesStyleEditor } from './spreadsheet-chart-series-style-editor';
import { SpreadsheetDataLabelEditor } from './spreadsheet-data-label-editor';
import { SpreadsheetErrorBarEditor } from './spreadsheet-error-bar-editor';
import { SpreadsheetTrendlineEditor } from './spreadsheet-trendline-editor';

interface SpreadsheetChartPanelProps {
  content: WorkSpreadsheetContent;
  activeSheetId: string;
  selection?: Selection;
  onChange: (content: WorkSpreadsheetContent) => void;
}

export function SpreadsheetChartPanel({ content, activeSheetId, selection, onChange }: SpreadsheetChartPanelProps) {
  const items = useMemo(
    () =>
      content.sheets.flatMap((sheet) =>
        (sheet.charts ?? []).flatMap((chart) => (sheet.id ? [{ sheetId: sheet.id, sheetName: sheet.name, chart }] : []))
      ),
    [content.sheets]
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(() => chartKey(items[0]));
  const [draft, setDraft] = useState<ChartDraft | null>(() => (items[0] ? chartDraft(items[0]) : null));
  const [error, setError] = useState('');

  useEffect(() => {
    const current = items.find((item) => chartKey(item) === selectedKey);
    if (current) {
      setDraft(chartDraft(current));
      return;
    }
    if (selectedKey) {
      const first = items[0];
      setSelectedKey(chartKey(first));
      setDraft(first ? chartDraft(first) : null);
    }
  }, [items, selectedKey]);

  const selectChart = (item: ChartListItem) => {
    setSelectedKey(chartKey(item));
    setDraft(chartDraft(item));
    setError('');
  };
  const addChart = () => {
    const sheet =
      content.sheets.find((candidate) => candidate.id === activeSheetId) ??
      content.sheets.find((candidate) => !candidate.hide) ??
      content.sheets[0];
    if (!sheet?.id) {
      setError('当前工作簿没有可用于创建图表的工作表。');
      return;
    }
    const fallbackSelection: Selection = {
      row: [0, Math.max(0, Math.min(4, (sheet.row ?? 5) - 1))],
      column: [0, Math.max(0, Math.min(1, (sheet.column ?? 2) - 1))],
    };
    const chart = createSpreadsheetChartFromSelection(content, sheet.id, selection ?? fallbackSelection);
    if (!chart) {
      setError('请先选择一个包含图表数据的连续单元格区域。');
      return;
    }
    const next = content.sheets.map((candidate) =>
      candidate.id === sheet.id ? { ...candidate, charts: [...(candidate.charts ?? []), chart] } : candidate
    );
    onChange({ ...content, sheets: next });
    setSelectedKey(`${sheet.id}:${chart.id}`);
    setDraft({ ...chart, sheetId: sheet.id, series: chart.series.map((item) => ({ ...item })) });
    setError('');
  };
  const saveChart = () => {
    if (!draft) return;
    const ownerSheet = content.sheets.find((sheet) => sheet.id === draft.sheetId);
    if (!ownerSheet) {
      setError('找不到图表所在的工作表。');
      return;
    }
    if (!draft.name.trim()) {
      setError('请输入图表对象名称。');
      return;
    }
    if (
      !workSpreadsheetChartUsesNumericXAxis(draft.type) &&
      draft.categoryReference?.trim() &&
      !parseSpreadsheetChartReference(content, ownerSheet, draft.categoryReference)
    ) {
      setError('分类引用必须是当前工作簿中的连续 A1 单元格范围。');
      return;
    }
    if (!draft.series.length) {
      setError('图表至少需要一个数据系列。');
      return;
    }
    if (draft.type === 'pie' && draft.series.length > 1) {
      setError('基础饼图只能使用一个数据系列，请先删除其他系列。');
      return;
    }
    if (draft.type === 'combination' && draft.series.length < 2) {
      setError('组合图至少需要两个数据系列。');
      return;
    }
    if (
      draft.type === 'doughnut' &&
      (typeof draft.doughnutHoleSize !== 'number' ||
        !Number.isFinite(draft.doughnutHoleSize) ||
        (draft.doughnutHoleSize ?? 0) < 10 ||
        (draft.doughnutHoleSize ?? 0) > 90)
    ) {
      setError('圆环孔径必须在 10% 到 90% 之间。');
      return;
    }
    if (
      draft.type === 'bubble' &&
      (typeof draft.bubbleScale !== 'number' ||
        !Number.isFinite(draft.bubbleScale) ||
        draft.bubbleScale < 0 ||
        draft.bubbleScale > 300)
    ) {
      setError('气泡缩放必须在 0% 到 300% 之间。');
      return;
    }
    const supportsSeriesAnalysis = workSpreadsheetChartSupportsSeriesAnalysis(draft);
    const hasSecondaryAxes =
      draft.type === 'combination' &&
      draft.series.some((series) => normalizeWorkSpreadsheetChartAxisGroup(series.axisGroup) === 'secondary');
    if (workSpreadsheetChartSupportsAxes(draft.type)) {
      const axisError = validateChartAxes(content, ownerSheet, draft.axes, hasSecondaryAxes);
      if (axisError) {
        setError(axisError);
        return;
      }
    }
    for (const [index, series] of draft.series.entries()) {
      if (series.nameReference?.trim() && !parseSpreadsheetChartReference(content, ownerSheet, series.nameReference)) {
        setError(`系列 ${index + 1} 的名称引用无效。`);
        return;
      }
      if (
        series.valuesReference?.trim() &&
        !parseSpreadsheetChartReference(content, ownerSheet, series.valuesReference)
      ) {
        setError(`系列 ${index + 1} 的数值引用无效。`);
        return;
      }
      if (!series.valuesReference?.trim() && !series.values.length) {
        setError(`系列 ${index + 1} 需要数值引用。`);
        return;
      }
      if (workSpreadsheetChartUsesNumericXAxis(draft.type)) {
        if (
          series.xValuesReference?.trim() &&
          !parseSpreadsheetChartReference(content, ownerSheet, series.xValuesReference)
        ) {
          setError(`系列 ${index + 1} 的 X 值引用无效。`);
          return;
        }
        if (!series.xValuesReference?.trim() && !series.xValues?.length) {
          setError(`系列 ${index + 1} 需要 X 值引用。`);
          return;
        }
      }
      if (draft.type === 'bubble') {
        if (
          series.bubbleSizesReference?.trim() &&
          !parseSpreadsheetChartReference(content, ownerSheet, series.bubbleSizesReference)
        ) {
          setError(`系列 ${index + 1} 的气泡大小引用无效。`);
          return;
        }
        if (!series.bubbleSizesReference?.trim() && !series.bubbleSizes?.length) {
          setError(`系列 ${index + 1} 需要气泡大小引用。`);
          return;
        }
      }
      if (supportsSeriesAnalysis && workSpreadsheetChartSupportsErrorBars(draft.type)) {
        const errorBarError = validateSeriesErrorBars(content, ownerSheet, series, index, draft.type);
        if (errorBarError) {
          setError(errorBarError);
          return;
        }
      }
      if (supportsSeriesAnalysis && workSpreadsheetChartSupportsTrendlines(draft.type)) {
        const trendlineError = validateSpreadsheetChartSeriesTrendlines(series, index);
        if (trendlineError) {
          setError(trendlineError);
          return;
        }
      }
    }
    const numericXAxis = workSpreadsheetChartUsesNumericXAxis(draft.type);
    const supportsErrorBars = supportsSeriesAnalysis && workSpreadsheetChartSupportsErrorBars(draft.type);
    const supportsTrendlines = supportsSeriesAnalysis && workSpreadsheetChartSupportsTrendlines(draft.type);
    const saved: WorkSpreadsheetChart = {
      ...draft,
      name: draft.name.trim(),
      altText: draft.altText?.trim() || undefined,
      title: draft.title?.trim() || undefined,
      titleReference: draft.titleReference?.trim().replace(/^=/, '') || undefined,
      axes: normalizeWorkSpreadsheetChartAxes(draft.axes, draft.type, hasSecondaryAxes),
      ...normalizeWorkSpreadsheetChartLayout(draft),
      categoryReference: numericXAxis ? undefined : draft.categoryReference?.trim().replace(/^=/, '') || undefined,
      doughnutHoleSize:
        draft.type === 'doughnut' ? normalizeWorkSpreadsheetDoughnutHoleSize(draft.doughnutHoleSize) : undefined,
      radarStyle: draft.type === 'radar' ? normalizeWorkSpreadsheetRadarStyle(draft.radarStyle) : undefined,
      scatterStyle: draft.type === 'scatter' ? normalizeWorkSpreadsheetScatterStyle(draft.scatterStyle) : undefined,
      bubbleScale: draft.type === 'bubble' ? normalizeWorkSpreadsheetBubbleScale(draft.bubbleScale) : undefined,
      showNegativeBubbles: draft.type === 'bubble' ? draft.showNegativeBubbles === true : undefined,
      bubbleSizeRepresents:
        draft.type === 'bubble' ? normalizeWorkSpreadsheetBubbleSizeRepresents(draft.bubbleSizeRepresents) : undefined,
      series: draft.series.map((series, index) => {
        const {
          xValues,
          xValuesReference,
          bubbleSizes,
          bubbleSizesReference,
          chartType,
          axisGroup,
          dataLabels,
          errorBars,
          trendlines,
          style,
          ...categorySeries
        } = series;
        return {
          ...categorySeries,
          name: series.name.trim() || `系列 ${index + 1}`,
          nameReference: series.nameReference?.trim().replace(/^=/, '') || undefined,
          valuesReference: series.valuesReference?.trim().replace(/^=/, '') || undefined,
          ...(numericXAxis
            ? {
                xValues,
                xValuesReference: xValuesReference?.trim().replace(/^=/, '') || undefined,
              }
            : {}),
          ...(draft.type === 'bubble'
            ? {
                bubbleSizes,
                bubbleSizesReference: bubbleSizesReference?.trim().replace(/^=/, '') || undefined,
              }
            : {}),
          ...(draft.type === 'combination'
            ? {
                chartType: normalizeWorkSpreadsheetCombinationSeriesType(chartType),
                axisGroup: normalizeWorkSpreadsheetChartAxisGroup(axisGroup),
              }
            : {}),
          ...(dataLabels ? { dataLabels: normalizeWorkSpreadsheetDataLabels(dataLabels, draft.type) } : {}),
          ...(style ? { style: normalizeWorkSpreadsheetChartSeriesStyle(style) } : {}),
          ...(supportsErrorBars && errorBars?.length
            ? { errorBars: errorBars.map((item) => normalizeWorkSpreadsheetErrorBars(item, draft.type)) }
            : {}),
          ...(supportsTrendlines && trendlines?.length
            ? { trendlines: trendlines.map(normalizeWorkSpreadsheetTrendline) }
            : {}),
        };
      }),
    };
    const sheets = content.sheets.map((sheet) =>
      sheet.id === draft.sheetId
        ? {
            ...sheet,
            charts: (sheet.charts ?? []).map((chart) => (chart.id === saved.id ? saved : chart)),
          }
        : sheet
    );
    onChange({ ...content, sheets });
    setDraft(chartDraft({ sheetId: draft.sheetId, sheetName: ownerSheet.name, chart: saved }));
    setError('');
  };
  const deleteChart = () => {
    if (!draft) return;
    const sheets = content.sheets.map((sheet) => {
      if (sheet.id !== draft.sheetId) return sheet;
      const charts = (sheet.charts ?? []).filter((chart) => chart.id !== draft.id);
      return { ...sheet, charts: charts.length ? charts : undefined };
    });
    onChange({ ...content, sheets });
    const next = items.find((item) => chartKey(item) !== `${draft.sheetId}:${draft.id}`);
    setSelectedKey(chartKey(next));
    setDraft(next ? chartDraft(next) : null);
    setError('');
  };

  return (
    <div className='work-spreadsheet-chart-manager'>
      <aside aria-label='工作簿图表'>
        <Button className='create' tone='secondary' onClick={addChart}>
          <Plus size={13} />
          根据当前选区新建
        </Button>
        <div className='work-spreadsheet-chart-list'>
          {items.map((item) => (
            <button
              type='button'
              className={chartKey(item) === selectedKey ? 'active' : ''}
              key={chartKey(item)}
              onClick={() => selectChart(item)}
            >
              <strong>{item.chart.title || item.chart.name}</strong>
              <span>
                {item.sheetName} · {workSpreadsheetChartTypeLabel(item.chart.type)}
              </span>
            </button>
          ))}
          {!items.length && (
            <CollectionState className='work-office-collection-empty' role='status'>
              还没有图表。先选择带标题的数据区域，再创建图表。
            </CollectionState>
          )}
        </div>
      </aside>
      {draft ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveChart();
          }}
        >
          <div className='work-spreadsheet-chart-fields'>
            <div className='work-office-field'>
              <span>对象名称</span>
              <OfficeTextField
                aria-label='图表对象名称'
                value={draft.name}
                maxLength={255}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>
            <div className='work-office-field'>
              <span>图表类型</span>
              <OfficeSelect
                ariaLabel='图表类型'
                value={draft.type}
                options={[
                  { value: 'column', label: '簇状柱形图' },
                  { value: 'bar', label: '簇状条形图' },
                  { value: 'line', label: '折线图' },
                  { value: 'pie', label: '饼图' },
                  { value: 'doughnut', label: '圆环图' },
                  { value: 'area', label: '面积图' },
                  { value: 'radar', label: '雷达图' },
                  { value: 'scatter', label: '散点图' },
                  { value: 'bubble', label: '气泡图' },
                  { value: 'combination', label: '组合图' },
                ]}
                onValueChange={(nextType) => {
                  const type = nextType as WorkSpreadsheetChartType;
                  setDraft(chartDraftWithType(draft, type));
                }}
              />
            </div>
            {draft.type === 'doughnut' && (
              <div className='work-office-field'>
                <span>圆环孔径（%）</span>
                <OfficeNumberField
                  ariaLabel='圆环孔径（%）'
                  min={10}
                  max={90}
                  step={1}
                  value={draft.doughnutHoleSize ?? 50}
                  onValueChange={(doughnutHoleSize) =>
                    setDraft({ ...draft, doughnutHoleSize: Number(doughnutHoleSize) })
                  }
                />
              </div>
            )}
            {draft.type === 'radar' && (
              <div className='work-office-field'>
                <span>雷达图样式</span>
                <OfficeSelect
                  ariaLabel='雷达图样式'
                  value={normalizeWorkSpreadsheetRadarStyle(draft.radarStyle)}
                  options={[
                    { value: 'standard', label: '标准雷达图' },
                    { value: 'marker', label: '带数据标记的雷达图' },
                    { value: 'filled', label: '填充雷达图' },
                  ]}
                  onValueChange={(radarStyle) =>
                    setDraft({ ...draft, radarStyle: radarStyle as WorkSpreadsheetRadarStyle })
                  }
                />
              </div>
            )}
            {draft.type === 'scatter' && (
              <div className='work-office-field'>
                <span>散点图样式</span>
                <OfficeSelect
                  ariaLabel='散点图样式'
                  value={normalizeWorkSpreadsheetScatterStyle(draft.scatterStyle)}
                  options={[
                    { value: 'marker', label: '仅数据标记' },
                    { value: 'line', label: '直线' },
                    { value: 'lineMarker', label: '带数据标记的直线' },
                    { value: 'smooth', label: '平滑线' },
                    { value: 'smoothMarker', label: '带数据标记的平滑线' },
                  ]}
                  onValueChange={(scatterStyle) =>
                    setDraft({ ...draft, scatterStyle: scatterStyle as WorkSpreadsheetScatterStyle })
                  }
                />
              </div>
            )}
            {draft.type === 'bubble' && (
              <>
                <div className='work-office-field'>
                  <span>气泡缩放（%）</span>
                  <OfficeNumberField
                    ariaLabel='气泡缩放（%）'
                    min={0}
                    max={300}
                    step={1}
                    value={draft.bubbleScale ?? 100}
                    onValueChange={(bubbleScale) => setDraft({ ...draft, bubbleScale: Number(bubbleScale) })}
                  />
                </div>
                <div className='work-office-field'>
                  <span>气泡大小表示</span>
                  <OfficeSelect
                    ariaLabel='气泡大小表示'
                    value={normalizeWorkSpreadsheetBubbleSizeRepresents(draft.bubbleSizeRepresents)}
                    options={[
                      { value: 'area', label: '面积' },
                      { value: 'width', label: '宽度' },
                    ]}
                    onValueChange={(bubbleSizeRepresents) =>
                      setDraft({
                        ...draft,
                        bubbleSizeRepresents: bubbleSizeRepresents as WorkSpreadsheetBubbleSizeRepresents,
                      })
                    }
                  />
                </div>
                <OfficeCheckbox
                  className='check'
                  ariaLabel='显示负值气泡'
                  checked={draft.showNegativeBubbles === true}
                  onCheckedChange={(showNegativeBubbles) => setDraft({ ...draft, showNegativeBubbles })}
                >
                  显示负值气泡
                </OfficeCheckbox>
              </>
            )}
            <div className='work-office-field'>
              <span>图表标题</span>
              <OfficeTextField
                aria-label='图表标题'
                value={draft.title ?? ''}
                maxLength={255}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </div>
            <div className='work-office-field'>
              <span>标题引用（可选）</span>
              <OfficeTextField
                aria-label='图表标题引用'
                value={draft.titleReference ?? ''}
                placeholder="'报告'!$B$1"
                onChange={(event) => setDraft({ ...draft, titleReference: event.target.value })}
              />
            </div>
            {workSpreadsheetChartSupportsAxes(draft.type) && (
              <SpreadsheetChartAxisEditor
                axes={draft.axes}
                chartType={draft.type}
                showSecondaryAxes={
                  draft.type === 'combination' &&
                  draft.series.some(
                    (series) => normalizeWorkSpreadsheetChartAxisGroup(series.axisGroup) === 'secondary'
                  )
                }
                onChange={(axes) => setDraft({ ...draft, axes })}
              />
            )}
            {!workSpreadsheetChartUsesNumericXAxis(draft.type) && (
              <div className='work-office-field reference'>
                <span>分类引用</span>
                <OfficeTextField
                  aria-label='图表分类引用'
                  value={draft.categoryReference ?? ''}
                  placeholder="'报告'!$A$2:$A$8"
                  onChange={(event) => setDraft({ ...draft, categoryReference: event.target.value })}
                />
              </div>
            )}
            <div className='work-office-field alternative-text'>
              <span>替代文本</span>
              <OfficeTextField
                aria-label='图表替代文本'
                value={draft.altText ?? ''}
                maxLength={1_024}
                placeholder='说明图表表达的关键数据或趋势'
                onChange={(event) => setDraft({ ...draft, altText: event.target.value })}
              />
            </div>
            <SpreadsheetChartLayoutEditor chart={draft} onChange={(change) => setDraft({ ...draft, ...change })} />
          </div>
          <section className='work-spreadsheet-chart-series' aria-label='图表数据系列'>
            <header>
              <strong>数据系列</strong>
              <button
                type='button'
                onClick={() =>
                  setDraft({
                    ...draft,
                    series: [...draft.series, newChartSeries(draft.type, draft.series.length)],
                  })
                }
              >
                <Plus size={12} />
                添加系列
              </button>
            </header>
            {workSpreadsheetChartUsesNumericXAxis(draft.type) && (
              <p className='xy-note'>每个系列独立使用 X 与 Y；未设置 X 引用时使用当前缓存值或稳定序号。</p>
            )}
            {draft.series.map((series, index) => (
              <div
                className={`work-spreadsheet-chart-series-row${
                  workSpreadsheetChartUsesNumericXAxis(draft.type) ? ' xy' : ''
                }${draft.type === 'bubble' ? ' bubble' : ''}${draft.type === 'combination' ? ' combination' : ''}`}
                key={`${draft.id}-series-${index}`}
              >
                <div className='work-office-field series-name'>
                  <span>系列 {index + 1} 名称</span>
                  <OfficeTextField
                    aria-label={`系列 ${index + 1} 名称`}
                    value={series.name}
                    onChange={(event) =>
                      setDraft({ ...draft, series: replaceSeries(draft.series, index, { name: event.target.value }) })
                    }
                  />
                </div>
                <div className='work-office-field name-reference'>
                  <span>名称引用</span>
                  <OfficeTextField
                    aria-label={`系列 ${index + 1} 名称引用`}
                    value={series.nameReference ?? ''}
                    placeholder="'报告'!$B$1"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        series: replaceSeries(draft.series, index, { nameReference: event.target.value }),
                      })
                    }
                  />
                </div>
                {workSpreadsheetChartUsesNumericXAxis(draft.type) && (
                  <div className='work-office-field x-reference'>
                    <span>X 值引用</span>
                    <OfficeTextField
                      aria-label={`系列 ${index + 1} X 值引用`}
                      value={series.xValuesReference ?? ''}
                      placeholder="'报告'!$A$2:$A$8"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          series: replaceSeries(draft.series, index, { xValuesReference: event.target.value }),
                        })
                      }
                    />
                  </div>
                )}
                <div
                  className={`work-office-field ${
                    workSpreadsheetChartUsesNumericXAxis(draft.type) ? 'y-reference' : 'reference'
                  }`}
                >
                  <span>{workSpreadsheetChartUsesNumericXAxis(draft.type) ? 'Y 值引用' : '数值引用'}</span>
                  <OfficeTextField
                    aria-label={`系列 ${index + 1} ${
                      workSpreadsheetChartUsesNumericXAxis(draft.type) ? 'Y 值引用' : '数值引用'
                    }`}
                    value={series.valuesReference ?? ''}
                    placeholder="'报告'!$B$2:$B$8"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        series: replaceSeries(draft.series, index, { valuesReference: event.target.value }),
                      })
                    }
                  />
                </div>
                {draft.type === 'combination' && (
                  <>
                    <div className='work-office-field combination-chart-type'>
                      <span>系列图表类型</span>
                      <OfficeSelect
                        ariaLabel={`系列 ${index + 1} 图表类型`}
                        value={normalizeWorkSpreadsheetCombinationSeriesType(series.chartType)}
                        options={[
                          { value: 'column', label: '柱形图' },
                          { value: 'line', label: '折线图' },
                          { value: 'area', label: '面积图' },
                        ]}
                        onValueChange={(chartType) =>
                          setDraft({
                            ...draft,
                            series: replaceSeries(draft.series, index, {
                              chartType: chartType as WorkSpreadsheetCombinationSeriesType,
                            }),
                          })
                        }
                      />
                    </div>
                    <div className='work-office-field combination-axis-group'>
                      <span>坐标轴</span>
                      <OfficeSelect
                        ariaLabel={`系列 ${index + 1} 坐标轴`}
                        value={normalizeWorkSpreadsheetChartAxisGroup(series.axisGroup)}
                        options={[
                          { value: 'primary', label: '主坐标轴' },
                          { value: 'secondary', label: '次坐标轴' },
                        ]}
                        onValueChange={(axisGroup) =>
                          setDraft({
                            ...draft,
                            series: replaceSeries(draft.series, index, {
                              axisGroup: axisGroup as WorkSpreadsheetChartAxisGroup,
                            }),
                          })
                        }
                      />
                    </div>
                  </>
                )}
                {draft.type === 'bubble' && (
                  <div className='work-office-field bubble-reference'>
                    <span>气泡大小引用</span>
                    <OfficeTextField
                      aria-label={`系列 ${index + 1} 气泡大小引用`}
                      value={series.bubbleSizesReference ?? ''}
                      placeholder="'报告'!$C$2:$C$8"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          series: replaceSeries(draft.series, index, {
                            bubbleSizesReference: event.target.value,
                          }),
                        })
                      }
                    />
                  </div>
                )}
                <button
                  type='button'
                  className='remove-series'
                  aria-label={`删除系列 ${index + 1}`}
                  disabled={draft.series.length <= 1}
                  onClick={() =>
                    setDraft({ ...draft, series: draft.series.filter((_, candidate) => candidate !== index) })
                  }
                >
                  <Trash2 size={13} />
                </button>
                <SpreadsheetDataLabelEditor
                  chartType={draft.type}
                  seriesNumber={index + 1}
                  value={series.dataLabels}
                  onChange={(dataLabels) =>
                    setDraft({
                      ...draft,
                      series: replaceSeries(draft.series, index, { dataLabels }),
                    })
                  }
                />
                <SpreadsheetChartSeriesStyleEditor
                  seriesNumber={index + 1}
                  supportsMarkers={
                    draft.type === 'line' ||
                    draft.type === 'radar' ||
                    draft.type === 'scatter' ||
                    (draft.type === 'combination' &&
                      normalizeWorkSpreadsheetCombinationSeriesType(series.chartType) === 'line')
                  }
                  value={series.style}
                  onChange={(style) => setDraft({ ...draft, series: replaceSeries(draft.series, index, { style }) })}
                />
                {workSpreadsheetChartSupportsSeriesAnalysis(draft) &&
                  workSpreadsheetChartSupportsErrorBars(draft.type) && (
                    <SpreadsheetErrorBarEditor
                      chartType={draft.type}
                      seriesNumber={index + 1}
                      errorBars={series.errorBars ?? []}
                      onChange={(errorBars) =>
                        setDraft({
                          ...draft,
                          series: replaceSeries(draft.series, index, { errorBars }),
                        })
                      }
                    />
                  )}
                {workSpreadsheetChartSupportsSeriesAnalysis(draft) &&
                  workSpreadsheetChartSupportsTrendlines(draft.type) && (
                    <SpreadsheetTrendlineEditor
                      seriesNumber={index + 1}
                      trendlines={series.trendlines ?? []}
                      onChange={(trendlines) =>
                        setDraft({
                          ...draft,
                          series: replaceSeries(draft.series, index, { trendlines }),
                        })
                      }
                    />
                  )}
              </div>
            ))}
          </section>
          <div className='actions'>
            {error && (
              <InlineNotice className='work-office-form-error' tone='danger' role='alert'>
                {error}
              </InlineNotice>
            )}
            <Button tone='danger' onClick={deleteChart}>
              <Trash2 size={13} />
              删除图表
            </Button>
            <Button type='submit' tone='primary'>
              保存图表
            </Button>
          </div>
        </form>
      ) : (
        <StateView
          className='work-spreadsheet-chart-empty'
          size='compact'
          title='从单元格选区创建原生图表'
          description='第一行会作为系列名称，第一列会作为分类标签；创建后仍可修改引用和图表类型。'
        >
          {error && (
            <InlineNotice className='work-office-form-error' tone='danger' role='alert'>
              {error}
            </InlineNotice>
          )}
        </StateView>
      )}
    </div>
  );
}
