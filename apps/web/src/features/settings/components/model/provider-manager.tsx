import { CheckCircle2, Plus, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, CollectionState, StateView } from '../../../../design-system/primitives';
import type { ProviderInfo } from '../../../../types/api';
import { SettingsSection } from '../config/settings-section';
import { createProvider } from './model-catalog';
import { ProviderEditor } from './provider-editor';

export function ProviderManager({
  providers,
  defaultModel,
  onChange,
}: {
  providers: ProviderInfo[];
  defaultModel: string;
  onChange(providers: ProviderInfo[]): void;
}) {
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);
  useEffect(() => {
    if (selectedProviderIndex >= providers.length) {
      setSelectedProviderIndex(Math.max(0, providers.length - 1));
    }
  }, [providers.length, selectedProviderIndex]);

  const selectedProvider = providers[selectedProviderIndex];
  const addProvider = () => {
    const next = [...providers, createProvider(providers)];
    onChange(next);
    setSelectedProviderIndex(next.length - 1);
  };
  const updateSelectedProvider = (provider: ProviderInfo) => {
    onChange(providers.map((item, index) => (index === selectedProviderIndex ? provider : item)));
  };
  const removeSelectedProvider = () => {
    const next = providers.filter((_, index) => index !== selectedProviderIndex);
    onChange(next);
    setSelectedProviderIndex(Math.min(selectedProviderIndex, Math.max(0, next.length - 1)));
  };

  return (
    <SettingsSection
      title='Provider 与模型'
      description='选择一个 Provider 后，只编辑它的连接信息和模型目录。密钥始终保存在本机。'
      className='model-provider-section'
      action={
        <Button tone='secondary' onClick={addProvider}>
          <Plus size={13} /> 添加 Provider
        </Button>
      }
    >
      <div className='model-provider-manager'>
        <aside className='model-provider-list' aria-label='Provider 列表'>
          {providers.map((provider, index) => {
            const name = provider.name || '未命名 Provider';
            const selected = index === selectedProviderIndex;
            return (
              <button
                type='button'
                className={selected ? 'selected' : ''}
                aria-label={`编辑 Provider ${name}`}
                aria-pressed={selected}
                onClick={() => setSelectedProviderIndex(index)}
                key={index}
              >
                <span className='model-provider-mark' aria-hidden='true'>
                  <Server size={14} />
                </span>
                <span className='model-provider-list-copy'>
                  <strong>{name}</strong>
                  <small>{provider.models.length} 个模型</small>
                </span>
                {provider.apiKey && (
                  <span className='model-provider-ready' title='API Key 已配置' role='img' aria-label='API Key 已配置'>
                    <CheckCircle2 size={13} />
                  </span>
                )}
              </button>
            );
          })}
          {!providers.length && (
            <CollectionState className='model-provider-list-empty' role='status'>
              尚未添加 Provider
            </CollectionState>
          )}
        </aside>

        <div className='model-provider-workspace'>
          {selectedProvider ? (
            <ProviderEditor
              provider={selectedProvider}
              defaultModel={defaultModel}
              onChange={updateSelectedProvider}
              onRemove={removeSelectedProvider}
            />
          ) : (
            <StateView
              className='model-provider-empty'
              icon={<Server size={22} />}
              title='添加第一个 Provider'
              description='配置连接信息后，再添加可以用于任务的模型。'
              actions={
                <Button tone='secondary' onClick={addProvider}>
                  <Plus size={13} /> 添加 Provider
                </Button>
              }
            />
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
