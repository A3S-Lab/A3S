import type { SpreadsheetConditionalThresholdType } from '../work-spreadsheet-conditional-values';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect } from './office-controls';
import type { SpreadsheetConditionalThresholdDraft } from './spreadsheet-conditional-format-model';

interface SpreadsheetConditionalThresholdFieldsProps {
  label: string;
  thresholds: SpreadsheetConditionalThresholdDraft[];
  startIndex?: number;
  showEquality?: boolean;
  onChange: (index: number, patch: Partial<SpreadsheetConditionalThresholdDraft>) => void;
}

export function SpreadsheetConditionalThresholdFields({
  label,
  thresholds,
  startIndex = 0,
  showEquality = false,
  onChange,
}: SpreadsheetConditionalThresholdFieldsProps) {
  return (
    <fieldset className='work-spreadsheet-conditional-thresholds'>
      <legend>{label}阈值</legend>
      {thresholds.slice(startIndex).map((threshold, offset) => {
        const index = startIndex + offset;
        const valueRequired = threshold.type !== 'min' && threshold.type !== 'max';
        return (
          <div key={index}>
            <span>第 {index + 1} 级起点</span>
            <OfficeSelect
              ariaLabel={`${label}阈值 ${index + 1} 类型`}
              value={threshold.type}
              options={[
                { value: 'percent', label: '百分比' },
                { value: 'percentile', label: '百分位' },
                { value: 'num', label: '数值' },
                { value: 'min', label: '最小值' },
                { value: 'max', label: '最大值' },
              ]}
              onValueChange={(type) =>
                onChange(index, {
                  type: type as SpreadsheetConditionalThresholdType,
                })
              }
            />
            <OfficeNumberField
              ariaLabel={`${label}阈值 ${index + 1}`}
              value={valueRequired ? threshold.value : ''}
              disabled={!valueRequired}
              onValueChange={(value) => onChange(index, { value })}
            />
            {showEquality ? (
              <OfficeCheckbox
                className='threshold-gte'
                ariaLabel={`${label}阈值 ${index + 1} 包含等于`}
                checked={threshold.gte}
                onCheckedChange={(gte) => onChange(index, { gte })}
              >
                包含等于
              </OfficeCheckbox>
            ) : (
              <span />
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
