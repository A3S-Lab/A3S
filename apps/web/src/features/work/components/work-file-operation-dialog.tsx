import { useEffect, useId, useState } from 'react';
import { Button, Dialog, Field, InlineNotice } from '../../../design-system/primitives';
import type { WorkspaceEntry } from '../../../types/api';
import type { WorkFilesActions } from '../use-work-files-controller';
import { workDuplicateName } from '../work-local-files';

export type WorkFileOperation =
  | { kind: 'create-folder' }
  | { kind: 'rename'; entry: WorkspaceEntry }
  | { kind: 'duplicate'; entry: WorkspaceEntry }
  | { kind: 'delete'; entries: WorkspaceEntry[] };

export function WorkFileOperationDialog({
  operation,
  actions,
  onClose,
}: {
  operation: WorkFileOperation;
  actions: WorkFilesActions;
  onClose: () => void;
}) {
  const formId = useId();
  const [name, setName] = useState(() => initialName(operation));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleting = operation.kind === 'delete';

  useEffect(() => {
    setName(initialName(operation));
    setError(null);
  }, [operation]);

  const title =
    operation.kind === 'create-folder'
      ? '新建文件夹'
      : operation.kind === 'rename'
        ? '重命名'
        : operation.kind === 'duplicate'
          ? '创建副本'
          : operation.entries.length === 1
            ? '永久删除'
            : `永久删除 ${operation.entries.length} 项`;
  const description =
    operation.kind === 'create-folder'
      ? '文件夹会直接创建在当前本地目录中。'
      : operation.kind === 'rename'
        ? '名称会直接更新到本地文件系统。'
        : operation.kind === 'duplicate'
          ? '副本会创建在原文件或文件夹旁边。'
          : '删除后无法恢复。';
  const runRequest = (request: Promise<void>) => {
    setSubmitting(true);
    setError(null);
    void request
      .then(onClose)
      .catch((operationError) => {
        setError(operationError instanceof Error ? operationError.message : '操作失败，请重试。');
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Dialog
      title={title}
      description={description}
      closeDisabled={submitting}
      onClose={onClose}
      footer={
        <>
          <Button tone='quiet' disabled={submitting} onClick={onClose}>
            取消
          </Button>
          {deleting ? (
            <Button
              tone='danger'
              loading={submitting}
              onClick={() => operation.kind === 'delete' && runRequest(actions.deleteEntries(operation.entries))}
            >
              确认永久删除
            </Button>
          ) : (
            <Button type='submit' form={formId} tone='primary' loading={submitting} disabled={!name.trim()}>
              {operation.kind === 'duplicate' ? '创建副本' : '保存'}
            </Button>
          )}
        </>
      }
    >
      {deleting ? (
        <InlineNotice className='work-library-operation-warning' tone='danger' role='alert' title='将从本机永久删除'>
          {operation.kind === 'delete' && operation.entries.length === 1
            ? `“${operation.entries[0].name}”将从本机永久删除。`
            : `选中的 ${operation.kind === 'delete' ? operation.entries.length : 0} 项将从本机永久删除。`}
        </InlineNotice>
      ) : (
        <form
          id={formId}
          className='work-file-operation-form'
          onSubmit={(event) => {
            event.preventDefault();
            const request =
              operation.kind === 'create-folder'
                ? actions.createFolder(name)
                : operation.kind === 'rename'
                  ? actions.renameEntry(operation.entry, name)
                  : actions.duplicateEntry(operation.entry, name);
            runRequest(request);
          }}
        >
          <Field label='名称'>
            <input
              data-autofocus
              aria-label='文件或文件夹名称'
              value={name}
              disabled={submitting}
              onChange={(event) => setName(event.target.value)}
              onFocus={(event) => selectBaseName(event.currentTarget, operation)}
            />
          </Field>
        </form>
      )}
      {error && (
        <InlineNotice className='work-file-operation-error' tone='danger' role='alert' title='操作失败'>
          {error}
        </InlineNotice>
      )}
    </Dialog>
  );
}

function initialName(operation: WorkFileOperation): string {
  if (operation.kind === 'delete') return '';
  if (operation.kind === 'create-folder') return '新建文件夹';
  if (operation.kind === 'rename') return operation.entry.name;
  return workDuplicateName(operation.entry.name, operation.entry.isDirectory);
}

function selectBaseName(input: HTMLInputElement, operation: WorkFileOperation): void {
  if (operation.kind === 'delete') return;
  if (operation.kind === 'create-folder') {
    input.select();
    return;
  }
  const value = input.value;
  const extensionIndex = operation.entry.isDirectory ? -1 : value.lastIndexOf('.');
  input.setSelectionRange(0, extensionIndex > 0 ? extensionIndex : value.length);
}
