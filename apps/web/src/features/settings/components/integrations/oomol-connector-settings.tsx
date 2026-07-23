import { ExternalLink, Plug, Plus, Trash2 } from 'lucide-react';
import { Button, Field, InlineNotice, StateView } from '../../../../design-system/primitives';
import type { McpServerSettings, McpTransportSettings } from '../../../../types/settings';
import {
  configuredSecret,
  SettingsNumberField,
  SettingsSecretField,
  SettingsSelect,
  SettingsTextField,
} from '../config/settings-fields';
import { SettingsRow } from '../config/settings-row';
import { SettingsSwitch } from '../config/settings-switch';

export const OOMOL_CONNECTOR_SERVER_NAME = 'oomol-connector';
export const OOMOL_HOSTED_MCP_URL = 'https://connector.oomol.com/mcp';
export const OOMOL_SELF_HOSTED_MCP_URL = 'http://localhost:3000/mcp';

const OOMOL_CATALOG_URL = 'https://oomol.com/zh-cn/apps/';
const OOMOL_CONNECTIONS_URL = 'https://console.oomol.com/connections';
const OOMOL_API_KEYS_URL = 'https://console.oomol.com/api-key';
const OOMOL_SELF_HOSTING_URL = 'https://oomol.com/zh-cn/docs/openconnector-self-hosting/';
const AUTHORIZATION_HEADER = 'Authorization';

type OomolDeployment = 'hosted' | 'self-hosted';
type OomolMcpTransport = Extract<McpTransportSettings, { type: 'streamable-http' }>;

export function OomolConnectorSettings({
  value,
  onChange,
}: {
  value: McpServerSettings[];
  onChange(value: McpServerSettings[]): void;
}) {
  const index = value.findIndex((server) => server.name === OOMOL_CONNECTOR_SERVER_NAME);
  const server = index >= 0 ? value[index] : null;

  if (!server) {
    return (
      <StateView
        className='oomol-connector-empty'
        size='compact'
        icon={<Plug size={21} />}
        title='把连接器注册为 Agent 工具'
        description='托管版直接使用 OOMOL 已连接账号；自部署版把凭据、策略和运行记录留在你的环境中。'
        actions={
          <>
            <Button tone='primary' onClick={() => onChange([...value, defaultOomolServer('hosted')])}>
              <Plus size={13} /> 接入 OOMOL 托管版
            </Button>
            <Button tone='secondary' onClick={() => onChange([...value, defaultOomolServer('self-hosted')])}>
              接入自部署版
            </Button>
          </>
        }
      >
        <OomolLinks deployment={null} />
      </StateView>
    );
  }

  const transport = server.transport;
  if (transport.type !== 'streamable-http') {
    return (
      <div className='config-stack'>
        <InlineNotice className='oomol-connector-warning' tone='warning' role='note' title='连接器名称冲突'>
          名为 <code>{OOMOL_CONNECTOR_SERVER_NAME}</code> 的现有 MCP Server 不是 streamable-http 服务。请先在下方 MCP
          列表中重命名或删除它，再添加连接器。
        </InlineNotice>
        <OomolLinks deployment={null} />
      </div>
    );
  }

  const deployment = deploymentFor(transport);
  const authorization = readHeader(transport.headers, AUTHORIZATION_HEADER);
  const token = displayToken(authorization, deployment);
  const urlValidationMessage = server.enabled ? oomolConnectorUrlValidationMessage(transport) : null;
  const authorizationValidationMessage = server.enabled
    ? oomolConnectorAuthorizationValidationMessage(transport)
    : null;
  const update = (next: McpServerSettings) =>
    onChange(value.map((item, itemIndex) => (itemIndex === index ? next : item)));
  const updateTransport = (nextTransport: OomolMcpTransport) => update({ ...server, transport: nextTransport });

  return (
    <div className='config-stack oomol-connector-settings'>
      <SettingsRow label='启用连接器' description='新建 Agent 会获得 OOMOL 的发现与执行工具。'>
        <SettingsSwitch
          label='启用连接器'
          checked={server.enabled}
          onChange={(enabled) => update({ ...server, enabled })}
        />
      </SettingsRow>
      <SettingsRow
        label='部署方式'
        description={deployment === 'hosted' ? '由 OOMOL 托管连接和执行环境。' : '连接你部署的 OpenConnector runtime。'}
      >
        <SettingsSelect
          label='OOMOL 部署方式'
          value={deployment}
          options={[
            { value: 'hosted', label: 'OOMOL 托管版' },
            { value: 'self-hosted', label: 'OpenConnector 自部署' },
          ]}
          onChange={(next) => update({ ...server, transport: changeDeployment(transport, next) })}
        />
      </SettingsRow>
      <SettingsRow
        label='MCP 地址'
        description={deployment === 'hosted' ? 'OOMOL 官方托管端点。' : '完整地址必须包含 /mcp 路径。'}
      >
        <Field className='oomol-connector-field' label='OOMOL MCP 地址' error={urlValidationMessage}>
          <SettingsTextField
            type='url'
            label='OOMOL MCP 地址'
            value={transport.url}
            disabled={deployment === 'hosted'}
            onChange={(url) => updateTransport({ ...transport, url })}
          />
        </Field>
      </SettingsRow>
      <SettingsRow
        label={deployment === 'hosted' ? 'OOMOL API Key' : 'Runtime Token'}
        description={
          deployment === 'hosted'
            ? '通过 OOMOL Console 创建；A3S 仅把它保存在本地配置中。'
            : '在 OpenConnector 的 Access 页面创建；A3S 会自动添加 Bearer 前缀。'
        }
      >
        <Field
          className='oomol-connector-field'
          label={deployment === 'hosted' ? 'OOMOL API Key' : 'OOMOL Runtime Token'}
          error={authorizationValidationMessage}
        >
          <SettingsSecretField
            label={deployment === 'hosted' ? 'OOMOL API Key' : 'OOMOL Runtime Token'}
            value={token}
            onChange={(nextToken) =>
              updateTransport({
                ...transport,
                headers: writeAuthorization(transport.headers, nextToken, deployment),
              })
            }
          />
        </Field>
      </SettingsRow>
      <SettingsRow label='工具超时' description='发现和执行 OOMOL Action 的单次最大等待时间。'>
        <SettingsNumberField
          label='OOMOL 工具超时'
          value={server.tool_timeout_secs}
          min={1}
          suffix='秒'
          onChange={(tool_timeout_secs) => update({ ...server, tool_timeout_secs: tool_timeout_secs ?? 60 })}
        />
      </SettingsRow>
      <OomolLinks deployment={deployment} />
      <Button
        tone='danger'
        className='config-delete-button'
        onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
      >
        <Trash2 size={13} /> 移除连接器
      </Button>
    </div>
  );
}

function OomolLinks({ deployment }: { deployment: OomolDeployment | null }) {
  return (
    <nav className='oomol-connector-links' aria-label='连接器相关链接'>
      <a href={OOMOL_CATALOG_URL} target='_blank' rel='noreferrer'>
        浏览连接器 <ExternalLink size={12} />
      </a>
      <a href={OOMOL_CONNECTIONS_URL} target='_blank' rel='noreferrer'>
        管理连接 <ExternalLink size={12} />
      </a>
      {deployment !== 'self-hosted' && (
        <a href={OOMOL_API_KEYS_URL} target='_blank' rel='noreferrer'>
          创建 API Key <ExternalLink size={12} />
        </a>
      )}
      {deployment !== 'hosted' && (
        <a href={OOMOL_SELF_HOSTING_URL} target='_blank' rel='noreferrer'>
          自部署指南 <ExternalLink size={12} />
        </a>
      )}
      {deployment && <span>保存后重启 A3S Code Web 生效。</span>}
    </nav>
  );
}

function defaultOomolServer(deployment: OomolDeployment): McpServerSettings {
  return {
    name: OOMOL_CONNECTOR_SERVER_NAME,
    transport: {
      type: 'streamable-http',
      url: deployment === 'hosted' ? OOMOL_HOSTED_MCP_URL : OOMOL_SELF_HOSTED_MCP_URL,
      headers: {},
    },
    enabled: true,
    env: {},
    oauth: null,
    tool_timeout_secs: 60,
  };
}

export function oomolConnectorValidationMessage(servers: McpServerSettings[]): string | null {
  const server = servers.find((item) => item.name === OOMOL_CONNECTOR_SERVER_NAME);
  if (!server?.enabled || server.transport.type !== 'streamable-http') return null;
  return (
    oomolConnectorUrlValidationMessage(server.transport) ??
    oomolConnectorAuthorizationValidationMessage(server.transport)
  );
}

function oomolConnectorUrlValidationMessage(transport: OomolMcpTransport): string | null {
  if (deploymentFor(transport) === 'hosted') return null;
  try {
    const url = new URL(transport.url.trim());
    const path = url.pathname.replace(/\/+$/, '');
    return (url.protocol === 'http:' || url.protocol === 'https:') && path.endsWith('/mcp')
      ? null
      : '请输入以 http:// 或 https:// 开头并以 /mcp 结尾的完整地址。';
  } catch {
    return '请输入以 http:// 或 https:// 开头并以 /mcp 结尾的完整地址。';
  }
}

function oomolConnectorAuthorizationValidationMessage(transport: OomolMcpTransport): string | null {
  if (deploymentFor(transport) !== 'hosted') return null;
  return readHeader(transport.headers, AUTHORIZATION_HEADER)?.trim() ? null : '启用 OOMOL 托管版前必须配置 API Key。';
}

function deploymentFor(transport: OomolMcpTransport): OomolDeployment {
  return normalizeUrl(transport.url) === normalizeUrl(OOMOL_HOSTED_MCP_URL) ? 'hosted' : 'self-hosted';
}

function changeDeployment(transport: OomolMcpTransport, deployment: OomolDeployment): OomolMcpTransport {
  const currentDeployment = deploymentFor(transport);
  if (currentDeployment === deployment) return transport;

  const currentToken = displayToken(readHeader(transport.headers, AUTHORIZATION_HEADER), currentDeployment);
  const portableToken = currentToken === configuredSecret ? null : currentToken;
  return {
    type: 'streamable-http',
    url: deployment === 'hosted' ? OOMOL_HOSTED_MCP_URL : OOMOL_SELF_HOSTED_MCP_URL,
    headers: writeAuthorization(transport.headers, portableToken, deployment),
  };
}

function displayToken(authorization: string | undefined, deployment: OomolDeployment): string | null {
  if (!authorization) return null;
  if (authorization === configuredSecret) return configuredSecret;
  if (deployment === 'self-hosted') return authorization.replace(/^Bearer\s+/i, '');
  return authorization;
}

function writeAuthorization(
  headers: Record<string, string>,
  token: string | null,
  deployment: OomolDeployment
): Record<string, string> {
  const next = Object.fromEntries(
    Object.entries(headers).filter(([key]) => key.toLowerCase() !== AUTHORIZATION_HEADER.toLowerCase())
  );
  const normalized = token?.trim();
  if (normalized) {
    next[AUTHORIZATION_HEADER] =
      deployment === 'hosted' || /^Bearer\s+/i.test(normalized) ? normalized : `Bearer ${normalized}`;
  }
  return next;
}

function readHeader(headers: Record<string, string>, name: string): string | undefined {
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}
