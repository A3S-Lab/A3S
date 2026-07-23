import type { Cell, Hooks, Selection } from '@fortune-sheet/core';
import { Workbook, type WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BarChart3,
  Bold,
  Bookmark,
  Calculator,
  Cloud,
  Grid3X3,
  Italic,
  Merge,
  Palette,
  Printer,
  Redo2,
  ShieldCheck,
  TableProperties,
  Underline,
  Undo2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceContextMenu } from '../../workspace/components/workspace-context-menu';
import { spreadsheetAgentMenuItems } from '../components/work-editor-agent-menus';
import { applySpreadsheetAgentProposalChanges } from '../work-agent-proposal-apply';
import type { WorkEditorAgentRequest } from '../work-agent-request';
import { spreadsheetAgentSelection, type WorkSpreadsheetAgentSelection } from '../work-spreadsheet-agent-context';
import {
  reconcileSpreadsheetChartPreviews,
  spreadsheetChartCount,
  spreadsheetSheetsWithChartPreviews,
} from '../work-spreadsheet-charts';
import {
  drawSpreadsheetCommentMarker,
  drawSpreadsheetConditionalDataBar,
} from '../work-spreadsheet-conditional-canvas';
import { spreadsheetConditionalFormatStyles } from '../work-spreadsheet-conditional-format';
import { drawSpreadsheetConditionalIcon } from '../work-spreadsheet-conditional-icons';
import { spreadsheetFormulaCount } from '../work-spreadsheet-formula-analysis';
import {
  reconcileSpreadsheetPivots,
  refreshSpreadsheetPivotTables,
  spreadsheetPivotCount,
  spreadsheetPivotIntersects,
  spreadsheetPivotOutputContains,
} from '../work-spreadsheet-pivots';
import { protectedSheetCount, spreadsheetProtectionKey } from '../work-spreadsheet-protection';
import type { WorkSpreadsheetContent } from '../work-types';
import { OfficeColorPicker, OfficeSelect } from './office-controls';
import { isOfficeShortcutBlocked } from './office-shortcuts';
import { managedConditionalFormatCount } from './spreadsheet-conditional-format-panel';
import { spreadsheetPrintSettingCount } from './spreadsheet-print-settings-panel';
import { SpreadsheetWorkbookPanel, type SpreadsheetWorkbookPanelView } from './spreadsheet-workbook-panel';
import { useOfficeHistory } from './use-office-history';
import {
  type WorkOfficeFileAction,
  WorkOfficePreviewBar,
  WorkOfficeRibbon,
  WorkOfficeRibbonButton,
  WorkOfficeRibbonGroup,
  WorkOfficeStatusBar,
  WorkOfficeZoomControls,
} from './work-office-chrome';

const spreadsheetRibbonTabs = [
  { id: 'home', label: '开始' },
  { id: 'insert', label: '插入' },
  { id: 'pageLayout', label: '页面布局' },
  { id: 'formulas', label: '公式' },
  { id: 'data', label: '数据' },
  { id: 'review', label: '审阅' },
  { id: 'view', label: '视图' },
] as const;

type SpreadsheetRibbonTabId = (typeof spreadsheetRibbonTabs)[number]['id'];

const spreadsheetFontSizes = [9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72] as const;

interface SpreadsheetEditorProps {
  content: WorkSpreadsheetContent;
  preview: boolean;
  saveStatus?: string;
  fileActions?: readonly WorkOfficeFileAction[];
  onChange: (content: WorkSpreadsheetContent) => void;
  onAgentRequest?: (request: WorkEditorAgentRequest) => void | Promise<void>;
}

interface SpreadsheetSelectionState {
  sheetId: string;
  selection: Selection;
}

interface SpreadsheetAgentMenuState {
  x: number;
  y: number;
  selection: WorkSpreadsheetAgentSelection;
}

export function SpreadsheetEditor({
  content,
  preview,
  saveStatus = '已自动保存',
  fileActions,
  onChange,
  onAgentRequest,
}: SpreadsheetEditorProps) {
  const materializedContent = useMemo(() => refreshSpreadsheetPivotTables(content), [content]);
  const contentRef = useRef(materializedContent);
  const onChangeRef = useRef(onChange);
  const previewRef = useRef(preview);
  const workbookRef = useRef<WorkbookInstance>(null);
  const [ribbonTab, setRibbonTab] = useState<SpreadsheetRibbonTabId>('home');
  const [panel, setPanel] = useState<SpreadsheetWorkbookPanelView | null>(null);
  const [selectionState, setSelectionState] = useState<SpreadsheetSelectionState | null>(null);
  const [agentMenu, setAgentMenu] = useState<SpreadsheetAgentMenuState | null>(null);
  const [previewZoom, setPreviewZoom] = useState(100);
  const history = useOfficeHistory({ content, onChange });
  const activeSheetId =
    content.sheets.find((sheet) => sheet.status === 1)?.id ?? content.sheets.find((sheet) => !sheet.hide)?.id ?? '';
  const activeSheetIdRef = useRef(activeSheetId);
  contentRef.current = materializedContent;
  onChangeRef.current = onChange;
  previewRef.current = preview;
  const conditionalStylesBySheet = useMemo(
    () =>
      new Map(
        materializedContent.sheets.flatMap((sheet) =>
          sheet.id ? [[sheet.id, spreadsheetConditionalFormatStyles(sheet)] as const] : []
        )
      ),
    [materializedContent.sheets]
  );
  useEffect(() => {
    activeSheetIdRef.current = activeSheetId;
  }, [activeSheetId]);
  useEffect(() => {
    if (!preview) return;
    setPanel(null);
    setAgentMenu(null);
  }, [preview]);
  const workbookHooks = useMemo<Hooks>(
    () => ({
      afterActivateSheet: (id) => {
        activeSheetIdRef.current = id;
        setSelectionState(null);
      },
      afterSelectionChange: (sheetId, selection) => {
        setSelectionState({ sheetId, selection });
      },
      beforeUpdateCell: (row, column) => {
        const sheet = contentRef.current.sheets.find((candidate) => candidate.id === activeSheetIdRef.current);
        return !sheet || !spreadsheetPivotOutputContains(sheet, row, column);
      },
      beforePaste: (selections) => {
        const sheet = contentRef.current.sheets.find((candidate) => candidate.id === activeSheetIdRef.current);
        if (!sheet) return true;
        return !(selections ?? []).some(
          (selection) =>
            spreadsheetPivotIntersects(sheet, {
              startRow: Math.min(selection.row[0], selection.row[1]),
              endRow: Math.max(selection.row[0], selection.row[1]),
              startColumn: Math.min(selection.column[0], selection.column[1]),
              endColumn: Math.max(selection.column[0], selection.column[1]),
            }).length
        );
      },
      beforeRenderCell: (_cell, cellInfo, context) => {
        const style = conditionalStylesBySheet.get(activeSheetIdRef.current)?.get(`${cellInfo.row}_${cellInfo.column}`);
        if (style?.cellColor) context.fillStyle = style.cellColor;
        return true;
      },
      afterRenderCell: (cell, cellInfo, context) => {
        const style = conditionalStylesBySheet.get(activeSheetIdRef.current)?.get(`${cellInfo.row}_${cellInfo.column}`);
        if (!style?.icon && !style?.dataBar) return;
        const background = style.cellColor ?? (typeof cell?.bg === 'string' ? cell.bg : '#ffffff');
        if (style.dataBar) {
          drawSpreadsheetConditionalDataBar(
            context,
            cellInfo,
            {
              ...style.dataBar,
              showValue: style.dataBar.showValue && (style.icon?.showValue ?? true),
            },
            cell,
            background,
            style.textColor
          );
        }
        if (style.icon) {
          drawSpreadsheetConditionalIcon(
            context,
            cellInfo,
            style.icon,
            background,
            style.dataBar ? false : !style.icon.showValue
          );
        }
        if (cell?.ps) drawSpreadsheetCommentMarker(context, cellInfo);
      },
    }),
    [conditionalStylesBySheet]
  );
  const conditionalFormatKey = content.sheets
    .map((sheet) => `${sheet.id}:${JSON.stringify(sheet.luckysheet_conditionformat_save ?? [])}`)
    .join('|');
  const protectionKey = spreadsheetProtectionKey(content.sheets);
  const printSettingCount = spreadsheetPrintSettingCount(content);
  const formulaCount = useMemo(() => spreadsheetFormulaCount(materializedContent), [materializedContent]);
  const formulaInitializationKey = useMemo(
    () => spreadsheetFormulaInitializationKey(materializedContent),
    [materializedContent]
  );
  const pivotCount = useMemo(() => spreadsheetPivotCount(materializedContent), [materializedContent]);
  const renderedWorkbookSheets = useMemo(
    () => spreadsheetSheetsWithFiniteSelections(spreadsheetSheetsWithChartPreviews(materializedContent)),
    [materializedContent]
  );
  const workbookSheets = useMemo(() => spreadsheetSheetsForFortune(renderedWorkbookSheets), [renderedWorkbookSheets]);
  const displayedWorkbookSheets = useMemo(
    () =>
      preview
        ? workbookSheets.map((sheet) => ({
            ...sheet,
            zoomRatio: previewZoom / 100,
          }))
        : workbookSheets,
    [preview, previewZoom, workbookSheets]
  );
  const workbookSheetsRef = useRef(workbookSheets);
  workbookSheetsRef.current = displayedWorkbookSheets;
  useEffect(() => {
    if (!formulaInitializationKey) return;
    const timeout = window.setTimeout(() => workbookRef.current?.calculateFormula(), 0);
    return () => window.clearTimeout(timeout);
  }, [formulaInitializationKey]);
  const handleWorkbookChange = useCallback((sheets: WorkSpreadsheetContent['sheets']) => {
    if (previewRef.current || sameSpreadsheetWorkbookState(sheets, workbookSheetsRef.current)) return;
    const withCharts = reconcileSpreadsheetChartPreviews(contentRef.current, sheets);
    const next = reconcileSpreadsheetPivots(contentRef.current, withCharts.sheets);
    contentRef.current = next;
    onChangeRef.current(next);
  }, []);
  const chartPreviewKey = workbookSheets
    .flatMap((sheet) =>
      (sheet.images ?? [])
        .filter((image) => image.id.startsWith('work-chart-preview-'))
        .map((image) => `${image.id}:${image.src}:${image.left}:${image.top}:${image.width}:${image.height}`)
    )
    .join('|');
  const panelSheetId = selectionState?.sheetId ?? activeSheetIdRef.current ?? activeSheetId;
  const activeSheet = materializedContent.sheets.find((sheet) => sheet.id === activeSheetId);
  const activeSheetIndex = Math.max(
    0,
    materializedContent.sheets.findIndex((sheet) => sheet.id === activeSheetId)
  );
  const zoom = Math.round((activeSheet?.zoomRatio ?? 1) * 100);
  useEffect(() => {
    if (preview) setPreviewZoom(zoom);
  }, [preview, zoom]);
  const gridLinesVisible = activeSheet?.showGridLines !== false && activeSheet?.showGridLines !== 0;
  const updateActiveSheet = (
    update: (sheet: WorkSpreadsheetContent['sheets'][number]) => WorkSpreadsheetContent['sheets'][number]
  ) => {
    if (!activeSheetId) return;
    const next = {
      ...contentRef.current,
      sheets: contentRef.current.sheets.map((sheet) => (sheet.id === activeSheetId ? update(sheet) : sheet)),
    };
    contentRef.current = next;
    onChange(next);
  };
  const recalculate = (scope: 'workbook' | 'selection'): boolean => {
    const workbook = workbookRef.current;
    if (!workbook) return false;
    if (scope === 'workbook') {
      workbook.calculateFormula();
      return true;
    }
    if (!selectionState) return false;
    if (selectionState.selection.row.length < 2 || selectionState.selection.column.length < 2) return false;
    const rowStart = Math.min(selectionState.selection.row[0], selectionState.selection.row[1]);
    const rowEnd = Math.max(selectionState.selection.row[0], selectionState.selection.row[1]);
    const columnStart = Math.min(selectionState.selection.column[0], selectionState.selection.column[1]);
    const columnEnd = Math.max(selectionState.selection.column[0], selectionState.selection.column[1]);
    workbook.calculateFormula(selectionState.sheetId, {
      row: [rowStart, rowEnd],
      column: [columnStart, columnEnd],
    });
    return true;
  };
  const toolbarSheetId = selectionState?.sheetId ?? activeSheetId;
  const toolbarSheet = workbookSheets.find((sheet) => sheet.id === toolbarSheetId);
  const toolbarSelection = finiteSpreadsheetSelection(
    selectionState?.selection ?? toolbarSheet?.luckysheet_select_save?.at(-1)
  );
  const toolbarCell = spreadsheetCellAt(
    toolbarSheet,
    toolbarSelection.row_focus ?? toolbarSelection.row[0],
    toolbarSelection.column_focus ?? toolbarSelection.column[0]
  );
  const selectedRange = spreadsheetSingleRange(toolbarSelection);
  const multipleCellsSelected =
    selectedRange.row[0] !== selectedRange.row[1] || selectedRange.column[0] !== selectedRange.column[1];
  const applyCellFormat = (attribute: keyof Cell, value: unknown) => {
    const workbook = workbookRef.current;
    if (!workbook || !toolbarSheetId) return;
    const liveSelection = workbook.getSelection()?.at(-1);
    workbook.setCellFormatByRange(
      attribute,
      value,
      liveSelection ? spreadsheetSingleRange(liveSelection) : selectedRange,
      { id: toolbarSheetId }
    );
  };
  const handleHistoryShortcut = (event: React.KeyboardEvent<HTMLElement>) => {
    if (
      preview ||
      event.defaultPrevented ||
      event.repeat ||
      event.altKey ||
      isOfficeShortcutBlocked(event.target) ||
      isSpreadsheetNativeTextUndoTarget(event.target) ||
      !(event.metaKey || event.ctrlKey)
    ) {
      return;
    }
    const key = event.key.toLocaleLowerCase();
    const handled =
      key === 'z'
        ? event.shiftKey
          ? history.redo()
          : history.undo()
        : key === 'y' && !event.shiftKey && history.redo();
    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const handleSpreadsheetShortcut = (event: React.KeyboardEvent<HTMLElement>) => {
    const formulaBar = spreadsheetFormulaBarSelectAllTarget(event);
    if (formulaBar) {
      event.preventDefault();
      event.stopPropagation();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(formulaBar);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    handleHistoryShortcut(event);
  };
  return (
    <section
      className={`work-spreadsheet-editor ${preview ? 'preview' : ''}`}
      aria-label='表格工作区'
      onKeyDownCapture={handleSpreadsheetShortcut}
    >
      {preview &&
        (fileActions?.length ? (
          <WorkOfficePreviewBar
            ariaLabel='表格预览工具'
            label='只读预览'
            detail={`${content.sheets.length} 个工作表`}
            fileActions={fileActions}
            className='work-spreadsheet-ribbon'
          />
        ) : (
          <div className='work-preview-notice'>只读预览 · {content.sheets.length} 个工作表</div>
        ))}
      {!preview && (
        <WorkOfficeRibbon
          ariaLabel='表格功能区'
          tabs={spreadsheetRibbonTabs}
          defaultTab='home'
          activeTab={ribbonTab}
          onTabChange={(tab) => {
            setRibbonTab(tab);
            setPanel(null);
          }}
          fileActions={fileActions}
          className='work-spreadsheet-ribbon'
          toolbarClassName='work-spreadsheet-ribbon-toolbar'
          panels={{
            home: (
              <>
                <WorkOfficeRibbonGroup label='撤销与恢复'>
                  <WorkOfficeRibbonButton
                    label='撤销'
                    title='撤销（Cmd/Ctrl+Z）'
                    aria-keyshortcuts='Control+Z Meta+Z'
                    disabled={!history.canUndo}
                    onClick={history.undo}
                  >
                    <Undo2 size={19} />
                  </WorkOfficeRibbonButton>
                  <WorkOfficeRibbonButton
                    label='重做'
                    title='重做（Cmd/Ctrl+Shift+Z）'
                    aria-keyshortcuts='Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y'
                    disabled={!history.canRedo}
                    onClick={history.redo}
                  >
                    <Redo2 size={19} />
                  </WorkOfficeRibbonButton>
                </WorkOfficeRibbonGroup>
                <WorkOfficeRibbonGroup label='字体'>
                  <OfficeSelect
                    ariaLabel='字号'
                    value={String(toolbarCell?.fs ?? 10)}
                    options={spreadsheetFontSizeOptions(toolbarCell?.fs)}
                    onValueChange={(value) => applyCellFormat('fs', Number(value))}
                  />
                  <WorkOfficeRibbonButton
                    label='加粗'
                    title='加粗（Cmd/Ctrl+B）'
                    displayLabel={false}
                    active={Number(toolbarCell?.bl) === 1}
                    onClick={() => applyCellFormat('bl', Number(toolbarCell?.bl) === 1 ? 0 : 1)}
                  >
                    <Bold size={15} />
                  </WorkOfficeRibbonButton>
                  <WorkOfficeRibbonButton
                    label='斜体'
                    title='斜体（Cmd/Ctrl+I）'
                    displayLabel={false}
                    active={Number(toolbarCell?.it) === 1}
                    onClick={() => applyCellFormat('it', Number(toolbarCell?.it) === 1 ? 0 : 1)}
                  >
                    <Italic size={15} />
                  </WorkOfficeRibbonButton>
                  <WorkOfficeRibbonButton
                    label='下划线'
                    title='下划线（Cmd/Ctrl+U）'
                    displayLabel={false}
                    active={Number(toolbarCell?.un) === 1}
                    onClick={() => applyCellFormat('un', Number(toolbarCell?.un) === 1 ? 0 : 1)}
                  >
                    <Underline size={15} />
                  </WorkOfficeRibbonButton>
                  <OfficeColorPicker
                    compact
                    className='work-color-tool'
                    ariaLabel='文字颜色'
                    value={typeof toolbarCell?.fc === 'string' ? toolbarCell.fc : '#172033'}
                    onValueChange={(value) => applyCellFormat('fc', value)}
                  />
                  <OfficeColorPicker
                    compact
                    className='work-color-tool work-spreadsheet-fill-color'
                    ariaLabel='填充颜色'
                    value={typeof toolbarCell?.bg === 'string' ? toolbarCell.bg : '#ffffff'}
                    onValueChange={(value) => applyCellFormat('bg', value)}
                  />
                </WorkOfficeRibbonGroup>
                <WorkOfficeRibbonGroup label='对齐'>
                  <WorkOfficeRibbonButton
                    label='左对齐'
                    displayLabel={false}
                    active={String(toolbarCell?.ht ?? '1') === '1'}
                    onClick={() => applyCellFormat('ht', '1')}
                  >
                    <AlignLeft size={15} />
                  </WorkOfficeRibbonButton>
                  <WorkOfficeRibbonButton
                    label='居中'
                    displayLabel={false}
                    active={String(toolbarCell?.ht) === '0'}
                    onClick={() => applyCellFormat('ht', '0')}
                  >
                    <AlignCenter size={15} />
                  </WorkOfficeRibbonButton>
                  <WorkOfficeRibbonButton
                    label='右对齐'
                    displayLabel={false}
                    active={String(toolbarCell?.ht) === '2'}
                    onClick={() => applyCellFormat('ht', '2')}
                  >
                    <AlignRight size={15} />
                  </WorkOfficeRibbonButton>
                </WorkOfficeRibbonGroup>
                <WorkOfficeRibbonGroup label='单元格'>
                  <WorkOfficeRibbonButton
                    label={toolbarCell?.mc ? '取消合并' : '合并单元格'}
                    disabled={!toolbarCell?.mc && !multipleCellsSelected}
                    onClick={() => {
                      const workbook = workbookRef.current;
                      if (!workbook || !toolbarSheetId) return;
                      const range = workbook.getSelection()?.at(-1) ?? selectedRange;
                      if (toolbarCell?.mc)
                        workbook.cancelMerge([spreadsheetSingleRange(range)], {
                          id: toolbarSheetId,
                        });
                      else workbook.mergeCells([spreadsheetSingleRange(range)], 'merge-all', { id: toolbarSheetId });
                    }}
                  >
                    <Merge size={19} />
                  </WorkOfficeRibbonButton>
                </WorkOfficeRibbonGroup>
              </>
            ),
            insert: (
              <>
                <WorkOfficeRibbonGroup label='图表'>
                  <SpreadsheetRibbonTool
                    label='插入图表'
                    count={spreadsheetChartCount(content)}
                    icon={<BarChart3 size={19} />}
                    active={panel === 'charts'}
                    onClick={() => setPanel((value) => (value === 'charts' ? null : 'charts'))}
                  />
                </WorkOfficeRibbonGroup>
                <WorkOfficeRibbonGroup label='样式'>
                  <SpreadsheetRibbonTool
                    label='条件格式'
                    count={managedConditionalFormatCount(content)}
                    icon={<Palette size={19} />}
                    active={panel === 'conditional-formatting'}
                    onClick={() =>
                      setPanel((value) => (value === 'conditional-formatting' ? null : 'conditional-formatting'))
                    }
                  />
                </WorkOfficeRibbonGroup>
              </>
            ),
            pageLayout: (
              <WorkOfficeRibbonGroup label='页面设置'>
                <SpreadsheetRibbonTool
                  label='打印设置'
                  count={printSettingCount}
                  icon={<Printer size={19} />}
                  active={panel === 'print-area'}
                  onClick={() => setPanel((value) => (value === 'print-area' ? null : 'print-area'))}
                />
              </WorkOfficeRibbonGroup>
            ),
            formulas: (
              <>
                <WorkOfficeRibbonGroup label='定义的名称'>
                  <SpreadsheetRibbonTool
                    label='名称管理器'
                    count={content.namedRanges?.length ?? 0}
                    icon={<Bookmark size={19} />}
                    active={panel === 'names'}
                    onClick={() => setPanel((value) => (value === 'names' ? null : 'names'))}
                  />
                </WorkOfficeRibbonGroup>
                <WorkOfficeRibbonGroup label='计算'>
                  <SpreadsheetRibbonTool
                    label='公式与计算'
                    count={formulaCount}
                    icon={<Calculator size={19} />}
                    active={panel === 'formulas'}
                    onClick={() => setPanel((value) => (value === 'formulas' ? null : 'formulas'))}
                  />
                </WorkOfficeRibbonGroup>
              </>
            ),
            data: (
              <WorkOfficeRibbonGroup label='分析'>
                <SpreadsheetRibbonTool
                  label='数据透视表'
                  count={pivotCount}
                  icon={<TableProperties size={19} />}
                  active={panel === 'pivots'}
                  onClick={() => setPanel((value) => (value === 'pivots' ? null : 'pivots'))}
                />
              </WorkOfficeRibbonGroup>
            ),
            review: (
              <WorkOfficeRibbonGroup label='保护'>
                <SpreadsheetRibbonTool
                  label='工作表保护'
                  count={protectedSheetCount(content.sheets)}
                  icon={<ShieldCheck size={19} />}
                  active={panel === 'protection'}
                  onClick={() => setPanel((value) => (value === 'protection' ? null : 'protection'))}
                />
              </WorkOfficeRibbonGroup>
            ),
            view: (
              <WorkOfficeRibbonGroup label='工作簿视图'>
                <WorkOfficeRibbonButton
                  label={gridLinesVisible ? '隐藏网格线' : '显示网格线'}
                  visibleLabel='网格线'
                  active={gridLinesVisible}
                  onClick={() =>
                    updateActiveSheet((sheet) => ({
                      ...sheet,
                      showGridLines: !gridLinesVisible,
                    }))
                  }
                >
                  <Grid3X3 size={19} />
                </WorkOfficeRibbonButton>
              </WorkOfficeRibbonGroup>
            ),
          }}
        />
      )}
      {!preview && panel && (
        <SpreadsheetWorkbookPanel
          content={materializedContent}
          view={panel}
          activeSheetId={panelSheetId}
          selection={selectionState?.sheetId === panelSheetId ? selectionState.selection : undefined}
          onChange={onChange}
          onRecalculate={recalculate}
          onClose={() => setPanel(null)}
        />
      )}
      <div
        className='work-spreadsheet-canvas'
        onContextMenuCapture={(event) => {
          if (preview || !onAgentRequest) return;
          const sheetId = selectionState?.sheetId ?? activeSheetIdRef.current;
          const sheet = content.sheets.find((candidate) => candidate.id === sheetId);
          const selection = selectionState?.selection ?? sheet?.luckysheet_select_save?.at(-1);
          if (!selection) return;
          const agentSelection = spreadsheetAgentSelection(content, sheetId, selection);
          if (!agentSelection) return;
          event.preventDefault();
          event.stopPropagation();
          setAgentMenu({
            x: event.clientX,
            y: event.clientY,
            selection: agentSelection,
          });
        }}
      >
        <Workbook
          ref={workbookRef}
          key={`spreadsheet:${conditionalFormatKey}:${protectionKey}:${chartPreviewKey}`}
          data={displayedWorkbookSheets}
          lang='zh'
          allowEdit={!preview}
          showToolbar={false}
          showFormulaBar
          showSheetTabs
          row={60}
          column={26}
          defaultRowHeight={24}
          defaultColWidth={96}
          hooks={workbookHooks}
          onChange={handleWorkbookChange}
        />
      </div>
      <WorkOfficeStatusBar
        className='work-spreadsheet-status'
        controls={
          <>
            <button type='button' aria-label='普通表格视图' title='普通表格视图' aria-pressed='true'>
              <Grid3X3 size={13} />
            </button>
            <span className='work-office-status-divider' />
            <WorkOfficeZoomControls
              zoom={preview ? previewZoom : zoom}
              decreaseLabel='缩小表格'
              increaseLabel='放大表格'
              outputLabel='表格缩放比例'
              sliderLabel='表格缩放'
              onChange={(nextZoom) => {
                if (preview) setPreviewZoom(nextZoom);
                else
                  updateActiveSheet((sheet) => ({
                    ...sheet,
                    zoomRatio: nextZoom / 100,
                  }));
              }}
            />
          </>
        }
      >
        <output aria-label='工作表状态'>
          工作表 {activeSheetIndex + 1} / {materializedContent.sheets.length} · {activeSheet?.name ?? '未命名'}
        </output>
        <output aria-label='表格选区状态'>
          {selectionState ? spreadsheetSelectionReference(selectionState.selection) : '未选择单元格'}
        </output>
        {!preview && (
          <output aria-label='表格保存状态' className='work-office-save-status'>
            <Cloud size={12} />
            {saveStatus}
          </output>
        )}
      </WorkOfficeStatusBar>
      {agentMenu && onAgentRequest && (
        <WorkspaceContextMenu
          label={`表格选区 ${agentMenu.selection.reference} AI 操作`}
          x={agentMenu.x}
          y={agentMenu.y}
          items={spreadsheetAgentMenuItems(agentMenu.selection, onAgentRequest, (changes) => {
            const outcome = applySpreadsheetAgentProposalChanges(
              contentRef.current,
              agentMenu.selection.sheetId,
              changes
            );
            if (outcome.result.appliedTargetIds.length) onChange(outcome.content);
            return outcome.result;
          })}
          onClose={() => setAgentMenu(null)}
        />
      )}
    </section>
  );
}

function SpreadsheetRibbonTool({
  label,
  count,
  icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <WorkOfficeRibbonButton
      label={`${label}（${count}）`}
      visibleLabel={label}
      badge={count}
      active={active}
      onClick={onClick}
    >
      {icon}
    </WorkOfficeRibbonButton>
  );
}

function spreadsheetSelectionReference(selection: Selection): string {
  const rowStart = Math.min(selection.row[0] ?? 0, selection.row[1] ?? selection.row[0] ?? 0);
  const rowEnd = Math.max(selection.row[0] ?? 0, selection.row[1] ?? selection.row[0] ?? 0);
  const columnStart = Math.min(selection.column[0] ?? 0, selection.column[1] ?? selection.column[0] ?? 0);
  const columnEnd = Math.max(selection.column[0] ?? 0, selection.column[1] ?? selection.column[0] ?? 0);
  const start = `${spreadsheetColumnLabel(columnStart)}${rowStart + 1}`;
  const end = `${spreadsheetColumnLabel(columnEnd)}${rowEnd + 1}`;
  return start === end ? start : `${start}:${end}`;
}

function spreadsheetSingleRange(selection: Pick<Selection, 'row' | 'column'>): {
  row: number[];
  column: number[];
} {
  return {
    row: finiteSpreadsheetSelectionAxis(selection.row),
    column: finiteSpreadsheetSelectionAxis(selection.column),
  };
}

function spreadsheetCellAt(
  sheet: WorkSpreadsheetContent['sheets'][number] | undefined,
  row: number | undefined,
  column: number | undefined
): Cell | null {
  if (!sheet) return null;
  const safeRow = finiteSpreadsheetIndex(row, 0);
  const safeColumn = finiteSpreadsheetIndex(column, 0);
  return (
    sheet.data?.[safeRow]?.[safeColumn] ??
    sheet.celldata?.find((entry) => entry.r === safeRow && entry.c === safeColumn)?.v ??
    null
  );
}

function spreadsheetFontSizeOptions(current: number | undefined): { value: string; label: string }[] {
  const values: number[] = [...spreadsheetFontSizes];
  if (current && !values.includes(current)) values.push(current);
  return values.sort((left, right) => left - right).map((value) => ({ value: String(value), label: String(value) }));
}

function spreadsheetColumnLabel(column: number): string {
  let value = Math.max(0, column) + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function spreadsheetSheetsWithFiniteSelections(
  sheets: WorkSpreadsheetContent['sheets']
): WorkSpreadsheetContent['sheets'] {
  return sheets.map((sheet) => ({
    ...sheet,
    luckysheet_select_save: (sheet.luckysheet_select_save?.length ? sheet.luckysheet_select_save : [undefined]).map(
      finiteSpreadsheetSelection
    ),
  }));
}

function spreadsheetSheetsForFortune(sheets: WorkSpreadsheetContent['sheets']): WorkSpreadsheetContent['sheets'] {
  return structuredClone(sheets).map((sheet) => {
    for (const merge of Object.values(sheet.config?.merge ?? {})) {
      for (let rowIndex = merge.r; rowIndex < merge.r + merge.rs; rowIndex += 1) {
        const row = sheet.data?.[rowIndex];
        if (!row) continue;
        for (let columnIndex = merge.c; columnIndex < merge.c + merge.cs; columnIndex += 1) {
          row[columnIndex] = {
            ...(row[columnIndex] ?? {}),
            mc: rowIndex === merge.r && columnIndex === merge.c ? { ...merge } : { r: merge.r, c: merge.c },
          };
        }
      }
    }
    return {
      ...sheet,
      celldata: sheet.data
        ? sheet.data.flatMap((row, rowIndex) =>
            row.flatMap((cell, columnIndex) => (cell == null ? [] : [{ r: rowIndex, c: columnIndex, v: cell }]))
          )
        : (sheet.celldata ?? []),
    };
  });
}

function spreadsheetFormulaInitializationKey(content: WorkSpreadsheetContent): string {
  return content.sheets
    .flatMap((sheet) =>
      (sheet.data ?? []).flatMap((row, rowIndex) =>
        row.flatMap((cell, columnIndex) =>
          cell?.f ? [`${sheet.id ?? sheet.name}:${rowIndex}:${columnIndex}:${cell.f}`] : []
        )
      )
    )
    .join('|');
}

function finiteSpreadsheetSelection(selection: Selection | undefined): Selection {
  const row = finiteSpreadsheetSelectionAxis(selection?.row);
  const column = finiteSpreadsheetSelectionAxis(selection?.column);
  const normalized: Selection = {
    ...selection,
    row,
    column,
    row_focus: finiteSpreadsheetFocus(selection?.row_focus, row),
    column_focus: finiteSpreadsheetFocus(selection?.column_focus, column),
  };
  return normalized;
}

function finiteSpreadsheetSelectionAxis(axis: number[] | undefined): number[] {
  const first = finiteSpreadsheetIndex(axis?.[0], 0);
  const second = finiteSpreadsheetIndex(axis?.[1], first);
  return [Math.min(first, second), Math.max(first, second)];
}

function finiteSpreadsheetFocus(value: unknown, axis: number[]): number {
  const focus = finiteSpreadsheetIndex(value, axis[0] ?? 0);
  return Math.min(axis[1] ?? focus, Math.max(axis[0] ?? focus, focus));
}

function finiteSpreadsheetIndex(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

function sameSpreadsheetWorkbookState(
  changed: WorkSpreadsheetContent['sheets'],
  rendered: WorkSpreadsheetContent['sheets']
): boolean {
  return (
    JSON.stringify(changed.map(spreadsheetSheetWithoutTransientSelection)) ===
    JSON.stringify(rendered.map(spreadsheetSheetWithoutTransientSelection))
  );
}

function spreadsheetSheetWithoutTransientSelection(sheet: WorkSpreadsheetContent['sheets'][number]) {
  const {
    celldata: _cellData,
    luckysheet_select_save: _selection,
    luckysheet_selection_range: _range,
    ...content
  } = sheet;
  return content;
}

function isSpreadsheetNativeTextUndoTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('.fortune-container')) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
}

function spreadsheetFormulaBarSelectAllTarget(event: React.KeyboardEvent<HTMLElement>): HTMLElement | null {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.altKey ||
    event.shiftKey ||
    !(event.metaKey || event.ctrlKey) ||
    event.key.toLocaleLowerCase() !== 'a' ||
    !(event.target instanceof Element)
  ) {
    return null;
  }
  const formulaBar = event.target.closest('.fortune-fx-input');
  return formulaBar instanceof HTMLElement ? formulaBar : null;
}
