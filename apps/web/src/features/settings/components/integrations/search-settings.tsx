import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../design-system/primitives';
import type { SearchSettings } from '../../../../types/settings';
import { SettingsDisclosure } from '../config/settings-disclosure';
import { SettingsField } from '../config/settings-field';
import { SettingsNumberField, SettingsSelect, SettingsTextField } from '../config/settings-fields';
import { SettingsRow } from '../config/settings-row';
import { SettingsSwitch } from '../config/settings-switch';

export function SearchSettingsEditor({
  value,
  onChange,
}: {
  value: SearchSettings;
  onChange(value: SearchSettings): void;
}) {
  const updateEngine = (name: string, nextName: string, patch: Partial<SearchSettings['engine'][string]>) => {
    const engine = { ...value.engine[name], ...patch };
    const engines = { ...value.engine };
    delete engines[name];
    engines[nextName] = engine;
    onChange({ ...value, engine: engines });
  };
  const addEngine = () => {
    let name = 'duckduckgo';
    let suffix = 2;
    while (name in value.engine) name = `engine-${suffix++}`;
    onChange({ ...value, engine: { ...value.engine, [name]: { enabled: true, weight: 1, timeout: null } } });
  };
  return (
    <div className='config-stack'>
      <SettingsRow label='默认搜索超时' description='所有搜索引擎的默认超时，单位秒。'>
        <SettingsNumberField
          label='默认搜索超时'
          value={value.timeout}
          min={1}
          suffix='秒'
          onChange={(timeout) => onChange({ ...value, timeout: timeout ?? 10 })}
        />
      </SettingsRow>
      <SettingsRow label='健康监控' description='连续失败后暂时熔断异常引擎。'>
        <SettingsSwitch
          label='搜索健康监控'
          checked={Boolean(value.health)}
          onChange={(enabled) =>
            onChange({ ...value, health: enabled ? { maxFailures: 3, suspendSeconds: 60 } : null })
          }
        />
      </SettingsRow>
      {value.health && (
        <div className='config-field-grid two'>
          <SettingsField label='连续失败次数'>
            <SettingsNumberField
              label='搜索连续失败次数'
              value={value.health.maxFailures}
              min={1}
              suffix='次'
              onChange={(maxFailures) =>
                onChange({ ...value, health: { ...value.health!, maxFailures: maxFailures ?? 1 } })
              }
            />
          </SettingsField>
          <SettingsField label='暂停时间（秒）'>
            <SettingsNumberField
              label='搜索引擎暂停时间'
              value={value.health.suspendSeconds}
              min={1}
              suffix='秒'
              onChange={(suspendSeconds) =>
                onChange({ ...value, health: { ...value.health!, suspendSeconds: suspendSeconds ?? 1 } })
              }
            />
          </SettingsField>
        </div>
      )}

      <div className='config-nested-header'>
        <div>
          <strong>搜索引擎</strong>
          <span>设置引擎权重、启用状态和独立超时。</span>
        </div>
        <Button tone='secondary' onClick={addEngine}>
          <Plus size={13} /> 添加引擎
        </Button>
      </div>
      <div className='search-engine-list'>
        {Object.entries(value.engine).map(([name, engine]) => (
          <div className='search-engine-row' key={name}>
            <SettingsSwitch
              label={`启用搜索引擎 ${name}`}
              checked={engine.enabled}
              onChange={(enabled) => updateEngine(name, name, { enabled })}
            />
            <SettingsTextField
              label={`${name} 引擎名称`}
              value={name}
              onChange={(nextName) => updateEngine(name, nextName, {})}
            />
            <SettingsNumberField
              label={`${name} 搜索权重`}
              value={engine.weight}
              min={0}
              step={0.1}
              onChange={(weight) => updateEngine(name, name, { weight: weight ?? 1 })}
            />
            <SettingsNumberField
              label={`${name} 搜索超时`}
              value={engine.timeout}
              min={1}
              placeholder='继承'
              suffix='秒'
              onChange={(timeout) => updateEngine(name, name, { timeout })}
            />
            <button
              type='button'
              aria-label={`删除搜索引擎 ${name}`}
              onClick={() => {
                const engines = { ...value.engine };
                delete engines[name];
                onChange({ ...value, engine: engines });
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {!Object.keys(value.engine).length && <div className='config-empty-inline'>没有配置搜索引擎。</div>}
      </div>

      <SettingsDisclosure
        title='无头浏览器'
        description='Google、百度等需要 JavaScript 渲染的引擎使用该浏览器池。'
        badge={
          <SettingsSwitch
            label='启用搜索无头浏览器'
            checked={Boolean(value.headless)}
            onChange={(enabled) =>
              onChange({
                ...value,
                headless: enabled
                  ? { backend: 'chrome', maxTabs: 4, browserPath: null, launchArgs: [], proxyUrl: null }
                  : null,
              })
            }
          />
        }
      >
        {value.headless && (
          <>
            <SettingsRow label='浏览器后端'>
              <SettingsSelect
                label='搜索浏览器后端'
                value={value.headless.backend}
                options={[
                  { value: 'chrome', label: 'Chrome / Chromium' },
                  { value: 'lightpanda', label: 'Lightpanda' },
                ]}
                onChange={(backend) => onChange({ ...value, headless: { ...value.headless!, backend } })}
              />
            </SettingsRow>
            <SettingsRow label='最大并发标签页'>
              <SettingsNumberField
                label='搜索最大并发标签页'
                value={value.headless.maxTabs}
                min={1}
                suffix='个'
                onChange={(maxTabs) => onChange({ ...value, headless: { ...value.headless!, maxTabs: maxTabs ?? 1 } })}
              />
            </SettingsRow>
            <SettingsRow label='浏览器可执行文件' description='留空时自动发现或下载。'>
              <SettingsTextField
                label='搜索浏览器可执行文件'
                value={value.headless.browserPath}
                placeholder='自动发现'
                onChange={(browserPath) =>
                  onChange({ ...value, headless: { ...value.headless!, browserPath: browserPath || null } })
                }
              />
            </SettingsRow>
            <SettingsRow label='启动参数' description='使用逗号分隔。'>
              <SettingsTextField
                label='搜索浏览器启动参数'
                value={value.headless.launchArgs.join(', ')}
                placeholder='--disable-gpu'
                onChange={(text) =>
                  onChange({ ...value, headless: { ...value.headless!, launchArgs: commaList(text) } })
                }
              />
            </SettingsRow>
            <SettingsRow label='浏览器代理'>
              <SettingsTextField
                label='搜索浏览器代理'
                value={value.headless.proxyUrl}
                placeholder='http://127.0.0.1:7890'
                onChange={(proxyUrl) =>
                  onChange({ ...value, headless: { ...value.headless!, proxyUrl: proxyUrl || null } })
                }
              />
            </SettingsRow>
          </>
        )}
      </SettingsDisclosure>
    </div>
  );
}

function commaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function defaultSearchSettings(): SearchSettings {
  return { timeout: 10, health: null, engine: {}, headless: null };
}
