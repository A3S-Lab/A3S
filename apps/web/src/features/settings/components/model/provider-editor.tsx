import { Server, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Tabs } from '../../../../design-system/primitives';
import type { ProviderInfo } from '../../../../types/api';
import { ProviderConnectionEditor } from './provider-connection-editor';
import { ProviderModelsEditor } from './provider-models-editor';

export function ProviderEditor({
  provider,
  defaultModel,
  onChange,
  onRemove,
}: {
  provider: ProviderInfo;
  defaultModel: string;
  onChange(provider: ProviderInfo): void;
  onRemove(): void;
}) {
  const [activeView, setActiveView] = useState<'connection' | 'models'>('connection');
  const name = provider.name || '未命名 Provider';
  return (
    <div className='model-provider-editor'>
      <header className='model-provider-detail-header'>
        <span className='model-provider-detail-icon' aria-hidden='true'>
          <Server size={16} />
        </span>
        <div>
          <strong>{name}</strong>
          <span>{provider.baseUrl || '使用 Provider 默认 API 地址'}</span>
        </div>
        <Button tone='quiet' className='model-provider-remove' aria-label={`删除 Provider ${name}`} onClick={onRemove}>
          <Trash2 size={13} /> 删除
        </Button>
      </header>

      <Tabs
        ariaLabel={`${name} 配置分类`}
        value={activeView}
        variant='line'
        size='compact'
        className='model-provider-tabs'
        items={[
          { id: 'connection', label: '连接设置' },
          { id: 'models', label: '模型目录', badge: provider.models.length },
        ]}
        onChange={setActiveView}
      />

      <div className='model-provider-detail-body'>
        {activeView === 'connection' ? (
          <ProviderConnectionEditor provider={provider} onChange={onChange} />
        ) : (
          <ProviderModelsEditor provider={provider} defaultModel={defaultModel} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
