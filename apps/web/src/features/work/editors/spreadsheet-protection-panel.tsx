import type { Sheet } from '@fortune-sheet/core';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, CollectionState, InlineNotice, StateView } from '../../../design-system/primitives';
import {
  editableRangeCellCount,
  editableRangeRequiresCredentials,
  sheetProtectionAuthority,
  unlockedCellCount,
  withEditableRange,
  withoutEditableRange,
  withSheetProtection,
  withSheetSelectionPermissions,
} from '../work-spreadsheet-protection';
import { formatSpreadsheetCellRanges, parseSpreadsheetCellRanges } from '../work-spreadsheet-ranges';
import type { WorkSpreadsheetContent } from '../work-types';
import { OfficeCheckbox, OfficeSelect, OfficeTextField } from './office-controls';

interface SpreadsheetProtectionPanelProps {
  content: WorkSpreadsheetContent;
  onChange: (content: WorkSpreadsheetContent) => void;
}

interface EditableRangeDraft {
  name: string;
  reference: string;
}

const MAX_EDITABLE_RANGE_CELLS = 100_000;

export function SpreadsheetProtectionPanel({ content, onChange }: SpreadsheetProtectionPanelProps) {
  const sheets = content.sheets.filter((sheet): sheet is Sheet & { id: string } => Boolean(sheet.id));
  const initialSheetId = sheets.find((sheet) => sheet.status === 1)?.id ?? sheets[0]?.id ?? '';
  const [sheetId, setSheetId] = useState(initialSheetId);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditableRangeDraft>(newRangeDraft());
  const [error, setError] = useState('');
  const sheet = sheets.find((item) => item.id === sheetId) ?? sheets[0];
  const authority = sheet ? sheetProtectionAuthority(sheet) : null;
  const ranges = authority?.allowRangeList ?? [];

  useEffect(() => {
    if (sheet && sheet.id !== sheetId) setSheetId(sheet.id);
  }, [sheet?.id, sheetId]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const range = ranges[selectedIndex];
    if (range) {
      setDraft({ name: range.name, reference: range.sqref });
      return;
    }
    setSelectedIndex(null);
    setDraft(newRangeDraft());
  }, [content.sheets, sheetId, selectedIndex]);

  if (!sheet || !authority) {
    return (
      <StateView
        className='work-office-panel-empty work-spreadsheet-protection-empty'
        size='compact'
        title='当前工作簿没有可保护的工作表'
      />
    );
  }

  const updateSheet = (nextSheet: Sheet) => {
    onChange({
      ...content,
      sheets: content.sheets.map((item) => (item.id === nextSheet.id ? nextSheet : item)),
    });
  };
  const changeSheet = (nextSheetId: string) => {
    setSheetId(nextSheetId);
    setSelectedIndex(null);
    setDraft(newRangeDraft());
    setError('');
  };
  const selectRange = (index: number) => {
    const range = ranges[index];
    if (!range) return;
    setSelectedIndex(index);
    setDraft({ name: range.name, reference: range.sqref });
    setError('');
  };
  const startNew = () => {
    setSelectedIndex(null);
    setDraft(newRangeDraft());
    setError('');
  };
  const saveRange = () => {
    const name = draft.name.trim();
    const parsed = parseSpreadsheetCellRanges(draft.reference);
    if (!name) {
      setError('请输入可编辑区域名称。');
      return;
    }
    if (!parsed) {
      setError('请输入有效的单元格范围，例如 B2:B20 或 B2:B20,D2:D20。');
      return;
    }
    if (
      ranges.some((range, index) => index !== selectedIndex && range.name.trim().toLowerCase() === name.toLowerCase())
    ) {
      setError('当前工作表中已经存在这个区域名称。');
      return;
    }
    if (editableRangeCellCount(parsed) > MAX_EDITABLE_RANGE_CELLS) {
      setError('一次最多可设置 100,000 个可编辑单元格。');
      return;
    }
    const maximumRow = Math.max(1, sheet.row ?? sheet.data?.length ?? 1) - 1;
    const maximumColumn = Math.max(1, sheet.column ?? Math.max(0, ...(sheet.data ?? []).map((row) => row.length))) - 1;
    if (parsed.some((range) => range.row[1] > maximumRow || range.column[1] > maximumColumn)) {
      setError(`范围必须位于当前工作表的 ${maximumRow + 1} 行 × ${maximumColumn + 1} 列以内。`);
      return;
    }
    const index = selectedIndex ?? ranges.length;
    updateSheet(
      withEditableRange(sheet, selectedIndex, {
        name,
        sqref: formatSpreadsheetCellRanges(parsed),
      })
    );
    setSelectedIndex(index);
    setDraft({ name, reference: formatSpreadsheetCellRanges(parsed) });
    setError('');
  };
  const deleteRange = () => {
    if (selectedIndex === null) return;
    updateSheet(withoutEditableRange(sheet, selectedIndex));
    setSelectedIndex(null);
    setDraft(newRangeDraft());
    setError('');
  };
  const setSelectLocked = (checked: boolean) => {
    updateSheet(
      withSheetSelectionPermissions(sheet, {
        selectLockedCells: checked,
        selectUnlockedCells: checked ? true : authority.selectunLockedCells === 1,
      })
    );
  };
  const setSelectUnlocked = (checked: boolean) => {
    updateSheet(
      withSheetSelectionPermissions(sheet, {
        selectLockedCells: checked ? authority.selectLockedCells === 1 : false,
        selectUnlockedCells: checked,
      })
    );
  };
  const selectedRange = selectedIndex === null ? null : ranges[selectedIndex];

  return (
    <div className='work-spreadsheet-protection-manager'>
      <aside aria-label='允许编辑的区域'>
        <Button className='create' tone='secondary' onClick={startNew}>
          <Plus size={13} />
          新建可编辑区域
        </Button>
        <div className='work-spreadsheet-protection-list'>
          {ranges.map((range, index) => (
            <button
              type='button'
              className={selectedIndex === index ? 'active' : ''}
              key={`${range.name}-${index}`}
              onClick={() => selectRange(index)}
            >
              <strong>{range.name}</strong>
              {editableRangeRequiresCredentials(range) && (
                <span className='credential'>
                  <KeyRound size={10} />
                  源凭据
                </span>
              )}
              <small>{range.sqref}</small>
            </button>
          ))}
          {!ranges.length && (
            <CollectionState className='work-office-collection-empty' role='status'>
              还没有命名的可编辑区域。
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
          <span>工作表</span>
          <OfficeSelect
            ariaLabel='保护工作表'
            value={sheet.id}
            options={sheets.map((item) => ({ value: item.id, label: item.name }))}
            onValueChange={changeSheet}
          />
        </div>
        <OfficeCheckbox
          className='toggle'
          ariaLabel='启用工作表保护'
          checked={authority.sheet === 1}
          onCheckedChange={(checked) => updateSheet(withSheetProtection(sheet, checked))}
        >
          保护工作表和锁定单元格
        </OfficeCheckbox>
        <fieldset>
          <legend>允许选择</legend>
          <OfficeCheckbox
            className='check'
            ariaLabel='允许选择锁定单元格'
            checked={authority.selectLockedCells === 1}
            onCheckedChange={setSelectLocked}
          >
            锁定单元格
          </OfficeCheckbox>
          <OfficeCheckbox
            className='check'
            ariaLabel='允许选择未锁定单元格'
            checked={authority.selectunLockedCells === 1}
            onCheckedChange={setSelectUnlocked}
          >
            未锁定单元格
          </OfficeCheckbox>
        </fieldset>
        <div className='work-office-field'>
          <span>区域名称</span>
          <OfficeTextField
            aria-label='可编辑区域名称'
            value={draft.name}
            maxLength={255}
            placeholder='例如 InputCells'
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </div>
        <div className='work-office-field reference'>
          <span>可编辑范围</span>
          <OfficeTextField
            aria-label='可编辑区域范围'
            value={draft.reference}
            placeholder='B2:B20'
            onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
          />
        </div>
        <p>
          当前有 {unlockedCellCount(sheet)} 个未锁定单元格。密码和账户权限验证器会保留到 XLSX，但 Work
          不会尝试破解或代替源应用验证。
        </p>
        {selectedRange && editableRangeRequiresCredentials(selectedRange) && (
          <InlineNotice className='work-office-form-warning' tone='warning' role='note'>
            保存对此区域的修改会将它转换为无需源凭据的可编辑区域。
          </InlineNotice>
        )}
        <div className='actions'>
          {error && (
            <InlineNotice className='work-office-form-error' tone='danger' role='alert'>
              {error}
            </InlineNotice>
          )}
          <Button tone='danger' disabled={selectedIndex === null} onClick={deleteRange}>
            <Trash2 size={13} />
            删除区域
          </Button>
          <Button type='submit' tone='primary'>
            保存区域
          </Button>
        </div>
      </form>
    </div>
  );
}

function newRangeDraft(): EditableRangeDraft {
  return { name: '', reference: 'B2:B10' };
}
