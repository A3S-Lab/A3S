import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkSpreadsheetContent } from '../work-types';
import { SpreadsheetChartPanel } from './spreadsheet-chart-panel';

afterEach(cleanup);

describe('Spreadsheet chart legend and plot layout editor', () => {
  it('saves legend position, overlay, stacking, gap width, and overlap', () => {
    const content = spreadsheetWithChart('column');
    const onChange = vi.fn();
    render(<SpreadsheetChartPanel content={content} activeSheetId='sheet-layout' onChange={onChange} />);

    chooseOfficeOption('图例位置', '底部');
    fireEvent.click(screen.getByLabelText('图例叠加在绘图区'));
    chooseOfficeOption('图表分组方式', '百分比堆积');
    fireEvent.change(screen.getByLabelText('分类间距（%）'), { target: { value: '240' } });
    fireEvent.change(screen.getByLabelText('系列重叠（%）'), { target: { value: '85' } });
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));

    expect(onChange.mock.lastCall?.[0].sheets[0].charts[0]).toMatchObject({
      legendPosition: 'bottom',
      legendOverlay: true,
      grouping: 'percentStacked',
      gapWidth: 240,
      overlap: 85,
    });
  });

  it('saves smooth standard lines and omits bar-only spacing controls', () => {
    const content = spreadsheetWithChart('line');
    const onChange = vi.fn();
    render(<SpreadsheetChartPanel content={content} activeSheetId='sheet-layout' onChange={onChange} />);

    expect(screen.queryByLabelText('分类间距（%）')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('系列重叠（%）')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('使用平滑线'));
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));

    expect(onChange.mock.lastCall?.[0].sheets[0].charts[0]).toMatchObject({
      type: 'line',
      grouping: 'standard',
      smoothLines: true,
    });
  });
});

function chooseOfficeOption(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function spreadsheetWithChart(type: 'column' | 'line'): WorkSpreadsheetContent {
  return {
    type: 'spreadsheet',
    sheets: [
      {
        id: 'sheet-layout',
        name: 'Report',
        order: 0,
        status: 1,
        row: 3,
        column: 3,
        data: [
          [{ v: 'Quarter' }, { v: 'Actual' }, { v: 'Forecast' }],
          [{ v: 'Q1' }, { v: 40 }, { v: 48 }],
          [{ v: 'Q2' }, { v: 55 }, { v: 60 }],
        ],
        charts: [
          {
            id: 'chart-layout-editor',
            name: 'Revenue chart',
            type,
            title: 'Revenue',
            categories: ['Q1', 'Q2'],
            categoryReference: 'Report!$A$2:$A$3',
            series: [
              { name: 'Actual', values: [40, 55], valuesReference: 'Report!$B$2:$B$3' },
              { name: 'Forecast', values: [48, 60], valuesReference: 'Report!$C$2:$C$3' },
            ],
            showLegend: true,
            left: 0,
            top: 0,
            width: 480,
            height: 288,
          },
        ],
      },
    ],
  };
}
