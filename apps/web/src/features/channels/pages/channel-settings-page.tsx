import { AlertTriangle, MessageCircleMore, MessageSquareText } from 'lucide-react';
import { useId } from 'react';
import { useSnapshot } from 'valtio';
import { StateView, type TabItem, Tabs } from '../../../design-system/primitives';
import { appState, navigateSettingsChannel } from '../../../state/app-state';
import type { ChannelSettingsTab } from '../../settings/settings-state';
import { WeixinRemotePage } from '../../weixin-remote/pages/weixin-remote-page';
import type { WeixinRemoteActions } from '../../weixin-remote/use-weixin-remote-controller';
import { FeishuChannelPage } from './feishu-channel-page';

const channels: Array<{ id: ChannelSettingsTab; label: string }> = [
  { id: 'weixin', label: '微信' },
  { id: 'feishu', label: '飞书' },
];

export function ChannelSettingsPage({ weixinActions }: { weixinActions?: WeixinRemoteActions }) {
  const state = useSnapshot(appState);
  const tabListId = useId();
  const items: readonly TabItem<ChannelSettingsTab>[] = channels.map((channel) => ({
    ...channel,
    icon: channel.id === 'weixin' ? <MessageCircleMore size={15} /> : <MessageSquareText size={15} />,
    panelId: `${tabListId}-${channel.id}-panel`,
  }));

  return (
    <section className='channel-settings-page' aria-label='渠道设置'>
      <Tabs
        ariaLabel='渠道'
        value={state.settingsChannel}
        items={items}
        variant='line'
        className='channel-settings-tabs'
        onChange={navigateSettingsChannel}
      />

      <section
        id={`${tabListId}-weixin-panel`}
        className='channel-settings-panel'
        role='tabpanel'
        aria-label='微信'
        hidden={state.settingsChannel !== 'weixin'}
      >
        {weixinActions ? (
          <WeixinRemotePage actions={weixinActions} embedded />
        ) : (
          <StateView
            className='channel-settings-controller-unavailable'
            size='compact'
            tone='danger'
            role='alert'
            icon={<AlertTriangle size={20} />}
            title='微信渠道控制器当前不可用'
            description='请重新连接本机 A3S Boot 后再试。'
          />
        )}
      </section>

      <section
        id={`${tabListId}-feishu-panel`}
        className='channel-settings-panel'
        role='tabpanel'
        aria-label='飞书'
        hidden={state.settingsChannel !== 'feishu'}
      >
        <FeishuChannelPage />
      </section>
    </section>
  );
}
