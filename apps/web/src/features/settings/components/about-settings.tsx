import { ExternalLink } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { SettingsActions } from '../settings-actions';
import { UpdateCard } from './update-card';

export function AboutSettings({ actions }: { actions: SettingsActions }) {
  const state = useSnapshot(appState);
  return (
    <div className='settings-section about-settings'>
      <img src='/logo.png' alt='A3S' />
      <h3>A3S Code Web</h3>
      <p>单智能体、本地优先的 A3S Code 浏览器工作台。</p>
      <dl>
        <div>
          <dt>CLI 版本</dt>
          <dd>{state.health?.version}</dd>
        </div>
        <div>
          <dt>API 状态</dt>
          <dd>
            <span className={`status-dot ${state.serviceStatus}`} />{' '}
            {state.serviceStatus === 'connected'
              ? '已连接'
              : state.serviceStatus === 'checking'
                ? '正在检查'
                : '连接中断'}
          </dd>
        </div>
        <div>
          <dt>配置文件</dt>
          <dd>{state.health?.configPath}</dd>
        </div>
      </dl>
      <a href='https://a3s.site' target='_blank' rel='noreferrer'>
        A3S 文档 <ExternalLink size={14} />
      </a>
      <UpdateCard actions={actions} />
    </div>
  );
}
