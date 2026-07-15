import { Check, LoaderCircle, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../../design-system/primitives';
import type { CodeSession } from '../../../types/api';
import { formatTaskAge, taskCreatedAtLabel } from './task-library-time';

export function TaskLibraryItem({
  session,
  title,
  active,
  running,
  onSelect,
  onRename,
  onDelete,
}: {
  session: CodeSession;
  title: string;
  active: boolean;
  running: boolean;
  onSelect: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'rename' | 'delete' | null>(null);
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const age = formatTaskAge(session.createdAt);
  const createdAtLabel = taskCreatedAtLabel(session.createdAt);
  const createdAtValue = Number.isFinite(session.createdAt) ? new Date(session.createdAt).toISOString() : undefined;
  useEffect(() => {
    if (mode !== 'rename') return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [mode]);
  const close = () => {
    if (busy) return;
    setMode(null);
    setName(title);
    setError(null);
  };
  const rename = async () => {
    const next = name.trim().slice(0, 72);
    if (!next || next === title || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onRename(next);
      setMode(null);
    } catch {
      setError('重命名失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!onDelete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setMode(null);
    } catch {
      setError('删除失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'rename') {
    return (
      <form
        className={`task-list-row task-list-inline-edit ${active ? 'active' : ''}`}
        aria-label={`重命名 ${title}`}
        onSubmit={(event) => {
          event.preventDefault();
          void rename();
        }}
      >
        <input
          ref={inputRef}
          aria-label='任务名称'
          value={name}
          maxLength={72}
          disabled={busy}
          aria-invalid={Boolean(error)}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            }
          }}
        />
        {error && (
          <span className='task-inline-error' title={error}>
            !
          </span>
        )}
        <IconButton label='保存任务名称' type='submit' disabled={!name.trim() || name.trim() === title || busy}>
          {busy ? <LoaderCircle className='spin' size={13} /> : <Check size={13} />}
        </IconButton>
        <IconButton label='取消重命名' disabled={busy} onClick={close}>
          <X size={13} />
        </IconButton>
      </form>
    );
  }

  if (mode === 'delete') {
    return (
      <fieldset
        className={`task-list-row task-list-inline-delete ${active ? 'active' : ''}`}
        aria-label={`确认删除 ${title}`}
      >
        <Trash2 size={13} />
        <span title={`工作区文件不会被删除：${session.workspace}`}>
          <strong>{error ?? '删除此任务？'}</strong>
          <small>保留工作区文件</small>
        </span>
        <button type='button' disabled={busy} onClick={close}>
          取消
        </button>
        <button
          type='button'
          className='danger'
          aria-label={`确认删除 ${title}`}
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? <LoaderCircle className='spin' size={12} /> : '删除'}
        </button>
      </fieldset>
    );
  }

  return (
    <div className={`task-list-row ${active ? 'active' : ''} ${running ? 'running' : ''}`}>
      <button
        type='button'
        className='task-list-link'
        aria-label={`打开任务 ${title}${running ? '，执行中' : ''}，${age}`}
        aria-current={active ? 'page' : undefined}
        title={`${title}\n${session.workspace}`}
        onClick={onSelect}
      >
        {running && <span className='task-list-running-dot' aria-hidden='true' />}
        <strong>{title}</strong>
        <time className='task-list-time' dateTime={createdAtValue} title={createdAtLabel}>
          {age}
        </time>
      </button>
      <div className='task-list-menu'>
        <IconButton
          label={`重命名 ${title}`}
          onClick={() => {
            setName(title);
            setError(null);
            setMode('rename');
          }}
        >
          <Pencil size={13} />
        </IconButton>
        {onDelete && (
          <IconButton
            className='task-row-danger'
            label={`删除 ${title}`}
            onClick={() => {
              setError(null);
              setMode('delete');
            }}
          >
            <Trash2 size={13} />
          </IconButton>
        )}
      </div>
    </div>
  );
}
