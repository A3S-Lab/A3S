import type { Selection } from '@fortune-sheet/core';
import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, CollectionState, IconButton, InlineNotice } from '../../../design-system/primitives';
import { isValidSpreadsheetDefinedName } from '../work-spreadsheet-ranges';
import { createWorkId } from '../work-templates';
import type { WorkSpreadsheetContent, WorkSpreadsheetNamedRange } from '../work-types';
import { OfficeSelect, OfficeTextField } from './office-controls';
import { SpreadsheetChartPanel } from './spreadsheet-chart-panel';
import { SpreadsheetConditionalFormatPanel } from './spreadsheet-conditional-format-panel';
import { SpreadsheetFormulaPanel } from './spreadsheet-formula-panel';
import { SpreadsheetPivotPanel } from './spreadsheet-pivot-panel';
import { SpreadsheetPrintSettingsPanel } from './spreadsheet-print-settings-panel';
import { SpreadsheetProtectionPanel } from './spreadsheet-protection-panel';

export type SpreadsheetWorkbookPanelView =
  | 'names'
  | 'print-area'
  | 'conditional-formatting'
  | 'protection'
  | 'charts'
  | 'formulas'
  | 'pivots';

interface SpreadsheetWorkbookPanelProps {
  content: WorkSpreadsheetContent;
  view: SpreadsheetWorkbookPanelView;
  activeSheetId: string;
  selection?: Selection;
  onChange: (content: WorkSpreadsheetContent) => void;
  onRecalculate: (scope: 'workbook' | 'selection') => boolean;
  onClose: () => void;
}

export function SpreadsheetWorkbookPanel({
  content,
  view,
  activeSheetId,
  selection,
  onChange,
  onRecalculate,
  onClose,
}: SpreadsheetWorkbookPanelProps) {
  const title = panelTitle(view);
  return (
    <section className='work-spreadsheet-workbook-panel' aria-label={title.label}>
      <header>
        <div>
          <strong>{title.heading}</strong>
          <span>{title.description}</span>
        </div>
        <IconButton label='关闭工作簿设置' onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>
      {view === 'names' ? (
        <NamedRangeManager content={content} onChange={onChange} />
      ) : view === 'formulas' ? (
        <SpreadsheetFormulaPanel
          content={content}
          canRecalculateSelection={Boolean(selection)}
          onChange={onChange}
          onRecalculate={onRecalculate}
        />
      ) : view === 'charts' ? (
        <SpreadsheetChartPanel
          content={content}
          activeSheetId={activeSheetId}
          selection={selection}
          onChange={onChange}
        />
      ) : view === 'pivots' ? (
        <SpreadsheetPivotPanel
          content={content}
          activeSheetId={activeSheetId}
          selection={selection}
          onChange={onChange}
        />
      ) : view === 'conditional-formatting' ? (
        <SpreadsheetConditionalFormatPanel content={content} onChange={onChange} />
      ) : view === 'protection' ? (
        <SpreadsheetProtectionPanel content={content} onChange={onChange} />
      ) : (
        <SpreadsheetPrintSettingsPanel content={content} onChange={onChange} />
      )}
    </section>
  );
}

function panelTitle(view: SpreadsheetWorkbookPanelView) {
  if (view === 'names') {
    return {
      label: '名称管理器',
      heading: '名称管理器',
      description: '管理工作簿级和工作表级引用',
    };
  }
  if (view === 'conditional-formatting') {
    return {
      label: '条件格式管理器',
      heading: '条件格式',
      description: '管理完整的单元格比较，以及色阶、数据条和图标集规则',
    };
  }
  if (view === 'formulas') {
    return {
      label: '公式与计算',
      heading: '公式与计算',
      description: '管理工作簿计算策略、显式重算和 XLSX 公式兼容性',
    };
  }
  if (view === 'charts') {
    return {
      label: '图表管理器',
      heading: '工作簿图表',
      description: '从单元格引用创建并编辑可原生往返的柱形图、条形图、折线图、饼图、圆环图、面积图和雷达图',
    };
  }
  if (view === 'pivots') {
    return {
      label: '数据透视表管理器',
      heading: '数据透视表',
      description: '按行、列和值字段汇总工作表数据，并原生往返支持范围内的 XLSX 透视定义与缓存',
    };
  }
  if (view === 'protection') {
    return {
      label: '工作表保护',
      heading: '工作表保护与可编辑区域',
      description: '锁定工作表，同时为输入区域保留明确的编辑权限',
    };
  }
  return {
    label: '打印设置',
    heading: '打印设置',
    description: '管理页面、缩放、边距、页眉页脚、页码、打印范围和分页',
  };
}

interface NamedRangeDraft {
  id?: string;
  name: string;
  reference: string;
  scopeSheetId: string;
  comment: string;
}

function NamedRangeManager({
  content,
  onChange,
}: {
  content: WorkSpreadsheetContent;
  onChange: (content: WorkSpreadsheetContent) => void;
}) {
  const ranges = content.namedRanges ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(ranges[0]?.id ?? null);
  const [draft, setDraft] = useState<NamedRangeDraft>(() => rangeDraft(ranges[0]));
  const [error, setError] = useState('');

  useEffect(() => {
    const selected = ranges.find((range) => range.id === selectedId);
    if (selected) setDraft(rangeDraft(selected));
    else if (selectedId) {
      setSelectedId(ranges[0]?.id ?? null);
      setDraft(rangeDraft(ranges[0]));
    }
  }, [ranges, selectedId]);

  const selectRange = (range: WorkSpreadsheetNamedRange) => {
    setSelectedId(range.id);
    setDraft(rangeDraft(range));
    setError('');
  };
  const startNewRange = () => {
    setSelectedId(null);
    setDraft(rangeDraft());
    setError('');
  };
  const saveRange = () => {
    const name = draft.name.trim();
    const reference = draft.reference.trim().replace(/^=/, '');
    if (!isValidSpreadsheetDefinedName(name)) {
      setError('名称必须以字母、下划线或反斜杠开头，且不能是单元格地址。');
      return;
    }
    if (!reference) {
      setError('请输入引用位置或公式。');
      return;
    }
    const scopeSheetId = draft.scopeSheetId || undefined;
    if (
      ranges.some(
        (range) =>
          range.id !== draft.id &&
          range.name.toLowerCase() === name.toLowerCase() &&
          (range.scopeSheetId ?? '') === (scopeSheetId ?? '')
      )
    ) {
      setError('同一作用域中已经存在这个名称。');
      return;
    }
    const saved: WorkSpreadsheetNamedRange = {
      id: draft.id ?? createWorkId('name'),
      name,
      reference,
      scopeSheetId,
      comment: draft.comment.trim() || undefined,
    };
    const next = draft.id ? ranges.map((range) => (range.id === draft.id ? saved : range)) : [...ranges, saved];
    onChange({ ...content, namedRanges: next });
    setSelectedId(saved.id);
    setDraft(rangeDraft(saved));
    setError('');
  };
  const deleteRange = () => {
    if (!draft.id) {
      startNewRange();
      return;
    }
    const next = ranges.filter((range) => range.id !== draft.id);
    onChange({ ...content, namedRanges: next.length ? next : undefined });
    const selected = next[0];
    setSelectedId(selected?.id ?? null);
    setDraft(rangeDraft(selected));
    setError('');
  };

  return (
    <div className='work-spreadsheet-name-manager'>
      <aside aria-label='已定义名称'>
        <Button className='create' tone='secondary' onClick={startNewRange}>
          <Plus size={13} />
          新建名称
        </Button>
        <div className='work-spreadsheet-name-list'>
          {ranges.map((range) => (
            <button
              type='button'
              className={range.id === selectedId ? 'active' : ''}
              key={range.id}
              onClick={() => selectRange(range)}
            >
              <strong>{range.name}</strong>
              <span>
                {range.scopeSheetId
                  ? (content.sheets.find((sheet) => sheet.id === range.scopeSheetId)?.name ?? '工作表')
                  : '工作簿'}
              </span>
            </button>
          ))}
          {!ranges.length && (
            <CollectionState className='work-office-collection-empty' role='status'>
              还没有定义名称。
            </CollectionState>
          )}
        </div>
      </aside>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          saveRange();
        }}
      >
        <div className='work-office-field'>
          <span>名称</span>
          <OfficeTextField
            aria-label='名称'
            value={draft.name}
            maxLength={255}
            placeholder='例如 Revenue_2026'
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </div>
        <div className='work-office-field'>
          <span>作用域</span>
          <OfficeSelect
            ariaLabel='名称作用域'
            value={draft.scopeSheetId}
            options={[
              { value: '', label: '工作簿' },
              ...content.sheets.flatMap((sheet) => (sheet.id ? [{ value: sheet.id, label: sheet.name }] : [])),
            ]}
            onValueChange={(scopeSheetId) => setDraft({ ...draft, scopeSheetId })}
          />
        </div>
        <div className='work-office-field reference'>
          <span>引用位置</span>
          <OfficeTextField
            aria-label='名称引用位置'
            value={draft.reference}
            placeholder="'工作表1'!$A$1:$B$20"
            onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
          />
        </div>
        <div className='work-office-field comment'>
          <span>备注</span>
          <OfficeTextField
            aria-label='名称备注'
            value={draft.comment}
            maxLength={255}
            placeholder='可选'
            onChange={(event) => setDraft({ ...draft, comment: event.target.value })}
          />
        </div>
        <div className='actions'>
          {error && (
            <InlineNotice className='work-office-form-error' tone='danger' role='alert'>
              {error}
            </InlineNotice>
          )}
          <Button tone='danger' disabled={!draft.id} onClick={deleteRange}>
            <Trash2 size={13} />
            删除
          </Button>
          <Button type='submit' tone='primary'>
            保存名称
          </Button>
        </div>
      </form>
    </div>
  );
}

function rangeDraft(range?: WorkSpreadsheetNamedRange): NamedRangeDraft {
  return {
    id: range?.id,
    name: range?.name ?? '',
    reference: range?.reference ?? '',
    scopeSheetId: range?.scopeSheetId ?? '',
    comment: range?.comment ?? '',
  };
}
