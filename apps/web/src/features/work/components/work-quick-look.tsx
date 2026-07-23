import { ChevronLeft, ChevronRight, FileQuestion } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Dialog, StateView } from '../../../design-system/primitives';
import { formatApiError } from '../../../state/app-state';
import type { WorkspaceEntry } from '../../../types/api';
import { PresentationEditor } from '../editors/presentation-editor';
import { formatWorkFileDate, formatWorkFileSize, isWorkImportablePath, workFileKindLabel } from '../work-local-files';
import { loadWorkQuickLook, type WorkQuickLookContent } from '../work-quick-look-loader';
import type { WorkArtifact } from '../work-types';
import { WorkDocumentPreview } from './work-document-pages';
import { WorkFileIcon } from './work-file-icon';

const SpreadsheetEditor = lazy(() =>
  import('../editors/spreadsheet-editor').then((module) => ({ default: module.SpreadsheetEditor }))
);
const PdfViewer = lazy(() => import('../editors/pdf-viewer').then((module) => ({ default: module.PdfViewer })));
const ignoreArtifactChange = () => undefined;

export function WorkQuickLook({
  entry,
  previousEntry,
  nextEntry,
  onNavigate,
  onOpen,
  onClose,
  loadPreview = loadWorkQuickLook,
}: {
  entry: WorkspaceEntry;
  previousEntry: WorkspaceEntry | null;
  nextEntry: WorkspaceEntry | null;
  onNavigate: (entry: WorkspaceEntry) => void;
  onOpen: (entry: WorkspaceEntry) => void | Promise<void>;
  onClose: () => void;
  loadPreview?: (entry: WorkspaceEntry) => Promise<WorkQuickLookContent>;
}) {
  const [preview, setPreview] = useState<WorkQuickLookContent | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setPreview(null);
    setError('');
    void loadPreview(entry)
      .then((content) => {
        if (current) setPreview(content);
      })
      .catch((loadError) => {
        if (current) setError(formatApiError(loadError));
      });
    return () => {
      current = false;
    };
  }, [entry, loadPreview]);

  const canOpen = entry.isDirectory || isWorkImportablePath(entry.path);
  return (
    <Dialog
      className='work-quick-look-dialog'
      title={entry.name}
      description={`${workFileKindLabel(entry)} · ${formatWorkFileSize(entry.size, entry.isDirectory)} · ${formatWorkFileDate(entry.mtimeMs)}`}
      onClose={onClose}
      footer={
        <div className='work-quick-look-footer'>
          <div>
            <Button
              tone='quiet'
              aria-label='预览上一个项目'
              disabled={!previousEntry}
              onClick={() => previousEntry && onNavigate(previousEntry)}
            >
              <ChevronLeft size={14} />
              上一个
            </Button>
            <Button
              tone='quiet'
              aria-label='预览下一个项目'
              disabled={!nextEntry}
              onClick={() => nextEntry && onNavigate(nextEntry)}
            >
              下一个
              <ChevronRight size={14} />
            </Button>
          </div>
          <span>空格关闭 · ←/→ 切换</span>
          {canOpen && (
            <Button
              tone='primary'
              onClick={() => {
                onClose();
                void onOpen(entry);
              }}
            >
              {entry.isDirectory ? '打开文件夹' : '打开'}
            </Button>
          )}
        </div>
      }
    >
      <section
        className='work-quick-look'
        data-autofocus
        aria-label='文件快速预览'
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === ' ') {
            event.preventDefault();
            onClose();
          } else if (event.key === 'ArrowLeft' && previousEntry) {
            event.preventDefault();
            onNavigate(previousEntry);
          } else if (event.key === 'ArrowRight' && nextEntry) {
            event.preventDefault();
            onNavigate(nextEntry);
          }
        }}
      >
        <span className='work-quick-look-path' title={entry.path}>
          {entry.path}
        </span>
        {error ? (
          <StateView
            className='work-quick-look-state'
            size='compact'
            tone='danger'
            role='alert'
            icon={<FileQuestion size={30} />}
            title='无法生成预览'
            description={error}
          />
        ) : preview ? (
          <QuickLookContent entry={entry} preview={preview} />
        ) : (
          <StateView className='work-quick-look-state' size='compact' role='status' title='正在生成预览…' />
        )}
      </section>
    </Dialog>
  );
}

function QuickLookContent({ entry, preview }: { entry: WorkspaceEntry; preview: WorkQuickLookContent }) {
  if (preview.kind === 'directory') {
    return (
      <StateView
        className='work-quick-look-state directory'
        size='compact'
        icon={<WorkFileIcon path={entry.path} directory size={32} />}
        title={entry.name}
        description='快速查看不会读取文件夹内的内容；打开文件夹后可以继续浏览。'
      />
    );
  }
  if (preview.kind === 'unsupported') {
    return (
      <StateView
        className='work-quick-look-state unsupported'
        size='compact'
        icon={<FileQuestion size={38} />}
        title='没有内容预览'
        description={preview.reason}
      />
    );
  }
  if (preview.kind === 'text') {
    return (
      <article className='work-quick-look-text' aria-label='文本文件预览'>
        <pre>{preview.text || '（空文件）'}</pre>
      </article>
    );
  }
  if (preview.kind === 'image') return <QuickLookImage blob={preview.blob} name={entry.name} />;
  if (preview.kind === 'pdf') return <QuickLookPdf blob={preview.blob} />;
  return <QuickLookArtifact artifact={preview.artifact} />;
}

function QuickLookImage({ blob, name }: { blob: Blob; name: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <figure className='work-quick-look-image'>
      <img src={url} alt={name} />
    </figure>
  );
}

function QuickLookPdf({ blob }: { blob: Blob }) {
  const loadSource = useCallback(async () => blob, [blob]);
  return (
    <Suspense
      fallback={
        <StateView className='work-quick-look-state' size='compact' role='status' title='正在准备 PDF 预览器…' />
      }
    >
      <PdfViewer loadSource={loadSource} />
    </Suspense>
  );
}

function QuickLookArtifact({ artifact }: { artifact: WorkArtifact }) {
  return (
    <section className={`work-quick-look-artifact ${artifact.kind}`} aria-label={`${artifact.title} 预览`}>
      {artifact.compatibility?.issues.length ? (
        <output className='work-quick-look-compatibility'>
          此文件有 {artifact.compatibility.issues.length} 条兼容性提示；快速查看不会保存转换结果。
        </output>
      ) : null}
      {artifact.content.type === 'document' && <WorkDocumentPreview content={artifact.content} />}
      {artifact.content.type === 'spreadsheet' && (
        <Suspense
          fallback={
            <StateView className='work-quick-look-state' size='compact' role='status' title='正在准备表格预览器…' />
          }
        >
          <SpreadsheetEditor content={artifact.content} preview onChange={ignoreArtifactChange} />
        </Suspense>
      )}
      {artifact.content.type === 'presentation' && (
        <PresentationEditor content={artifact.content} preview onChange={ignoreArtifactChange} />
      )}
    </section>
  );
}
