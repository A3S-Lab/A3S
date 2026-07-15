import type { DocumentOcrSettings, DocumentParserSettings } from '../../../../types/settings';
import { SettingsDisclosure } from '../config/settings-disclosure';
import { SettingsField } from '../config/settings-field';
import {
  SettingsNumberField,
  SettingsSecretField,
  SettingsTextArea,
  SettingsTextField,
} from '../config/settings-fields';
import { SettingsRow } from '../config/settings-row';
import { SettingsSwitch } from '../config/settings-switch';

export function DocumentParserSettingsEditor({
  value,
  onChange,
}: {
  value: DocumentParserSettings;
  onChange(value: DocumentParserSettings): void;
}) {
  return (
    <div className='config-stack'>
      <SettingsRow label='启用文档解析' description='为 PDF、Office 和图片等文件提取可供 Agent 使用的文本上下文。'>
        <SettingsSwitch
          label='启用文档解析'
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
        />
      </SettingsRow>
      <SettingsRow label='最大文件大小' description='单个文件允许进入解析器的最大体积，单位 MiB。'>
        <SettingsNumberField
          label='文档解析最大文件大小'
          value={value.maxFileSizeMb}
          min={1}
          max={1024}
          suffix='MiB'
          onChange={(maxFileSizeMb) => onChange({ ...value, maxFileSizeMb: maxFileSizeMb ?? 1 })}
        />
      </SettingsRow>

      <SettingsDisclosure
        title='解析缓存'
        description='复用已经完成的文档规范化结果，减少重复解析。'
        badge={
          <SettingsSwitch
            label='配置文档解析缓存'
            checked={Boolean(value.cache)}
            onChange={(enabled) => onChange({ ...value, cache: enabled ? { enabled: true, directory: null } : null })}
          />
        }
      >
        {value.cache && (
          <>
            <SettingsRow label='启用缓存'>
              <SettingsSwitch
                label='启用文档解析缓存'
                checked={value.cache.enabled}
                onChange={(enabled) => onChange({ ...value, cache: { ...value.cache!, enabled } })}
              />
            </SettingsRow>
            <SettingsRow label='缓存目录' description='留空时使用运行时默认目录。'>
              <SettingsTextField
                label='文档解析缓存目录'
                value={value.cache.directory}
                placeholder='运行时默认'
                onChange={(directory) =>
                  onChange({ ...value, cache: { ...value.cache!, directory: directory || null } })
                }
              />
            </SettingsRow>
          </>
        )}
      </SettingsDisclosure>

      <SettingsDisclosure
        title='OCR 与视觉识别'
        description='扫描件或图片型文档可回退到本地 OCR 或视觉模型。'
        badge={
          <SettingsSwitch
            label='配置文档 OCR'
            checked={Boolean(value.ocr)}
            onChange={(enabled) => onChange({ ...value, ocr: enabled ? defaultDocumentOcrSettings() : null })}
          />
        }
      >
        {value.ocr && <DocumentOcrEditor value={value.ocr} onChange={(ocr) => onChange({ ...value, ocr })} />}
      </SettingsDisclosure>
    </div>
  );
}

function DocumentOcrEditor({
  value,
  onChange,
}: {
  value: DocumentOcrSettings;
  onChange(value: DocumentOcrSettings): void;
}) {
  return (
    <div className='config-stack compact'>
      <SettingsRow label='启用 OCR 回退'>
        <SettingsSwitch
          label='启用 OCR 回退'
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
        />
      </SettingsRow>
      <SettingsRow label='Provider' description='使用 vision 调用兼容 API，或使用 builtin 调用本机 OCR。'>
        <SettingsTextField
          label='OCR Provider'
          value={value.provider}
          placeholder='vision 或 builtin'
          onChange={(provider) => onChange({ ...value, provider: provider || null })}
        />
      </SettingsRow>
      <SettingsRow label='视觉模型' description='例如 openai/gpt-4.1-mini；本地 OCR 可留空。'>
        <SettingsTextField
          label='OCR 视觉模型'
          value={value.model}
          placeholder='provider/model'
          onChange={(model) => onChange({ ...value, model: model || null })}
        />
      </SettingsRow>
      <div className='config-field-grid two'>
        <SettingsField label='最大图片数'>
          <SettingsNumberField
            label='OCR 最大图片数'
            value={value.maxImages}
            min={1}
            max={64}
            suffix='张'
            onChange={(maxImages) => onChange({ ...value, maxImages: maxImages ?? 1 })}
          />
        </SettingsField>
        <SettingsField label='渲染 DPI'>
          <SettingsNumberField
            label='OCR 渲染 DPI'
            value={value.dpi}
            min={72}
            max={600}
            suffix='DPI'
            onChange={(dpi) => onChange({ ...value, dpi: dpi ?? 72 })}
          />
        </SettingsField>
      </div>
      <SettingsRow label='自定义识别提示' description='为表格、版面或特定字段提供提取指令。' vertical>
        <SettingsTextArea
          label='OCR 自定义识别提示'
          value={value.prompt}
          placeholder='例如：保留表格结构并提取页码。'
          onChange={(prompt) => onChange({ ...value, prompt: prompt || null })}
        />
      </SettingsRow>
      <SettingsRow label='视觉 API 地址' description='留空时使用 Provider 默认地址。'>
        <SettingsTextField
          type='url'
          label='OCR 视觉 API 地址'
          value={value.baseUrl}
          placeholder='https://api.example.com/v1'
          onChange={(baseUrl) => onChange({ ...value, baseUrl: baseUrl || null })}
        />
      </SettingsRow>
      <SettingsRow label='视觉 API Key' description='密钥仅写入本机配置，Web 不会读取明文。'>
        <SettingsSecretField
          label='OCR 视觉 API Key'
          value={value.apiKey}
          onChange={(apiKey) => onChange({ ...value, apiKey })}
        />
      </SettingsRow>
    </div>
  );
}

export function defaultDocumentParserSettings(): DocumentParserSettings {
  return {
    enabled: true,
    maxFileSizeMb: 50,
    cache: { enabled: true, directory: null },
    ocr: null,
  };
}

function defaultDocumentOcrSettings(): DocumentOcrSettings {
  return {
    enabled: false,
    model: null,
    prompt: null,
    maxImages: 8,
    dpi: 144,
    provider: null,
    baseUrl: null,
    apiKey: null,
  };
}
