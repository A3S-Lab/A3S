import {
  AlertTriangle,
  ArrowLeft,
  Cloud,
  CloudOff,
  Download,
  Eye,
  FileDown,
  FileText,
  FileType2,
  FolderOutput,
  History,
  Info,
  Pencil,
  Presentation,
  Printer,
  Save,
  Sheet,
  Sparkles,
  Star,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { DocumentEditor } from '../editors/document-editor';
import { PresentationEditor } from '../editors/presentation-editor';
import type { WorkActions } from '../use-work-controller';
import { localPathParent } from '../work-local-files';
import type { WorkArtifactContent, WorkArtifactKind, WorkPresentationPrintLayout } from '../work-types';
import type { WorkEditorAgentRequest } from '../work-agent-request';
import { workArtifactExtension, workArtifactKindLabel } from '../work-types';
import { WorkCompatibilityDialog } from './work-compatibility-dialog';
import { WorkLocalFileConflictDialog, WorkLocalSaveDialog } from './work-local-save-dialog';
import { WorkPdfExportSurface } from './work-pdf-export-surface';
import { WorkPrintPreviewDialog } from './work-print-preview-dialog';
import { WorkVersionHistoryDialog } from './work-version-history-dialog';

const SpreadsheetEditor = lazy(() =>
  import('../editors/spreadsheet-editor').then((module) => ({ default: module.SpreadsheetEditor }))
);
const PdfViewer = lazy(() => import('../editors/pdf-viewer').then((module) => ({ default: module.PdfViewer })));

export function WorkEditorShell({
  actions,
  copilotOpen = false,
  onToggleCopilot,
  onAgentRequest,
  defaultLocalDirectory = '',
  onPickLocalDirectory,
  onLocalFileSaved,
}: {
  actions: WorkActions;
  copilotOpen?: boolean;
  onToggleCopilot?: () => void;
  onAgentRequest?: (request: WorkEditorAgentRequest) => void | Promise<void>;
  defaultLocalDirectory?: string;
  onPickLocalDirectory?: () => Promise<string | null>;
  onLocalFileSaved?: () => void;
}) {
  const artifact = actions.activeArtifact;
  const [preview, setPreview] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showLocalSaveAs, setShowLocalSaveAs] = useState(false);
  const [compatibilityMode, setCompatibilityMode] = useState<'review' | 'native' | 'pdf' | 'local' | 'local-as' | null>(
    null
  );
  const [presentationPrintLayout, setPresentationPrintLayout] = useState<WorkPresentationPrintLayout>('slides');
  const [pendingPdfPageIndexes, setPendingPdfPageIndexes] = useState<number[] | null>(null);
  const saveBoundLocalFile = async (force = false) => {
    const saved = await actions.saveLocalFile({ force });
    if (saved) onLocalFileSaved?.();
    return saved;
  };
  const requestBoundLocalSave = () => {
    if (!artifact || artifact.kind === 'pdf' || !actions.activeLocalBinding) return;
    if (artifact.compatibility?.issues.length) {
      setCompatibilityMode('local');
      return;
    }
    void saveBoundLocalFile();
  };

  useEffect(() => {
    setPresentationPrintLayout('slides');
    setShowPrintPreview(false);
    setPendingPdfPageIndexes(null);
  }, [artifact?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'p' && artifact?.kind !== 'pdf') {
        event.preventDefault();
        setShowPrintPreview(true);
      } else if (key === 's') {
        event.preventDefault();
        if (actions.activeLocalBinding && artifact?.kind !== 'pdf') requestBoundLocalSave();
        else void actions.saveNow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, artifact]);

  useEffect(() => {
    const path = actions.activeLocalBinding?.path;
    if (!path || artifact?.kind === 'pdf') return;
    void actions.checkLocalFile();
    const onFocus = () => void actions.checkLocalFile();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [
    actions.activeLocalBinding?.fingerprint,
    actions.activeLocalBinding?.path,
    actions.checkLocalFile,
    artifact?.kind,
  ]);

  if (!artifact) return null;

  const updateContent = (content: WorkArtifactContent) => {
    actions.updateArtifact((current) => ({ ...current, content }));
  };
  const requestPdfExport = (pageIndexes: number[]) => {
    if (artifact.compatibility?.issues.length) {
      setPendingPdfPageIndexes(pageIndexes);
      setShowPrintPreview(false);
      setCompatibilityMode('pdf');
      return;
    }
    void actions.exportPdf({ pageIndexes });
  };

  return (
    <section className={`work-editor-shell ${artifact.kind}`}>
      <header className='work-editor-header'>
        <button
          type='button'
          className='work-editor-back'
          aria-label='返回 Work 文件中心'
          onClick={() => void actions.closeArtifact()}
        >
          <ArrowLeft size={17} />
        </button>
        <span className={`work-file-kind-icon ${artifact.kind}`}>
          <WorkKindIcon kind={artifact.kind} />
        </span>
        <div className='work-editor-identity'>
          <input
            value={artifact.title}
            aria-label='文件名'
            onChange={(event) => {
              const title = event.target.value;
              actions.updateArtifact((current) => ({ ...current, title }));
            }}
            onBlur={() => {
              if (artifact.title.trim()) return;
              actions.updateArtifact((current) => ({
                ...current,
                title: `无标题${workArtifactKindLabel(current.kind)}`,
              }));
            }}
          />
          <span>
            {workArtifactExtension(artifact.kind).toUpperCase()}
            <i aria-hidden='true'>·</i>
            <SaveStatus state={actions.saveState} storageMode={actions.storageMode} />
          </span>
        </div>
        <div className='work-editor-header-actions'>
          {onToggleCopilot && (
            <button
              type='button'
              className={`work-icon-button ${copilotOpen ? 'active' : ''}`}
              aria-label={copilotOpen ? '关闭 Work AI 助手' : '打开 Work AI 助手'}
              aria-pressed={copilotOpen}
              onClick={onToggleCopilot}
            >
              <Sparkles size={16} />
            </button>
          )}
          <button
            type='button'
            className={`work-icon-button ${artifact.favorite ? 'active' : ''}`}
            aria-label={artifact.favorite ? '取消收藏' : '收藏'}
            onClick={() => actions.toggleFavorite(artifact.id)}
          >
            <Star size={16} fill={artifact.favorite ? 'currentColor' : 'none'} />
          </button>
          {artifact.source && (
            <button
              type='button'
              className='work-icon-button'
              aria-label={`下载原始文件 ${artifact.source.name}`}
              title={`下载原始文件：${artifact.source.name}`}
              onClick={() => void actions.downloadSource()}
            >
              <FileDown size={16} />
            </button>
          )}
          <button
            type='button'
            className='work-icon-button'
            aria-label='查看版本历史'
            onClick={() => setShowVersions(true)}
          >
            <History size={16} />
          </button>
          {artifact.kind !== 'pdf' && (
            <>
              <button
                type='button'
                className='work-local-save-button'
                aria-label={actions.activeLocalBinding ? '保存到原本地文件' : '另存为本地文件'}
                title={actions.activeLocalBinding?.path}
                disabled={actions.localSaveState === 'saving'}
                onClick={() => {
                  if (actions.activeLocalBinding) requestBoundLocalSave();
                  else if (artifact.compatibility?.issues.length) setCompatibilityMode('local-as');
                  else setShowLocalSaveAs(true);
                }}
              >
                <Save size={15} />
                {actions.localSaveState === 'saving' ? '正在保存…' : actions.activeLocalBinding ? '保存' : '另存为'}
              </button>
              {actions.activeLocalBinding && (
                <button
                  type='button'
                  className='work-icon-button'
                  aria-label='另存为本地文件'
                  onClick={() => {
                    if (artifact.compatibility?.issues.length) setCompatibilityMode('local-as');
                    else setShowLocalSaveAs(true);
                  }}
                >
                  <FolderOutput size={16} />
                </button>
              )}
            </>
          )}
          {artifact.kind !== 'pdf' && (
            <fieldset className='work-preview-switch'>
              <legend className='sr-only'>编辑或预览</legend>
              <button type='button' className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>
                <Pencil size={14} />
                编辑
              </button>
              <button type='button' className={preview ? 'active' : ''} onClick={() => setPreview(true)}>
                <Eye size={15} />
                预览
              </button>
            </fieldset>
          )}
          {artifact.kind !== 'pdf' && (
            <button
              type='button'
              className='work-pdf-export-button'
              disabled={actions.exportingPdf || actions.exporting}
              aria-label='打开打印预览'
              onClick={() => setShowPrintPreview(true)}
            >
              <Printer size={15} />
              打印预览
            </button>
          )}
          <button
            type='button'
            className='work-export-button'
            disabled={actions.exporting}
            onClick={() => {
              if (artifact.kind === 'pdf') void actions.downloadSource();
              else if (artifact.compatibility?.issues.length) setCompatibilityMode('native');
              else void actions.exportArtifact();
            }}
          >
            <Download size={15} />
            {actions.exporting
              ? '正在导出…'
              : artifact.kind === 'pdf'
                ? '下载原始 PDF'
                : `导出 ${workArtifactExtension(artifact.kind).toUpperCase()}`}
          </button>
        </div>
      </header>

      {actions.activeLocalBinding ? (
        <output
          className={`work-source-copy-banner local-binding ${actions.localSaveState === 'conflict' ? 'conflict' : ''}`}
        >
          {actions.localSaveState === 'conflict' ? <AlertTriangle size={14} /> : <Save size={14} />}
          <span>
            已连接本地文件 <strong title={actions.activeLocalBinding.path}>{actions.activeLocalBinding.path}</strong>
            ；自动保存进入 A3S，按 Cmd/Ctrl+S 才会写回本地。
          </span>
        </output>
      ) : artifact.source ? (
        <output className='work-source-copy-banner'>
          <Info size={14} />
          <span>
            正在编辑 <strong>{artifact.source.name}</strong> 的 Work 副本；原始本地文件不会自动改写。
          </span>
        </output>
      ) : null}

      {artifact.compatibility?.issues.length ? (
        <button type='button' className='work-compatibility-banner' onClick={() => setCompatibilityMode('review')}>
          <AlertTriangle size={15} />
          <span>
            此 {artifact.compatibility.sourceFormat} 文件有 {artifact.compatibility.issues.length} 条兼容性提示
          </span>
          <strong>查看详情</strong>
        </button>
      ) : null}

      <div className='work-editor-body'>
        {artifact.content.type === 'document' && (
          <DocumentEditor
            content={artifact.content}
            preview={preview}
            saveStatus={workSaveStatusText(actions.saveState, actions.storageMode)}
            onChange={updateContent}
            onAgentRequest={onAgentRequest}
          />
        )}
        {artifact.content.type === 'spreadsheet' && (
          <Suspense fallback={<output className='work-editor-loading'>正在准备表格编辑器…</output>}>
            <SpreadsheetEditor
              content={artifact.content}
              preview={preview}
              saveStatus={workSaveStatusText(actions.saveState, actions.storageMode)}
              onChange={updateContent}
              onAgentRequest={onAgentRequest}
            />
          </Suspense>
        )}
        {artifact.content.type === 'presentation' && (
          <PresentationEditor
            content={artifact.content}
            preview={preview}
            saveStatus={workSaveStatusText(actions.saveState, actions.storageMode)}
            onChange={updateContent}
            onAgentRequest={onAgentRequest}
            onStartSlideshow={() => setPreview(true)}
          />
        )}
        {artifact.content.type === 'pdf' && (
          <Suspense fallback={<output className='work-editor-loading'>正在准备 PDF 预览器…</output>}>
            <PdfViewer
              fileName={artifact.source?.name ?? `${artifact.title}.pdf`}
              loadSource={actions.sourceBlob}
              saveLabel={actions.activeLocalBinding ? '保存并写回本地' : '保存到 A3S'}
              sourceKey={artifact.id}
              onSave={actions.savePdfSource}
            />
          </Suspense>
        )}
      </div>
      <WorkPdfExportSurface artifact={artifact} presentationLayout={presentationPrintLayout} />
      {showPrintPreview && artifact.kind !== 'pdf' && (
        <WorkPrintPreviewDialog
          artifact={artifact}
          presentationLayout={presentationPrintLayout}
          exportingPdf={actions.exportingPdf}
          onPresentationLayoutChange={setPresentationPrintLayout}
          onClose={() => setShowPrintPreview(false)}
          onExportPdf={requestPdfExport}
          onPrint={async () => {
            if (await actions.saveNow()) window.print();
          }}
          onReviewCompatibility={
            artifact.compatibility?.issues.length
              ? () => {
                  setShowPrintPreview(false);
                  setCompatibilityMode('review');
                }
              : undefined
          }
        />
      )}
      {compatibilityMode && artifact.compatibility && (
        <WorkCompatibilityDialog
          report={artifact.compatibility}
          mode={
            compatibilityMode === 'review'
              ? 'review'
              : compatibilityMode === 'local' || compatibilityMode === 'local-as'
                ? 'save'
                : 'export'
          }
          busy={actions.exporting || actions.exportingPdf}
          onClose={() => {
            setCompatibilityMode(null);
            if (compatibilityMode === 'pdf') setPendingPdfPageIndexes(null);
          }}
          onConfirm={
            compatibilityMode !== 'review'
              ? async () => {
                  if (compatibilityMode === 'pdf') {
                    await actions.exportPdf({
                      pageIndexes: pendingPdfPageIndexes ?? undefined,
                    });
                    setPendingPdfPageIndexes(null);
                  } else if (compatibilityMode === 'native') {
                    await actions.exportArtifact();
                  } else if (compatibilityMode === 'local') {
                    await saveBoundLocalFile();
                  } else {
                    setShowLocalSaveAs(true);
                  }
                  setCompatibilityMode(null);
                }
              : undefined
          }
        />
      )}
      {showLocalSaveAs && (
        <WorkLocalSaveDialog
          artifact={artifact}
          defaultDirectory={
            defaultLocalDirectory ||
            (actions.activeLocalBinding ? localPathParent(actions.activeLocalBinding.path) : '')
          }
          onClose={() => setShowLocalSaveAs(false)}
          onPickDirectory={onPickLocalDirectory ?? (async () => null)}
          onSave={async (directory, fileName, allowOverwrite) => {
            const result = await actions.saveLocalFileAs(directory, fileName, { allowOverwrite });
            if (result === 'saved') onLocalFileSaved?.();
            return result;
          }}
        />
      )}
      {actions.localConflict && (
        <WorkLocalFileConflictDialog
          conflict={actions.localConflict}
          onClose={actions.dismissLocalConflict}
          onSaveAs={() => {
            actions.dismissLocalConflict();
            setShowLocalSaveAs(true);
          }}
          onOverwrite={() => saveBoundLocalFile(true)}
        />
      )}
      {showVersions && <WorkVersionHistoryDialog actions={actions} onClose={() => setShowVersions(false)} />}
    </section>
  );
}

function WorkKindIcon({ kind }: { kind: WorkArtifactKind }) {
  if (kind === 'spreadsheet') return <Sheet size={17} />;
  if (kind === 'presentation') return <Presentation size={17} />;
  if (kind === 'pdf') return <FileType2 size={17} />;
  return <FileText size={17} />;
}

function SaveStatus({
  state,
  storageMode,
}: {
  state: WorkActions['saveState'];
  storageMode: WorkActions['storageMode'];
}) {
  if (state === 'error') {
    return (
      <>
        <CloudOff size={11} />
        保存失败
      </>
    );
  }
  return (
    <>
      <Cloud size={11} />
      {workSaveStatusText(state, storageMode)}
    </>
  );
}

function workSaveStatusText(state: WorkActions['saveState'], storageMode: WorkActions['storageMode']): string {
  if (state === 'error') return '保存失败';
  if (state === 'saving') return '正在保存';
  if (state === 'dirty') return '等待保存';
  return storageMode === 'server' ? '已保存到 A3S' : '已保存到此设备';
}
