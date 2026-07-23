import {
  type SpreadsheetConditionalComparisonOperator,
  spreadsheetConditionalComparisonNeedsUpperValue,
} from '../work-spreadsheet-conditional-comparisons';
import { OfficeCheckbox, OfficeColorPicker, OfficeSelect, OfficeTextField } from './office-controls';
import { type ConditionalRuleDraft, SPREADSHEET_CONDITIONAL_COMPARISONS } from './spreadsheet-conditional-format-model';

interface SpreadsheetConditionalComparisonFieldsProps {
  draft: ConditionalRuleDraft;
  onChange: (patch: Partial<ConditionalRuleDraft>) => void;
}

export function SpreadsheetConditionalComparisonFields({
  draft,
  onChange,
}: SpreadsheetConditionalComparisonFieldsProps) {
  const needsUpperValue = spreadsheetConditionalComparisonNeedsUpperValue(draft.comparisonOperator);
  return (
    <>
      <div className='work-office-field'>
        <span>比较方式</span>
        <OfficeSelect
          ariaLabel='条件比较运算符'
          value={draft.comparisonOperator}
          options={SPREADSHEET_CONDITIONAL_COMPARISONS.map((comparison) => ({
            value: comparison.name,
            label: comparison.label,
          }))}
          onValueChange={(comparisonOperator) =>
            onChange({ comparisonOperator: comparisonOperator as SpreadsheetConditionalComparisonOperator })
          }
        />
      </div>
      <div className='work-office-field'>
        <span>{needsUpperValue ? '下限' : '比较值'}</span>
        <OfficeTextField
          aria-label={needsUpperValue ? '条件比较下限' : '条件比较值'}
          value={draft.comparisonValue}
          onChange={(event) => onChange({ comparisonValue: event.target.value })}
        />
      </div>
      {needsUpperValue && (
        <div className='work-office-field'>
          <span>上限</span>
          <OfficeTextField
            aria-label='条件比较上限'
            value={draft.comparisonUpperValue}
            onChange={(event) => onChange({ comparisonUpperValue: event.target.value })}
          />
        </div>
      )}
      <OfficeCheckbox
        className='toggle'
        ariaLabel='设置文字颜色'
        checked={draft.comparisonUseTextColor}
        onCheckedChange={(comparisonUseTextColor) => onChange({ comparisonUseTextColor })}
      >
        设置文字颜色
      </OfficeCheckbox>
      <div className='work-office-field color'>
        <span>文字颜色</span>
        <OfficeColorPicker
          ariaLabel='条件文字颜色'
          value={draft.comparisonTextColor}
          disabled={!draft.comparisonUseTextColor}
          onValueChange={(comparisonTextColor) => onChange({ comparisonTextColor })}
        />
      </div>
      <OfficeCheckbox
        className='toggle'
        ariaLabel='设置填充颜色'
        checked={draft.comparisonUseCellColor}
        onCheckedChange={(comparisonUseCellColor) => onChange({ comparisonUseCellColor })}
      >
        设置填充颜色
      </OfficeCheckbox>
      <div className='work-office-field color'>
        <span>填充颜色</span>
        <OfficeColorPicker
          ariaLabel='条件填充颜色'
          value={draft.comparisonCellColor}
          disabled={!draft.comparisonUseCellColor}
          onValueChange={(comparisonCellColor) => onChange({ comparisonCellColor })}
        />
      </div>
    </>
  );
}
