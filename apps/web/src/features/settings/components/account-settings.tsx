import { Cloud, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { SettingsActions } from '../settings-actions';

export function AccountSettings({ actions }: { actions: SettingsActions }) {
  const state = useSnapshot(appState);
  const [accountBusy, setAccountBusy] = useState(false);
  const signedIn = state.osAccount?.signedIn;
  const runAccountAction = async () => {
    if (accountBusy) return;
    setAccountBusy(true);
    try {
      if (signedIn) await actions.logout();
      else await actions.loginWithOs();
    } catch {
      // The controller keeps the existing account state and reports the error.
    } finally {
      setAccountBusy(false);
    }
  };
  return (
    <div className='settings-section'>
      <div className='setting-heading'>
        <h3>A3S OS 连接</h3>
        <p>OAuth 凭据由本机 A3S CLI 安全持有，不会写入浏览器存储。</p>
      </div>
      <div className='os-account-card'>
        <img src='/logo.png' alt='' />
        <div>
          <strong>{state.osAccount?.label || state.osAccount?.origin || '未配置 A3S OS'}</strong>
          <span>
            {signedIn
              ? state.osAccount?.runtimeToolActive
                ? '已授权 · Runtime 工具可用'
                : '已授权 · Runtime 工具未启用'
              : state.osAccount?.configured
                ? '等待你授权连接'
                : '请先在本机配置 A3S OS 地址'}
          </span>
        </div>
        <span className={`connection-badge ${signedIn ? 'online' : ''}`}>{signedIn ? '已连接' : '未连接'}</span>
      </div>
      {!state.osAccount?.configured && state.health?.configPath && (
        <p className='account-config-hint'>配置文件：{state.health.configPath}</p>
      )}
      <div className='account-capabilities'>
        <div>
          <span>内置技能</span>
          <strong>{state.osAccount?.builtinSkillActive ? '可用' : '未启用'}</strong>
        </div>
        <div>
          <span>OS 能力技能</span>
          <strong>{state.osAccount?.capabilitySkillActive ? '可用' : '未启用'}</strong>
        </div>
        <div>
          <span>Runtime 工具</span>
          <strong>{state.osAccount?.runtimeToolActive ? '可用' : '未启用'}</strong>
        </div>
      </div>
      {signedIn ? (
        <button
          type='button'
          className='btn-outline danger-btn'
          disabled={accountBusy}
          onClick={() => {
            void runAccountAction();
          }}
        >
          <LogOut size={16} />
          {accountBusy ? '正在退出…' : '退出 A3S OS'}
        </button>
      ) : (
        <button
          type='button'
          className='btn'
          disabled={!state.osAccount?.configured || accountBusy}
          onClick={() => {
            void runAccountAction();
          }}
        >
          <Cloud size={16} />
          {accountBusy ? '正在连接…' : '授权连接'}
        </button>
      )}
    </div>
  );
}
