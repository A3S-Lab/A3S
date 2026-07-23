import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkSpreadsheetContent } from '../work-types';
import { SpreadsheetChartPanel } from './spreadsheet-chart-panel';

afterEach(cleanup);

describe('Spreadsheet chart series style editor', () => {
  it('enables and saves fill, line, dash, and marker appearance for a series', () => {
    const content = spreadsheetWithChart();
    const onChange = vi.fn();
    render(<SpreadsheetChartPanel content={content} activeSheetId='sheet-series-style' onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('系列 1 使用自定义外观'));
    chooseOfficeColor('系列 1 填充颜色', '#123456');
    fireEvent.change(screen.getByLabelText('系列 1 填充透明度'), { target: { value: '42' } });
    chooseOfficeColor('系列 1 线条颜色', '#654321');
    fireEvent.change(screen.getByLabelText('系列 1 线条宽度'), { target: { value: '4.5' } });
    chooseOfficeOption('系列 1 线条虚线', '点线');
    chooseOfficeOption('系列 1 数据标记符号', '三角形');
    fireEvent.change(screen.getByLabelText('系列 1 数据标记大小'), { target: { value: '11' } });
    chooseOfficeColor('系列 1 数据标记填充颜色', '#abcdef');
    chooseOfficeColor('系列 1 数据标记轮廓颜色', '#fedcba');
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));

    expect(onChange.mock.lastCall?.[0].sheets[0].charts[0].series[0].style).toEqual({
      fillColor: '#123456',
      fillTransparency: 42,
      lineColor: '#654321',
      lineWidth: 4.5,
      lineDash: 'dot',
      marker: {
        symbol: 'triangle',
        size: 11,
        fillColor: '#ABCDEF',
        lineColor: '#FEDCBA',
      },
    });
  }, 10_000);

  it('removes a previously customized appearance without retaining nested marker state', () => {
    const content = spreadsheetWithChart();
    content.sheets[0].charts![0].series[0].style = {
      fillColor: '#112233',
      marker: { symbol: 'diamond', size: 9 },
    };
    const onChange = vi.fn();
    render(<SpreadsheetChartPanel content={content} activeSheetId='sheet-series-style' onChange={onChange} />);

    expect(screen.getByLabelText('系列 1 使用自定义外观')).toBeChecked();
    fireEvent.click(screen.getByLabelText('系列 1 使用自定义外观'));
    expect(screen.queryByLabelText('系列 1 填充颜色')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));

    expect(onChange.mock.lastCall?.[0].sheets[0].charts[0].series[0].style).toBeUndefined();
  });
});

function chooseOfficeOption(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function chooseOfficeColor(label: string, value: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.change(screen.getByRole('textbox', { name: '自定义颜色值' }), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
}

function spreadsheetWithChart(): WorkSpreadsheetContent {
  return {
    type: 'spreadsheet',
    sheets: [
      {
        id: 'sheet-series-style',
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
            id: 'chart-series-style-editor',
            name: 'Revenue chart',
            type: 'line',
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
