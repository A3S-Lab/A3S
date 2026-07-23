import { RefreshCw } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { Button, InlineNotice, StatusBadge } from '../../../../design-system/primitives';
import { appState } from '../../../../state/app-state';
import type { CatalogModel } from '../../../../types/api';
import type { SettingsActions } from '../../settings-actions';
import { SettingsSection } from '../config/settings-section';

interface LocalAccountDefinition {
  id: string;
  label: string;
  mark: string;
  sources: string[];
  loginCommand?: string;
  loginInstruction?: string;
}

const localAccounts: LocalAccountDefinition[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    mark: 'C',
    sources: ['Claude Code', 'claude-code'],
    loginCommand: 'claude auth login',
  },
  {
    id: 'codex',
    label: 'Codex',
    mark: 'X',
    sources: ['Codex'],
    loginCommand: 'codex login',
  },
  {
    id: 'workbuddy',
    label: 'WorkBuddy',
    mark: 'W',
    sources: ['WorkBuddy', 'CodeBuddy'],
    loginInstruction: '打开 WorkBuddy 完成登录',
  },
];

export function LocalModelAccounts({ actions }: { actions: SettingsActions }) {
  const state = useSnapshot(appState);
  const models = state.modelCatalog?.items ?? [];
  const catalogLoaded = state.modelCatalog !== null;

  return (
    <SettingsSection
      title='本地开发工具账户'
      description='复用本机已登录账户的授权模型；令牌和凭据不会返回浏览器。'
      action={
        <Button
          tone='secondary'
          loading={state.modelCatalogRefreshing}
          onClick={() => {
            void actions.refreshModelCatalog();
          }}
        >
          <RefreshCw size={14} />
          刷新账户模型
        </Button>
      }
    >
      {state.modelCatalogRefreshError && (
        <InlineNotice className='account-model-refresh-error' tone='danger' role='alert'>
          刷新失败：{state.modelCatalogRefreshError}。已保留当前可用模型。
        </InlineNotice>
      )}

      <ul className='local-model-account-list'>
        {localAccounts.map((account) => {
          const accountModels = models.filter((model) => account.sources.some((source) => sameSource(model, source)));
          return (
            <LocalModelAccountRow
              key={account.id}
              account={account}
              models={accountModels}
              catalogLoaded={catalogLoaded}
            />
          );
        })}
      </ul>

      <footer className='account-model-catalog-note'>
        <span>模型能力由本机 CLI 检测，账号失效后不会继续出现在选择器中。</span>
        {state.modelCatalogRefreshedAt && <strong>最近已刷新</strong>}
      </footer>
    </SettingsSection>
  );
}

function LocalModelAccountRow({
  account,
  models,
  catalogLoaded,
}: {
  account: LocalAccountDefinition;
  models: readonly CatalogModel[];
  catalogLoaded: boolean;
}) {
  const connected = models.length > 0;
  const preview = models
    .slice(0, 3)
    .map((model) => model.name)
    .join('、');

  return (
    <li aria-label={`${account.label} 账户状态`}>
      <span className={`local-account-mark ${account.id}`} aria-hidden='true'>
        {account.mark}
      </span>
      <div className='local-account-copy'>
        <strong>{account.label}</strong>
        {connected ? (
          <span className='local-account-models' title={models.map((model) => model.name).join('、')}>
            {models.length} 个可用模型 · {preview}
            {models.length > 3 ? ` 等 ${models.length} 个` : ''}
          </span>
        ) : catalogLoaded ? (
          <span className='local-account-guidance'>
            未检测到有效登录 · {account.loginCommand ? <code>{account.loginCommand}</code> : account.loginInstruction}
          </span>
        ) : (
          <span>正在读取本机模型目录…</span>
        )}
      </div>
      <StatusBadge tone={connected ? 'success' : 'neutral'}>
        {connected ? '已连接' : catalogLoaded ? '未连接' : '检测中'}
      </StatusBadge>
    </li>
  );
}

function sameSource(model: Pick<CatalogModel, 'source'>, expected: string): boolean {
  return normalizeSource(model.source) === normalizeSource(expected);
}

function normalizeSource(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
