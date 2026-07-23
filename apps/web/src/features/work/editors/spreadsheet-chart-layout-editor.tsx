import {
  normalizeWorkSpreadsheetChartGapWidth,
  normalizeWorkSpreadsheetChartGrouping,
  normalizeWorkSpreadsheetChartLegendOverlay,
  normalizeWorkSpreadsheetChartLegendPosition,
  normalizeWorkSpreadsheetChartOverlap,
  normalizeWorkSpreadsheetChartSmoothLines,
  type WorkSpreadsheetChartGrouping,
  type WorkSpreadsheetChartLayout,
  type WorkSpreadsheetChartLegendPosition,
  workSpreadsheetChartGroupingIsStacked,
  workSpreadsheetChartSupportsBarSpacing,
  workSpreadsheetChartSupportsGrouping,
  workSpreadsheetChartSupportsSmoothLines,
} from '../work-spreadsheet-chart-layout';
import type { WorkSpreadsheetChartType } from '../work-types';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect } from './office-controls';

interface SpreadsheetChartLayoutEditorProps {
  chart: WorkSpreadsheetChartLayout & { type: WorkSpreadsheetChartType; showLegend: boolean };
  onChange: (change: Partial<WorkSpreadsheetChartLayout & { showLegend: boolean }>) => void;
}

export function SpreadsheetChartLayoutEditor({ chart, onChange }: SpreadsheetChartLayoutEditorProps) {
  const grouping = normalizeWorkSpreadsheetChartGrouping(chart.grouping, chart.type);
  return (
    <section className='work-spreadsheet-chart-layout' aria-label='图表图例与绘图区设置'>
      <header>
        <strong>图例与绘图区</strong>
        <span>位置、堆积与系列间距</span>
      </header>
      <div>
        <OfficeCheckbox
          className='check'
          ariaLabel='显示图表图例'
          checked={chart.showLegend}
          onCheckedChange={(showLegend) => onChange({ showLegend })}
        >
          显示图例
        </OfficeCheckbox>
        {chart.showLegend && (
          <>
            <div className='work-office-field'>
              <span>图例位置</span>
              <OfficeSelect
                ariaLabel='图例位置'
                value={normalizeWorkSpreadsheetChartLegendPosition(chart.legendPosition)}
                options={[
                  { value: 'right', label: '右侧' },
                  { value: 'left', label: '左侧' },
                  { value: 'top', label: '顶部' },
                  { value: 'bottom', label: '底部' },
                  { value: 'topRight', label: '右上角' },
                ]}
                onValueChange={(legendPosition) =>
                  onChange({ legendPosition: legendPosition as WorkSpreadsheetChartLegendPosition })
                }
              />
            </div>
            <OfficeCheckbox
              className='check'
              ariaLabel='图例叠加在绘图区'
              checked={normalizeWorkSpreadsheetChartLegendOverlay(chart.legendOverlay)}
              onCheckedChange={(legendOverlay) => onChange({ legendOverlay })}
            >
              叠加在绘图区
            </OfficeCheckbox>
          </>
        )}
        {workSpreadsheetChartSupportsGrouping(chart.type) && (
          <div className='work-office-field'>
            <span>分组方式</span>
            <OfficeSelect
              ariaLabel='图表分组方式'
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
                  onChange({ grouping: nextGrouping });
                  return;
                }
                const currentDefault = workSpreadsheetChartGroupingIsStacked(grouping) ? 100 : 0;
                const nextDefault = workSpreadsheetChartGroupingIsStacked(nextGrouping) ? 100 : 0;
                const currentOverlap = normalizeWorkSpreadsheetChartOverlap(chart.overlap, grouping);
                onChange({
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
                ariaLabel='分类间距（%）'
                min={0}
                max={500}
                step={1}
                value={normalizeWorkSpreadsheetChartGapWidth(chart.gapWidth)}
                onValueChange={(gapWidth) => onChange({ gapWidth: Number(gapWidth) })}
              />
            </div>
            <div className='work-office-field'>
              <span>系列重叠（%）</span>
              <OfficeNumberField
                ariaLabel='系列重叠（%）'
                min={-100}
                max={100}
                step={1}
                value={normalizeWorkSpreadsheetChartOverlap(chart.overlap, grouping)}
                onValueChange={(overlap) => onChange({ overlap: Number(overlap) })}
              />
            </div>
          </>
        )}
        {workSpreadsheetChartSupportsSmoothLines(chart.type) && (
          <OfficeCheckbox
            className='check'
            ariaLabel='使用平滑线'
            checked={normalizeWorkSpreadsheetChartSmoothLines(chart.smoothLines)}
            onCheckedChange={(smoothLines) => onChange({ smoothLines })}
          >
            使用平滑线
          </OfficeCheckbox>
        )}
      </div>
      {workSpreadsheetChartGroupingIsStacked(grouping) && (
        <p>堆积布局按正值和负值分别累计；保存时会移除不适用于堆积语义的趋势线与误差线。</p>
      )}
    </section>
  );
}
