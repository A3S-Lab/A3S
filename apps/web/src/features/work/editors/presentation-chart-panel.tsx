import { Plus, Trash2, X } from 'lucide-react';
import { Button, IconButton } from '../../../design-system/primitives';
import {
  createPresentationChartSeries,
  normalizeDoughnutHoleSize,
  normalizePresentationBubbleScale,
  normalizePresentationBubbleSizeRepresents,
  normalizePresentationScatterStyle,
  parsePresentationChartCategories,
  parsePresentationChartValues,
  parsePresentationChartXValues,
  presentationChartSupportsAxisTitles,
  presentationChartSupportsSeriesMarkers,
  presentationChartTypeLabel,
  presentationChartUsesNumericXAxis,
  withPresentationChartDataLabels,
  withPresentationChartSeriesStyle,
  withPresentationChartType,
} from '../work-presentation-charts';
import type {
  WorkSlideBubbleSizeRepresents,
  WorkSlideChart,
  WorkSlideChartType,
  WorkSlideRadarStyle,
  WorkSlideScatterStyle,
} from '../work-types';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect, OfficeTextArea, OfficeTextField } from './office-controls';
import { PresentationChartAxisEditor } from './presentation-chart-axis-editor';
import { PresentationChartDataLabelEditor } from './presentation-chart-data-label-editor';
import { PresentationChartLayoutEditor } from './presentation-chart-layout-editor';
import { PresentationChartSeriesAnalysisEditor } from './presentation-chart-series-analysis-editor';
import { SpreadsheetChartSeriesStyleEditor } from './spreadsheet-chart-series-style-editor';

const CHART_TYPES: WorkSlideChartType[] = [
  'column',
  'bar',
  'line',
  'area',
  'pie',
  'doughnut',
  'radar',
  'scatter',
  'bubble',
];

export function PresentationChartPanel({
  chart,
  onChange,
  onDelete,
  onClose,
}: {
  chart: WorkSlideChart;
  onChange: (chart: WorkSlideChart) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const numericXAxis = presentationChartUsesNumericXAxis(chart.type);
  const updateSeries = (index: number, patch: Partial<WorkSlideChart['series'][number]>) => {
    onChange({
      ...chart,
      series: chart.series.map((series, current) => (current === index ? { ...series, ...patch } : series)),
    });
  };
  return (
    <section className='work-presentation-chart-panel' aria-label='演示图表数据'>
      <header>
        <div>
          <strong>图表数据</strong>
          <span>编辑后的数据会同步到预览和原生 PPTX。</span>
        </div>
        <div>
          <Button tone='danger' aria-label='删除演示图表' onClick={onDelete}>
            <Trash2 size={13} />
            删除图表
          </Button>
          <IconButton className='close' label='关闭演示图表数据' onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
      </header>
      <div className='work-presentation-chart-controls'>
        <div className='work-office-field'>
          <span>类型</span>
          <OfficeSelect
            ariaLabel='演示图表类型'
            value={chart.type}
            options={CHART_TYPES.map((type) => ({ value: type, label: presentationChartTypeLabel(type) }))}
            onValueChange={(type) => onChange(withPresentationChartType(chart, type as WorkSlideChartType))}
          />
        </div>
        <div className='work-office-field'>
          <span>标题</span>
          <OfficeTextField
            aria-label='演示图表标题'
            value={chart.title ?? ''}
            onChange={(event) => onChange({ ...chart, title: event.target.value || undefined })}
          />
        </div>
        <PresentationChartLayoutEditor chart={chart} onChange={onChange} />
        {presentationChartSupportsAxisTitles(chart) && (
          <PresentationChartAxisEditor chart={chart} onChange={onChange} />
        )}
        <PresentationChartDataLabelEditor
          chartType={chart.type}
          value={chart.dataLabels}
          onChange={(dataLabels) => onChange(withPresentationChartDataLabels(chart, dataLabels))}
        />
        {chart.type === 'doughnut' && (
          <div className='work-office-field'>
            <span>孔径</span>
            <OfficeNumberField
              ariaLabel='圆环孔径'
              min={10}
              max={90}
              value={normalizeDoughnutHoleSize(chart.doughnutHoleSize)}
              onValueChange={(value) =>
                onChange({ ...chart, doughnutHoleSize: normalizeDoughnutHoleSize(Number(value)) })
              }
            />
          </div>
        )}
        {chart.type === 'radar' && (
          <div className='work-office-field'>
            <span>样式</span>
            <OfficeSelect
              ariaLabel='雷达图样式'
              value={chart.radarStyle ?? 'standard'}
              options={[
                { value: 'standard', label: '标准' },
                { value: 'marker', label: '带数据标记' },
                { value: 'filled', label: '填充' },
              ]}
              onValueChange={(radarStyle) => onChange({ ...chart, radarStyle: radarStyle as WorkSlideRadarStyle })}
            />
          </div>
        )}
        {chart.type === 'scatter' && (
          <div className='work-office-field'>
            <span>散点样式</span>
            <OfficeSelect
              ariaLabel='演示散点图样式'
              value={normalizePresentationScatterStyle(chart.scatterStyle)}
              options={[
                { value: 'marker', label: '仅数据标记' },
                { value: 'line', label: '直线' },
                { value: 'lineMarker', label: '直线和数据标记' },
                { value: 'smooth', label: '平滑线' },
                { value: 'smoothMarker', label: '平滑线和数据标记' },
              ]}
              onValueChange={(scatterStyle) =>
                onChange({ ...chart, scatterStyle: scatterStyle as WorkSlideScatterStyle })
              }
            />
          </div>
        )}
        {chart.type === 'bubble' && (
          <>
            <div className='work-office-field'>
              <span>气泡缩放</span>
              <OfficeNumberField
                ariaLabel='演示气泡图缩放'
                min={5}
                max={300}
                value={normalizePresentationBubbleScale(chart.bubbleScale)}
                onValueChange={(value) => onChange({ ...chart, bubbleScale: normalizePresentationBubbleScale(value) })}
              />
            </div>
            <div className='work-office-field'>
              <span>大小表示</span>
              <OfficeSelect
                ariaLabel='演示气泡大小表示'
                value={normalizePresentationBubbleSizeRepresents(chart.bubbleSizeRepresents)}
                options={[
                  { value: 'area', label: '面积' },
                  { value: 'width', label: '宽度' },
                ]}
                onValueChange={(bubbleSizeRepresents) =>
                  onChange({ ...chart, bubbleSizeRepresents: bubbleSizeRepresents as WorkSlideBubbleSizeRepresents })
                }
              />
            </div>
            <div className='check'>
              <span>负气泡</span>
              <OfficeCheckbox
                className='work-presentation-chart-check-control'
                ariaLabel='显示负气泡'
                checked={chart.showNegativeBubbles === true}
                onCheckedChange={(showNegativeBubbles) => onChange({ ...chart, showNegativeBubbles })}
              >
                显示
              </OfficeCheckbox>
            </div>
          </>
        )}
        <div className='work-office-field categories'>
          <span>{numericXAxis ? 'X 值' : '分类'}（每行一项）</span>
          <OfficeTextArea
            aria-label={numericXAxis ? '演示图表 X 值' : '演示图表分类'}
            value={chart.categories.join('\n')}
            onChange={(event) =>
              onChange({
                ...chart,
                categories: numericXAxis
                  ? parsePresentationChartXValues(event.target.value)
                  : parsePresentationChartCategories(event.target.value),
              })
            }
          />
        </div>
        <div className='work-presentation-chart-series-list'>
          {chart.series.map((series, index) => (
            <div className='work-presentation-chart-series-card' key={index}>
              <fieldset>
                <legend>系列 {index + 1}</legend>
                <OfficeTextField
                  aria-label={`演示图表系列 ${index + 1} 名称`}
                  value={series.name}
                  onChange={(event) => updateSeries(index, { name: event.target.value.slice(0, 255) })}
                />
                <OfficeTextArea
                  aria-label={`演示图表系列 ${index + 1} ${numericXAxis ? 'Y 值' : '数据'}`}
                  value={series.values.join(', ')}
                  onChange={(event) =>
                    updateSeries(index, { values: parsePresentationChartValues(event.target.value) })
                  }
                />
                {chart.type === 'bubble' && (
                  <OfficeTextArea
                    aria-label={`演示气泡图系列 ${index + 1} 大小`}
                    value={series.bubbleSizes?.join(', ') ?? ''}
                    onChange={(event) =>
                      updateSeries(index, { bubbleSizes: parsePresentationChartValues(event.target.value) })
                    }
                  />
                )}
                <IconButton
                  label={`删除演示图表系列 ${index + 1}`}
                  disabled={chart.series.length === 1}
                  onClick={() => onChange({ ...chart, series: chart.series.filter((_, current) => current !== index) })}
                >
                  <Trash2 size={12} />
                </IconButton>
              </fieldset>
              <SpreadsheetChartSeriesStyleEditor
                seriesNumber={index + 1}
                supportsMarkers={presentationChartSupportsSeriesMarkers(chart.type)}
                value={series.style}
                onChange={(style) => onChange(withPresentationChartSeriesStyle(chart, index, style))}
              />
              <PresentationChartSeriesAnalysisEditor chart={chart} seriesIndex={index} onChange={onChange} />
            </div>
          ))}
          <Button
            tone='secondary'
            className='add-series'
            aria-label='添加图表系列'
            onClick={() => onChange({ ...chart, series: [...chart.series, createPresentationChartSeries(chart)] })}
          >
            <Plus size={13} />
            添加系列
          </Button>
        </div>
      </div>
    </section>
  );
}
