import { MessageSquareText } from 'lucide-react';
import { StateView, StatusBadge } from '../../../design-system/primitives';

export function FeishuChannelPage() {
  return (
    <StateView
      className='channel-settings-placeholder'
      size='compact'
      icon={<MessageSquareText size={22} />}
      title='飞书渠道'
      description='飞书接入正在规划中。'
    >
      <StatusBadge>敬请期待</StatusBadge>
    </StateView>
  );
}
