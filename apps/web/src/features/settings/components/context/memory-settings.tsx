import type { MemorySettings } from '../../../../types/settings';
import { SettingsField } from '../config/settings-field';
import { SettingsNumberField, SettingsSliderField } from '../config/settings-fields';
import { SettingsRow } from '../config/settings-row';
import { SettingsSwitch } from '../config/settings-switch';

export function MemorySettingsEditor({
  value,
  onChange,
}: {
  value: MemorySettings;
  onChange(value: MemorySettings): void;
}) {
  return (
    <div className='config-stack'>
      <div className='config-field-grid three'>
        <NumberLabel
          label='短期记忆上限'
          value={value.maxShortTerm}
          min={1}
          onChange={(maxShortTerm) => onChange({ ...value, maxShortTerm: maxShortTerm ?? 1 })}
        />
        <NumberLabel
          label='工作记忆上限'
          value={value.maxWorking}
          min={1}
          onChange={(maxWorking) => onChange({ ...value, maxWorking: maxWorking ?? 1 })}
        />
        <NumberLabel
          label='清理周期（秒）'
          value={value.pruneIntervalSecs}
          min={1}
          onChange={(pruneIntervalSecs) => onChange({ ...value, pruneIntervalSecs: pruneIntervalSecs ?? 1 })}
        />
      </div>

      <div className='config-subsection-title'>相关性评分</div>
      <div className='config-field-grid three'>
        <NumberLabel
          label='衰减天数'
          value={value.relevance.decayDays}
          min={0.01}
          step={0.1}
          onChange={(decayDays) =>
            onChange({ ...value, relevance: { ...value.relevance, decayDays: decayDays ?? 30 } })
          }
        />
        <SliderLabel
          label='重要性权重'
          value={value.relevance.importanceWeight}
          onChange={(importanceWeight) => onChange({ ...value, relevance: { ...value.relevance, importanceWeight } })}
        />
        <SliderLabel
          label='新近度权重'
          value={value.relevance.recencyWeight}
          onChange={(recencyWeight) => onChange({ ...value, relevance: { ...value.relevance, recencyWeight } })}
        />
      </div>

      <SettingsRow label='LLM 记忆提取' description='重要任务完成后提炼可长期复用的记忆。'>
        <SettingsSwitch
          label='LLM 记忆提取'
          checked={value.llmExtraction}
          onChange={(llmExtraction) => onChange({ ...value, llmExtraction })}
        />
      </SettingsRow>
      <div className='config-field-grid two'>
        <NumberLabel
          label='每轮最多提取条目'
          value={value.llmExtractionMaxItems}
          min={1}
          onChange={(llmExtractionMaxItems) =>
            onChange({ ...value, llmExtractionMaxItems: llmExtractionMaxItems ?? 1 })
          }
        />
        <NumberLabel
          label='提取输入字符上限'
          value={value.llmExtractionMaxInputChars}
          min={1}
          onChange={(llmExtractionMaxInputChars) =>
            onChange({ ...value, llmExtractionMaxInputChars: llmExtractionMaxInputChars ?? 1 })
          }
        />
      </div>

      <SettingsRow label='自动清理策略' description='关闭时不运行后台长期记忆清理。'>
        <SettingsSwitch
          label='自动清理策略'
          checked={Boolean(value.prunePolicy)}
          onChange={(enabled) =>
            onChange({
              ...value,
              prunePolicy: enabled ? { maxAgeDays: 90, minImportanceToKeep: 0.5, maxItems: 0 } : null,
            })
          }
        />
      </SettingsRow>
      {value.prunePolicy && (
        <div className='config-field-grid three'>
          <NumberLabel
            label='最大保留天数'
            value={value.prunePolicy.maxAgeDays}
            min={1}
            onChange={(maxAgeDays) =>
              onChange({ ...value, prunePolicy: { ...value.prunePolicy!, maxAgeDays: maxAgeDays ?? 1 } })
            }
          />
          <SliderLabel
            label='保护重要性阈值'
            value={value.prunePolicy.minImportanceToKeep}
            onChange={(minImportanceToKeep) =>
              onChange({
                ...value,
                prunePolicy: { ...value.prunePolicy!, minImportanceToKeep },
              })
            }
          />
          <NumberLabel
            label='长期记忆硬上限'
            value={value.prunePolicy.maxItems}
            min={0}
            onChange={(maxItems) =>
              onChange({ ...value, prunePolicy: { ...value.prunePolicy!, maxItems: maxItems ?? 0 } })
            }
          />
        </div>
      )}
    </div>
  );
}

function SliderLabel({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return (
    <SettingsField label={label}>
      <SettingsSliderField
        label={label}
        value={value}
        min={0}
        max={1}
        step={0.05}
        formatValue={(current) => `${Math.round(current * 100)}%`}
        onChange={onChange}
      />
    </SettingsField>
  );
}

function NumberLabel({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange(value: number | null): void;
  min?: number;
  step?: number;
}) {
  return (
    <SettingsField label={label}>
      <SettingsNumberField label={label} value={value} min={min} step={step} onChange={onChange} />
    </SettingsField>
  );
}

export function defaultMemorySettings(): MemorySettings {
  return {
    relevance: { decayDays: 30, importanceWeight: 0.7, recencyWeight: 0.3 },
    maxShortTerm: 100,
    maxWorking: 10,
    prunePolicy: null,
    pruneIntervalSecs: 3600,
    llmExtraction: true,
    llmExtractionMaxItems: 5,
    llmExtractionMaxInputChars: 8000,
  };
}
