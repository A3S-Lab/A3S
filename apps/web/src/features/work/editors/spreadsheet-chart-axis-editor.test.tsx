import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkSpreadsheetContent } from '../work-types';
import { SpreadsheetChartPanel } from './spreadsheet-chart-panel';

afterEach(cleanup);

describe('Spreadsheet chart axis display editor', () => {
  it('saves reverse order, label placement, major ticks, and category-label interval', () => {
    const content = spreadsheetWithChart();
    const onChange = vi.fn();
    render(<SpreadsheetChartPanel content={content} activeSheetId='sheet-axis' onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('横坐标轴逆序显示'));
    chooseOfficeOption('横坐标轴标签位置', '高位');
    chooseOfficeOption('横坐标轴主要刻度线', '向外');
    fireEvent.change(screen.getByLabelText('横坐标轴标签间隔'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('纵坐标轴逆序显示'));
    chooseOfficeOption('纵坐标轴标签位置', '不显示');
    chooseOfficeOption('纵坐标轴主要刻度线', '交叉');
    expect(screen.queryByLabelText('纵坐标轴标签间隔')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));

    expect(onChange.mock.lastCall?.[0].sheets[0].charts[0]).toMatchObject({
      axes: {
        bottom: {
          reverseOrder: true,
          labelPosition: 'high',
          majorTickMark: 'outside',
          labelInterval: 3,
        },
        left: {
          reverseOrder: true,
          labelPosition: 'none',
          majorTickMark: 'cross',
        },
      },
    });
  });
});

function chooseOfficeOption(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function spreadsheetWithChart(): WorkSpreadsheetContent {
  return {
    type: 'spreadsheet',
    sheets: [
      {
        id: 'sheet-axis',
        name: 'Report',
        order: 0,
        status: 1,
        row: 4,
        column: 2,
        data: [
          [{ v: 'Quarter' }, { v: 'Revenue' }],
          [{ v: 'Q1' }, { v: 40 }],
          [{ v: 'Q2' }, { v: 55 }],
          [{ v: 'Q3' }, { v: 60 }],
        ],
        charts: [
          {
            id: 'chart-axis-editor',
            name: 'Revenue chart',
            type: 'column',
            categories: ['Q1', 'Q2', 'Q3'],
            categoryReference: 'Report!$A$2:$A$4',
            series: [{ name: 'Revenue', values: [40, 55, 60], valuesReference: 'Report!$B$2:$B$4' }],
            showLegend: false,
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
