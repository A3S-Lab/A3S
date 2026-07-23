import type { Hooks } from '@fortune-sheet/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpreadsheetPivotFromSelection } from '../work-spreadsheet-pivots';
import { createWorkArtifact } from '../work-templates';
import type { WorkSpreadsheetContent } from '../work-types';
import { SpreadsheetEditor } from './spreadsheet-editor';

const workbookMocks = vi.hoisted(() => ({
  calculateFormula: vi.fn(),
  cancelMerge: vi.fn(),
  handleRedo: vi.fn(),
  handleUndo: vi.fn(),
  mergeCells: vi.fn(),
  setCellFormatByRange: vi.fn(),
  hooks: undefined as Hooks | undefined,
  onChange: undefined as ((sheets: WorkSpreadsheetContent['sheets']) => void) | undefined,
  sheets: undefined as WorkSpreadsheetContent['sheets'] | undefined,
  showToolbar: undefined as boolean | undefined,
  mountCount: 0,
  unmountCount: 0,
}));

vi.mock('@fortune-sheet/react', async () => {
  const React = await import('react');
  return {
    Workbook: React.forwardRef(
      (
        {
          data,
          hooks,
          onChange,
          showToolbar,
        }: {
          data: WorkSpreadsheetContent['sheets'];
          hooks?: Hooks;
          onChange?: (sheets: WorkSpreadsheetContent['sheets']) => void;
          showToolbar?: boolean;
        },
        ref: React.ForwardedRef<{
          calculateFormula: typeof workbookMocks.calculateFormula;
          cancelMerge: typeof workbookMocks.cancelMerge;
          getSelection: () => { row: number[]; column: number[] }[];
          handleRedo: typeof workbookMocks.handleRedo;
          handleUndo: typeof workbookMocks.handleUndo;
          mergeCells: typeof workbookMocks.mergeCells;
          setCellFormatByRange: typeof workbookMocks.setCellFormatByRange;
        }>
      ) => {
        React.useEffect(() => {
          workbookMocks.mountCount += 1;
          return () => {
            workbookMocks.unmountCount += 1;
          };
        }, []);
        React.useImperativeHandle(ref, () => ({
          calculateFormula: workbookMocks.calculateFormula,
          cancelMerge: workbookMocks.cancelMerge,
          getSelection: () => [{ row: [0, 1], column: [0, 1] }],
          handleRedo: workbookMocks.handleRedo,
          handleUndo: workbookMocks.handleUndo,
          mergeCells: workbookMocks.mergeCells,
          setCellFormatByRange: workbookMocks.setCellFormatByRange,
        }));
        workbookMocks.hooks = hooks;
        workbookMocks.onChange = onChange;
        workbookMocks.sheets = data;
        workbookMocks.showToolbar = showToolbar;
        return (
          <button
            type='button'
            data-testid='fortune-sheet'
            onMouseDown={() => hooks?.afterSelectionChange?.(data[0].id!, { row: [0, 1], column: [0, 1] })}
          >
            {data.map((sheet) => sheet.name).join(',')}
          </button>
        );
      }
    ),
  };
});

describe('Work spreadsheet editor advanced workflows', () => {
  afterEach(() => {
    cleanup();
    workbookMocks.calculateFormula.mockReset();
    workbookMocks.cancelMerge.mockReset();
    workbookMocks.handleRedo.mockReset();
    workbookMocks.handleUndo.mockReset();
    workbookMocks.mergeCells.mockReset();
    workbookMocks.setCellFormatByRange.mockReset();
    workbookMocks.hooks = undefined;
    workbookMocks.onChange = undefined;
    workbookMocks.sheets = undefined;
    workbookMocks.showToolbar = undefined;
    workbookMocks.mountCount = 0;
    workbookMocks.unmountCount = 0;
  });

  it('adds and edits polynomial trendline forecasts and labels on a chart series', async () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByTestId('fortune-sheet'));
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: /^插入图表/ }));
    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].sheets[0].charts).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: '添加系列 1 趋势线' }));
    chooseOfficeOption('系列 1 趋势线 1 类型', '多项式');
    fireEvent.change(screen.getByLabelText('系列 1 趋势线 1 名称'), { target: { value: '收入趋势' } });
    fireEvent.change(screen.getByLabelText('系列 1 趋势线 1 阶数'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('系列 1 趋势线 1 前推'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('系列 1 趋势线 1 后推'), { target: { value: '1' } });
    fireEvent.click(screen.getByLabelText('系列 1 趋势线 1 固定截距'));
    fireEvent.change(screen.getByLabelText('系列 1 趋势线 1 截距'), { target: { value: '0' } });
    fireEvent.click(screen.getByLabelText('系列 1 趋势线 1 显示公式'));
    fireEvent.click(screen.getByLabelText('系列 1 趋势线 1 显示 R 方'));
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));

    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0].series[0].trendlines).toEqual([
        {
          type: 'polynomial',
          name: '收入趋势',
          order: 4,
          forward: 2,
          backward: 1,
          intercept: 0,
          displayEquation: true,
          displayRSquared: true,
        },
      ]);
    });
  });

  it('edits data-label content, separator, and position on a chart series', async () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByTestId('fortune-sheet'));
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: /^插入图表/ }));
    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].sheets[0].charts).toHaveLength(1));

    fireEvent.click(screen.getByLabelText('系列 1 显示数据标签'));
    fireEvent.click(screen.getByLabelText('系列 1 数据标签显示分类名称'));
    fireEvent.click(screen.getByLabelText('系列 1 数据标签显示系列名称'));
    chooseOfficeOption('系列 1 数据标签位置', '外侧末端');
    fireEvent.change(screen.getByLabelText('系列 1 数据标签分隔符'), { target: { value: ' / ' } });
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));

    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0].series[0].dataLabels).toEqual({
        showValue: true,
        showCategoryName: true,
        showSeriesName: true,
        separator: ' / ',
        position: 'outsideEnd',
      });
    });
  });

  it('adds and edits a percentage error bar on a chart series', async () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByTestId('fortune-sheet'));
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: /^插入图表/ }));
    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].sheets[0].charts).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: '添加系列 1 Y 误差线' }));
    chooseOfficeOption('系列 1 误差线 1 误差类型', '正向');
    chooseOfficeOption('系列 1 误差线 1 计算方式', '百分比');
    fireEvent.change(screen.getByLabelText('系列 1 误差线 1 数值'), { target: { value: '12' } });
    fireEvent.click(screen.getByLabelText('系列 1 误差线 1 显示端帽'));
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));

    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0].series[0].errorBars).toEqual([
        {
          direction: 'y',
          barType: 'plus',
          valueType: 'percentage',
          value: 12,
          showEndCaps: false,
        },
      ]);
    });
  });

  it('edits calculation settings and recalculates the selected range or workbook', async () => {
    const content = spreadsheetContent();
    const sheetId = content.sheets[0].id!;
    content.sheets[0].data = [
      [
        { v: 1, m: '1' },
        { f: '=A1*2', v: 2, m: '2' },
      ],
      [
        { v: 2, m: '2' },
        { f: '=A2*2', v: 4, m: '4' },
      ],
    ];
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByTestId('fortune-sheet'));
    fireEvent.click(screen.getByRole('tab', { name: '公式' }));
    fireEvent.click(screen.getByRole('button', { name: /^公式与计算/ }));
    expect(screen.getByRole('region', { name: '公式兼容性诊断' })).toBeInTheDocument();
    chooseOfficeOption('计算模式', '手动');
    fireEvent.click(screen.getByLabelText('打开工作簿时完整重算'));
    fireEvent.click(screen.getByLabelText('强制完整计算'));
    fireEvent.click(screen.getByLabelText('使用迭代计算'));
    fireEvent.change(screen.getByLabelText('最大迭代次数'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('最大更改值'), { target: { value: '0.00001' } });
    fireEvent.click(screen.getByLabelText('使用完整精度'));
    fireEvent.click(screen.getByRole('button', { name: '保存计算设置' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          calculation: {
            mode: 'manual',
            fullCalculationOnLoad: true,
            forceFullCalculation: true,
            iterativeCalculation: true,
            maximumIterations: 250,
            maximumChange: 0.00001,
            fullPrecision: false,
          },
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '重新计算当前选区' }));
    expect(workbookMocks.calculateFormula).toHaveBeenLastCalledWith(sheetId, {
      row: [0, 1],
      column: [0, 1],
    });
    fireEvent.click(screen.getByRole('button', { name: '重新计算工作簿' }));
    expect(workbookMocks.calculateFormula).toHaveBeenLastCalledWith();
  });

  it('protects pivot output cells and preserves pivot metadata after FortuneSheet changes', () => {
    const content = spreadsheetContent();
    content.sheets[0].name = 'Sales';
    content.sheets[0].data = [
      [{ v: 'Region' }, { v: 'Revenue' }],
      [{ v: 'East' }, { v: 10 }],
      [{ v: 'West' }, { v: 20 }],
    ];
    const sourceSheetId = content.sheets[0].id!;
    const created = createSpreadsheetPivotFromSelection(content, sourceSheetId, {
      row: [0, 2],
      column: [0, 1],
    });
    const report = created.content.sheets.find((sheet) => sheet.id === created.ownerSheetId)!;
    created.content.sheets[0].status = 0;
    report.status = 1;
    const onChange = vi.fn();

    render(<SpreadsheetEditor content={created.content} preview={false} onChange={onChange} />);

    expect(workbookMocks.hooks?.beforeUpdateCell?.(0, 0, { v: 'blocked' })).toBe(false);
    expect(workbookMocks.hooks?.beforeUpdateCell?.(10, 10, { v: 'allowed' })).toBe(true);
    expect(workbookMocks.hooks?.beforePaste?.([{ row: [0, 1], column: [0, 1] }], 'blocked')).toBe(false);
    expect(workbookMocks.hooks?.beforePaste?.([{ row: [10, 11], column: [10, 11] }], 'allowed')).toBe(true);

    const changedSheets = workbookMocks.sheets!.map((sheet) => ({
      ...sheet,
      pivotTables: undefined,
    }));
    workbookMocks.onChange?.(changedSheets);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sheets: expect.arrayContaining([
          expect.objectContaining({
            id: report.id,
            pivotTables: expect.arrayContaining([expect.objectContaining({ id: created.pivotId })]),
          }),
        ]),
      })
    );
  });

  it('keeps workbook metadata controls out of read-only preview', () => {
    render(<SpreadsheetEditor content={spreadsheetContent()} preview={true} onChange={vi.fn()} />);
    expect(screen.queryByRole('toolbar', { name: '工作簿工具' })).not.toBeInTheDocument();
    expect(screen.getByText(/只读预览/)).toBeInTheDocument();
  });

  it('prepares a Copilot draft from the selected cell range', () => {
    const content = spreadsheetContent();
    content.sheets[0].name = '预算';
    content.sheets[0].data = [
      [{ v: '项目' }, { v: '金额' }],
      [{ v: '云服务' }, { v: 120, m: '¥120' }],
    ];
    const onAgentRequest = vi.fn();
    render(<SpreadsheetEditor content={content} preview={false} onChange={vi.fn()} onAgentRequest={onAgentRequest} />);

    fireEvent.mouseDown(screen.getByTestId('fortune-sheet'));
    fireEvent.contextMenu(screen.getByTestId('fortune-sheet'), { clientX: 120, clientY: 140 });
    fireEvent.click(screen.getByRole('menuitem', { name: '分析数据与异常' }));

    expect(onAgentRequest).toHaveBeenCalledWith({
      instruction: expect.stringContaining('关键趋势'),
      selection: expect.stringContaining('选区：A1:B2'),
    });
    expect(onAgentRequest.mock.calls[0][0].selection).toContain('云服务\t¥120');

    onAgentRequest.mockClear();
    fireEvent.contextMenu(screen.getByTestId('fortune-sheet'), { clientX: 120, clientY: 140 });
    fireEvent.click(screen.getByRole('menuitem', { name: '建议公式或整理方案' }));
    expect(onAgentRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        proposal: expect.objectContaining({
          title: '审阅表格修改',
          targets: expect.arrayContaining([
            { id: 'A1', label: '预算!A1', before: '项目' },
            { id: 'B2', label: '预算!B2', before: '120' },
          ]),
        }),
      })
    );
  });
});

function chooseOfficeOption(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function SpreadsheetHarness({
  initial,
  onChange,
}: {
  initial: WorkSpreadsheetContent;
  onChange: (content: WorkSpreadsheetContent) => void;
}) {
  const [content, setContent] = useState(initial);
  return (
    <SpreadsheetEditor
      content={content}
      preview={false}
      onChange={(next) => {
        onChange(next);
        setContent(next);
      }}
    />
  );
}

function spreadsheetContent(): WorkSpreadsheetContent {
  const artifact = createWorkArtifact('blank-spreadsheet');
  if (artifact.content.type !== 'spreadsheet') throw new Error('Spreadsheet template is invalid');
  return artifact.content;
}
