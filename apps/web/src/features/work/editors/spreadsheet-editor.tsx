import type { Hooks, Selection } from '@fortune-sheet/core';
import { Workbook, type WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import {
  BarChart3,
  Bookmark,
  Calculator,
  Cloud,
  Grid3X3,
  Palette,
  Printer,
  ShieldCheck,
  TableProperties,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceContextMenu } from '../../workspace/components/workspace-context-menu';
import { spreadsheetAgentMenuItems } from '../components/work-editor-agent-menus';
import { applySpreadsheetAgentProposalChanges } from '../work-agent-proposal-apply';
import type { WorkEditorAgentRequest } from '../work-agent-request';
import { spreadsheetAgentSelection, type WorkSpreadsheetAgentSelection } from '../work-spreadsheet-agent-context';
import {
  drawSpreadsheetCommentMarker,
  drawSpreadsheetConditionalDataBar,
} from '../work-spreadsheet-conditional-canvas';
import { drawSpreadsheetConditionalIcon } from '../work-spreadsheet-conditional-icons';
import { spreadsheetConditionalFormatStyles } from '../work-spreadsheet-conditional-format';
import {
  reconcileSpreadsheetChartPreviews,
  spreadsheetChartCount,
  spreadsheetSheetsWithChartPreviews,
} from '../work-spreadsheet-charts';
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
import { managedConditionalFormatCount } from './spreadsheet-conditional-format-panel';
import { spreadsheetPrintSettingCount } from './spreadsheet-print-settings-panel';
import { SpreadsheetWorkbookPanel, type SpreadsheetWorkbookPanelView } from './spreadsheet-workbook-panel';
import {
  WorkOfficeRibbon,
  WorkOfficeRibbonButton,
  WorkOfficeRibbonGroup,
  WorkOfficeStatusBar,
  WorkOfficeZoomControls,
} from './work-office-chrome';

const spreadsheetRibbonTabs = [
  { id: 'home', label: '首页' },
  { id: 'insert', label: '插入' },
  { id: 'formulas', label: '公式' },
  { id: 'data', label: '数据' },
  { id: 'review', label: '审阅' },
  { id: 'view', label: '视图' },
] as const;

type SpreadsheetRibbonTabId = (typeof spreadsheetRibbonTabs)[number]['id'];

interface SpreadsheetEditorProps {
  content: WorkSpreadsheetContent;
  preview: boolean;
  saveStatus?: string;
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
  onChange,
  onAgentRequest,
}: SpreadsheetEditorProps) {
  const materializedContent = useMemo(() => refreshSpreadsheetPivotTables(content), [content]);
  const contentRef = useRef(materializedContent);
  const workbookRef = useRef<WorkbookInstance>(null);
  const [ribbonTab, setRibbonTab] = useState<SpreadsheetRibbonTabId>('home');
  const [panel, setPanel] = useState<SpreadsheetWorkbookPanelView | null>(null);
  const [selectionState, setSelectionState] = useState<SpreadsheetSelectionState | null>(null);
  const [agentMenu, setAgentMenu] = useState<SpreadsheetAgentMenuState | null>(null);
  const activeSheetId =
    content.sheets.find((sheet) => sheet.status === 1)?.id ?? content.sheets.find((sheet) => !sheet.hide)?.id ?? '';
  const activeSheetIdRef = useRef(activeSheetId);
  contentRef.current = materializedContent;
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
  const pivotCount = useMemo(() => spreadsheetPivotCount(materializedContent), [materializedContent]);
  const workbookSheets = useMemo(() => spreadsheetSheetsWithChartPreviews(materializedContent), [materializedContent]);
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
  return (
    <section className={`work-spreadsheet-editor ${preview ? 'preview' : ''}`} aria-label='表格工作区'>
      {preview && <div className='work-preview-notice'>只读预览 · {content.sheets.length} 个工作表</div>}
      {!preview && (
        <WorkOfficeRibbon
          ariaLabel='表格功能区'
          tabs={spreadsheetRibbonTabs}
          defaultTab='home'
          activeTab={ribbonTab}
          onTabChange={setRibbonTab}
          className='work-spreadsheet-ribbon'
          toolbarClassName='work-spreadsheet-ribbon-toolbar'
          panels={{
            home: (
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
            ),
            insert: (
              <WorkOfficeRibbonGroup label='插入'>
                <SpreadsheetRibbonTool
                  label='图表'
                  count={spreadsheetChartCount(content)}
                  icon={<BarChart3 size={19} />}
                  active={panel === 'charts'}
                  onClick={() => setPanel((value) => (value === 'charts' ? null : 'charts'))}
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
              <>
                <WorkOfficeRibbonGroup label='工作簿视图'>
                  <WorkOfficeRibbonButton
                    label={gridLinesVisible ? '隐藏网格线' : '显示网格线'}
                    active={gridLinesVisible}
                    onClick={() => updateActiveSheet((sheet) => ({ ...sheet, showGridLines: !gridLinesVisible }))}
                  >
                    <Grid3X3 size={19} />
                  </WorkOfficeRibbonButton>
                </WorkOfficeRibbonGroup>
                <WorkOfficeRibbonGroup label='打印'>
                  <SpreadsheetRibbonTool
                    label='打印设置'
                    count={printSettingCount}
                    icon={<Printer size={19} />}
                    active={panel === 'print-area'}
                    onClick={() => setPanel((value) => (value === 'print-area' ? null : 'print-area'))}
                  />
                </WorkOfficeRibbonGroup>
              </>
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
          key={`${preview ? 'spreadsheet-preview' : 'spreadsheet-edit'}:${conditionalFormatKey}:${protectionKey}:${chartPreviewKey}`}
          data={workbookSheets}
          lang='zh'
          allowEdit={!preview}
          showToolbar={!preview && ribbonTab === 'home'}
          showFormulaBar
          showSheetTabs
          row={60}
          column={26}
          defaultRowHeight={24}
          defaultColWidth={96}
          hooks={workbookHooks}
          onChange={(sheets) => {
            if (!preview) {
              const withCharts = reconcileSpreadsheetChartPreviews(contentRef.current, sheets);
              onChange(reconcileSpreadsheetPivots(contentRef.current, withCharts.sheets));
            }
          }}
        />
      </div>
      <WorkOfficeStatusBar
        className='work-spreadsheet-status'
        controls={
          !preview ? (
            <>
              <button type='button' aria-label='普通表格视图' title='普通表格视图' aria-pressed='true'>
                <Grid3X3 size={13} />
              </button>
              <span className='work-office-status-divider' />
              <WorkOfficeZoomControls
                zoom={zoom}
                decreaseLabel='缩小表格'
                increaseLabel='放大表格'
                outputLabel='表格缩放比例'
                sliderLabel='表格缩放'
                onChange={(nextZoom) => updateActiveSheet((sheet) => ({ ...sheet, zoomRatio: nextZoom / 100 }))}
              />
            </>
          ) : undefined
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
