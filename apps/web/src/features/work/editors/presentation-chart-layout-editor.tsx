import {
  normalizePresentationChartLegendPosition,
  presentationChartShowsLegend,
  withPresentationChartLayout,
} from '../work-presentation-charts';
import {
  normalizeWorkSpreadsheetChartGapWidth,
  normalizeWorkSpreadsheetChartGrouping,
  normalizeWorkSpreadsheetChartLegendOverlay,
  normalizeWorkSpreadsheetChartOverlap,
  normalizeWorkSpreadsheetChartSmoothLines,
  type WorkSpreadsheetChartGrouping,
  workSpreadsheetChartGroupingIsStacked,
  workSpreadsheetChartSupportsBarSpacing,
  workSpreadsheetChartSupportsGrouping,
  workSpreadsheetChartSupportsSmoothLines,
} from '../work-spreadsheet-chart-layout';
import type { WorkSlideChart, WorkSlideChartLegendPosition } from '../work-types';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect } from './office-controls';

export function PresentationChartLayoutEditor({
  chart,
  onChange,
}: {
  chart: WorkSlideChart;
  onChange: (chart: WorkSlideChart) => void;
}) {
  const showLegend = presentationChartShowsLegend(chart);
  const grouping = normalizeWorkSpreadsheetChartGrouping(chart.grouping, chart.type);
  const change = (patch: Parameters<typeof withPresentationChartLayout>[1]) =>
    onChange(withPresentationChartLayout(chart, patch));
  return (
    <section className='work-presentation-chart-layout' aria-label='演示图表图例与绘图区设置'>
      <header>
        <strong>图例与绘图区</strong>
        <span>位置、堆积、间距与线条布局</span>
      </header>
      <div>
        <div className='check'>
          <span>图例</span>
          <OfficeCheckbox
            className='work-presentation-chart-check-control'
            ariaLabel='显示演示图表图例'
            checked={showLegend}
            onCheckedChange={(showLegend) => change({ showLegend })}
          >
            显示
          </OfficeCheckbox>
        </div>
        {showLegend && (
          <>
            <div className='work-office-field'>
              <span>图例位置</span>
              <OfficeSelect
                ariaLabel='演示图表图例位置'
                value={normalizePresentationChartLegendPosition(chart.legendPosition)}
                options={[
                  { value: 'right', label: '右侧' },
                  { value: 'left', label: '左侧' },
                  { value: 'top', label: '顶部' },
                  { value: 'bottom', label: '底部' },
                  { value: 'topRight', label: '右上角' },
                ]}
                onValueChange={(legendPosition) =>
                  change({ legendPosition: legendPosition as WorkSlideChartLegendPosition })
                }
              />
            </div>
            <div className='check'>
              <span>图例布局</span>
              <OfficeCheckbox
                className='work-presentation-chart-check-control'
                ariaLabel='演示图表图例叠加在绘图区'
                checked={normalizeWorkSpreadsheetChartLegendOverlay(chart.legendOverlay)}
                onCheckedChange={(legendOverlay) => change({ legendOverlay })}
              >
                叠加绘图区
              </OfficeCheckbox>
            </div>
          </>
        )}
        {workSpreadsheetChartSupportsGrouping(chart.type) && (
          <div className='work-office-field'>
            <span>分组方式</span>
            <OfficeSelect
              ariaLabel='演示图表分组方式'
              value={grouping}
              options={[
                ...(workSpreadsheetChartSupportsBarSpacing(chart.type)
                  ? [{ value: 'clustered', label: '簇状' } as const]
                  : []),
                { value: 'standard', label: '标准' },
                { value: 'stacked', label: '堆积' },
                { value: 'percentStacked', label: '百分比堆积' },
              ]}
              onValueChange={(value) => {
                const nextGrouping = value as WorkSpreadsheetChartGrouping;
                if (!workSpreadsheetChartSupportsBarSpacing(chart.type)) {
                  change({ grouping: nextGrouping });
                  return;
                }
                const currentDefault = workSpreadsheetChartGroupingIsStacked(grouping) ? 100 : 0;
                const nextDefault = workSpreadsheetChartGroupingIsStacked(nextGrouping) ? 100 : 0;
                const currentOverlap = normalizeWorkSpreadsheetChartOverlap(chart.overlap, grouping);
                change({
                  grouping: nextGrouping,
                  overlap: currentOverlap === currentDefault ? nextDefault : currentOverlap,
                });
              }}
            />
          </div>
        )}
        {workSpreadsheetChartSupportsBarSpacing(chart.type) && (
          <>
            <div className='work-office-field'>
              <span>分类间距（%）</span>
              <OfficeNumberField
                ariaLabel='演示图表分类间距（%）'
                min={0}
                max={500}
                step={1}
                value={normalizeWorkSpreadsheetChartGapWidth(chart.gapWidth)}
                onValueChange={(value) => change({ gapWidth: Number(value) })}
              />
            </div>
            <div className='work-office-field'>
              <span>系列重叠（%）</span>
              <OfficeNumberField
                ariaLabel='演示图表系列重叠（%）'
                min={-100}
                max={100}
                step={1}
                value={normalizeWorkSpreadsheetChartOverlap(chart.overlap, grouping)}
                onValueChange={(value) => change({ overlap: Number(value) })}
              />
            </div>
          </>
        )}
        {workSpreadsheetChartSupportsSmoothLines(chart.type) && (
          <div className='check'>
            <span>折线</span>
            <OfficeCheckbox
              className='work-presentation-chart-check-control'
              ariaLabel='演示图表使用平滑线'
              checked={normalizeWorkSpreadsheetChartSmoothLines(chart.smoothLines)}
              onCheckedChange={(smoothLines) => change({ smoothLines })}
            >
              使用平滑线
            </OfficeCheckbox>
          </div>
        )}
      </div>
      {workSpreadsheetChartGroupingIsStacked(grouping) && (
        <p>正值与负值会分别累计；切换到堆积布局时会移除不适用的趋势线和误差线。</p>
      )}
    </section>
  );
}
