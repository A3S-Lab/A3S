import type { Selection } from '@fortune-sheet/core';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, CollectionState, InlineNotice, StateView } from '../../../design-system/primitives';
import { spreadsheetPivotFilterValueKey } from '../work-spreadsheet-pivot-values';
import {
  createSpreadsheetPivotFromSelection,
  defaultPivotValueCaption,
  deleteSpreadsheetPivotTable,
  refreshSpreadsheetPivotTables,
  spreadsheetPivotAggregationLabel,
  spreadsheetPivotFields,
  spreadsheetPivotFilterItems,
  spreadsheetPivotValidation,
} from '../work-spreadsheet-pivots';
import type {
  WorkSpreadsheetContent,
  WorkSpreadsheetPivotAggregation,
  WorkSpreadsheetPivotFilterValue,
  WorkSpreadsheetPivotTable,
} from '../work-types';
import { OfficeCheckbox, OfficeSelect, OfficeTextField } from './office-controls';

interface SpreadsheetPivotPanelProps {
  content: WorkSpreadsheetContent;
  activeSheetId: string;
  selection?: Selection;
  onChange: (content: WorkSpreadsheetContent) => void;
}

interface PivotListItem {
  ownerSheetId: string;
  ownerSheetName: string;
  pivot: WorkSpreadsheetPivotTable;
}

type PivotDraft = WorkSpreadsheetPivotTable & { ownerSheetId: string };
type PivotFieldRole = 'unused' | 'row' | 'column' | 'filter' | 'value';

const AGGREGATIONS: WorkSpreadsheetPivotAggregation[] = [
  'sum',
  'count',
  'counta',
  'average',
  'max',
  'min',
  'product',
  'stdDev',
  'stdDevP',
  'var',
  'varP',
];

export function SpreadsheetPivotPanel({ content, activeSheetId, selection, onChange }: SpreadsheetPivotPanelProps) {
  const items = useMemo(
    () =>
      content.sheets.flatMap((sheet) =>
        (sheet.pivotTables ?? []).flatMap((pivot) =>
          sheet.id ? [{ ownerSheetId: sheet.id, ownerSheetName: sheet.name, pivot }] : []
        )
      ),
    [content.sheets]
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(() => pivotKey(items[0]));
  const [draft, setDraft] = useState<PivotDraft | null>(() => (items[0] ? pivotDraft(items[0]) : null));
  const [error, setError] = useState('');
  const optimisticPivotKey = useRef<string | null>(null);

  useEffect(() => {
    if (!items.length) {
      if (selectedKey && optimisticPivotKey.current === selectedKey) return;
      setSelectedKey(null);
      setDraft(null);
      return;
    }
    const selected = items.find((item) => pivotKey(item) === selectedKey);
    if (selected) {
      if (optimisticPivotKey.current === selectedKey) optimisticPivotKey.current = null;
      setDraft(pivotDraft(selected));
      return;
    }
    const first = items[0];
    setSelectedKey(pivotKey(first));
    setDraft(pivotDraft(first));
  }, [items, selectedKey]);

  const fields = useMemo(() => (draft ? spreadsheetPivotFields(content, draft) : []), [content, draft]);
  const selectPivot = (item: PivotListItem) => {
    setSelectedKey(pivotKey(item));
    setDraft(pivotDraft(item));
    setError('');
  };
  const addPivot = () => {
    if (!selection) {
      setError('请先在源工作表中选择包含标题和数据的连续区域。');
      return;
    }
    const created = createSpreadsheetPivotFromSelection(content, activeSheetId, selection);
    if (created.error || !created.ownerSheetId || !created.pivotId) {
      setError(created.error ?? '无法创建数据透视表。');
      return;
    }
    onChange(created.content);
    const createdKey = `${created.ownerSheetId}:${created.pivotId}`;
    optimisticPivotKey.current = createdKey;
    setSelectedKey(createdKey);
    const owner = created.content.sheets.find((sheet) => sheet.id === created.ownerSheetId);
    const pivot = owner?.pivotTables?.find((candidate) => candidate.id === created.pivotId);
    setDraft(owner && pivot ? pivotDraft({ ownerSheetId: owner.id!, ownerSheetName: owner.name, pivot }) : null);
    setError('');
  };
  const savePivot = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!/^[\p{L}_][\p{L}\p{N}_.]*$/u.test(name) || name.length > 255) {
      setError('透视表名称必须以字母、文字或下划线开头，且不能包含空格。');
      return;
    }
    if (
      items.some(
        (item) => item.pivot.id !== draft.id && item.pivot.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
      )
    ) {
      setError('工作簿中已经存在同名数据透视表。');
      return;
    }
    const saved: WorkSpreadsheetPivotTable = {
      ...draft,
      name,
      sourceReference: draft.sourceReference.trim().replace(/^=/, ''),
      anchor: draft.anchor.trim().replace(/^=/, ''),
      styleName: draft.styleName || 'PivotStyleLight16',
      rowFields: [...draft.rowFields].sort((left, right) => left - right),
      columnFields: [...draft.columnFields].sort((left, right) => left - right),
      reportFilters: (draft.reportFilters ?? [])
        .map((filter) => ({ ...filter }))
        .sort((left, right) => left.fieldIndex - right.fieldIndex),
      values: draft.values
        .map((value) => ({
          ...value,
          caption:
            value.caption?.trim() ||
            defaultPivotValueCaption(
              fields[value.fieldIndex]?.name ?? `字段 ${value.fieldIndex + 1}`,
              value.aggregation
            ),
        }))
        .sort((left, right) => left.fieldIndex - right.fieldIndex),
    };
    const sheets = content.sheets.map((sheet) =>
      sheet.id === draft.ownerSheetId
        ? {
            ...sheet,
            pivotTables: (sheet.pivotTables ?? []).map((pivot) => (pivot.id === saved.id ? saved : pivot)),
          }
        : sheet
    );
    const candidate = { ...content, sheets };
    const validation = spreadsheetPivotValidation(candidate, draft.ownerSheetId, saved);
    if (!validation.valid) {
      setError(validation.message ?? '当前透视表设置无效。');
      return;
    }
    const refreshed = refreshSpreadsheetPivotTables(candidate);
    onChange(refreshed);
    const refreshedOwner = refreshed.sheets.find((sheet) => sheet.id === draft.ownerSheetId);
    const refreshedPivot = refreshedOwner?.pivotTables?.find((pivot) => pivot.id === saved.id);
    if (refreshedOwner && refreshedPivot) {
      setDraft(
        pivotDraft({ ownerSheetId: refreshedOwner.id!, ownerSheetName: refreshedOwner.name, pivot: refreshedPivot })
      );
    }
    setError('');
  };
  const deletePivot = () => {
    if (!draft) return;
    optimisticPivotKey.current = null;
    const next = deleteSpreadsheetPivotTable(content, draft.ownerSheetId, draft.id);
    onChange(next);
    const remaining = items.find((item) => pivotKey(item) !== `${draft.ownerSheetId}:${draft.id}`);
    setSelectedKey(pivotKey(remaining));
    setDraft(remaining ? pivotDraft(remaining) : null);
    setError('');
  };
  const refreshAll = () => {
    onChange(refreshSpreadsheetPivotTables(content));
    setError('');
  };

  return (
    <div className='work-spreadsheet-pivot-manager'>
      <aside aria-label='工作簿数据透视表'>
        <Button className='create' tone='secondary' onClick={addPivot}>
          <Plus size={13} />
          根据当前选区新建
        </Button>
        <Button className='refresh' tone='secondary' disabled={!items.length} onClick={refreshAll}>
          <RefreshCw size={13} />
          刷新全部
        </Button>
        <div className='work-spreadsheet-pivot-list'>
          {items.map((item) => (
            <button
              type='button'
              className={pivotKey(item) === selectedKey ? 'active' : ''}
              key={pivotKey(item)}
              onClick={() => selectPivot(item)}
            >
              <strong>{item.pivot.name}</strong>
              <span>
                {item.ownerSheetName} · {item.pivot.outputReference ?? item.pivot.anchor}
              </span>
            </button>
          ))}
          {!items.length && (
            <CollectionState className='work-office-collection-empty' role='status'>
              还没有数据透视表。选择带标题的数据区域后创建。
            </CollectionState>
          )}
        </div>
      </aside>
      {draft ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            savePivot();
          }}
        >
          <div className='work-spreadsheet-pivot-fields'>
            <div className='work-office-field'>
              <span>名称</span>
              <OfficeTextField
                aria-label='透视表名称'
                value={draft.name}
                maxLength={255}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>
            <div className='work-office-field'>
              <span>源工作表</span>
              <OfficeSelect
                ariaLabel='透视表源工作表'
                value={draft.sourceSheetId}
                options={content.sheets.flatMap((sheet) => (sheet.id ? [{ value: sheet.id, label: sheet.name }] : []))}
                onValueChange={(sourceSheetId) => setDraft({ ...draft, sourceSheetId })}
              />
            </div>
            <div className='work-office-field'>
              <span>源区域</span>
              <OfficeTextField
                aria-label='透视表源区域'
                value={draft.sourceReference}
                placeholder='A1:D200'
                onChange={(event) => setDraft({ ...draft, sourceReference: event.target.value })}
              />
            </div>
            <div className='work-office-field'>
              <span>输出位置</span>
              <OfficeTextField
                aria-label='透视表输出位置'
                value={draft.anchor}
                placeholder='A1'
                onChange={(event) => setDraft({ ...draft, anchor: event.target.value })}
              />
            </div>
            <div className='work-office-field'>
              <span>样式</span>
              <OfficeSelect
                ariaLabel='透视表样式'
                value={draft.styleName}
                options={[
                  { value: 'PivotStyleLight16', label: '浅色 16' },
                  { value: 'PivotStyleLight18', label: '浅色 18' },
                  { value: 'PivotStyleMedium2', label: '中等 2' },
                  { value: 'PivotStyleMedium9', label: '中等 9' },
                  { value: 'PivotStyleDark3', label: '深色 3' },
                ]}
                onValueChange={(styleName) => setDraft({ ...draft, styleName })}
              />
            </div>
            <OfficeCheckbox
              className='check'
              ariaLabel='在 Excel 中打开时刷新'
              checked={draft.refreshOnLoad}
              onCheckedChange={(refreshOnLoad) => setDraft({ ...draft, refreshOnLoad })}
            >
              在 Excel 中打开时刷新
            </OfficeCheckbox>
            <OfficeCheckbox
              className='check'
              ariaLabel='显示右侧总计列'
              checked={draft.rowGrandTotals}
              onCheckedChange={(rowGrandTotals) => setDraft({ ...draft, rowGrandTotals })}
            >
              显示右侧总计列
            </OfficeCheckbox>
            <OfficeCheckbox
              className='check'
              ariaLabel='显示底部总计行'
              checked={draft.columnGrandTotals}
              onCheckedChange={(columnGrandTotals) => setDraft({ ...draft, columnGrandTotals })}
            >
              显示底部总计行
            </OfficeCheckbox>
          </div>
          <section className='work-spreadsheet-pivot-layout' aria-label='透视表字段布局'>
            <header>
              <strong>字段布局</strong>
              <span>把源字段分配到行、列、筛选或值区域；保存时立即刷新缓存结果。</span>
            </header>
            {fields.length ? (
              <div>
                {fields.map((field) => {
                  const role = pivotFieldRole(draft, field.index);
                  const value = draft.values.find((candidate) => candidate.fieldIndex === field.index);
                  const filter = draft.reportFilters?.find((candidate) => candidate.fieldIndex === field.index);
                  const filterItems = role === 'filter' ? spreadsheetPivotFilterItems(content, draft, field.index) : [];
                  return (
                    <div className='work-spreadsheet-pivot-field-row' key={field.index}>
                      <strong>{field.name}</strong>
                      <span>{field.numeric ? '数值' : '文本/分类'}</span>
                      <OfficeSelect
                        ariaLabel={`${field.name} 字段区域`}
                        value={role}
                        options={[
                          { value: 'unused', label: '未使用' },
                          { value: 'row', label: '行' },
                          { value: 'column', label: '列' },
                          { value: 'filter', label: '筛选' },
                          { value: 'value', label: '值' },
                        ]}
                        onValueChange={(nextRole) =>
                          setDraft(
                            assignPivotFieldRole(
                              draft,
                              field.index,
                              nextRole as PivotFieldRole,
                              field.name,
                              field.numeric
                            )
                          )
                        }
                      />
                      {role === 'value' && value ? (
                        <>
                          <OfficeSelect
                            ariaLabel={`${field.name} 聚合方式`}
                            value={value.aggregation}
                            options={AGGREGATIONS.map((aggregation) => ({
                              value: aggregation,
                              label: spreadsheetPivotAggregationLabel(aggregation),
                            }))}
                            onValueChange={(aggregation) =>
                              setDraft(
                                updatePivotValue(draft, field.index, {
                                  aggregation: aggregation as WorkSpreadsheetPivotAggregation,
                                })
                              )
                            }
                          />
                          <OfficeTextField
                            aria-label={`${field.name} 值标题`}
                            value={value.caption ?? ''}
                            placeholder={defaultPivotValueCaption(field.name, value.aggregation)}
                            onChange={(event) =>
                              setDraft(updatePivotValue(draft, field.index, { caption: event.target.value }))
                            }
                          />
                        </>
                      ) : role === 'filter' && filter ? (
                        <>
                          <OfficeSelect
                            ariaLabel={`${field.name} 筛选值`}
                            value={
                              filter.selectedItem === undefined
                                ? 'all:'
                                : spreadsheetPivotFilterValueKey(filter.selectedItem)
                            }
                            options={[
                              { value: 'all:', label: '（全部）' },
                              ...filterItems.map((item) => ({
                                value: spreadsheetPivotFilterValueKey(item.value),
                                label: item.label,
                              })),
                            ]}
                            onValueChange={(selectedValue) =>
                              setDraft(
                                updatePivotReportFilter(
                                  draft,
                                  field.index,
                                  selectedValue === 'all:'
                                    ? undefined
                                    : filterItems.find(
                                        (item) => spreadsheetPivotFilterValueKey(item.value) === selectedValue
                                      )?.value
                                )
                              )
                            }
                          />
                          <span className='filter-hint'>单选报表筛选</span>
                        </>
                      ) : (
                        <span className='placeholder'>—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>输入有效的源工作表和连续区域后即可配置字段。</p>
            )}
          </section>
          <div className='actions'>
            <Button tone='danger' onClick={deletePivot}>
              <Trash2 size={13} />
              删除
            </Button>
            {error && (
              <InlineNotice className='work-office-form-error' tone='danger' role='alert'>
                {error}
              </InlineNotice>
            )}
            <Button type='submit' tone='primary'>
              保存并刷新
            </Button>
          </div>
        </form>
      ) : (
        <StateView
          className='work-spreadsheet-pivot-empty'
          size='compact'
          title='用当前选区创建数据透视表'
          description='首行将作为字段名，Work 会在新的报告工作表中生成可刷新的汇总结果。'
        >
          {error && (
            <InlineNotice className='work-office-form-error' tone='danger' role='alert'>
              {error}
            </InlineNotice>
          )}
        </StateView>
      )}
    </div>
  );
}

function pivotKey(item: PivotListItem | undefined): string | null {
  return item ? `${item.ownerSheetId}:${item.pivot.id}` : null;
}

function pivotDraft(item: PivotListItem): PivotDraft {
  return {
    ...item.pivot,
    ownerSheetId: item.ownerSheetId,
    rowFields: [...item.pivot.rowFields],
    columnFields: [...item.pivot.columnFields],
    reportFilters: item.pivot.reportFilters?.map((filter) => ({ ...filter })) ?? [],
    values: item.pivot.values.map((value) => ({ ...value })),
  };
}

function pivotFieldRole(draft: PivotDraft, fieldIndex: number): PivotFieldRole {
  if (draft.rowFields.includes(fieldIndex)) return 'row';
  if (draft.columnFields.includes(fieldIndex)) return 'column';
  if (draft.reportFilters?.some((filter) => filter.fieldIndex === fieldIndex)) return 'filter';
  if (draft.values.some((value) => value.fieldIndex === fieldIndex)) return 'value';
  return 'unused';
}

function assignPivotFieldRole(
  draft: PivotDraft,
  fieldIndex: number,
  role: PivotFieldRole,
  fieldName: string,
  numeric: boolean
): PivotDraft {
  const next: PivotDraft = {
    ...draft,
    rowFields: draft.rowFields.filter((index) => index !== fieldIndex),
    columnFields: draft.columnFields.filter((index) => index !== fieldIndex),
    reportFilters: (draft.reportFilters ?? []).filter((filter) => filter.fieldIndex !== fieldIndex),
    values: draft.values.filter((value) => value.fieldIndex !== fieldIndex),
  };
  if (role === 'row') next.rowFields = [...next.rowFields, fieldIndex];
  else if (role === 'column') next.columnFields = [...next.columnFields, fieldIndex];
  else if (role === 'filter') next.reportFilters = [...(next.reportFilters ?? []), { fieldIndex }];
  else if (role === 'value') {
    const aggregation: WorkSpreadsheetPivotAggregation = numeric ? 'sum' : 'counta';
    next.values = [
      ...next.values,
      {
        fieldIndex,
        aggregation,
        caption: defaultPivotValueCaption(fieldName, aggregation),
      },
    ];
  }
  return next;
}

function updatePivotValue(
  draft: PivotDraft,
  fieldIndex: number,
  changes: Partial<WorkSpreadsheetPivotTable['values'][number]>
): PivotDraft {
  return {
    ...draft,
    values: draft.values.map((value) => (value.fieldIndex === fieldIndex ? { ...value, ...changes } : value)),
  };
}

function updatePivotReportFilter(
  draft: PivotDraft,
  fieldIndex: number,
  selectedItem: WorkSpreadsheetPivotFilterValue | undefined
): PivotDraft {
  return {
    ...draft,
    reportFilters: (draft.reportFilters ?? []).map((filter) =>
      filter.fieldIndex === fieldIndex ? { ...filter, selectedItem } : filter
    ),
  };
}
