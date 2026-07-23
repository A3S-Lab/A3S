import type { Cell, Selection } from '@fortune-sheet/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpreadsheetPivotFromSelection } from '../work-spreadsheet-pivots';
import { createWorkArtifact } from '../work-templates';
import type { WorkSpreadsheetContent } from '../work-types';
import { SpreadsheetPivotPanel } from './spreadsheet-pivot-panel';

afterEach(cleanup);

describe('SpreadsheetPivotPanel', () => {
  it('creates an editable pivot definition from the current selection', () => {
    const content = salesWorkbook();
    const onChange = vi.fn();
    render(
      <SpreadsheetPivotPanel
        content={content}
        activeSheetId={content.sheets[0].id!}
        selection={selection(0, 3, 0, 2)}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const changed = onChange.mock.calls[0][0] as WorkSpreadsheetContent;
    expect(changed.sheets).toHaveLength(2);
    expect(changed.sheets[1].pivotTables?.[0]).toMatchObject({
      rowFields: [0],
      columnFields: [1],
      values: [{ fieldIndex: 2, aggregation: 'sum' }],
      outputReference: expect.stringMatching(/^A1:/),
    });
    expect(screen.getByLabelText('透视表名称')).toHaveValue('PivotTable1');
    expect(screen.getByRole('combobox', { name: 'Region 字段区域' })).toHaveTextContent('行');
    expect(screen.getByRole('combobox', { name: 'Quarter 字段区域' })).toHaveTextContent('列');
    expect(screen.getByRole('combobox', { name: 'Revenue 字段区域' })).toHaveTextContent('值');
  });

  it('explains that a source selection is required', () => {
    const content = salesWorkbook();
    render(<SpreadsheetPivotPanel content={content} activeSheetId={content.sheets[0].id!} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));

    expect(screen.getByText('请先在源工作表中选择包含标题和数据的连续区域。')).toBeInTheDocument();
  });

  it('selects the first pivot when controlled content changes from empty to populated', async () => {
    const content = salesWorkbook();
    const sourceSheetId = content.sheets[0].id!;
    const view = render(<SpreadsheetPivotPanel content={content} activeSheetId={sourceSheetId} onChange={vi.fn()} />);
    const created = createSpreadsheetPivotFromSelection(content, sourceSheetId, selection(0, 3, 0, 2));

    view.rerender(<SpreadsheetPivotPanel content={created.content} activeSheetId={sourceSheetId} onChange={vi.fn()} />);

    expect(await screen.findByLabelText('透视表名称')).toHaveValue('PivotTable1');
  });

  it('assigns a field as a single-selection report filter and refreshes the report', async () => {
    const content = salesWorkbook();
    const sourceSheetId = content.sheets[0].id!;
    const onChange = vi.fn();
    const view = render(
      <SpreadsheetPivotPanel
        content={content}
        activeSheetId={sourceSheetId}
        selection={selection(0, 3, 0, 2)}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));
    const created = onChange.mock.calls[0][0] as WorkSpreadsheetContent;
    view.rerender(
      <SpreadsheetPivotPanel
        content={created}
        activeSheetId={sourceSheetId}
        selection={selection(0, 3, 0, 2)}
        onChange={onChange}
      />
    );

    await screen.findByRole('combobox', { name: 'Quarter 字段区域' });
    chooseOfficeOption('Quarter 字段区域', '筛选');
    chooseOfficeOption('Quarter 筛选值', 'Q1');
    fireEvent.click(screen.getByRole('button', { name: '保存并刷新' }));

    const saved = onChange.mock.lastCall?.[0] as WorkSpreadsheetContent;
    const pivot = saved.sheets.flatMap((sheet) => sheet.pivotTables ?? [])[0];
    expect(pivot).toMatchObject({
      columnFields: [],
      reportFilters: [{ fieldIndex: 1, selectedItem: 'Q1' }],
    });
    const report = saved.sheets.find((sheet) => sheet.pivotTables?.length);
    expect(report?.data?.[0]?.[0]?.v).toBe('Quarter');
    expect(report?.data?.[0]?.[1]?.v).toBe('Q1');
  });
});

function chooseOfficeOption(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function salesWorkbook(): WorkSpreadsheetContent {
  const artifact = createWorkArtifact('blank-spreadsheet');
  if (artifact.content.type !== 'spreadsheet') throw new Error('Expected spreadsheet fixture');
  artifact.content.sheets[0].name = 'Sales';
  artifact.content.sheets[0].data = [
    cells('Region', 'Quarter', 'Revenue'),
    cells('East', 'Q1', 10),
    cells('East', 'Q2', 20),
    cells('West', 'Q1', 30),
  ];
  return artifact.content;
}

function cells(...items: Array<string | number>): Cell[] {
  return items.map((value) => ({ v: value, m: String(value) }));
}

function selection(rowStart: number, rowEnd: number, columnStart: number, columnEnd: number): Selection {
  return { row: [rowStart, rowEnd], column: [columnStart, columnEnd] };
}
