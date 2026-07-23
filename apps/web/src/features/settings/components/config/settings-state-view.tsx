import { AlertCircle, Check, CircleDot, LoaderCircle, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, InlineNotice, StateView, StatusBadge } from '../../../../design-system/primitives';
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
    return (
      <StateView
        className='settings-state-view'
        size='compact'
        role='status'
        icon={<LoaderCircle className='spin' size={18} />}
        title='正在读取本机配置…'
        description='正在从 A3S Boot 同步这一组设置。'
      />
    );
  }
  if (!loaded) {
    return (
      <StateView
        className='settings-state-view'
        size='compact'
        tone='danger'
        role='alert'
        icon={<AlertCircle size={18} />}
        title='无法读取这一组设置'
        description={error || '本地配置服务没有返回数据。'}
        actions={
          <Button tone='secondary' onClick={() => void actions.loadSettingsCategory(category, true)}>
            <RotateCw size={13} /> 重试
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}

export function SettingsCategoryError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <InlineNotice
      className='settings-category-notice'
      tone='danger'
      role='alert'
      icon={<AlertCircle size={17} />}
      title='设置未同步'
    >
      <p>{message}</p>
      <p>当前草稿仍然保留，可修改后重试。</p>
    </InlineNotice>
  );
}

export function SettingsSaveState({
  dirty,
  saving,
  savedAt,
  onReset,
  onSave,
  disabled = false,
}: {
  dirty: boolean;
  saving: boolean;
  savedAt?: number | null;
  onReset?(): void;
  onSave(): void;
  disabled?: boolean;
}) {
  return (
    <div className='settings-save-state' aria-live='polite'>
      {dirty ? (
        <StatusBadge tone='warning'>
          <CircleDot size={12} /> 有未保存的更改
        </StatusBadge>
      ) : savedAt ? (
        <StatusBadge tone='success'>
          <Check size={12} /> 已保存
        </StatusBadge>
      ) : (
        <StatusBadge tone='neutral'>配置已同步</StatusBadge>
      )}
      <span className='settings-save-actions'>
        {dirty && onReset && (
          <Button tone='quiet' disabled={saving} onClick={onReset}>
            撤销
          </Button>
        )}
        <Button tone='primary' loading={saving} disabled={!dirty || disabled} onClick={onSave}>
          保存更改
        </Button>
      </span>
    </div>
  );
}
