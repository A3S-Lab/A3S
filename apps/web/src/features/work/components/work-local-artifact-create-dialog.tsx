import { useEffect, useId, useMemo, useState } from 'react';
import { Button, Dialog, Field } from '../../../design-system/primitives';
import { workLocalArtifactFileName } from '../work-local-artifact-create';
import { WORK_TEMPLATES } from '../work-templates';
import type { WorkArtifactKind } from '../work-types';

export function WorkLocalArtifactCreateDialog({
  templateId,
  directory,
  onClose,
  onCreate,
}: {
  templateId: string;
  directory: string;
  onClose: () => void;
  onCreate: (fileName: string) => Promise<'created' | 'exists' | 'error'>;
}) {
  const formId = useId();
  const kind = useMemo(() => templateKind(templateId), [templateId]);
  const [fileName, setFileName] = useState(() => defaultFileName(kind));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFileName(defaultFileName(kind));
    setError(null);
  }, [kind, directory]);

  return (
    <Dialog
      title={dialogTitle(kind)}
      description='文件会直接保存到当前文件夹并打开。'
      closeDisabled={submitting}
      onClose={onClose}
      footer={
        <>
          <Button tone='quiet' disabled={submitting} onClick={onClose}>
            取消
          </Button>
          <Button
            type='submit'
            form={formId}
            tone='primary'
            loading={submitting}
            disabled={submitting || !fileName.trim()}
          >
            创建文件
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className='work-local-save-form'
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          try {
            workLocalArtifactFileName(fileName, kind);
          } catch (validationError) {
            setError(validationError instanceof Error ? validationError.message : '请输入有效的文件名。');
            return;
          }
          setSubmitting(true);
          void onCreate(fileName)
            .then((result) => {
              if (result === 'created') {
                onClose();
                return;
              }
              setError(
                result === 'exists'
                  ? '当前文件夹中已有同名文件，请使用其他名称。'
                  : '文件未创建，请检查当前文件夹后重试。'
              );
            })
            .catch(() => setError('文件未创建，请检查当前文件夹后重试。'))
            .finally(() => setSubmitting(false));
        }}
      >
        <Field label='创建到'>
          <input aria-label='本地创建文件夹' value={directory} readOnly />
        </Field>
        <Field label='文件名' error={error}>
          <input
            data-autofocus
            aria-label='本地 Office 文件名'
            value={fileName}
            disabled={submitting}
            onChange={(event) => {
              setFileName(event.target.value);
              setError(null);
            }}
            onFocus={(event) => selectFileBaseName(event.currentTarget)}
          />
        </Field>
      </form>
    </Dialog>
  );
}

function templateKind(templateId: string): WorkArtifactKind {
  return WORK_TEMPLATES.find((template) => template.id === templateId)?.kind ?? 'document';
}

function defaultFileName(kind: WorkArtifactKind): string {
  if (kind === 'spreadsheet') return '新建电子表格.xlsx';
  if (kind === 'presentation') return '新建演示文稿.pptx';
  return '新建文字文档.docx';
}

function dialogTitle(kind: WorkArtifactKind): string {
  if (kind === 'spreadsheet') return '新建电子表格';
  if (kind === 'presentation') return '新建演示文稿';
  return '新建文字文档';
}

function selectFileBaseName(input: HTMLInputElement): void {
  const extensionIndex = input.value.lastIndexOf('.');
  input.setSelectionRange(0, extensionIndex > 0 ? extensionIndex : input.value.length);
}
