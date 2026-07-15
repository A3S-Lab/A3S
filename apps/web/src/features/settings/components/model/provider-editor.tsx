import { Server, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../../design-system/primitives';
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

      <div className='model-provider-tabs' role='tablist' aria-label={`${name} 配置分类`}>
        <button
          type='button'
          role='tab'
          aria-selected={activeView === 'connection'}
          onClick={() => setActiveView('connection')}
        >
          连接设置
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={activeView === 'models'}
          onClick={() => setActiveView('models')}
        >
          模型目录 <span>{provider.models.length}</span>
        </button>
      </div>

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
