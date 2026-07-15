import type { ProviderInfo } from '../../../../types/api';
import { KeyValueEditor } from '../config/key-value-editor';
import { SettingsDisclosure } from '../config/settings-disclosure';
import { SettingsSecretField, SettingsTextField } from '../config/settings-fields';
import { SettingsRow } from '../config/settings-row';

export function ProviderConnectionEditor({
  provider,
  onChange,
}: {
  provider: ProviderInfo;
  onChange(provider: ProviderInfo): void;
}) {
  const label = provider.name || 'Provider';
  return (
    <div className='provider-connection-editor'>
      <SettingsRow label='Provider 名称' description='模型引用中 `/` 前的唯一名称。'>
        <SettingsTextField
          label={`${label} 名称`}
          value={provider.name}
          placeholder='openai'
          onChange={(name) => onChange({ ...provider, name })}
        />
      </SettingsRow>
      <SettingsRow label='API 地址' description='OpenAI-compatible 或 Provider 原生服务地址。'>
        <SettingsTextField
          type='url'
          label={`${label} API 地址`}
          value={provider.baseUrl}
          placeholder='使用 Provider 默认地址'
          onChange={(baseUrl) => onChange({ ...provider, baseUrl: baseUrl || null })}
        />
      </SettingsRow>
      <SettingsRow label='API Key' description='已保存的密钥不会返回浏览器；输入新值可替换。'>
        <SettingsSecretField
          label={`${label} API Key`}
          value={provider.apiKey}
          onChange={(apiKey) => onChange({ ...provider, apiKey })}
        />
      </SettingsRow>
      <SettingsDisclosure title='高级连接选项' description='请求头与会话标识透传；通常无需配置。'>
        <SettingsRow label='会话 ID Header' description='将运行时 session id 注入指定请求头。'>
          <SettingsTextField
            label={`${label} 会话 ID Header`}
            value={provider.sessionIdHeader}
            placeholder='例如 X-Session-ID'
            onChange={(sessionIdHeader) => onChange({ ...provider, sessionIdHeader: sessionIdHeader || null })}
          />
        </SettingsRow>
        <SettingsRow label='自定义 Header' description='添加该 Provider 要求的请求头。' vertical>
          <KeyValueEditor
            label={`${label} Header`}
            value={provider.headers ?? {}}
            onChange={(headers) => onChange({ ...provider, headers })}
          />
        </SettingsRow>
      </SettingsDisclosure>
    </div>
  );
}
