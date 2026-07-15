import { SettingsNumberField } from '../config/settings-fields';
import { SettingsSection } from '../config/settings-section';

export function ModelRuntimeSettings({
  thinkingBudget,
  timeoutMs,
  onThinkingBudgetChange,
  onTimeoutChange,
}: {
  thinkingBudget?: number | null;
  timeoutMs?: number | null;
  onThinkingBudgetChange(value: number | null): void;
  onTimeoutChange(value: number | null): void;
}) {
  return (
    <SettingsSection title='运行参数' description='只在需要统一覆盖运行时默认值时填写。'>
      <div className='model-runtime-grid'>
        <div className='model-runtime-field'>
          <div>
            <strong>推理预算</strong>
            <span>单次请求最多可使用的思考 token。</span>
          </div>
          <SettingsNumberField
            label='推理预算'
            value={thinkingBudget}
            min={1}
            placeholder='运行时默认'
            suffix='tokens'
            onChange={onThinkingBudgetChange}
          />
        </div>
        <div className='model-runtime-field'>
          <div>
            <strong>请求超时</strong>
            <span>模型请求等待多久后停止。</span>
          </div>
          <SettingsNumberField
            label='LLM API 请求超时'
            value={timeoutMs == null ? null : timeoutMs / 1_000}
            min={0.1}
            step={0.1}
            placeholder='运行时默认'
            suffix='秒'
            onChange={(seconds) => onTimeoutChange(seconds == null ? null : seconds * 1_000)}
          />
        </div>
      </div>
    </SettingsSection>
  );
}
