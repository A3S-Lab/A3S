import { ClipboardCopy, Clock3, Database, Eye, Network, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { CollectionState, IconButton } from '../../../design-system/primitives';
import { showToast } from '../../../state/app-state';
import type { MemoryEntry, MemoryGraphEntity, MemoryOverview } from '../../../types/api';
import {
  entityKindLabel,
  entityNameLabel,
  formatMemoryDate,
  memorySourceLabel,
  memoryTagLabel,
  memoryTypeLabel,
} from '../memory-format';
import { entityForId, eventForMemory } from '../memory-projection';
import type { MemoryInspectorSelection } from '../memory-state';

export function MemoryInspector({
  data,
  selection,
  visibleMemoryIds,
  onClear,
  onFallbackFocus,
  onSelectMemory,
  onSelectEntity,
}: {
  data: MemoryOverview;
  selection: MemoryInspectorSelection;
  visibleMemoryIds: Set<string>;
  onClear: () => void;
  onFallbackFocus?: () => void;
  onSelectMemory: (id: string) => void;
  onSelectEntity: (id: string) => void;
}) {
  const restoreFocusRef = useRef<Element | null>(null);
  const inspectorWasOpenRef = useRef(false);

  useEffect(() => {
    const inspectorOpen = selection !== null;
    if (inspectorOpen && !inspectorWasOpenRef.current) {
      const activeElement = document.activeElement;
      restoreFocusRef.current =
        activeElement && typeof (activeElement as HTMLElement).focus === 'function' ? activeElement : null;
    }
    inspectorWasOpenRef.current = inspectorOpen;
  }, [selection]);

  const clearAndRestoreFocus = () => {
    const focusTarget = restoreFocusRef.current;
    restoreFocusRef.current = null;
    onClear();
    if (focusTarget?.isConnected) (focusTarget as HTMLElement).focus();
    else onFallbackFocus?.();
  };

  if (!selection) return null;
  if (selection.kind === 'entity') {
    const entity = entityForId(data, selection.id);
    if (!entity) return null;
    return (
      <EntityInspector
        key={entity.id}
        data={data}
        entity={entity}
        visibleMemoryIds={visibleMemoryIds}
        onClear={clearAndRestoreFocus}
        onSelectMemory={onSelectMemory}
      />
    );
  }
  const entry = data.entries.find((item) => item.id === selection.id);
  if (!entry) return null;
  return (
    <MemoryEntryInspector
      key={entry.id}
      data={data}
      entry={entry}
      visible={visibleMemoryIds.has(entry.id)}
      onClear={clearAndRestoreFocus}
      onSelectEntity={onSelectEntity}
    />
  );
}

function MemoryEntryInspector({
  data,
  entry,
  visible,
  onClear,
  onSelectEntity,
}: {
  data: MemoryOverview;
  entry: MemoryEntry;
  visible: boolean;
  onClear: () => void;
  onSelectEntity: (id: string) => void;
}) {
  const facet = data.graph.facets[entry.id];
  const event = eventForMemory(data, entry.id);
  const entities = (facet?.entityIds ?? [])
    .map((id) => entityForId(data, id))
    .filter(
      (entity): entity is MemoryGraphEntity =>
        Boolean(entity) && (entity?.kind !== 'tag' || memoryTagLabel(entity.name) !== null)
    );
  const source = memoryMetadata(entry, 'source') || event?.source || 'memory';
  const extractionReason = memoryMetadata(entry, 'reason');
  const tags = entry.tags.flatMap((tag) => {
    const label = memoryTagLabel(tag);
    return label ? [{ key: tag, label }] : [];
  });
  const content = entry.content || entry.preview || '没有可显示的内容。';
  const copyContent = async () => {
    try {
      await copyText(content);
      showToast('记忆内容已复制', 'success');
    } catch {
      showToast('无法复制记忆内容', 'error');
    }
  };
  return (
    <aside className='memory-inspector' aria-label='记忆详情'>
      <header>
        <div className='memory-inspector-title'>
          <span className='memory-inspector-kicker'>记忆详情</span>
          <h2>{event?.label || entry.preview || entry.id}</h2>
        </div>
        <div className='memory-inspector-actions'>
          <IconButton label='复制记忆' onClick={() => void copyContent()}>
            <ClipboardCopy size={14} />
          </IconButton>
          <IconButton label='关闭详情' onClick={onClear}>
            <X size={15} />
          </IconButton>
        </div>
      </header>
      {!visible && <p className='memory-inspector-filter-note'>这条记忆不在当前筛选结果中。</p>}
      <div className='memory-inspector-badges'>
        <span className='memory-type-badge' data-tone={entry.memoryType}>
          {memoryTypeLabel(entry.memoryType)}
        </span>
      </div>
      <div className='memory-inspector-section'>
        <div className='memory-inspector-content'>{content}</div>
      </div>
      {extractionReason && (
        <section className='memory-inspector-section'>
          <h3>为什么会记住</h3>
          <div className='memory-retention-reason'>
            <p>{extractionReason}</p>
          </div>
        </section>
      )}
      {facet?.conflicts && (
        <p className='memory-inspector-conflict'>
          <TriangleAlert size={13} /> 与其他记忆不一致
        </p>
      )}
      <section className='memory-inspector-section'>
        <h3>信息</h3>
        <dl className='memory-detail-grid'>
          <div>
            <dt>
              <Clock3 size={12} />
              保存时间
            </dt>
            <dd>{formatMemoryDate(entry.timestamp)}</dd>
          </div>
          <div>
            <dt>
              <Eye size={12} />
              使用次数
            </dt>
            <dd>{entry.accessCount} 次</dd>
          </div>
          <div>
            <dt>
              <Clock3 size={12} />
              最近使用
            </dt>
            <dd>{formatMemoryDate(entry.lastAccessed)}</dd>
          </div>
          <div>
            <dt>
              <Database size={12} />
              来源
            </dt>
            <dd>{memorySourceLabel(source)}</dd>
          </div>
        </dl>
      </section>
      {tags.length > 0 && (
        <section className='memory-inspector-section'>
          <h3>标签</h3>
          <div className='memory-inspector-tags'>
            {tags.map((tag) => (
              <span className='memory-tag' key={tag.key}>
                {tag.label}
              </span>
            ))}
          </div>
        </section>
      )}
      {entities.length > 0 && (
        <section className='memory-inspector-section'>
          <h3>
            相关内容 <small>{entities.length}</small>
          </h3>
          <div className='memory-entity-links'>
            {entities.map((entity) => (
              <button type='button' key={entity.id} onClick={() => onSelectEntity(entity.id)}>
                <i data-tone={entity.kind} />
                <span>
                  <strong>{entityNameLabel(entity.kind, entity.name)}</strong>
                  <small>{entityKindLabel(entity.kind)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

function EntityInspector({
  data,
  entity,
  visibleMemoryIds,
  onClear,
  onSelectMemory,
}: {
  data: MemoryOverview;
  entity: MemoryGraphEntity;
  visibleMemoryIds: Set<string>;
  onClear: () => void;
  onSelectMemory: (id: string) => void;
}) {
  const entries = entity.memoryIds
    .map((id) => data.entries.find((entry) => entry.id === id))
    .filter((entry): entry is MemoryEntry => Boolean(entry))
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
  return (
    <aside className='memory-inspector' aria-label='相关内容详情'>
      <header>
        <div className='memory-inspector-title'>
          <span className='memory-inspector-kicker'>{entityKindLabel(entity.kind)}</span>
          <h2>{entityNameLabel(entity.kind, entity.name)}</h2>
        </div>
        <div className='memory-inspector-actions'>
          <IconButton label='关闭详情' onClick={onClear}>
            <X size={15} />
          </IconButton>
        </div>
      </header>
      <span className='memory-entity-hero' data-tone={entity.kind}>
        <Network size={18} />
      </span>
      <dl className='memory-detail-grid entity'>
        <div>
          <dt>出现次数</dt>
          <dd>{entity.mentions} 次</dd>
        </div>
        <div>
          <dt>相关记忆</dt>
          <dd>{entity.memoryIds.length} 条</dd>
        </div>
        <div>
          <dt>最近出现</dt>
          <dd>{formatMemoryDate(entity.lastSeen)}</dd>
        </div>
      </dl>
      {entity.aliases.length > 0 && (
        <section className='memory-inspector-section'>
          <h3>别名</h3>
          <div className='memory-inspector-tags'>
            {entity.aliases.map((alias) => (
              <span className='memory-tag' key={alias}>
                {alias}
              </span>
            ))}
          </div>
        </section>
      )}
      <section className='memory-inspector-section entity-memories'>
        <h3>
          相关记忆 <small>{entries.length}</small>
        </h3>
        <div className='memory-entity-memory-list'>
          {entries.map((entry) => (
            <button
              type='button'
              key={entry.id}
              data-filtered={!visibleMemoryIds.has(entry.id) || undefined}
              onClick={() => onSelectMemory(entry.id)}
            >
              <strong>{eventForMemory(data, entry.id)?.label || entry.preview}</strong>
              <span>
                {memoryTypeLabel(entry.memoryType)} · {formatMemoryDate(entry.timestamp)}
              </span>
            </button>
          ))}
          {!entries.length && <CollectionState role='status'>相关记忆暂未显示。</CollectionState>}
        </div>
      </section>
    </aside>
  );
}

function memoryMetadata(entry: MemoryEntry, key: string): string | undefined {
  const value = entry.metadata?.[key]?.trim();
  return value || undefined;
}

async function copyText(content: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand?.('copy') ?? false;
  textarea.remove();
  if (!copied) throw new Error('Clipboard is unavailable');
}
