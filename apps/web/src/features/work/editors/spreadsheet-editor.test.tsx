import type { Hooks } from '@fortune-sheet/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkArtifact } from '../work-templates';
import type { WorkSpreadsheetContent } from '../work-types';
import { SpreadsheetEditor } from './spreadsheet-editor';

const workbookMocks = vi.hoisted(() => ({
  calculateFormula: vi.fn(),
  cancelMerge: vi.fn(),
  handleRedo: vi.fn(),
  handleUndo: vi.fn(),
  onKeyDown: vi.fn(),
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
          <div className='fortune-container' role='application' onKeyDown={(event) => workbookMocks.onKeyDown(event)}>
            <button
              type='button'
              data-testid='fortune-sheet'
              onMouseDown={() =>
                hooks?.afterSelectionChange?.(data[0].id!, {
                  row: [0, 1],
                  column: [0, 1],
                })
              }
            >
              {data.map((sheet) => sheet.name).join(',')}
            </button>
            {/* biome-ignore lint/a11y/useSemanticElements: Fortune Sheet renders its formula bar as a contenteditable textbox. */}
            <div className='fortune-fx-input' role='textbox' tabIndex={0} aria-label='当前单元格输入' contentEditable />
          </div>
        );
      }
    ),
  };
});

describe('Work spreadsheet editor', () => {
  afterEach(() => {
    cleanup();
    workbookMocks.calculateFormula.mockReset();
    workbookMocks.cancelMerge.mockReset();
    workbookMocks.handleRedo.mockReset();
    workbookMocks.handleUndo.mockReset();
    workbookMocks.onKeyDown.mockReset();
    workbookMocks.mergeCells.mockReset();
    workbookMocks.setCellFormatByRange.mockReset();
    workbookMocks.hooks = undefined;
    workbookMocks.onChange = undefined;
    workbookMocks.sheets = undefined;
    workbookMocks.showToolbar = undefined;
    workbookMocks.mountCount = 0;
    workbookMocks.unmountCount = 0;
  });

  it('uses a keyboard-accessible spreadsheet ribbon and a live workbook status bar', async () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetEditor content={content} preview={false} saveStatus='已保存到 A3S' onChange={onChange} />);

    const tablist = screen.getByRole('tablist', { name: '表格功能区' });
    expect(tablist).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '开始',
      '插入',
      '页面布局',
      '公式',
      '数据',
      '审阅',
      '视图',
    ]);

    const homeTab = screen.getByRole('tab', { name: '开始' });
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

  it('uses the shared Home ribbon for common formatting instead of the embedded toolbar', () => {
    const content = spreadsheetContent();
    const sheetId = content.sheets[0].id!;
    render(<SpreadsheetEditor content={content} preview={false} onChange={vi.fn()} />);

    expect(workbookMocks.showToolbar).toBe(false);
    expect(screen.getByRole('toolbar', { name: '开始工具栏' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '撤销' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重做' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '撤销' })).toHaveAttribute('aria-keyshortcuts', 'Control+Z Meta+Z');
    expect(screen.getByRole('button', { name: '重做' })).toHaveAttribute(
      'aria-keyshortcuts',
      'Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y'
    );

    fireEvent.mouseDown(screen.getByTestId('fortune-sheet'));
    fireEvent.click(screen.getByRole('button', { name: '加粗' }));
    expect(workbookMocks.setCellFormatByRange).toHaveBeenCalledWith(
      'bl',
      1,
      { row: [0, 1], column: [0, 1] },
      { id: sheetId }
    );

    fireEvent.click(screen.getByRole('button', { name: '合并单元格' }));
    expect(workbookMocks.mergeCells).toHaveBeenCalledWith([{ row: [0, 1], column: [0, 1] }], 'merge-all', {
      id: sheetId,
    });
  });

  it('tracks workbook edits with accurate ribbon and keyboard undo and redo state', async () => {
    const initial = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={initial} onChange={onChange} />);
    const editedSheets = workbookMocks.sheets!.map((sheet, index) =>
      index === 0
        ? {
            ...sheet,
            data: [[{ v: '可撤销内容', m: '可撤销内容' }]],
          }
        : sheet
    );

    await act(async () => workbookMocks.onChange?.(editedSheets));
    await waitFor(() => expect(screen.getByRole('button', { name: '撤销' })).toBeEnabled());
    expect(screen.getByRole('button', { name: '重做' })).toBeDisabled();
    const edited = onChange.mock.lastCall?.[0];
    expect(edited?.sheets[0].data?.[0]?.[0]?.v).toBe('可撤销内容');

    expect(
      fireEvent.keyDown(screen.getByTestId('fortune-sheet'), {
        key: 'z',
        ctrlKey: true,
      })
    ).toBe(false);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(initial));
    expect(screen.getByRole('button', { name: '撤销' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重做' })).toBeEnabled();

    expect(
      fireEvent.keyDown(screen.getByRole('textbox', { name: '当前单元格输入' }), {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
      })
    ).toBe(false);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(edited));

    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(initial));
    expect(
      fireEvent.keyDown(screen.getByTestId('fortune-sheet'), {
        key: 'y',
        ctrlKey: true,
      })
    ).toBe(false);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(edited));

    expect(workbookMocks.handleUndo).not.toHaveBeenCalled();
    expect(workbookMocks.handleRedo).not.toHaveBeenCalled();
  });

  it('keeps native select-all inside the formula bar instead of selecting the workbook', () => {
    render(<SpreadsheetEditor content={spreadsheetContent()} preview={false} onChange={vi.fn()} />);
    const formulaBar = screen.getByRole('textbox', { name: '当前单元格输入' });
    formulaBar.textContent = '=SUM(A1:A3)';

    expect(
      fireEvent.keyDown(formulaBar, {
        key: 'a',
        code: 'KeyA',
        metaKey: true,
      })
    ).toBe(false);

    expect(workbookMocks.onKeyDown).not.toHaveBeenCalled();
    expect(window.getSelection()?.toString()).toBe('=SUM(A1:A3)');
  });

  it('keeps native text-field undo separate from workbook history', async () => {
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={spreadsheetContent()} onChange={onChange} />);
    const editedSheets = workbookMocks.sheets!.map((sheet, index) =>
      index === 0
        ? {
            ...sheet,
            data: [[{ v: '工作簿历史', m: '工作簿历史' }]],
          }
        : sheet
    );
    await act(async () => workbookMocks.onChange?.(editedSheets));
    await waitFor(() => expect(screen.getByRole('button', { name: '撤销' })).toBeEnabled());

    fireEvent.click(screen.getByRole('tab', { name: '公式' }));
    fireEvent.click(screen.getByRole('button', { name: /^名称管理器/ }));
    const reference = screen.getByLabelText('名称引用位置');
    const changeCount = onChange.mock.calls.length;

    expect(fireEvent.keyDown(reference, { key: 'z', ctrlKey: true })).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(changeCount);
    fireEvent.click(screen.getByRole('tab', { name: '开始' }));
    expect(screen.getByRole('button', { name: '撤销' })).toBeEnabled();
  });

  it('gives Fortune Sheet a finite A1 selection when a workbook has no saved selection', () => {
    render(<SpreadsheetEditor content={spreadsheetContent()} preview={false} onChange={vi.fn()} />);

    expect(workbookMocks.sheets?.[0].luckysheet_select_save).toEqual([
      { row: [0, 0], column: [0, 0], row_focus: 0, column_focus: 0 },
    ]);
  });

  it('adapts matrix cells to Fortune Sheet initialization without clearing controlled content', () => {
    const artifact = createWorkArtifact('quarterly-plan');
    if (artifact.content.type !== 'spreadsheet') throw new Error('Spreadsheet template is invalid');
    const content = artifact.content;
    const firstCell = content.sheets[0].data?.[0]?.[0];

    render(<SpreadsheetEditor content={content} preview={false} onChange={vi.fn()} />);

    const expectedMerge = { r: 0, c: 0, rs: 1, cs: 7 };
    expect(workbookMocks.sheets?.[0].celldata).toContainEqual({
      r: 0,
      c: 0,
      v: { ...firstCell, mc: expectedMerge },
    });
    expect(workbookMocks.sheets?.[0].data?.[0]?.[0]?.mc).toEqual(expectedMerge);
    expect(content.sheets[0].data?.[0]?.[0]).toEqual(firstCell);
  });

  it('calculates existing formulas after the workbook initializes', async () => {
    const artifact = createWorkArtifact('quarterly-plan');
    if (artifact.content.type !== 'spreadsheet') throw new Error('Spreadsheet template is invalid');

    render(<SpreadsheetEditor content={artifact.content} preview={false} onChange={vi.fn()} />);

    await waitFor(() => expect(workbookMocks.calculateFormula).toHaveBeenCalledWith());
  });

  it('does not report Fortune Sheet initialization as a workbook edit', () => {
    const onChange = vi.fn();
    render(<SpreadsheetEditor content={spreadsheetContent()} preview={false} onChange={onChange} />);

    workbookMocks.onChange?.(workbookMocks.sheets!);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the Fortune Sheet change subscription stable after returning controlled content', async () => {
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={spreadsheetContent()} onChange={onChange} />);
    const initialSubscription = workbookMocks.onChange;
    const changedSheets = workbookMocks.sheets!.map((sheet, index) =>
      index === 0
        ? {
            ...sheet,
            data: [[{ v: '只保存一次', m: '只保存一次' }]],
          }
        : sheet
    );

    await act(async () => initialSubscription?.(changedSheets));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(workbookMocks.onChange).toBe(initialSubscription);

    await act(async () => workbookMocks.onChange?.(changedSheets));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the workbook instance mounted when switching between edit and preview', () => {
    const content = spreadsheetContent();
    const { rerender } = render(<SpreadsheetEditor content={content} preview={false} onChange={vi.fn()} />);
    expect(workbookMocks.mountCount).toBe(1);

    rerender(<SpreadsheetEditor content={content} preview onChange={vi.fn()} />);

    expect(workbookMocks.mountCount).toBe(1);
    expect(workbookMocks.unmountCount).toBe(0);
  });

  it('uses the shared status zoom in preview without changing workbook content', async () => {
    const onChange = vi.fn();
    render(<SpreadsheetEditor content={spreadsheetContent()} preview onChange={onChange} />);

    expect(screen.getByRole('slider', { name: '表格缩放' })).toHaveValue(100);
    fireEvent.click(screen.getByRole('button', { name: '放大表格' }));

    await waitFor(() => expect(screen.getByRole('slider', { name: '表格缩放' })).toHaveValue(110));
    expect(workbookMocks.sheets?.[0].zoomRatio).toBe(1.1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the file menu available without exposing editing commands in preview', async () => {
    const print = vi.fn();
    render(
      <SpreadsheetEditor
        content={spreadsheetContent()}
        preview
        fileActions={[{ id: 'print', label: '打印', onSelect: print }]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('region', { name: '表格预览工具' })).toHaveTextContent('只读预览1 个工作表');
    expect(screen.queryByRole('tablist', { name: '表格功能区' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '文件' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '打印' }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it('closes a workbook settings panel after moving to another ribbon tab', () => {
    render(<SpreadsheetEditor content={spreadsheetContent()} preview={false} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: /^条件格式/ }));
    expect(screen.getByLabelText('条件格式范围')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '公式' }));

    expect(screen.queryByLabelText('条件格式范围')).not.toBeInTheDocument();
  });

  it('creates, updates, and deletes scoped named ranges', async () => {
    const content = spreadsheetContent();
    const sheetId = content.sheets[0].id!;
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '公式' }));
    fireEvent.click(screen.getByRole('button', { name: /^名称管理器/ }));
    fireEvent.click(screen.getByRole('button', { name: '新建名称' }));
    fireEvent.change(screen.getByLabelText('名称'), {
      target: { value: '收入目标' },
    });
    chooseOfficeOption('名称作用域', '工作表1');
    fireEvent.change(screen.getByLabelText('名称引用位置'), {
      target: { value: '$b$2:$c$8' },
    });
    fireEvent.change(screen.getByLabelText('名称备注'), {
      target: { value: '季度目标' },
    });
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

    fireEvent.change(screen.getByLabelText('名称引用位置'), {
      target: { value: '$B$2:$D$10' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          namedRanges: [
            expect.objectContaining({
              name: '收入目标',
              reference: '$B$2:$D$10',
            }),
          ],
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

    fireEvent.click(screen.getByRole('tab', { name: '页面布局' }));
    fireEvent.click(screen.getByRole('button', { name: /^打印设置/ }));
    fireEvent.change(screen.getByLabelText('打印范围'), {
      target: { value: 'A0:C4' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存打印设置' }));
    expect(screen.getByText(/请输入有效的 A1 范围/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('打印范围'), {
      target: { value: '$a$1:$j$40' },
    });
    fireEvent.change(screen.getByLabelText('重复标题行'), {
      target: { value: '$2:$1' },
    });
    fireEvent.change(screen.getByLabelText('重复标题列'), {
      target: { value: 'c:a' },
    });
    fireEvent.change(screen.getByLabelText('手动水平分页符'), {
      target: { value: '35, 20, 35' },
    });
    fireEvent.change(screen.getByLabelText('手动垂直分页符'), {
      target: { value: 'K, E' },
    });
    chooseOfficeOption('纸张大小', 'Tabloid');
    chooseOfficeOption('页面方向', '纵向');
    chooseOfficeOption('缩放方式', '适合指定页数');
    fireEvent.change(screen.getByLabelText('适合页宽'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('适合页高'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByLabelText('水平居中'));
    fireEvent.click(screen.getByLabelText('垂直居中'));
    fireEvent.change(screen.getByLabelText('上边距（毫米）'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByLabelText('右边距（毫米）'), {
      target: { value: '23' },
    });
    fireEvent.change(screen.getByLabelText('下边距（毫米）'), {
      target: { value: '21' },
    });
    fireEvent.change(screen.getByLabelText('左边距（毫米）'), {
      target: { value: '22' },
    });
    fireEvent.change(screen.getByLabelText('页眉边距（毫米）'), {
      target: { value: '8' },
    });
    fireEvent.change(screen.getByLabelText('页脚边距（毫米）'), {
      target: { value: '9' },
    });
    fireEvent.change(screen.getByLabelText('页眉左侧'), {
      target: { value: 'Confidential' },
    });
    fireEvent.change(screen.getByLabelText('页眉中间'), {
      target: { value: '{sheet} · {file}' },
    });
    fireEvent.change(screen.getByLabelText('页脚右侧'), {
      target: { value: 'Page {page} of {pages}' },
    });
    fireEvent.change(screen.getByLabelText('起始页码'), {
      target: { value: '7' },
    });
    chooseOfficeOption('打印页顺序', '先向下，再向右');
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

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: /^条件格式/ }));
    fireEvent.change(screen.getByLabelText('条件格式范围'), {
      target: { value: 'A0:A4' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));
    expect(screen.getByText(/请输入有效的单元格范围/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('条件格式范围'), {
      target: { value: '$b$2:$b$4' },
    });
    chooseOfficeOption('色阶级数', '双色阶');
    chooseOfficeColor('最小值颜色', '#ff0000');
    chooseOfficeColor('最大值颜色', '#00ff00');
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
    chooseOfficeOption('条件格式规则类型', '数据条');
    fireEvent.change(screen.getByLabelText('条件格式范围'), {
      target: { value: 'C2:C4' },
    });
    chooseOfficeColor('数据条颜色', '#3366ff');
    fireEvent.click(screen.getByLabelText('显示数据条数值'));
    fireEvent.change(screen.getByLabelText('数据条最短长度'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByLabelText('数据条最长长度'), {
      target: { value: '80' },
    });
    chooseOfficeOption('数据条阈值 1 类型', '数值');
    fireEvent.change(screen.getByLabelText('数据条阈值 1'), {
      target: { value: '-10' },
    });
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
    chooseOfficeOption('条件格式规则类型', '图标集');
    fireEvent.change(screen.getByLabelText('条件格式范围'), {
      target: { value: 'D2:D4' },
    });
    chooseOfficeOption('图标集', '四向彩色箭头');
    fireEvent.click(screen.getByLabelText('反转图标顺序'));
    fireEvent.click(screen.getByLabelText('显示单元格值'));
    fireEvent.change(screen.getByLabelText('图标阈值 2'), {
      target: { value: '20' },
    });
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
  }, 10_000);

  it('creates and updates every core cell-comparison rule in the Work manager', async () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    render(<SpreadsheetHarness initial={content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: /^条件格式/ }));
    chooseOfficeOption('条件格式规则类型', '单元格比较');
    fireEvent.change(screen.getByLabelText('条件格式范围'), {
      target: { value: 'A2:A4' },
    });
    chooseOfficeOption('条件比较运算符', '不介于');
    fireEvent.change(screen.getByLabelText('条件比较下限'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('条件比较上限'), {
      target: { value: '20' },
    });
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
    chooseOfficeOption('条件比较运算符', '大于或等于');
    fireEvent.change(screen.getByLabelText('条件比较值'), {
      target: { value: '12' },
    });
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

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
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
    fireEvent.change(screen.getByLabelText('条件格式范围'), {
      target: { value: 'B2:B4' },
    });
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

    fireEvent.change(screen.getByLabelText('可编辑区域名称'), {
      target: { value: 'InputCells' },
    });
    fireEvent.change(screen.getByLabelText('可编辑区域范围'), {
      target: { value: '$b$2:$b$3' },
    });
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
    fireEvent.click(screen.getByRole('button', { name: /^插入图表/ }));
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

    fireEvent.change(await screen.findByLabelText('图表标题'), {
      target: { value: '季度收入趋势' },
    });
    chooseOfficeOption('图表类型', '圆环图');
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

    chooseOfficeOption('图表类型', '雷达图');
    chooseOfficeOption('雷达图样式', '填充雷达图');
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0]).toMatchObject({
        type: 'radar',
        radarStyle: 'filled',
      });
    });

    chooseOfficeOption('图表类型', '散点图');
    chooseOfficeOption('散点图样式', '带数据标记的平滑线');
    fireEvent.change(screen.getByLabelText('系列 1 X 值引用'), {
      target: { value: "'报告'!$A$2" },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].sheets[0].charts[0]).toMatchObject({
        type: 'scatter',
        scatterStyle: 'smoothMarker',
        series: [expect.objectContaining({ xValuesReference: "'报告'!$A$2" })],
      });
    });

    chooseOfficeOption('图表类型', '气泡图');
    const bubbleScale = screen.getByLabelText('气泡缩放（%）');
    fireEvent.change(bubbleScale, { target: { value: '301' } });
    expect(bubbleScale).toBeInvalid();
    fireEvent.change(bubbleScale, { target: { value: '135' } });
    fireEvent.click(screen.getByLabelText('显示负值气泡'));
    chooseOfficeOption('气泡大小表示', '宽度');
    fireEvent.change(screen.getByLabelText('系列 1 气泡大小引用'), {
      target: { value: "'报告'!$B$2" },
    });
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
  }, 10_000);

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
    fireEvent.click(screen.getByRole('button', { name: /^插入图表/ }));
    fireEvent.click(screen.getByRole('button', { name: '根据当前选区新建' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].sheets[0].charts).toHaveLength(1));

    fireEvent.click(await screen.findByRole('button', { name: '添加系列' }));
    fireEvent.change(await screen.findByLabelText('系列 2 名称'), {
      target: { value: '利润率' },
    });
    fireEvent.change(await screen.findByLabelText('系列 2 数值引用'), {
      target: { value: "'报告'!$C$2" },
    });
    chooseOfficeOption('图表类型', '组合图');
    chooseOfficeOption('系列 1 图表类型', '柱形图');
    chooseOfficeOption('系列 1 坐标轴', '主坐标轴');
    chooseOfficeOption('系列 2 图表类型', '折线图');
    chooseOfficeOption('系列 2 坐标轴', '次坐标轴');
    fireEvent.change(screen.getByLabelText('横坐标轴标题'), {
      target: { value: '季度' },
    });
    fireEvent.change(screen.getByLabelText('纵坐标轴标题'), {
      target: { value: '收入（万元）' },
    });
    fireEvent.change(screen.getByLabelText('次横坐标轴标题'), {
      target: { value: '次分类' },
    });
    fireEvent.change(screen.getByLabelText('次纵坐标轴标题'), {
      target: { value: '利润率' },
    });
    fireEvent.change(screen.getByLabelText('次纵坐标轴标题引用'), {
      target: { value: "'报告'!$C$1" },
    });
    fireEvent.change(screen.getByLabelText('纵坐标轴最小值'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('纵坐标轴最大值'), {
      target: { value: '-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存图表' }));
    expect(screen.getByText('纵坐标轴最小值必须小于最大值。')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('纵坐标轴最大值'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText('纵坐标轴主单位'), {
      target: { value: '25' },
    });
    fireEvent.change(screen.getByLabelText('纵坐标轴数字格式'), {
      target: { value: '#,##0' },
    });
    fireEvent.click(screen.getByLabelText('纵坐标轴显示主要网格线'));
    fireEvent.change(screen.getByLabelText('次纵坐标轴最小值'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('次纵坐标轴最大值'), {
      target: { value: '0.3' },
    });
    fireEvent.change(screen.getByLabelText('次纵坐标轴主单位'), {
      target: { value: '0.1' },
    });
    fireEvent.change(screen.getByLabelText('次纵坐标轴数字格式'), {
      target: { value: '0.0%' },
    });
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
          expect.objectContaining({
            chartType: 'column',
            axisGroup: 'primary',
          }),
          expect.objectContaining({
            name: '利润率',
            valuesReference: "'报告'!$C$2",
            chartType: 'line',
            axisGroup: 'secondary',
          }),
        ],
      });
    });

    chooseOfficeOption('图表类型', '簇状柱形图');
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
  }, 10_000);
});

function chooseOfficeOption(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function chooseOfficeColor(label: string, value: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.change(screen.getByRole('textbox', { name: '自定义颜色值' }), {
    target: { value },
  });
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
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
