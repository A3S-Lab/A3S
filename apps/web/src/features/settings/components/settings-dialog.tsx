import {
  AlertTriangle,
  Bot,
  Box,
  CircleHelp,
  Database,
  Info,
  type LucideIcon,
  MessagesSquare,
  Plug,
  Settings2,
  UserRound,
  X,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, IconButton, StatusBadge, useDialogFocusScope } from '../../../design-system/primitives';
import { appState, closeSettings, navigateSettings } from '../../../state/app-state';
import { ChannelSettingsPage } from '../../channels/pages/channel-settings-page';
import type { WeixinRemoteActions } from '../../weixin-remote/use-weixin-remote-controller';
import type { SettingsActions } from '../settings-actions';
import type { SettingsTab } from '../settings-state';
import { AboutSettings } from './about-settings';
import { AccountSettings } from './account-settings';
import { AgentSettingsView } from './agent-settings';
import { AppearanceSettings } from './appearance-settings';
import { ContextSettingsView } from './context-settings';
import { HelpSettings } from './help-settings';
import { IntegrationsSettingsView } from './integrations-settings';
import { ModelSettings } from './model-settings';

interface SettingsTabDefinition {
  id: SettingsTab;
  label: string;
  description: string;
  icon: LucideIcon;
}

const primaryTabs: SettingsTabDefinition[] = [
  { id: 'account', label: '账户', description: '管理 A3S OS 授权与本地开发工具模型', icon: UserRound },
  { id: 'general', label: '通用', description: '调整外观、工作区与本机偏好', icon: Settings2 },
  { id: 'model', label: '模型与 Provider', description: '管理模型来源、能力、密钥和新任务默认模型', icon: Box },
  { id: 'agent', label: 'Agent 与执行', description: '配置工具边界、自动委派、目录和任务队列', icon: Bot },
  { id: 'context', label: '上下文与存储', description: '配置会话存储、记忆目录与上下文生命周期', icon: Database },
  { id: 'integrations', label: '集成', description: '配置连接器、MCP、搜索与文档解析', icon: Plug },
  {
    id: 'channels',
    label: '渠道',
    description: '管理微信、飞书等远程消息渠道',
    icon: MessagesSquare,
  },
];

const supportTabs: SettingsTabDefinition[] = [
  { id: 'about', label: '关于与更新', description: '查看版本、连接状态与更新', icon: Info },
  { id: 'help', label: '帮助', description: '查找 Code 工作流、安全说明与键盘操作', icon: CircleHelp },
];

const tabs = [...primaryTabs, ...supportTabs];

export function SettingsDialog({
  actions,
  weixinActions,
}: {
  actions: SettingsActions;
  weixinActions?: WeixinRemoteActions;
}) {
  const state = useSnapshot(appState);
  const tab = state.settingsTab;
  const selectedTab = tabs.find((item) => item.id === tab) ?? tabs[0];
  const titleId = useId();
  const descriptionId = useId();
  const discardTitleId = useId();
  const discardDescriptionId = useId();
  const contentBodyRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const discardDialogRef = useRef<HTMLElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const discardRestoreFocusRef = useRef<HTMLElement | null>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTab>>(() => new Set([tab]));
  const [dirtyTabs, setDirtyTabs] = useState<Set<SettingsTab>>(() => new Set());
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const closeDisabled = state.updateInstalling;
  const reportDirty = useCallback((target: SettingsTab, dirty: boolean) => {
    setDirtyTabs((current) => {
      const alreadyDirty = current.has(target);
      if (alreadyDirty === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(target);
      else next.delete(target);
      return next;
    });
  }, []);
  const requestClose = () => {
    if (closeDisabled) return;
    if (dirtyTabs.size > 0) {
      discardRestoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setDiscardConfirmationOpen(true);
      return;
    }
    closeSettings();
  };
  const continueEditing = () => {
    setDiscardConfirmationOpen(false);
    discardRestoreFocusRef.current?.focus();
  };
  const focusScope = useDialogFocusScope<HTMLElement>({
    onEscape: () => {
      if (discardConfirmationOpen) continueEditing();
      else requestClose();
    },
    escapeDisabled: closeDisabled && !discardConfirmationOpen,
    initialFocus: () => closeButtonRef.current,
    getActiveScope: () => discardDialogRef.current,
  });

  useEffect(() => {
    setVisitedTabs((current) => (current.has(tab) ? current : new Set([...current, tab])));
    if (contentBodyRef.current) contentBodyRef.current.scrollTop = 0;
  }, [tab]);

  useEffect(() => {
    if (discardConfirmationOpen) continueEditingRef.current?.focus();
  }, [discardConfirmationOpen]);

  return (
    <dialog
      open
      className='settings-overlay'
      role='presentation'
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <section
        ref={focusScope.scopeRef}
        className='settings-dialog'
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={focusScope.handleKeyDown}
      >
        <aside className='settings-nav'>
          <nav aria-label='设置分类'>
            {primaryTabs.map((item) => (
              <SettingsNavButton
                key={item.id}
                item={item}
                active={tab === item.id}
                dirty={dirtyTabs.has(item.id)}
                onSelect={() => {
                  setVisitedTabs((current) => (current.has(item.id) ? current : new Set([...current, item.id])));
                  navigateSettings(item.id);
                }}
              />
            ))}
            {supportTabs.map((item) => (
              <SettingsNavButton
                key={item.id}
                item={item}
                active={tab === item.id}
                dirty={dirtyTabs.has(item.id)}
                onSelect={() => {
                  setVisitedTabs((current) => (current.has(item.id) ? current : new Set([...current, item.id])));
                  navigateSettings(item.id);
                }}
              />
            ))}
          </nav>
          <footer>
            <strong>A3S Code</strong>
            <span>本地 CLI {state.health?.version || '—'}</span>
          </footer>
        </aside>

        <div className='settings-content'>
          <header className='settings-content-header'>
            <div>
              <h2 id={titleId}>{selectedTab.label}</h2>
              <p id={descriptionId}>{selectedTab.description}</p>
            </div>
            <StatusBadge className='settings-local-badge'>{tab === 'help' ? '本地帮助' : '设置保存在本机'}</StatusBadge>
          </header>
          <div ref={contentBodyRef} className='settings-content-body'>
            {visitedTabs.has('general') && (
              <SettingsTabPanel active={tab === 'general'}>
                <AppearanceSettings />
              </SettingsTabPanel>
            )}
            {visitedTabs.has('model') && (
              <SettingsTabPanel active={tab === 'model'}>
                <ModelSettings actions={actions} onDirtyChange={(dirty) => reportDirty('model', dirty)} />
              </SettingsTabPanel>
            )}
            {visitedTabs.has('agent') && (
              <SettingsTabPanel active={tab === 'agent'}>
                <AgentSettingsView actions={actions} onDirtyChange={(dirty) => reportDirty('agent', dirty)} />
              </SettingsTabPanel>
            )}
            {visitedTabs.has('context') && (
              <SettingsTabPanel active={tab === 'context'}>
                <ContextSettingsView actions={actions} onDirtyChange={(dirty) => reportDirty('context', dirty)} />
              </SettingsTabPanel>
            )}
            {visitedTabs.has('integrations') && (
              <SettingsTabPanel active={tab === 'integrations'}>
                <IntegrationsSettingsView
                  actions={actions}
                  onDirtyChange={(dirty) => reportDirty('integrations', dirty)}
                />
              </SettingsTabPanel>
            )}
            {visitedTabs.has('account') && (
              <SettingsTabPanel active={tab === 'account'}>
                <AccountSettings actions={actions} />
              </SettingsTabPanel>
            )}
            {visitedTabs.has('channels') && (
              <SettingsTabPanel active={tab === 'channels'}>
                <ChannelSettingsPage weixinActions={weixinActions} />
              </SettingsTabPanel>
            )}
            {visitedTabs.has('about') && (
              <SettingsTabPanel active={tab === 'about'}>
                <AboutSettings actions={actions} />
              </SettingsTabPanel>
            )}
            {visitedTabs.has('help') && (
              <SettingsTabPanel active={tab === 'help'}>
                <HelpSettings />
              </SettingsTabPanel>
            )}
          </div>
        </div>
        <IconButton
          ref={closeButtonRef}
          className='settings-close'
          label='关闭设置'
          disabled={closeDisabled}
          onClick={requestClose}
        >
          <X size={17} />
        </IconButton>
        {discardConfirmationOpen && (
          <div className='settings-discard-overlay'>
            <section
              ref={discardDialogRef}
              className='settings-discard-dialog'
              role='alertdialog'
              aria-modal='true'
              aria-labelledby={discardTitleId}
              aria-describedby={discardDescriptionId}
            >
              <span className='settings-discard-icon'>
                <AlertTriangle size={18} />
              </span>
              <div>
                <h3 id={discardTitleId}>还有未保存的更改</h3>
                <p id={discardDescriptionId}>关闭设置会放弃尚未保存的配置。你也可以返回对应分类继续编辑。</p>
              </div>
              <footer>
                <Button ref={continueEditingRef} tone='secondary' onClick={continueEditing}>
                  继续编辑
                </Button>
                <Button tone='danger' onClick={closeSettings}>
                  放弃并关闭
                </Button>
              </footer>
            </section>
          </div>
        )}
      </section>
    </dialog>
  );
}

function SettingsNavButton({
  item,
  active,
  dirty,
  onSelect,
}: {
  item: SettingsTabDefinition;
  active: boolean;
  dirty: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type='button'
      className={active ? 'active' : ''}
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
    >
      <Icon size={16} />
      <span className='settings-nav-label'>{item.label}</span>
      {dirty && <i className='settings-nav-dirty' aria-hidden='true' />}
    </button>
  );
}

function SettingsTabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <section className='settings-tab-panel' hidden={!active}>
      {children}
    </section>
  );
}
