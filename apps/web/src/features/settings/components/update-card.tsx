import { Download, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import { appState } from '../../../state/app-state';
import type { SettingsActions } from '../settings-actions';

export function UpdateCard({ actions }: { actions: SettingsActions }) {
  const state = useSnapshot(appState);
  const [confirming, setConfirming] = useState(false);
  const status = state.updateStatus;
  const loading = state.updateChecking;
  const installing = state.updateInstalling;
  const error = state.updateCheckError;
  const installError = state.updateInstallError;
  const installedVersion = state.updateInstalledVersion;
  const check = async () => {
    setConfirming(false);
    await actions.checkForUpdates();
  };
  useEffect(() => {
    if (!appState.updateStatus && !appState.updateChecking) void actions.checkForUpdates();
  }, []);
  const install = async () => {
    if (!status?.latestVersion) return;
    try {
      await actions.installUpdate(status.latestVersion);
      setConfirming(false);
    } catch {
      // Keep the reviewed version and confirmation visible for retry or cancel.
    }
  };
  return (
    <section className='update-card'>
      <header>
        <div>
          <strong>版本与更新</strong>
          <span>
            {installedVersion
              ? `已安装 ${installedVersion}，等待重启服务`
              : loading
                ? '正在检查最新版本…'
                : error
                  ? '无法检查更新'
                  : status?.updateAvailable
                    ? `发现 ${status.latestVersion}`
                    : status && !status.latestVersion
                      ? '未获取到最新版本信息'
                      : '当前已是最新版本'}
          </span>
        </div>
        <button
          type='button'
          className='btn-outline'
          disabled={loading || installing}
          onClick={() => {
            void check();
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          检查更新
        </button>
      </header>
      {status && (
        <div className='update-versions'>
          <div>
            <span>当前版本</span>
            <strong>{status.currentVersion}</strong>
          </div>
          <i />
          <div>
            <span>最新版本</span>
            <strong>{status.latestVersion ?? '无法获取'}</strong>
          </div>
        </div>
      )}
      {error && (
        <p className='update-error' role='alert'>
          {error} 当前版本未发生更改，可稍后重试。
        </p>
      )}
      {installError && (
        <p className='update-error' role='alert'>
          安装失败：{installError}。已保留当前版本，可重试或取消。
        </p>
      )}
      {installedVersion && (
        <output className='update-success'>
          {installedVersion} 已安装。请重启 A3S Code Web 服务后再检查更新，不要重复安装。
        </output>
      )}
      {status?.updateAvailable && !installedVersion && (
        <div className='update-action'>
          <p>更新会替换本机 A3S 可执行文件。当前页面不会自动重启服务，安装完成后需要手动重新启动。</p>
          {!status.canSelfUpdate && <p>当前安装方式不支持应用内更新，请使用原安装渠道升级 A3S。</p>}
          {confirming ? (
            <div>
              <button
                type='button'
                className='btn-outline'
                disabled={installing}
                onClick={() => {
                  setConfirming(false);
                }}
              >
                取消
              </button>
              <button
                type='button'
                className='btn'
                disabled={installing || !status.canSelfUpdate}
                onClick={() => {
                  void install();
                }}
              >
                <Download size={14} />
                {installing ? '安装中…' : `确认安装 ${status.latestVersion}`}
              </button>
            </div>
          ) : (
            <button
              type='button'
              className='btn'
              disabled={!status.canSelfUpdate}
              onClick={() => {
                setConfirming(true);
              }}
            >
              <Download size={14} />
              安装更新
            </button>
          )}
        </div>
      )}
    </section>
  );
}
