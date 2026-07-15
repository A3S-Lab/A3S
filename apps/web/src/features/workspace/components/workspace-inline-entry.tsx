import { Check, FilePlus2, FolderPlus, LoaderCircle, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../../design-system/primitives';
import type { WorkspaceEntry } from '../../../types/api';
import type { WorkspaceActions } from '../workspace-actions';
import { WorkspaceFileIcon } from './workspace-file-icon';

export type WorkspaceInlineAction =
  | { kind: 'create-file' | 'create-directory'; parent: string }
  | { kind: 'rename' | 'copy' | 'delete'; entry: Readonly<WorkspaceEntry> };

export function WorkspaceInlineEntry({
  action,
  depth,
  dirtyDescendant,
  actions,
  onComplete,
}: {
  action: WorkspaceInlineAction;
  depth: number;
  dirtyDescendant?: boolean;
  actions: WorkspaceActions;
  onComplete: () => void;
}) {
  const [name, setName] = useState(() => initialName(action));
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameError = validateWorkspaceEntryName(name);
  const unchanged = action.kind === 'rename' && name.trim() === action.entry.name;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  if (action.kind === 'delete') {
    return (
      <fieldset
        className='explorer-inline-delete'
        aria-label={`确认删除 ${action.entry.name}`}
        style={{ paddingLeft: 10 + depth * 14 }}
      >
        <Trash2 size={13} />
        <span title={action.entry.path}>
          <strong>{operationError ?? `删除 ${action.entry.name}？`}</strong>
          <small>
            {dirtyDescendant ? '包含未保存编辑' : action.entry.isDirectory ? '同时删除内部内容' : '此操作无法撤销'}
          </small>
        </span>
        <button type='button' disabled={busy} onClick={onComplete}>
          取消
        </button>
        <button
          type='button'
          className='danger'
          aria-label={`确认删除 ${action.entry.name}`}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setOperationError(null);
            void actions
              .deleteWorkspaceEntry(action.entry.path)
              .then(onComplete)
              .catch(() => setOperationError('删除失败，请重试'))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? <LoaderCircle className='spin' size={12} /> : '删除'}
        </button>
      </fieldset>
    );
  }

  const directory = action.kind === 'create-directory' || ('entry' in action && action.entry.isDirectory);
  const path = 'entry' in action ? action.entry.path : name;
  const submit = async () => {
    if (nameError || unchanged || busy) {
      setTouched(true);
      return;
    }
    setBusy(true);
    setOperationError(null);
    try {
      if (action.kind === 'create-file' || action.kind === 'create-directory') {
        await actions.createWorkspaceEntry(
          action.parent,
          name.trim(),
          action.kind === 'create-file' ? 'file' : 'directory'
        );
      } else if (action.kind === 'rename') {
        await actions.renameWorkspaceEntry(action.entry.path, name.trim());
      } else if ('entry' in action) {
        await actions.copyWorkspaceEntry(action.entry.path, name.trim());
      }
      onComplete();
    } catch {
      setOperationError('操作失败，请检查名称后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role='treeitem'
      tabIndex={-1}
      aria-level={depth + 1}
      aria-label={inlineActionLabel(action)}
      className='explorer-inline-treeitem'
    >
      <form
        className='explorer-inline-entry'
        style={{ paddingLeft: 9 + depth * 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <span aria-hidden='true'>
          {action.kind === 'create-directory' ? (
            <FolderPlus size={13} />
          ) : action.kind === 'create-file' ? (
            <FilePlus2 size={13} />
          ) : null}
        </span>
        <WorkspaceFileIcon path={path} directory={directory} expanded={false} size={14} />
        <input
          ref={inputRef}
          aria-label='文件或文件夹名称'
          aria-invalid={Boolean((touched && nameError) || operationError)}
          title={(touched && nameError) || operationError || undefined}
          value={name}
          disabled={busy}
          onChange={(event) => {
            setName(event.target.value);
            setTouched(true);
            setOperationError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onComplete();
            }
          }}
        />
        {((touched && nameError) || operationError) && (
          <span
            className='explorer-inline-error'
            role='alert'
            aria-label={(touched && nameError) || operationError || undefined}
            title={(touched && nameError) || operationError || undefined}
          >
            !
          </span>
        )}
        <IconButton label='确认文件操作' type='submit' disabled={Boolean(nameError) || unchanged || busy}>
          {busy ? <LoaderCircle className='spin' size={12} /> : <Check size={12} />}
        </IconButton>
        <IconButton label='取消文件操作' disabled={busy} onClick={onComplete}>
          <X size={12} />
        </IconButton>
      </form>
    </div>
  );
}

export function workspaceInlineActionKey(action: WorkspaceInlineAction): string {
  return 'entry' in action ? `${action.kind}:${action.entry.path}` : `${action.kind}:${action.parent}`;
}

export function validateWorkspaceEntryName(value: string): string | null {
  const name = value.trim();
  if (!name) return '请输入名称。';
  if (name === '.' || name === '..') return '名称不能是“.”或“..”。';
  if (name.includes('/') || name.includes('\\')) return '名称不能包含路径分隔符。';
  return null;
}

function initialName(action: WorkspaceInlineAction) {
  if (action.kind === 'rename') return action.entry.name;
  if (action.kind === 'copy') return `${action.entry.name}.copy`;
  return '';
}

function inlineActionLabel(action: WorkspaceInlineAction) {
  if (action.kind === 'create-file') return '行内新建文件';
  if (action.kind === 'create-directory') return '行内新建文件夹';
  if (action.kind === 'rename') return `行内重命名 ${action.entry.name}`;
  return 'entry' in action ? `行内复制 ${action.entry.name}` : '行内文件操作';
}
