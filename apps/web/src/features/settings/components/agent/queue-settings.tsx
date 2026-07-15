import type { QueueLane, QueueLaneHandlerSettings, QueueSettings } from '../../../../types/settings';
import { SettingsDisclosure } from '../config/settings-disclosure';
import { SettingsField } from '../config/settings-field';
import { SettingsNumberField, SettingsSelect, SettingsTextField } from '../config/settings-fields';
import { SettingsRow } from '../config/settings-row';
import { SettingsSwitch } from '../config/settings-switch';

const lanes: Array<{ id: QueueLane; label: string; concurrency: keyof QueueSettings }> = [
  { id: 'Control', label: '控制', concurrency: 'controlMaxConcurrency' },
  { id: 'Query', label: '查询', concurrency: 'queryMaxConcurrency' },
  { id: 'Execute', label: '执行', concurrency: 'executeMaxConcurrency' },
  { id: 'Generate', label: '生成', concurrency: 'generateMaxConcurrency' },
];

export function QueueSettingsEditor({
  value,
  onChange,
}: {
  value: QueueSettings;
  onChange(value: QueueSettings): void;
}) {
  const update = <K extends keyof QueueSettings>(key: K, next: QueueSettings[K]) => onChange({ ...value, [key]: next });
  return (
    <div className='config-stack'>
      <div className='config-field-grid four'>
        {lanes.map((lane) => (
          <SettingsField label={`${lane.label}并发`} key={lane.id}>
            <SettingsNumberField
              label={`${lane.label}队列最大并发`}
              value={value[lane.concurrency] as number}
              min={1}
              suffix='个'
              onChange={(next) => update(lane.concurrency, (next ?? 1) as never)}
            />
          </SettingsField>
        ))}
      </div>

      <div className='config-subsection-grid capabilities'>
        <Toggle label='失败队列（DLQ）' checked={value.enableDlq} onChange={(next) => update('enableDlq', next)} />
        <Toggle label='指标采集' checked={value.enableMetrics} onChange={(next) => update('enableMetrics', next)} />
        <Toggle label='队列告警' checked={value.enableAlerts} onChange={(next) => update('enableAlerts', next)} />
      </div>

      <SettingsRow label='DLQ 最大容量' description='仅在失败队列启用时使用；留空采用运行时默认值。'>
        <SettingsNumberField
          label='DLQ 最大容量'
          value={value.dlqMaxSize}
          min={1}
          suffix='项'
          onChange={(next) => update('dlqMaxSize', next)}
        />
      </SettingsRow>
      <SettingsRow label='默认任务超时' description='所有 Lane 的默认超时，单位毫秒。'>
        <SettingsNumberField
          label='队列默认任务超时'
          value={value.defaultTimeoutMs}
          min={1}
          suffix='ms'
          onChange={(next) => update('defaultTimeoutMs', next)}
        />
      </SettingsRow>
      <SettingsRow label='持久化目录' description='留空时队列状态仅保存在内存。'>
        <SettingsTextField
          label='队列持久化目录'
          value={value.storagePath}
          placeholder='./queue'
          onChange={(next) => update('storagePath', next || null)}
        />
      </SettingsRow>
      <SettingsRow label='压力阈值' description='达到该队列深度后发布压力事件。'>
        <SettingsNumberField
          label='队列压力阈值'
          value={value.pressureThreshold}
          min={1}
          suffix='项'
          onChange={(next) => update('pressureThreshold', next)}
        />
      </SettingsRow>

      <SettingsDisclosure title='Lane 路由与超时' description='为四种任务通道配置内部、外部或混合处理。'>
        <div className='queue-lane-list'>
          {lanes.map((lane) => {
            const handler = value.laneHandlers[lane.id] ?? defaultHandler();
            return (
              <div className='queue-lane-row' key={lane.id}>
                <strong>{lane.label}</strong>
                <SettingsSelect
                  label={`${lane.label}处理模式`}
                  value={handler.mode}
                  options={[
                    { value: 'Internal', label: '内部执行' },
                    { value: 'External', label: '外部处理' },
                    { value: 'Hybrid', label: '混合模式' },
                  ]}
                  onChange={(mode) => updateHandler(value, onChange, lane.id, { ...handler, mode })}
                />
                <SettingsNumberField
                  label={`${lane.label}外部处理超时`}
                  value={handler.timeout_ms}
                  min={1}
                  suffix='ms'
                  onChange={(timeout_ms) =>
                    updateHandler(value, onChange, lane.id, { ...handler, timeout_ms: timeout_ms ?? 60_000 })
                  }
                />
                <SettingsNumberField
                  label={`${lane.label}Lane 超时`}
                  value={value.laneTimeouts[lane.id]}
                  min={1}
                  placeholder='继承默认'
                  suffix='ms'
                  onChange={(timeout) => {
                    const laneTimeouts = { ...value.laneTimeouts };
                    if (timeout === null) delete laneTimeouts[lane.id];
                    else laneTimeouts[lane.id] = timeout;
                    update('laneTimeouts', laneTimeouts);
                  }}
                />
              </div>
            );
          })}
        </div>
      </SettingsDisclosure>

      <OptionalQueueBlock
        title='重试策略'
        description='失败任务的自动重试与退避规则。'
        enabled={Boolean(value.retryPolicy)}
        onToggle={(enabled) => update('retryPolicy', enabled ? defaultRetryPolicy() : null)}
      >
        {value.retryPolicy && (
          <>
            <SettingsRow label='策略'>
              <SettingsSelect
                label='队列重试策略'
                value={value.retryPolicy.strategy}
                options={[
                  { value: 'exponential', label: '指数退避' },
                  { value: 'fixed', label: '固定间隔' },
                  { value: 'none', label: '不重试' },
                ]}
                onChange={(strategy) => update('retryPolicy', { ...value.retryPolicy!, strategy })}
              />
            </SettingsRow>
            <div className='config-field-grid three'>
              <NumberLabel
                label='最大重试次数'
                value={value.retryPolicy.maxRetries}
                onChange={(maxRetries) => update('retryPolicy', { ...value.retryPolicy!, maxRetries: maxRetries ?? 0 })}
              />
              <NumberLabel
                label='初始延迟（ms）'
                value={value.retryPolicy.initialDelayMs}
                onChange={(initialDelayMs) =>
                  update('retryPolicy', { ...value.retryPolicy!, initialDelayMs: initialDelayMs ?? 0 })
                }
              />
              <NumberLabel
                label='固定延迟（ms）'
                value={value.retryPolicy.fixedDelayMs}
                onChange={(fixedDelayMs) => update('retryPolicy', { ...value.retryPolicy!, fixedDelayMs })}
              />
            </div>
          </>
        )}
      </OptionalQueueBlock>

      <OptionalQueueBlock
        title='速率限制'
        description='限制每个周期可进入队列的操作数量。'
        enabled={Boolean(value.rateLimit)}
        onToggle={(enabled) => update('rateLimit', enabled ? { limitType: 'per_second', maxOperations: 100 } : null)}
      >
        {value.rateLimit && (
          <div className='config-field-grid two'>
            <SettingsField label='周期'>
              <SettingsSelect
                label='队列速率限制周期'
                value={value.rateLimit.limitType}
                options={[
                  { value: 'per_second', label: '每秒' },
                  { value: 'per_minute', label: '每分钟' },
                  { value: 'per_hour', label: '每小时' },
                  { value: 'unlimited', label: '不限速' },
                ]}
                onChange={(limitType) => update('rateLimit', { ...value.rateLimit!, limitType })}
              />
            </SettingsField>
            <NumberLabel
              label='最大操作数'
              value={value.rateLimit.maxOperations}
              onChange={(maxOperations) => update('rateLimit', { ...value.rateLimit!, maxOperations })}
            />
          </div>
        )}
      </OptionalQueueBlock>

      <OptionalQueueBlock
        title='优先级提升'
        description='临近截止时间时提高任务优先级。'
        enabled={Boolean(value.priorityBoost)}
        onToggle={(enabled) => update('priorityBoost', enabled ? { strategy: 'standard', deadlineMs: 300_000 } : null)}
      >
        {value.priorityBoost && (
          <div className='config-field-grid two'>
            <SettingsField label='策略'>
              <SettingsSelect
                label='队列优先级提升策略'
                value={value.priorityBoost.strategy}
                options={[
                  { value: 'standard', label: '标准' },
                  { value: 'aggressive', label: '积极' },
                  { value: 'disabled', label: '禁用' },
                ]}
                onChange={(strategy) => update('priorityBoost', { ...value.priorityBoost!, strategy })}
              />
            </SettingsField>
            <NumberLabel
              label='截止时间（ms）'
              value={value.priorityBoost.deadlineMs}
              onChange={(deadlineMs) => update('priorityBoost', { ...value.priorityBoost!, deadlineMs })}
            />
          </div>
        )}
      </OptionalQueueBlock>
    </div>
  );
}

function OptionalQueueBlock({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle(value: boolean): void;
  children: React.ReactNode;
}) {
  return (
    <SettingsDisclosure
      title={title}
      description={description}
      badge={<SettingsSwitch checked={enabled} label={title} onChange={onToggle} />}
    >
      {children}
    </SettingsDisclosure>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
  return (
    <div>
      <span>{label}</span>
      <SettingsSwitch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

function NumberLabel({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number | null;
  onChange(value: number | null): void;
}) {
  return (
    <SettingsField label={label}>
      <SettingsNumberField label={label} value={value} min={0} onChange={onChange} />
    </SettingsField>
  );
}

function updateHandler(
  value: QueueSettings,
  onChange: (value: QueueSettings) => void,
  lane: QueueLane,
  handler: QueueLaneHandlerSettings
) {
  onChange({ ...value, laneHandlers: { ...value.laneHandlers, [lane]: handler } });
}

function defaultHandler(): QueueLaneHandlerSettings {
  return { mode: 'Internal', timeout_ms: 60_000 };
}

function defaultRetryPolicy() {
  return { strategy: 'exponential' as const, maxRetries: 3, initialDelayMs: 100, fixedDelayMs: null };
}

export function defaultQueueSettings(): QueueSettings {
  return {
    controlMaxConcurrency: 2,
    queryMaxConcurrency: 4,
    executeMaxConcurrency: 2,
    generateMaxConcurrency: 1,
    laneHandlers: {},
    enableDlq: false,
    dlqMaxSize: null,
    enableMetrics: false,
    enableAlerts: false,
    defaultTimeoutMs: null,
    storagePath: null,
    retryPolicy: null,
    rateLimit: null,
    priorityBoost: null,
    pressureThreshold: null,
    laneTimeouts: {},
  };
}
