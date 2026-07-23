import { Cpu } from 'lucide-react';
import { ModelCombobox, StateView } from '../../../../design-system/primitives';
import type { CatalogModel } from '../../../../types/api';
import { SettingsSection } from '../config/settings-section';

export function DefaultModelSetting({
  models,
  providerCount,
  value,
  savedValue,
  onChange,
}: {
  models: CatalogModel[];
  providerCount: number;
  value: string;
  savedValue: string;
  onChange(value: string): void;
}) {
  const current = models.find((model) => model.id === value);
  return (
    <SettingsSection
      title='默认模型'
      description='新任务会使用这里选择的模型；运行中的任务不会被切换。'
      className='model-default-section'
    >
      {current ? (
        <div className='model-default-setting'>
          <span className='model-default-icon' aria-hidden='true'>
            <Cpu size={17} />
          </span>
          <div className='model-default-copy'>
            <strong>新任务默认模型</strong>
            <span>
              {providerCount} 个 Provider · {models.length} 个模型
              {current.reasoning ? ' · 支持推理' : ''}
              {current.toolCall ? ' · 支持工具' : ''}
            </span>
          </div>
          <div className='model-default-picker'>
            <ModelCombobox
              sourceTabs
              models={models}
              value={value}
              defaultModel={savedValue}
              label='设置默认模型'
              onChange={onChange}
            />
          </div>
        </div>
      ) : (
        <StateView
          className='model-default-empty'
          size='compact'
          icon={<Cpu size={17} />}
          title='还没有可用模型'
          description='先在下方添加 Provider，再为它添加至少一个模型。'
        />
      )}
    </SettingsSection>
  );
}
