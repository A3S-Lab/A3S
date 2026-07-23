import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  FileCode2,
  RefreshCw,
  TerminalSquare,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, IconButton, SearchField, StateView, StatusBadge } from '../../../design-system/primitives';
import { appState, formatApiError, navigateTask, showToast } from '../../../state/app-state';
import type { ToolOutputRecord } from '../../../types/api';
import type { RunActions } from '../run-actions';

type OutputFilter = 'all' | 'success' | 'error';

export function RunsPage({ actions }: { actions: RunActions }) {
  const state = useSnapshot(appState);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<OutputFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = state.sessionOutputSessionId === state.activeSessionId ? (state.sessionOutput?.items ?? []) : [];
  const outputError = state.sessionOutputErrorSessionId === state.activeSessionId ? state.sessionOutputError : null;
  const normalized = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (filter === 'success' && item.isError) return false;
        if (filter === 'error' && !item.isError) return false;
        if (!normalized) return true;
        return `${item.toolName} ${item.input} ${item.output} ${item.filePath ?? ''}`
          .toLowerCase()
          .includes(normalized);
      }),
    [filter, items, normalized]
  );
  const selected = items.find((item) => item.id === selectedId) ?? null;
  useEffect(() => {
    if (state.activeSessionId) void actions.openSessionOutput();
  }, [state.activeSessionId]);

  if (!state.activeSessionId) {
    return (
      <section className='runs-page' aria-label='任务活动'>
        <StateView
          className='output-empty task-required'
          icon={<TerminalSquare size={24} />}
          title='开始任务后查看活动'
          description='工具调用、耗时、输入和输出会归档到对应任务。'
          actions={
            <Button tone='primary' onClick={() => navigateTask('conversation')}>
              返回对话
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section className='runs-page' aria-label='当前任务活动'>
      <section className='output-panel'>
        <header>
          <div>
            <p className='eyebrow'>CURRENT TASK ACTIVITY</p>
            <h2>当前任务活动</h2>
            <span>{items.length ? `${items.length} 次已完成工具调用` : '执行过程会持续记录在当前任务中'}</span>
          </div>
          <div>
            <IconButton
              label='刷新工具记录'
              disabled={state.sessionOutputLoading}
              onClick={() => {
                void actions.openSessionOutput();
              }}
            >
              <RefreshCw className={state.sessionOutputLoading ? 'spin' : ''} size={16} />
            </IconButton>
          </div>
        </header>

        <div className='output-toolbar'>
          <SearchField label='搜索工具记录' value={query} placeholder='搜索工具、输入或输出' onValueChange={setQuery} />
          <fieldset aria-label='工具状态筛选'>
            {(['all', 'success', 'error'] as const).map((id) => (
              <button
                type='button'
                aria-pressed={filter === id}
                className={filter === id ? 'active' : ''}
                key={id}
                onClick={() => setFilter(id)}
              >
                {id === 'all' ? '全部' : id === 'success' ? '成功' : '失败'}
              </button>
            ))}
          </fieldset>
        </div>

        <div className={`output-layout ${selected ? 'with-detail' : ''}`}>
          <div className='output-list'>
            {state.sessionOutputLoading ? (
              <StateView
                className='output-empty'
                size='compact'
                role='status'
                icon={<RefreshCw className='spin' size={18} />}
                title='正在加载工具记录'
              />
            ) : outputError ? (
              <StateView
                className='output-empty output-error'
                size='compact'
                role='alert'
                tone='danger'
                icon={<XCircle size={21} />}
                title='无法加载当前任务活动'
                description={`${outputError} 已保留任务内容，可以重新加载工具记录。`}
                actions={
                  <Button
                    onClick={() => {
                      void actions.openSessionOutput();
                    }}
                  >
                    重新加载活动
                  </Button>
                }
              />
            ) : visible.length ? (
              visible.map((item) => (
                <OutputRow
                  key={item.id}
                  item={item}
                  active={selected?.id === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))
            ) : (
              <StateView
                className='output-empty'
                size='compact'
                icon={<TerminalSquare size={21} />}
                title={items.length ? '没有匹配记录' : '当前任务还没有工具活动'}
                description={
                  items.length
                    ? '尝试修改搜索或筛选条件。'
                    : '回到对话让 Agent 开始执行；文件读取、命令与修改记录会归档到这个任务。'
                }
                actions={
                  !items.length ? (
                    <Button tone='primary' onClick={() => navigateTask('conversation')}>
                      返回对话继续任务
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
          {selected && <OutputDetail item={selected} onClose={() => setSelectedId(null)} />}
        </div>
      </section>
    </section>
  );
}

function OutputRow({ item, active, onSelect }: { item: ToolOutputRecord; active: boolean; onSelect: () => void }) {
  return (
    <button type='button' aria-pressed={active} className={`output-row ${active ? 'active' : ''}`} onClick={onSelect}>
      <span className={`output-status ${item.isError ? 'error' : 'success'}`}>
        {item.isError ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
      </span>
      <div>
        <strong>{item.toolName}</strong>
        <small>{summarize(item.input) || '无输入参数'}</small>
      </div>
      <span className='output-meta'>
        {formatDuration(item.durationMs)}
        <ChevronRight size={14} />
      </span>
    </button>
  );
}

function OutputDetail({ item, onClose }: { item: ToolOutputRecord; onClose: () => void }) {
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast('已复制到剪贴板', 'success');
    } catch (error) {
      showToast(formatApiError(error), 'error');
    }
  };
  return (
    <aside className='output-detail' aria-label={`${item.toolName} 详情`}>
      <header>
        <div>
          <strong>{item.toolName}</strong>
          <StatusBadge tone={item.isError ? 'danger' : 'success'}>{item.isError ? '执行失败' : '执行成功'}</StatusBadge>
        </div>
        <IconButton label='关闭详情' onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      <dl>
        {item.createdAt && (
          <div>
            <dt>
              <Clock3 size={13} />
              开始时间
            </dt>
            <dd>{formatTime(item.createdAt)}</dd>
          </div>
        )}
        {item.durationMs != null && (
          <div>
            <dt>
              <Clock3 size={13} />
              耗时
            </dt>
            <dd>{formatDuration(item.durationMs)}</dd>
          </div>
        )}
        {item.exitCode != null && (
          <div>
            <dt>
              <TerminalSquare size={13} />
              退出码
            </dt>
            <dd>{String(item.exitCode)}</dd>
          </div>
        )}
        {item.filePath && (
          <div>
            <dt>
              <FileCode2 size={13} />
              文件
            </dt>
            <dd>{item.filePath}</dd>
          </div>
        )}
      </dl>
      <OutputCode title='输入' value={item.input} onCopy={copy} />
      <OutputCode title='输出' value={item.output} onCopy={copy} />
    </aside>
  );
}

function OutputCode({
  title,
  value,
  onCopy,
}: {
  title: string;
  value: string;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <section className='output-code'>
      <header>
        <strong>{title}</strong>
        <Button
          className='output-code-copy'
          tone='quiet'
          aria-label={`复制${title}`}
          onClick={() => {
            void onCopy(value);
          }}
        >
          <Copy size={13} />
          复制
        </Button>
      </header>
      <pre>{value || '—'}</pre>
    </section>
  );
}

function summarize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 110);
}
function formatDuration(value?: number | null): string {
  return value == null ? '' : value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}
function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
