import { useEffect, useId, useState } from 'react';
import { Button, Dialog, Field, InlineNotice } from '../../../design-system/primitives';
import type { WorkArtifact, WorkFolder } from '../work-types';

export type WorkLibraryOperation =
  | { kind: 'create-folder' }
  | { kind: 'rename-folder'; folder: WorkFolder }
  | { kind: 'rename-artifact'; artifact: WorkArtifact }
  | { kind: 'delete-folder'; folder: WorkFolder }
  | { kind: 'delete-artifact'; artifact: WorkArtifact };

export function WorkLibraryOperationDialog({
  operation,
  onClose,
  onConfirm,
}: {
  operation: WorkLibraryOperation;
  onClose: () => void;
  onConfirm: (value?: string) => void;
}) {
  const formId = useId();
  const [value, setValue] = useState(() => initialValue(operation));
  const textOperation =
    operation.kind === 'create-folder' || operation.kind === 'rename-folder' || operation.kind === 'rename-artifact';

  useEffect(() => setValue(initialValue(operation)), [operation]);

  return (
    <Dialog
      title={operationTitle(operation)}
      description={operationDescription(operation)}
      className='work-library-operation-dialog'
      onClose={onClose}
      footer={
        <>
          <Button tone='quiet' onClick={onClose}>
            取消
          </Button>
          {textOperation ? (
            <Button type='submit' form={formId} tone='primary' disabled={!value.trim()}>
              {operation.kind === 'create-folder' ? '创建' : '保存'}
            </Button>
          ) : (
            <Button tone='danger' onClick={() => onConfirm()}>
              {isPermanentDelete(operation) ? '确认永久删除' : '确认移到回收站'}
            </Button>
          )}
        </>
      }
    >
      {textOperation ? (
        <form
          id={formId}
          className='work-file-operation-form'
          onSubmit={(event) => {
            event.preventDefault();
            const next = value.trim();
            if (next) onConfirm(next);
          }}
        >
          <Field label={operation.kind === 'rename-artifact' ? '文件名称' : '文件夹名称'}>
            <input
              data-autofocus
              aria-label={operation.kind === 'rename-artifact' ? '文件名称' : '文件夹名称'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
            />
          </Field>
        </form>
      ) : (
        <InlineNotice
          className='work-library-operation-warning'
          tone={isPermanentDelete(operation) ? 'danger' : 'warning'}
          role='alert'
          title={isPermanentDelete(operation) ? '永久删除确认' : '移到回收站'}
        >
          {deleteMessage(operation)}
        </InlineNotice>
      )}
    </Dialog>
  );
}

function initialValue(operation: WorkLibraryOperation): string {
  if (operation.kind === 'create-folder') return '新建文件夹';
  if (operation.kind === 'rename-folder') return operation.folder.name;
  if (operation.kind === 'rename-artifact') return operation.artifact.title;
  return '';
}

function operationTitle(operation: WorkLibraryOperation): string {
  if (operation.kind === 'create-folder') return '新建文件夹';
  if (operation.kind === 'rename-folder') return '重命名文件夹';
  if (operation.kind === 'rename-artifact') return '重命名文件';
  if (operation.kind === 'delete-folder') return operation.folder.trashedAt ? '永久删除文件夹' : '移到回收站';
  return operation.artifact.trashedAt ? '永久删除文件' : '移到回收站';
}

function operationDescription(operation: WorkLibraryOperation): string {
  if (operation.kind === 'create-folder') return '文件夹会显示在当前“我的文档”位置。';
  if (operation.kind === 'rename-folder') return `修改“${operation.folder.name}”的名称。`;
  if (operation.kind === 'rename-artifact') return `修改“${operation.artifact.title}”的名称。`;
  return isPermanentDelete(operation) ? '删除后无法恢复。' : '之后可以从回收站恢复。';
}

function isPermanentDelete(operation: WorkLibraryOperation): boolean {
  if (operation.kind === 'delete-folder') return Boolean(operation.folder.trashedAt);
  if (operation.kind === 'delete-artifact') return Boolean(operation.artifact.trashedAt);
  return false;
}

function deleteMessage(operation: WorkLibraryOperation): string {
  if (operation.kind === 'delete-folder') {
    return operation.folder.trashedAt
      ? `确定永久删除文件夹“${operation.folder.name}”吗？文件夹必须为空。`
      : `确定将文件夹“${operation.folder.name}”移到回收站吗？`;
  }
  if (operation.kind === 'delete-artifact') {
    return operation.artifact.trashedAt
      ? `确定永久删除“${operation.artifact.title}”吗？`
      : `确定将“${operation.artifact.title}”移到回收站吗？`;
  }
  return '';
}
