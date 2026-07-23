import {
  AlertTriangle,
  Database,
  FileText,
  FolderInput,
  LibraryBig,
  LoaderCircle,
  Pin,
  PinOff,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, Dialog, Field, IconButton, InlineNotice, StateView } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { PersonalKnowledgeBase } from '../../../types/api';
import type { KnowledgeActions } from '../use-knowledge-controller';

export function KnowledgeDirectory({
  actions,
  query,
  onCreate,
  onImport,
  onOpen,
}: {
  actions: KnowledgeActions;
  query: string;
  onCreate: () => void;
  onImport: () => void;
  onOpen: (item: PersonalKnowledgeBase) => void;
}) {
  const state = useSnapshot(appState);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const items = useMemo(
    () =>
      (state.personalKnowledgeBases?.items ?? [])
        .map((item) => item as PersonalKnowledgeBase)
        .filter((item) => personalKnowledgeText(item).includes(normalizedQuery)),
    [normalizedQuery, state.personalKnowledgeBases?.items]
  );

  return (
    <section className='knowledge-directory' aria-label='本地知识库目录'>
      <KnowledgeMessages />
      <PersonalKnowledgeBases
        actions={actions}
        items={items}
        searching={normalizedQuery.length > 0}
        onCreate={onCreate}
        onImport={onImport}
        onOpen={onOpen}
      />
    </section>
  );
}

function KnowledgeMessages() {
  const state = useSnapshot(appState);
  return (
    <>
      {state.knowledgeError && (
        <InlineNotice
          className='knowledge-message'
          tone='danger'
          role='alert'
          icon={<Database size={18} />}
          title='无法刷新知识库'
        >
          {state.knowledgeError}
        </InlineNotice>
      )}
      {state.knowledgeOperationError && (
        <InlineNotice
          className='knowledge-message'
          tone='danger'
          role='alert'
          icon={<Database size={18} />}
          title='知识库操作失败'
        >
          {state.knowledgeOperationError}
        </InlineNotice>
      )}
      {(state.personalKnowledgeBases?.warnings.length ?? 0) > 0 && (
        <InlineNotice
          className='knowledge-message'
          tone='warning'
          role='status'
          icon={<AlertTriangle size={18} />}
          title='部分知识库已跳过'
        >
          部分本地知识库无法读取，已跳过损坏的条目。
        </InlineNotice>
      )}
    </>
  );
}

function PersonalKnowledgeBases({
  actions,
  items,
  searching,
  onCreate,
  onImport,
  onOpen,
}: {
  actions: KnowledgeActions;
  items: PersonalKnowledgeBase[];
  searching: boolean;
  onCreate: () => void;
  onImport: () => void;
  onOpen: (item: PersonalKnowledgeBase) => void;
}) {
  const state = useSnapshot(appState);
  if (state.knowledgeStatus === 'loading' && !state.personalKnowledgeBases) {
    return (
      <StateView
        className='knowledge-directory-state'
        size='compact'
        role='status'
        icon={<LoaderCircle className='spin' size={22} />}
        title='正在读取本地知识库…'
        description='正在加载保存在当前工作区的知识库。'
      />
    );
  }
  if (items.length === 0) {
    return (
      <StateView
        className='knowledge-directory-state'
        tone='info'
        icon={<LibraryBig size={25} />}
        title={searching ? '没有找到知识库' : '建立你的本地知识库'}
        description={searching ? '换一个关键词，或清空搜索后重试。' : '从空白知识库开始，或导入已有的 Obsidian Vault。'}
        actions={
          !searching && (
            <>
              <Button tone='primary' onClick={onCreate}>
                <Plus size={14} /> 新建知识库
              </Button>
              <Button onClick={onImport}>
                <FolderInput size={14} /> 导入知识库
              </Button>
            </>
          )
        }
      />
    );
  }
  const pinned = searching ? [] : items.filter((item) => item.pinned);
  return (
    <>
      {pinned.length > 0 && (
        <KnowledgeShelf title='置顶知识库'>
          {pinned.map((item) => (
            <PersonalKnowledgeCard key={item.id} item={item} actions={actions} onOpen={() => onOpen(item)} />
          ))}
        </KnowledgeShelf>
      )}
      <KnowledgeShelf
        title={searching ? '搜索结果' : '全部知识库'}
        description={searching ? `找到 ${items.length} 个知识库。` : `${items.length} 个本地知识库`}
      >
        {items.map((item) => (
          <PersonalKnowledgeCard key={item.id} item={item} actions={actions} onOpen={() => onOpen(item)} />
        ))}
      </KnowledgeShelf>
    </>
  );
}

function KnowledgeShelf({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className='knowledge-shelf'>
      <header>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      <div className='knowledge-card-grid'>{children}</div>
    </section>
  );
}

function PersonalKnowledgeCard({
  item,
  actions,
  onOpen,
}: {
  item: PersonalKnowledgeBase;
  actions: KnowledgeActions;
  onOpen: () => void;
}) {
  const state = useSnapshot(appState);
  const busy = state.knowledgeOperationStatus === 'loading';
  const updating = busy && state.knowledgeOperationId === item.id;
  const tone = stableTone(item.id);
  return (
    <article className={`personal-knowledge-card tone-${tone}`} title={item.path}>
      <span className='knowledge-source-ribbon'>{originLabel(item.origin)}</span>
      {item.origin !== 'workspace' && (
        <IconButton
          className='knowledge-pin-button'
          label={item.pinned ? `取消置顶 ${item.name}` : `置顶 ${item.name}`}
          disabled={busy}
          aria-busy={updating || undefined}
          onClick={() => void actions.setPinned(item.id, !item.pinned)}
        >
          {item.pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </IconButton>
      )}
      <button type='button' className='personal-knowledge-open' aria-label={`打开知识库 ${item.name}`} onClick={onOpen}>
        <div className='personal-knowledge-copy'>
          <h3>{item.name}</h3>
          <p>{item.description}</p>
        </div>
        <span className='personal-knowledge-icon' aria-hidden='true'>
          <FileText size={42} strokeWidth={1.25} />
        </span>
        <dl>
          <div>
            <dt>来源</dt>
            <dd>{item.sourceCount}</dd>
          </div>
          <div>
            <dt>概念</dt>
            <dd>{item.conceptCount}</dd>
          </div>
          <div>
            <dt>大小</dt>
            <dd>{formatBytes(item.bytes)}</dd>
          </div>
        </dl>
        <footer>
          <code title={item.path}>{item.path}</code>
          {item.pinned && (
            <span>
              <Pin size={10} /> 已置顶
            </span>
          )}
        </footer>
      </button>
    </article>
  );
}

export function CreateKnowledgeBaseDialog({
  actions,
  onClose,
  onCreated,
}: {
  actions: KnowledgeActions;
  onClose: () => void;
  onCreated: () => void;
}) {
  const state = useSnapshot(appState);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const submitting = state.knowledgeOperationStatus === 'loading' && state.knowledgeOperationId === 'create';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const created = await actions.createKnowledgeBase({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    if (created) onCreated();
  };
  return (
    <Dialog
      title='新建知识库'
      description='创建一个保存在当前工作区的个人知识库。'
      className='knowledge-create-dialog'
      closeDisabled={submitting}
      onClose={onClose}
      footer={
        <>
          <Button disabled={submitting} onClick={onClose}>
            取消
          </Button>
          <Button
            tone='primary'
            loading={submitting}
            disabled={!name.trim()}
            onClick={() => undefined}
            type='submit'
            form='knowledge-create-form'
          >
            创建知识库
          </Button>
        </>
      }
    >
      <form className='knowledge-create-form' id='knowledge-create-form' onSubmit={(event) => void submit(event)}>
        <Field label='名称' required>
          <input
            autoFocus
            maxLength={80}
            value={name}
            aria-label='名称'
            placeholder='例如：项目资料库'
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label='描述'>
          <textarea
            maxLength={280}
            rows={3}
            value={description}
            placeholder='说明这个知识库保存什么内容（可选）'
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <InlineNotice tone='info' role='note' icon={<ShieldCheck size={15} />}>
          内容保存在当前工作区，不会发布或上传。
        </InlineNotice>
        {state.knowledgeOperationError && (
          <InlineNotice tone='danger' role='alert' title='无法创建知识库'>
            {state.knowledgeOperationError}
          </InlineNotice>
        )}
      </form>
    </Dialog>
  );
}

export function ImportKnowledgeBaseDialog({
  actions,
  onClose,
  onImported,
}: {
  actions: KnowledgeActions;
  onClose: () => void;
  onImported: (item: PersonalKnowledgeBase) => void;
}) {
  const state = useSnapshot(appState);
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [picking, setPicking] = useState(false);
  const submitting = state.knowledgeOperationStatus === 'loading' && state.knowledgeOperationId === 'import';
  const pick = async () => {
    setPicking(true);
    const selected = await actions.pickKnowledgeBaseDirectory();
    setPicking(false);
    if (selected) setPath(selected);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const imported = await actions.importKnowledgeBase({ path: path.trim(), name: name.trim() || undefined });
    if (imported) onImported(imported);
  };
  return (
    <Dialog
      title='导入知识库'
      description='导入 Obsidian Vault 或其他包含 Markdown 的本地文件夹。'
      className='knowledge-create-dialog knowledge-import-dialog'
      closeDisabled={submitting}
      onClose={onClose}
      footer={
        <>
          <Button disabled={submitting} onClick={onClose}>
            取消
          </Button>
          <Button
            tone='primary'
            loading={submitting}
            disabled={!path.trim()}
            onClick={() => undefined}
            type='submit'
            form='knowledge-import-form'
          >
            开始导入
          </Button>
        </>
      }
    >
      <form className='knowledge-create-form' id='knowledge-import-form' onSubmit={(event) => void submit(event)}>
        <Field label='本地文件夹' required>
          {(controlProps) => (
            <div className='knowledge-import-path'>
              <input
                {...controlProps}
                value={path}
                placeholder='选择文件夹或输入绝对路径'
                onChange={(event) => setPath(event.target.value)}
              />
              <Button disabled={picking || submitting} onClick={() => void pick()}>
                <FolderInput size={14} /> {picking ? '选择中…' : '选择文件夹'}
              </Button>
            </div>
          )}
        </Field>
        <Field label='知识库名称（可选）'>
          <input
            maxLength={80}
            value={name}
            aria-label='知识库名称'
            placeholder='默认使用文件夹名称'
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <InlineNotice tone='info' role='note' icon={<ShieldCheck size={15} />}>
          A3S 会复制内容到当前工作区；原始 Vault 保持不变，.obsidian 配置不会导入。
        </InlineNotice>
        {state.knowledgeOperationError && (
          <InlineNotice tone='danger' role='alert' title='无法导入知识库'>
            {state.knowledgeOperationError}
          </InlineNotice>
        )}
      </form>
    </Dialog>
  );
}

function personalKnowledgeText(item: PersonalKnowledgeBase): string {
  return [item.name, item.description, item.origin].join(' ').toLocaleLowerCase();
}

function stableTone(value: string): number {
  return [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 5;
}

function originLabel(origin: PersonalKnowledgeBase['origin']): string {
  if (origin === 'workspace') return '工作区默认';
  if (origin === 'imported') return '外部导入';
  if (origin === 'marketplace') return '已导入';
  return '本地创建';
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}
