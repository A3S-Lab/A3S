import { BrainCircuit, Check, Cpu, Plus, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../../design-system/primitives';
import type { ModelInfo, ProviderInfo } from '../../../../types/api';
import { createModel } from './model-catalog';
import { ModelEditor } from './model-editor';

export function ProviderModelsEditor({
  provider,
  defaultModel,
  onChange,
}: {
  provider: ProviderInfo;
  defaultModel: string;
  onChange(provider: ProviderInfo): void;
}) {
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  useEffect(() => {
    if (selectedModelIndex >= provider.models.length) {
      setSelectedModelIndex(Math.max(0, provider.models.length - 1));
    }
  }, [provider.models.length, selectedModelIndex]);

  const selectedModel = provider.models[selectedModelIndex];
  const addModel = () => {
    const nextModel = createModel(provider.models);
    onChange({ ...provider, models: [...provider.models, nextModel] });
    setSelectedModelIndex(provider.models.length);
  };
  const updateSelectedModel = (model: ModelInfo) => {
    onChange({
      ...provider,
      models: provider.models.map((item, index) => (index === selectedModelIndex ? model : item)),
    });
  };
  const removeSelectedModel = () => {
    const models = provider.models.filter((_, index) => index !== selectedModelIndex);
    onChange({ ...provider, models });
    setSelectedModelIndex(Math.min(selectedModelIndex, Math.max(0, models.length - 1)));
  };

  return (
    <div className='provider-models-editor'>
      <div className='provider-models-toolbar'>
        <div>
          <strong>模型目录</strong>
          <span>选择一个模型查看和编辑它的能力、限额与连接覆盖。</span>
        </div>
        <Button tone='secondary' onClick={addModel}>
          <Plus size={13} /> 添加模型
        </Button>
      </div>

      {provider.models.length ? (
        <div className='provider-model-grid' role='listbox' aria-label={`${provider.name || 'Provider'} 模型目录`}>
          {provider.models.map((model, index) => {
            const reference = `${provider.name}/${model.id}`;
            return (
              <button
                type='button'
                role='option'
                aria-selected={index === selectedModelIndex}
                className={index === selectedModelIndex ? 'selected' : ''}
                onClick={() => setSelectedModelIndex(index)}
                key={index}
              >
                <span className='provider-model-icon' aria-hidden='true'>
                  <Cpu size={14} />
                </span>
                <span className='provider-model-copy'>
                  <strong>{model.name?.trim() || model.id || '未命名模型'}</strong>
                  <small>{model.id || '尚未填写模型标识'}</small>
                </span>
                <span className='provider-model-capabilities' aria-hidden='true'>
                  {model.reasoning && <BrainCircuit size={12} />}
                  {model.toolCall !== false && <Wrench size={12} />}
                  {reference === defaultModel && <Check size={13} />}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className='provider-model-empty'>
          <Cpu size={20} />
          <strong>这个 Provider 还没有模型</strong>
          <span>添加模型后，它才会出现在默认模型和任务模型选择器中。</span>
          <Button tone='secondary' onClick={addModel}>
            <Plus size={13} /> 添加第一个模型
          </Button>
        </div>
      )}

      {selectedModel && (
        <ModelEditor
          model={selectedModel}
          providerName={provider.name}
          isDefault={`${provider.name}/${selectedModel.id}` === defaultModel}
          onChange={updateSelectedModel}
          onRemove={removeSelectedModel}
        />
      )}
    </div>
  );
}
