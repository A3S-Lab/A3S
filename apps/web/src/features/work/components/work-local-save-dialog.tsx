import { AlertTriangle, FolderOpen } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button, Dialog, InlineNotice } from '../../../design-system/primitives';
import { OfficeTextField } from '../editors/office-controls';
import type { WorkLocalFileConflict } from '../use-work-controller';
import { safeFileName } from '../work-file-download';
import { type WorkArtifact, workArtifactExtension } from '../work-types';

export function WorkLocalSaveDialog({
  artifact,
  defaultDirectory,
  onClose,
  onPickDirectory,
  onSave,
}: {
  artifact: WorkArtifact;
  defaultDirectory: string;
  onClose: () => void;
  onPickDirectory: () => Promise<string | null>;
  onSave: (directory: string, fileName: string, allowOverwrite: boolean) => Promise<'saved' | 'exists' | 'error'>;
}) {
  const formId = useId();
  const [directory, setDirectory] = useState(defaultDirectory);
  const [fileName, setFileName] = useState(() => defaultLocalFileName(artifact));
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDirectory(defaultDirectory);
    setFileName(defaultLocalFileName(artifact));
    setReplaceExisting(false);
    setError(null);
  }, [artifact.id, defaultDirectory]);

  const busy = submitting || picking;
  return (
    <Dialog
      title='另存为本地 Office 文件'
      description='选择保存位置，之后可用 Cmd/Ctrl+S 写回此文件。'
      closeDisabled={busy}
      onClose={onClose}
      footer={
        <>
          <Button tone='quiet' disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button
            type='submit'
            form={formId}
            tone={replaceExisting ? 'danger' : 'primary'}
            loading={submitting}
            disabled={busy || !directory || !fileName.trim()}
          >
            {replaceExisting ? '替换文件' : '保存'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className='work-local-save-form'
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);
          void onSave(directory, fileName, replaceExisting)
            .then((result) => {
              if (result === 'saved') {
                onClose();
                return;
              }
              if (result === 'exists') {
                setReplaceExisting(true);
                setError('此位置已有同名文件。再次确认后才会替换它。');
                return;
              }
              setError('文件未保存，请检查目标文件夹后重试。');
            })
            .catch(() => setError('文件未保存，请检查目标文件夹后重试。'))
            .finally(() => setSubmitting(false));
        }}
      >
        <div className='work-office-field'>
          <span>保存到</span>
          <div className='work-local-save-location'>
            <OfficeTextField aria-label='本地保存文件夹' value={directory} readOnly />
            <button
              type='button'
              disabled={busy}
              onClick={() => {
                setPicking(true);
                void onPickDirectory()
                  .then((path) => {
                    if (!path) return;
                    setDirectory(path);
                    setReplaceExisting(false);
                    setError(null);
                  })
                  .catch(() => setError('无法打开文件夹选择器，请重试。'))
                  .finally(() => setPicking(false));
              }}
            >
              <FolderOpen size={14} />
              {picking ? '正在选择…' : '选择文件夹'}
            </button>
          </div>
        </div>
        <div className='work-office-field'>
          <span>文件名</span>
          <OfficeTextField
            data-autofocus
            aria-label='本地文件名'
            value={fileName}
            disabled={busy}
            onChange={(event) => {
              setFileName(event.target.value);
              setReplaceExisting(false);
              setError(null);
            }}
            onFocus={(event) => selectFileBaseName(event.currentTarget)}
          />
        </div>
        {error && (
          <InlineNotice
            className='work-local-save-message'
            tone={replaceExisting ? 'warning' : 'danger'}
            role='alert'
            title={replaceExisting ? '需要确认替换' : '保存失败'}
          >
            {error}
          </InlineNotice>
        )}
      </form>
    </Dialog>
  );
}

export function WorkLocalFileConflictDialog({
  conflict,
  onClose,
  onSaveAs,
  onOverwrite,
}: {
  conflict: WorkLocalFileConflict;
  onClose: () => void;
  onSaveAs: () => void;
  onOverwrite: () => Promise<boolean>;
}) {
  const [overwriting, setOverwriting] = useState(false);
  return (
    <Dialog
      title={conflict.missing ? '原本地文件已不存在' : '本地文件已在别处更改'}
      description={
        conflict.missing
          ? 'A3S Work 中的编辑内容仍然保留。你可以另存为，或明确重新创建原路径。'
          : '为避免覆盖其他应用的修改，A3S Work 已停止写回。你可以另存为，或明确覆盖外部版本。'
      }
      closeDisabled={overwriting}
      onClose={onClose}
      footer={
        <>
          <Button tone='quiet' disabled={overwriting} onClick={onClose}>
            稍后处理
          </Button>
          <Button tone='secondary' disabled={overwriting} onClick={onSaveAs}>
            另存为
          </Button>
          <Button
            tone='danger'
            loading={overwriting}
            onClick={() => {
              setOverwriting(true);
              void onOverwrite().finally(() => setOverwriting(false));
            }}
          >
            {conflict.missing ? '重新创建原路径' : '覆盖外部版本'}
          </Button>
        </>
      }
    >
      <InlineNotice
        className='work-local-conflict-summary'
        tone='warning'
        role='alert'
        icon={<AlertTriangle size={18} />}
        title={conflict.missing ? '原路径不可用' : '检测到不同的文件版本'}
      >
        <code>{conflict.path}</code>
      </InlineNotice>
    </Dialog>
  );
}

function defaultLocalFileName(artifact: WorkArtifact): string {
  return `${safeFileName(artifact.title)}.${workArtifactExtension(artifact.kind)}`;
}

function selectFileBaseName(input: HTMLInputElement): void {
  const extensionIndex = input.value.lastIndexOf('.');
  input.setSelectionRange(0, extensionIndex > 0 ? extensionIndex : input.value.length);
}
