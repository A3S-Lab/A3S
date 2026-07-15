import { AlertCircle, Check, CircleDot, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../../../design-system/primitives';
import type { ConfigCategory } from '../../../../types/settings';
import type { SettingsActions } from '../../settings-actions';

export function SettingsLoadState({
  category,
  loading,
  error,
  loaded,
  actions,
  children,
}: {
  category: ConfigCategory;
  loading: boolean;
  error?: string | null;
  loaded: boolean;
  actions: SettingsActions;
  children: ReactNode;
}) {
  if (loading && !loaded) {
    return <div className='settings-state-card loading'>正在读取本机配置…</div>;
  }
  if (!loaded) {
    return (
      <div className='settings-state-card error'>
        <AlertCircle size={18} />
        <div>
          <strong>无法读取这一组设置</strong>
          <span>{error || '本地配置服务没有返回数据。'}</span>
        </div>
        <Button tone='secondary' onClick={() => void actions.loadSettingsCategory(category, true)}>
          <RotateCw size={13} /> 重试
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

export function SettingsSaveState({
  dirty,
  saving,
  savedAt,
  onReset,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  savedAt?: number | null;
  onReset?(): void;
  onSave(): void;
}) {
  return (
    <div className='settings-save-state' aria-live='polite'>
      {dirty ? (
        <span className='dirty'>
          <CircleDot size={12} /> 有未保存的更改
        </span>
      ) : savedAt ? (
        <span className='saved'>
          <Check size={12} /> 已保存
        </span>
      ) : (
        <span className='synced'>配置已同步</span>
      )}
      <span className='settings-save-actions'>
        {dirty && onReset && (
          <Button tone='quiet' disabled={saving} onClick={onReset}>
            撤销
          </Button>
        )}
        <Button tone='primary' loading={saving} disabled={!dirty} onClick={onSave}>
          保存更改
        </Button>
      </span>
    </div>
  );
}
