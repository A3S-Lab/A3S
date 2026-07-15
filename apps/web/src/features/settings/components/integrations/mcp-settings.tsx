import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../design-system/primitives';
import type { McpOAuthSettings, McpServerSettings, McpTransportSettings } from '../../../../types/settings';
import { KeyValueEditor } from '../config/key-value-editor';
import { SettingsDisclosure } from '../config/settings-disclosure';
import {
  SettingsNumberField,
  SettingsSecretField,
  SettingsSelect,
  SettingsTextArea,
  SettingsTextField,
} from '../config/settings-fields';
import { SettingsRow } from '../config/settings-row';
import { SettingsSwitch } from '../config/settings-switch';

export function McpSettingsEditor({
  value,
  onChange,
}: {
  value: McpServerSettings[];
  onChange(value: McpServerSettings[]): void;
}) {
  const update = (index: number, server: McpServerSettings) =>
    onChange(value.map((item, itemIndex) => (itemIndex === index ? server : item)));
  return (
    <div className='config-stack'>
      <div className='config-nested-header'>
        <div>
          <strong>MCP Servers</strong>
          <span>连接本地 stdio 或远程 HTTP 工具服务；每个服务独立启停。</span>
        </div>
        <Button tone='secondary' onClick={() => onChange([...value, defaultMcpServer(value)])}>
          <Plus size={13} /> 添加 Server
        </Button>
      </div>
      <div className='config-card-list'>
        {value.map((server, index) => (
          <McpServerEditor
            server={server}
            key={`${server.name}-${index}`}
            onChange={(next) => update(index, next)}
            onRemove={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
          />
        ))}
        {!value.length && <div className='config-empty-inline'>尚未配置 MCP Server。</div>}
      </div>
    </div>
  );
}

function McpServerEditor({
  server,
  onChange,
  onRemove,
}: {
  server: McpServerSettings;
  onChange(server: McpServerSettings): void;
  onRemove(): void;
}) {
  const label = server.name.trim() || '未命名 Server';
  const stdioTransport = server.transport.type === 'stdio' ? server.transport : null;
  const remoteTransport = server.transport.type === 'stdio' ? null : server.transport;
  return (
    <SettingsDisclosure
      title={label}
      description={transportDescription(server.transport)}
      badge={
        <span className={`config-mini-badge ${server.enabled ? 'online' : ''}`}>
          {server.enabled ? '已启用' : '已停用'}
        </span>
      }
      defaultOpen
    >
      <SettingsRow label='启用 Server'>
        <SettingsSwitch
          label={`启用 MCP Server ${label}`}
          checked={server.enabled}
          onChange={(enabled) => onChange({ ...server, enabled })}
        />
      </SettingsRow>
      <SettingsRow label='Server 名称' description='作为工具前缀使用，在 MCP 列表中必须唯一。'>
        <SettingsTextField
          label={`${label} 名称`}
          value={server.name}
          placeholder='filesystem'
          onChange={(name) => onChange({ ...server, name })}
        />
      </SettingsRow>
      <SettingsRow label='Transport'>
        <SettingsSelect
          label={`${label} Transport`}
          value={server.transport.type}
          options={[
            { value: 'stdio', label: 'stdio（本地进程）' },
            { value: 'streamable-http', label: 'Streamable HTTP' },
            { value: 'http', label: 'HTTP / SSE（兼容）' },
          ]}
          onChange={(type) => onChange({ ...server, transport: changeTransport(server.transport, type) })}
        />
      </SettingsRow>
      {stdioTransport ? (
        <>
          <SettingsRow label='启动命令'>
            <SettingsTextField
              label={`${label} 启动命令`}
              value={stdioTransport.command}
              placeholder='npx'
              onChange={(command) => onChange({ ...server, transport: { ...stdioTransport, command } })}
            />
          </SettingsRow>
          <SettingsRow label='启动参数' description='每行一个参数，顺序会被保留。' vertical>
            <SettingsTextArea
              label={`${label} 启动参数`}
              value={stdioTransport.args.join('\n')}
              placeholder={'-y\n@modelcontextprotocol/server-filesystem'}
              onChange={(text) => onChange({ ...server, transport: { ...stdioTransport, args: lineList(text) } })}
            />
          </SettingsRow>
        </>
      ) : remoteTransport ? (
        <>
          <SettingsRow label='服务地址'>
            <SettingsTextField
              type='url'
              label={`${label} 服务地址`}
              value={remoteTransport.url}
              placeholder='https://mcp.example.com/mcp'
              onChange={(url) => onChange({ ...server, transport: { ...remoteTransport, url } })}
            />
          </SettingsRow>
          <SettingsRow label='HTTP Header' description='Authorization 等敏感值只显示已配置占位符。' vertical>
            <KeyValueEditor
              label={`${label} HTTP Header`}
              value={remoteTransport.headers}
              onChange={(headers) => onChange({ ...server, transport: { ...remoteTransport, headers } })}
            />
          </SettingsRow>
        </>
      ) : null}
      <SettingsRow label='环境变量' description='敏感键值不会通过 Web API 返回明文。' vertical>
        <KeyValueEditor
          label={`${label} 环境变量`}
          value={server.env}
          keyPlaceholder='MCP_TOKEN'
          onChange={(env) => onChange({ ...server, env })}
        />
      </SettingsRow>
      <SettingsRow label='工具超时' description='单个 MCP 工具的最大执行时间，单位秒。'>
        <SettingsNumberField
          label={`${label} 工具超时`}
          value={server.tool_timeout_secs}
          min={1}
          suffix='秒'
          onChange={(tool_timeout_secs) => onChange({ ...server, tool_timeout_secs: tool_timeout_secs ?? 60 })}
        />
      </SettingsRow>

      <SettingsDisclosure
        title='OAuth'
        description='远程 MCP Server 的授权码流程或静态访问令牌。'
        badge={
          <SettingsSwitch
            label={`配置 ${label} OAuth`}
            checked={Boolean(server.oauth)}
            onChange={(enabled) => onChange({ ...server, oauth: enabled ? defaultOAuthSettings() : null })}
          />
        }
      >
        {server.oauth && (
          <OAuthEditor value={server.oauth} label={label} onChange={(oauth) => onChange({ ...server, oauth })} />
        )}
      </SettingsDisclosure>

      <button type='button' className='config-delete-button' onClick={onRemove}>
        <Trash2 size={13} /> 删除 MCP Server
      </button>
    </SettingsDisclosure>
  );
}

function OAuthEditor({
  value,
  label,
  onChange,
}: {
  value: McpOAuthSettings;
  label: string;
  onChange(value: McpOAuthSettings): void;
}) {
  return (
    <div className='config-stack compact'>
      <SettingsRow label='授权地址'>
        <SettingsTextField
          type='url'
          label={`${label} OAuth 授权地址`}
          value={value.auth_url}
          onChange={(auth_url) => onChange({ ...value, auth_url })}
        />
      </SettingsRow>
      <SettingsRow label='Token 地址'>
        <SettingsTextField
          type='url'
          label={`${label} OAuth Token 地址`}
          value={value.token_url}
          onChange={(token_url) => onChange({ ...value, token_url })}
        />
      </SettingsRow>
      <SettingsRow label='Client ID'>
        <SettingsTextField
          label={`${label} OAuth Client ID`}
          value={value.client_id}
          onChange={(client_id) => onChange({ ...value, client_id })}
        />
      </SettingsRow>
      <SettingsRow label='Client Secret'>
        <SettingsSecretField
          label={`${label} OAuth Client Secret`}
          value={value.client_secret}
          onChange={(client_secret) => onChange({ ...value, client_secret })}
        />
      </SettingsRow>
      <SettingsRow label='Scopes' description='每行一个 scope。' vertical>
        <SettingsTextArea
          label={`${label} OAuth Scopes`}
          value={value.scopes.join('\n')}
          placeholder='tools.read'
          onChange={(text) => onChange({ ...value, scopes: lineList(text) })}
        />
      </SettingsRow>
      <SettingsRow label='Redirect URI'>
        <SettingsTextField
          type='url'
          label={`${label} OAuth Redirect URI`}
          value={value.redirect_uri}
          onChange={(redirect_uri) => onChange({ ...value, redirect_uri })}
        />
      </SettingsRow>
      <SettingsRow label='静态 Access Token' description='配置后跳过 OAuth 交换流程。'>
        <SettingsSecretField
          label={`${label} OAuth Access Token`}
          value={value.access_token}
          onChange={(access_token) => onChange({ ...value, access_token })}
        />
      </SettingsRow>
    </div>
  );
}

function changeTransport(current: McpTransportSettings, type: McpTransportSettings['type']): McpTransportSettings {
  if (current.type === type) return current;
  if (type === 'stdio') return { type, command: '', args: [] };
  return { type, url: '', headers: {} };
}

function transportDescription(transport: McpTransportSettings) {
  if (transport.type === 'stdio') return transport.command || '本地 stdio 进程';
  return transport.url || (transport.type === 'streamable-http' ? 'Streamable HTTP' : 'HTTP / SSE');
}

function lineList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultOAuthSettings(): McpOAuthSettings {
  return {
    auth_url: '',
    token_url: '',
    client_id: '',
    client_secret: null,
    scopes: [],
    redirect_uri: '',
    access_token: null,
  };
}

function defaultMcpServer(existing: McpServerSettings[]): McpServerSettings {
  const names = new Set(existing.map((server) => server.name));
  let name = 'new-server';
  let suffix = 2;
  while (names.has(name)) name = `new-server-${suffix++}`;
  return {
    name,
    transport: { type: 'stdio', command: '', args: [] },
    enabled: true,
    env: {},
    oauth: null,
    tool_timeout_secs: 60,
  };
}
