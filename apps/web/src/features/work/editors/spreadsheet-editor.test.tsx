import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Hooks } from '@fortune-sheet/core';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpreadsheetPivotFromSelection } from '../work-spreadsheet-pivots';
import { createWorkArtifact } from '../work-templates';
import type { WorkSpreadsheetContent } from '../work-types';
import { SpreadsheetEditor } from './spreadsheet-editor';

const workbookMocks = vi.hoisted(() => ({
  calculateFormula: vi.fn(),
  hooks: undefined as Hooks | undefined,
  onChange: undefined as ((sheets: WorkSpreadsheetContent['sheets']) => void) | undefined,
  sheets: undefined as WorkSpreadsheetContent['sheets'] | undefined,
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
        }: {
          data: WorkSpreadsheetContent['sheets'];
          hooks?: Hooks;
          onChange?: (sheets: WorkSpreadsheetContent['sheets']) => void;
        },
        ref: React.ForwardedRef<{ calculateFormula: typeof workbookMocks.calculateFormula }>
      ) => {
        React.useImperativeHandle(ref, () => ({
          calculateFormula: workbookMocks.calculateFormula,
        }));
        workbookMocks.hooks = hooks;
        workbookMocks.onChange = onChange;
        workbookMocks.sheets = data;
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

describe('Work spreadsheet editor', () => {
  afterEach(() => {
    cleanup();
    workbookMocks.calculateFormula.mockReset();
    workbookMocks.hooks = undefined;
    workbookMocks.onChange = undefined;
    workbookMocks.sheets = undefined;
  });

  it('uses a keyboard-accessible spreadsheet ribbon and a live workbook status bar', async () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetEditor content={content} preview={false} saveStatus='已保存到 A3S' onChange={onChange} />);

    const tablist = screen.getByRole('tablist', { name: '表格功能区' });
    expect(tablist).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '首页',
      '插入',
      '公式',
      '数据',
      '审阅',
      '视图',
    ]);

    const homeTab = screen.getByRole('tab', { name: '首页' });
    fireEvent.keyDown(homeTab, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByRole('tab', { name: '插入' })).toHaveFocus());

    fireEvent.click(screen.getByRole('tab', { name: '公式' }));
    expect(screen.getByRole('button', { name: /^名称管理器/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^公式与计算/ })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('fortune-sheet'));
    expect(screen.getByLabelText('表格选区状态')).toHaveTextContent('A1:B2');
    expect(screen.getByLabelText('表格保存状态')).toHaveTextContent('已保存到 A3S');

    fireEvent.click(screen.getByRole('button', { name: '放大表格' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sheets: [expect.objectContaining({ zoomRatio: 1.1 })],
      })
    );
  });

  it('creates, updates, and deletes scoped named ranges', async () => {
    const content = spreadsheetContent();
    const sheetId = content.sheets[0].id!;
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '公式' }));
    fireEvent.click(screen.getByRole('button', { name: /^名称管理器/ }));
    fireEvent.click(screen.getByRole('button', { name: '新建名称' }));
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '收入目标' } });
    fireEvent.change(screen.getByLabelText('名称作用域'), { target: { value: sheetId } });
    fireEvent.change(screen.getByLabelText('名称引用位置'), { target: { value: '$b$2:$c$8' } });
    fireEvent.change(screen.getByLabelText('名称备注'), { target: { value: '季度目标' } });
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          namedRanges: [
            expect.objectContaining({
              name: '收入目标',
              reference: '$b$2:$c$8',
              scopeSheetId: sheetId,
              comment: '季度目标',
            }),
          ],
        })
      );
    });

    fireEvent.change(screen.getByLabelText('名称引用位置'), { target: { value: '$B$2:$D$10' } });
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          namedRanges: [expect.objectContaining({ name: '收入目标', reference: '$B$2:$D$10' })],
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ namedRanges: undefined }));
    });
  });

  it('validates, saves, and clears worksheet print areas, titles, breaks, and page setup', async () => {
    const content = spreadsheetContent();
    const sheetId = content.sheets[0].id!;
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '视图' }));
    fireEvent.click(screen.getByRole('button', { name: /^打印设置/ }));
    fireEvent.change(screen.getByLabelText('打印范围'), { target: { value: 'A0:C4' } });
    fireEvent.click(screen.getByRole('button', { name: '保存打印设置' }));
    expect(screen.getByText(/请输入有效的 A1 范围/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('打印范围'), { target: { value: '$a$1:$j$40' } });
    fireEvent.change(screen.getByLabelText('重复标题行'), { target: { value: '$2:$1' } });
    fireEvent.change(screen.getByLabelText('重复标题列'), { target: { value: 'c:a' } });
    fireEvent.change(screen.getByLabelText('手动水平分页符'), {
      target: { value: '35, 20, 35' },
    });
    fireEvent.change(screen.getByLabelText('手动垂直分页符'), {
      target: { value: 'K, E' },
    });
    fireEvent.change(screen.getByLabelText('纸张大小'), { target: { value: 'tabloid' } });
    fireEvent.change(screen.getByLabelText('页面方向'), { target: { value: 'portrait' } });
    fireEvent.change(screen.getByLabelText('缩放方式'), { target: { value: 'fit' } });
    fireEvent.change(screen.getByLabelText('适合页宽'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('适合页高'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('水平居中'));
    fireEvent.click(screen.getByLabelText('垂直居中'));
    fireEvent.change(screen.getByLabelText('上边距（毫米）'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('右边距（毫米）'), { target: { value: '23' } });
    fireEvent.change(screen.getByLabelText('下边距（毫米）'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('左边距（毫米）'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('页眉边距（毫米）'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('页脚边距（毫米）'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('页眉左侧'), { target: { value: 'Confidential' } });
    fireEvent.change(screen.getByLabelText('页眉中间'), { target: { value: '{sheet} · {file}' } });
    fireEvent.change(screen.getByLabelText('页脚右侧'), {
      target: { value: 'Page {page} of {pages}' },
    });
    fireEvent.change(screen.getByLabelText('起始页码'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('打印页顺序'), { target: { value: 'downThenOver' } });
    fireEvent.click(screen.getByLabelText('页眉页脚随文档缩放'));
    fireEvent.click(screen.getByLabelText('页眉页脚与页边距对齐'));
    fireEvent.click(screen.getByRole('button', { name: '保存打印设置' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          printAreas: [{ sheetId, reference: '$A$1:$J$40' }],
          printTitles: [{ sheetId, rows: '$1:$2', columns: '$A:$C' }],
          pageBreaks: [{ sheetId, rows: [19, 34], columns: [4, 10] }],
          pageSetups: [
            {
              sheetId,
              paperSize: 'tabloid',
              orientation: 'portrait',
              scale: 100,
              fitToPage: true,
              fitToWidth: 1,
              fitToHeight: 2,
              horizontalCentered: true,
              verticalCentered: true,
              header: {
                left: 'Confidential',
                center: '{sheet} · {file}',
                right: '',
              },
              footer: {
                left: '',
                center: '',
                right: 'Page {page} of {pages}',
              },
              pageNumberStart: 7,
              pageOrder: 'downThenOver',
              scaleWithDocument: false,
              alignWithMargins: false,
              margins: {
                top: 20,
                right: 23,
                bottom: 21,
                left: 22,
                header: 8,
                footer: 9,
              },
            },
          ],
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '清除' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          printAreas: undefined,
          printTitles: undefined,
          pageBreaks: undefined,
          pageSetups: undefined,
        })
      );
    });
  });

  it('creates, updates, and deletes editable color-scale, data-bar, and icon-set rules', async () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /^条件格式/ }));
    fireEvent.change(screen.getByLabelText('条件格式范围'), { target: { value: 'A0:A4' } });
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));
    expect(screen.getByText(/请输入有效的单元格范围/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('条件格式范围'), { target: { value: '$b$2:$b$4' } });
    fireEvent.change(screen.getByLabelText('色阶级数'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('最小值颜色'), { target: { value: '#ff0000' } });
    fireEvent.change(screen.getByLabelText('最大值颜色'), { target: { value: '#00ff00' } });
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sheets: [
            expect.objectContaining({
              luckysheet_conditionformat_save: [
                {
                  type: 'colorGradation',
                  cellrange: [{ row: [1, 3], column: [1, 1] }],
                  format: ['#00ff00', '#ff0000'],
                },
              ],
            }),
          ],
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '新建规则' }));
    fireEvent.change(screen.getByLabelText('条件格式规则类型'), { target: { value: 'dataBar' } });
    fireEvent.change(screen.getByLabelText('条件格式范围'), { target: { value: 'C2:C4' } });
    fireEvent.change(screen.getByLabelText('数据条颜色'), { target: { value: '#3366ff' } });
    fireEvent.click(screen.getByLabelText('显示数据条数值'));
    fireEvent.change(screen.getByLabelText('数据条最短长度'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('数据条最长长度'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('数据条阈值 1 类型'), { target: { value: 'num' } });
    fireEvent.change(screen.getByLabelText('数据条阈值 1'), { target: { value: '-10' } });
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));

    await waitFor(() => {
      const rules = onChange.mock.lastCall?.[0].sheets[0].luckysheet_conditionformat_save;
      expect(rules).toEqual([
        expect.objectContaining({ type: 'colorGradation' }),
        {
          type: 'dataBar',
          cellrange: [{ row: [1, 3], column: [2, 2] }],
          format: { textColor: null, cellColor: '#3366ff' },
          visualOptions: {
            thresholds: [{ type: 'num', value: -10 }, { type: 'max' }],
            showValue: false,
            minLength: 20,
            maxLength: 80,
          },
        },
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: '新建规则' }));
    fireEvent.change(screen.getByLabelText('条件格式规则类型'), { target: { value: 'icons' } });
    fireEvent.change(screen.getByLabelText('条件格式范围'), { target: { value: 'D2:D4' } });
    fireEvent.change(screen.getByLabelText('图标集'), { target: { value: '4Arrows' } });
    fireEvent.click(screen.getByLabelText('反转图标顺序'));
    fireEvent.click(screen.getByLabelText('显示单元格值'));
    fireEvent.change(screen.getByLabelText('图标阈值 2'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));

    await waitFor(() => {
      const rules = onChange.mock.lastCall?.[0].sheets[0].luckysheet_conditionformat_save;
      expect(rules).toEqual([
        expect.objectContaining({ type: 'colorGradation' }),
        expect.objectContaining({ type: 'dataBar' }),
        {
          type: 'icons',
          cellrange: [{ row: [1, 3], column: [3, 3] }],
          format: {
            iconSet: '4Arrows',
            showValue: false,
            reverse: true,
            percent: true,
            thresholds: [
              { type: 'min', gte: true },
              { type: 'percent', value: 20, gte: true },
              { type: 'percent', value: 50, gte: true },
              { type: 'percent', value: 75, gte: true },
            ],
          },
        },
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: /双色阶/ }));
    fireEvent.click(screen.getByRole('button', { name: '删除规则' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].luckysheet_conditionformat_save).toEqual([
        expect.objectContaining({ type: 'dataBar' }),
        expect.objectContaining({ type: 'icons' }),
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: /四向彩色箭头/ }));
    fireEvent.click(screen.getByRole('button', { name: '删除规则' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].luckysheet_conditionformat_save).toEqual([
        expect.objectContaining({ type: 'dataBar' }),
      ]);
    });
  });

  it('creates and updates every core cell-comparison rule in the Work manager', async () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /^条件格式/ }));
    fireEvent.change(screen.getByLabelText('条件格式规则类型'), { target: { value: 'cellComparison' } });
    fireEvent.change(screen.getByLabelText('条件格式范围'), { target: { value: 'A2:A4' } });
    fireEvent.change(screen.getByLabelText('条件比较运算符'), { target: { value: 'notBetween' } });
    fireEvent.change(screen.getByLabelText('条件比较下限'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('条件比较上限'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));

    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].luckysheet_conditionformat_save).toEqual([
        {
          type: 'default',
          cellrange: [{ row: [1, 3], column: [0, 0] }],
          format: { textColor: '#9c0006', cellColor: '#ffc7ce' },
          conditionName: 'notBetween',
          conditionRange: [],
          conditionValue: ['10', '20'],
        },
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: /不介于/ }));
    fireEvent.change(screen.getByLabelText('条件比较运算符'), { target: { value: 'greaterThanOrEqual' } });
    fireEvent.change(screen.getByLabelText('条件比较值'), { target: { value: '12' } });
    fireEvent.click(screen.getByLabelText('设置文字颜色'));
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));

    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].luckysheet_conditionformat_save).toEqual([
        expect.objectContaining({
          format: { textColor: null, cellColor: '#ffc7ce' },
          conditionName: 'greaterThanOrEqual',
          conditionValue: ['12'],
        }),
      ]);
    });
  });

  it('edits stop-if-true and reorders conditional-format priority', async () => {
    const content = spreadsheetContent();
    content.sheets[0].luckysheet_conditionformat_save = [
      {
        type: 'default',
        cellrange: [{ row: [1, 3], column: [0, 0] }],
        format: { textColor: null, cellColor: '#ffc7ce' },
        conditionName: 'greaterThan',
        conditionRange: [],
        conditionValue: ['10'],
      },
      {
        type: 'default',
        cellrange: [{ row: [1, 3], column: [0, 0] }],
        format: { textColor: null, cellColor: '#c6efce' },
        conditionName: 'textContains',
        conditionRange: [],
        conditionValue: ['Ready'],
      },
    ];
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /^条件格式/ }));
    fireEvent.click(screen.getByLabelText('匹配后停止后续规则'));
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].luckysheet_conditionformat_save[0]).toMatchObject({
        conditionName: 'greaterThan',
        stopIfTrue: true,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /包含文本/ }));
    expect(screen.getByLabelText('条件格式规则类型')).toBeDisabled();
    expect(screen.getByLabelText('条件格式规则摘要')).toHaveValue('包含文本：“Ready”');
    fireEvent.change(screen.getByLabelText('条件格式范围'), { target: { value: 'B2:B4' } });
    fireEvent.click(screen.getByLabelText('匹配后停止后续规则'));
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].luckysheet_conditionformat_save[1]).toEqual({
        type: 'default',
        cellrange: [{ row: [1, 3], column: [1, 1] }],
        format: { textColor: null, cellColor: '#c6efce' },
        conditionName: 'textContains',
        conditionRange: [],
        conditionValue: ['Ready'],
        stopIfTrue: true,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: '提高优先级' }));
    await waitFor(() => {
      expect(
        onChange.mock.lastCall?.[0].sheets[0].luckysheet_conditionformat_save.map(
          (rule: { conditionName: string }) => rule.conditionName
        )
      ).toEqual(['textContains', 'greaterThan']);
    });
  });

  it('protects a worksheet and manages passwordless editable ranges', async () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '审阅' }));
    fireEvent.click(screen.getByRole('button', { name: /^工作表保护/ }));
    fireEvent.click(screen.getByLabelText('启用工作表保护'));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].config.authority).toMatchObject({
        sheet: 1,
        selectLockedCells: 1,
        selectunLockedCells: 1,
      });
    });

    fireEvent.change(screen.getByLabelText('可编辑区域名称'), { target: { value: 'InputCells' } });
    fireEvent.change(screen.getByLabelText('可编辑区域范围'), { target: { value: '$b$2:$b$3' } });
    fireEvent.click(screen.getByRole('button', { name: '保存区域' }));
    await waitFor(() => {
      const sheet = onChange.mock.lastCall?.[0].sheets[0];
      expect(sheet.config.authority.allowRangeList).toEqual([{ name: 'InputCells', sqref: 'B2:B3' }]);
      expect(sheet.data[1][1]).toMatchObject({ lo: 0 });
      expect(sheet.data[2][1]).toMatchObject({ lo: 0 });
    });

    fireEvent.click(screen.getByLabelText('允许选择未锁定单元格'));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].config.authority).toMatchObject({
        selectLockedCells: 0,
        selectunLockedCells: 0,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: '删除区域' }));
    await waitFor(() => {
      const sheet = onChange.mock.lastCall?.[0].sheets[0];
      expect(sheet.config.authority.allowRangeList).toEqual([]);
      expect(sheet.data[1][1]).toMatchObject({ lo: 1 });
      expect(sheet.data[2][1]).toMatchObject({ lo: 1 });
    });
  });

  it('creates, edits, and deletes a native chart from the selected range', async () => {
    const content = spreadsheetContent();
    content.sheets[0].name = '报告';
    content.sheets[0].data = [
      [
        { v: '季度', m: '季度' },
        { v: '收入', m: '收入' },
      ],
      [
        { v: 'Q1', m: 'Q1' },
        { v: 42, m: '42' },
      ],
    ];
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByTestId('fortune-sheet'));
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: /^图表/ }));
    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));

    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts).toEqual([
        expect.objectContaining({
          type: 'column',
          categories: ['Q1'],
          categoryReference: "'报告'!$A$2",
          series: [
            expect.objectContaining({
              name: '收入',
              values: [42],
              valuesReference: "'报告'!$B$2",
            }),
          ],
        }),
      ]);
    });

    fireEvent.change(screen.getByLabelText('图表标题'), { target: { value: '季度收入趋势' } });
    expect(screen.getByRole('option', { name: '雷达图' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('图表类型'), { target: { value: 'doughnut' } });
    const holeSize = screen.getByLabelText('圆环孔径（%）');
    fireEvent.change(holeSize, { target: { value: '91' } });
    expect(holeSize).toBeInvalid();
    fireEvent.change(holeSize, { target: { value: '64' } });
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0]).toMatchObject({
        type: 'doughnut',
        doughnutHoleSize: 64,
        title: '季度收入趋势',
      });
    });

    fireEvent.change(screen.getByLabelText('图表类型'), { target: { value: 'radar' } });
    expect(screen.getByRole('option', { name: '标准雷达图' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '带数据标记的雷达图' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '填充雷达图' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('雷达图样式'), { target: { value: 'filled' } });
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0]).toMatchObject({
        type: 'radar',
        radarStyle: 'filled',
      });
    });

    expect(screen.getByRole('option', { name: '散点图' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '气泡图' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('图表类型'), { target: { value: 'scatter' } });
    expect(screen.getByRole('option', { name: '仅数据标记' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '带数据标记的平滑线' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('散点图样式'), { target: { value: 'smoothMarker' } });
    fireEvent.change(screen.getByLabelText('系列 1 X 值引用'), { target: { value: "'报告'!$A$2" } });
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0]).toMatchObject({
        type: 'scatter',
        scatterStyle: 'smoothMarker',
        series: [expect.objectContaining({ xValuesReference: "'报告'!$A$2" })],
      });
    });

    fireEvent.change(screen.getByLabelText('图表类型'), { target: { value: 'bubble' } });
    const bubbleScale = screen.getByLabelText('气泡缩放（%）');
    fireEvent.change(bubbleScale, { target: { value: '301' } });
    expect(bubbleScale).toBeInvalid();
    fireEvent.change(bubbleScale, { target: { value: '135' } });
    fireEvent.click(screen.getByLabelText('显示负值气泡'));
    fireEvent.change(screen.getByLabelText('气泡大小表示'), { target: { value: 'width' } });
    fireEvent.change(screen.getByLabelText('系列 1 气泡大小引用'), { target: { value: "'报告'!$B$2" } });
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0]).toMatchObject({
        type: 'bubble',
        bubbleScale: 135,
        showNegativeBubbles: true,
        bubbleSizeRepresents: 'width',
        series: [
          expect.objectContaining({
            xValuesReference: "'报告'!$A$2",
            bubbleSizesReference: "'报告'!$B$2",
          }),
        ],
      });
    });

    fireEvent.click(screen.getByRole('button', { name: '删除图表' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts).toBeUndefined();
    });
  });

  it('edits per-series plot types and primary or secondary axes for a combination chart', async () => {
    const content = spreadsheetContent();
    content.sheets[0].name = '报告';
    content.sheets[0].data = [
      [
        { v: '季度', m: '季度' },
        { v: '收入', m: '收入' },
        { v: '利润率', m: '利润率' },
      ],
      [
        { v: 'Q1', m: 'Q1' },
        { v: 42, m: '42' },
        { v: 0.12, m: '12%' },
      ],
    ];
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByTestId('fortune-sheet'));
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: /^图表/ }));
    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].sheets[0].charts).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: '添加系列' }));
    fireEvent.change(screen.getByLabelText('系列 2 名称'), { target: { value: '利润率' } });
    fireEvent.change(screen.getByLabelText('系列 2 数值引用'), { target: { value: "'报告'!$C$2" } });
    expect(screen.getByRole('option', { name: '组合图' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('图表类型'), { target: { value: 'combination' } });
    fireEvent.change(screen.getByLabelText('系列 1 图表类型'), { target: { value: 'column' } });
    fireEvent.change(screen.getByLabelText('系列 1 坐标轴'), { target: { value: 'primary' } });
    fireEvent.change(screen.getByLabelText('系列 2 图表类型'), { target: { value: 'line' } });
    fireEvent.change(screen.getByLabelText('系列 2 坐标轴'), { target: { value: 'secondary' } });
    fireEvent.change(screen.getByLabelText('横坐标轴标题'), { target: { value: '季度' } });
    fireEvent.change(screen.getByLabelText('纵坐标轴标题'), { target: { value: '收入（万元）' } });
    fireEvent.change(screen.getByLabelText('次横坐标轴标题'), { target: { value: '次分类' } });
    fireEvent.change(screen.getByLabelText('次纵坐标轴标题'), { target: { value: '利润率' } });
    fireEvent.change(screen.getByLabelText('次纵坐标轴标题引用'), { target: { value: "'报告'!$C$1" } });
    fireEvent.change(screen.getByLabelText('纵坐标轴最小值'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('纵坐标轴最大值'), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));
    expect(screen.getByText('纵坐标轴最小值必须小于最大值。')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('纵坐标轴最大值'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('纵坐标轴主单位'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('纵坐标轴数字格式'), { target: { value: '#,##0' } });
    fireEvent.click(screen.getByLabelText('纵坐标轴显示主要网格线'));
    fireEvent.change(screen.getByLabelText('次纵坐标轴最小值'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('次纵坐标轴最大值'), { target: { value: '0.3' } });
    fireEvent.change(screen.getByLabelText('次纵坐标轴主单位'), { target: { value: '0.1' } });
    fireEvent.change(screen.getByLabelText('次纵坐标轴数字格式'), { target: { value: '0.0%' } });
    fireEvent.click(screen.getByLabelText('次纵坐标轴链接源数字格式'));
    fireEvent.click(screen.getByLabelText('次纵坐标轴显示主要网格线'));
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));

    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0]).toMatchObject({
        type: 'combination',
        axes: {
          bottom: { title: '季度' },
          left: {
            title: '收入（万元）',
            minimum: 0,
            maximum: 100,
            majorUnit: 25,
            showMajorGridlines: false,
            numberFormat: '#,##0',
            numberFormatSourceLinked: false,
          },
          top: { title: '次分类' },
          right: {
            title: '利润率',
            titleReference: "'报告'!$C$1",
            minimum: 0,
            maximum: 0.3,
            majorUnit: 0.1,
            showMajorGridlines: true,
            numberFormat: '0.0%',
            numberFormatSourceLinked: true,
          },
        },
        series: [
          expect.objectContaining({ chartType: 'column', axisGroup: 'primary' }),
          expect.objectContaining({
            name: '利润率',
            valuesReference: "'报告'!$C$2",
            chartType: 'line',
            axisGroup: 'secondary',
          }),
        ],
      });
    });

    fireEvent.change(screen.getByLabelText('图表类型'), { target: { value: 'column' } });
    expect(screen.queryByLabelText('次纵坐标轴标题')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0].axes).toEqual({
        bottom: { title: '季度' },
        left: {
          title: '收入（万元）',
          minimum: 0,
          maximum: 100,
          majorUnit: 25,
          showMajorGridlines: false,
          numberFormat: '#,##0',
          numberFormatSourceLinked: false,
        },
      });
    });
  });

  it('adds and edits polynomial trendline forecasts and labels on a chart series', async () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByTestId('fortune-sheet'));
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: /^图表/ }));
    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].sheets[0].charts).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: '添加系列 1 趋势线' }));
    fireEvent.change(screen.getByLabelText('系列 1 趋势线 1 类型'), { target: { value: 'polynomial' } });
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
    fireEvent.click(screen.getByRole('button', { name: /^图表/ }));
    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].sheets[0].charts).toHaveLength(1));

    fireEvent.click(screen.getByLabelText('系列 1 显示数据标签'));
    fireEvent.click(screen.getByLabelText('系列 1 数据标签显示分类名称'));
    fireEvent.click(screen.getByLabelText('系列 1 数据标签显示系列名称'));
    fireEvent.change(screen.getByLabelText('系列 1 数据标签位置'), { target: { value: 'outsideEnd' } });
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
    fireEvent.click(screen.getByRole('button', { name: /^图表/ }));
    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].sheets[0].charts).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: '添加系列 1 Y 误差线' }));
    fireEvent.change(screen.getByLabelText('系列 1 误差线 1 误差类型'), { target: { value: 'plus' } });
    fireEvent.change(screen.getByLabelText('系列 1 误差线 1 计算方式'), { target: { value: 'percentage' } });
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
    fireEvent.change(screen.getByLabelText('计算模式'), { target: { value: 'manual' } });
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
