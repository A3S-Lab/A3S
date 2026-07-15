import { Trash2 } from 'lucide-react';
import { Button } from '../../../../design-system/primitives';
import type { ModelInfo } from '../../../../types/api';
import { KeyValueEditor } from '../config/key-value-editor';
import { SettingsDisclosure } from '../config/settings-disclosure';
import { SettingsField } from '../config/settings-field';
import { SettingsNumberField, SettingsSecretField, SettingsTextField } from '../config/settings-fields';
import { SettingsRow } from '../config/settings-row';
import { SettingsSwitch } from '../config/settings-switch';

export function ModelEditor({
  model,
  providerName,
  isDefault = false,
  onChange,
  onRemove,
}: {
  model: ModelInfo;
  providerName: string;
  isDefault?: boolean;
  onChange(model: ModelInfo): void;
  onRemove(): void;
}) {
  const reference = `${providerName || 'provider'}/${model.id || 'model'}`;
  return (
    <section className='model-editor-panel' aria-label={`模型 ${model.name?.trim() || model.id || '未命名模型'}`}>
      <header className='model-editor-header'>
        <div>
          <strong>{model.name?.trim() || model.id || '未命名模型'}</strong>
          <code>{reference}</code>
        </div>
        <span className='model-editor-status'>
          {isDefault ? '默认模型' : model.reasoning ? 'Reasoning' : 'Standard'}
        </span>
        <Button tone='quiet' className='model-editor-remove' aria-label={`删除模型 ${reference}`} onClick={onRemove}>
          <Trash2 size={13} /> 删除
        </Button>
      </header>

      <div className='model-editor-group'>
        <div className='model-editor-group-heading'>
          <strong>基本信息</strong>
          <span>模型标识会用于 API 请求，显示名称只影响界面。</span>
        </div>
        <div className='config-field-grid two'>
          <SettingsField label='模型标识'>
            <SettingsTextField
              label={`${reference} 模型标识`}
              value={model.id}
              onChange={(id) => onChange({ ...model, id })}
            />
          </SettingsField>
          <SettingsField label='显示名称'>
            <SettingsTextField
              label={`${reference} 显示名称`}
              value={model.name}
              placeholder={model.id || '模型名称'}
              onChange={(name) => onChange({ ...model, name })}
            />
          </SettingsField>
          <SettingsField label='模型家族'>
            <SettingsTextField
              label={`${reference} 模型家族`}
              value={model.family}
              placeholder='例如 claude-sonnet'
              onChange={(family) => onChange({ ...model, family })}
            />
          </SettingsField>
        </div>
      </div>

      <div className='model-editor-group'>
        <div className='model-editor-group-heading'>
          <strong>能力</strong>
          <span>只开启模型和当前接口真实支持的能力。</span>
        </div>
        <div className='config-subsection-grid capabilities'>
          <Capability
            label='文件附件'
            checked={Boolean(model.attachment)}
            onChange={(attachment) => onChange({ ...model, attachment })}
          />
          <Capability
            label='推理模式'
            checked={Boolean(model.reasoning)}
            onChange={(reasoning) => onChange({ ...model, reasoning })}
          />
          <Capability
            label='工具调用'
            checked={model.toolCall !== false}
            onChange={(toolCall) => onChange({ ...model, toolCall })}
          />
          <Capability
            label='Temperature'
            checked={model.temperature !== false}
            onChange={(temperature) => onChange({ ...model, temperature })}
          />
        </div>
      </div>

      <div className='model-editor-group'>
        <div className='model-editor-group-heading'>
          <strong>上下文与输出</strong>
          <span>填写 0 表示没有提供明确的模型限制。</span>
        </div>
        <div className='config-field-grid two'>
          <SettingsField label='上下文窗口'>
            <SettingsNumberField
              label={`${reference} 上下文窗口`}
              value={model.limit?.context}
              min={0}
              suffix='tokens'
              onChange={(context) => onChange({ ...model, limit: { ...model.limit, context: context ?? 0 } })}
            />
          </SettingsField>
          <SettingsField label='最大输出'>
            <SettingsNumberField
              label={`${reference} 最大输出`}
              value={model.limit?.output}
              min={0}
              suffix='tokens'
              onChange={(output) => onChange({ ...model, limit: { ...model.limit, output: output ?? 0 } })}
            />
          </SettingsField>
        </div>
      </div>

      <SettingsDisclosure title='模型级连接覆盖' description='仅当这个模型不继承 Provider 连接时配置。'>
        <SettingsRow label='独立 API 地址' description='留空时继承 Provider 地址。'>
          <SettingsTextField
            type='url'
            label={`${reference} 独立 API 地址`}
            value={model.baseUrl}
            placeholder='继承 Provider'
            onChange={(baseUrl) => onChange({ ...model, baseUrl: baseUrl || null })}
          />
        </SettingsRow>
        <SettingsRow label='独立 API Key' description='留空时继承 Provider 密钥。'>
          <SettingsSecretField
            label={`${reference} 独立 API Key`}
            value={model.apiKey}
            onChange={(apiKey) => onChange({ ...model, apiKey })}
          />
        </SettingsRow>
      </SettingsDisclosure>

      <SettingsDisclosure title='高级模型信息' description='模态、成本、请求头和会话透传。'>
        <SettingsRow label='发布日期'>
          <SettingsTextField
            label={`${reference} 发布日期`}
            value={model.releaseDate}
            placeholder='YYYY-MM-DD'
            onChange={(releaseDate) => onChange({ ...model, releaseDate: releaseDate || null })}
          />
        </SettingsRow>
        <SettingsRow label='会话 ID Header'>
          <SettingsTextField
            label={`${reference} 会话 ID Header`}
            value={model.sessionIdHeader}
            placeholder='继承 Provider'
            onChange={(sessionIdHeader) => onChange({ ...model, sessionIdHeader: sessionIdHeader || null })}
          />
        </SettingsRow>
        <SettingsRow label='输入模态'>
          <SettingsTextField
            label={`${reference} 输入模态`}
            value={(model.modalities?.input ?? []).join(', ')}
            placeholder='text, image'
            onChange={(value) =>
              onChange({
                ...model,
                modalities: { input: commaList(value), output: model.modalities?.output ?? [] },
              })
            }
          />
        </SettingsRow>
        <SettingsRow label='输出模态'>
          <SettingsTextField
            label={`${reference} 输出模态`}
            value={(model.modalities?.output ?? []).join(', ')}
            placeholder='text'
            onChange={(value) =>
              onChange({
                ...model,
                modalities: { input: model.modalities?.input ?? [], output: commaList(value) },
              })
            }
          />
        </SettingsRow>
        <div className='config-field-grid four'>
          {(['input', 'output', 'cacheRead', 'cacheWrite'] as const).map((key) => (
            <SettingsField label={costLabels[key]} key={key}>
              <SettingsNumberField
                label={`${reference} ${costLabels[key]}`}
                value={model.cost?.[key]}
                min={0}
                step={0.01}
                onChange={(value) =>
                  onChange({
                    ...model,
                    cost: {
                      input: model.cost?.input ?? 0,
                      output: model.cost?.output ?? 0,
                      cacheRead: model.cost?.cacheRead ?? 0,
                      cacheWrite: model.cost?.cacheWrite ?? 0,
                      [key]: value ?? 0,
                    },
                  })
                }
              />
            </SettingsField>
          ))}
        </div>
        <SettingsRow label='自定义 Header' vertical>
          <KeyValueEditor
            label={`${reference} Header`}
            value={model.headers ?? {}}
            onChange={(headers) => onChange({ ...model, headers })}
          />
        </SettingsRow>
      </SettingsDisclosure>
    </section>
  );
}

function Capability({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
  return (
    <div>
      <span>{label}</span>
      <SettingsSwitch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

function commaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const costLabels = {
  input: '输入成本 / M',
  output: '输出成本 / M',
  cacheRead: '缓存读取 / M',
  cacheWrite: '缓存写入 / M',
};
