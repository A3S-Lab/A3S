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
import { Button, IconButton, SegmentedControl } from '../../../design-system/primitives';
import { DocumentEditor } from '../editors/document-editor';
import { OfficeTextField } from '../editors/office-controls';
import { isOfficeShortcutBlocked } from '../editors/office-shortcuts';
import { PresentationEditor } from '../editors/presentation-editor';
import type { WorkOfficeFileAction } from '../editors/work-office-chrome';
import type { WorkActions } from '../use-work-controller';
import type { WorkEditorAgentRequest } from '../work-agent-request';
import { localPathParent } from '../work-local-files';
import type { WorkArtifactContent, WorkArtifactKind, WorkPresentationPrintLayout } from '../work-types';
import { workArtifactExtension, workArtifactKindLabel } from '../work-types';
import { WorkCompatibilityDialog } from './work-compatibility-dialog';
import { WorkEditorLoadingState } from './work-editor-loading-state';
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
  const requestPrimarySave = () => {
    if (!artifact || artifact.kind === 'pdf') return;
    if (actions.activeLocalBinding) requestBoundLocalSave();
    else void actions.saveNow();
  };
  const requestLocalSaveAs = () => {
    if (!artifact || artifact.kind === 'pdf') return;
    if (artifact.compatibility?.issues.length) setCompatibilityMode('local-as');
    else setShowLocalSaveAs(true);
  };

  useEffect(() => {
    setPreview(false);
    setPresentationPrintLayout('slides');
    setShowPrintPreview(false);
    setPendingPdfPageIndexes(null);
  }, [artifact?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        isOfficeShortcutBlocked(event.target) ||
        !(event.metaKey || event.ctrlKey) ||
        !artifact ||
        artifact.kind === 'pdf'
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'p' && !event.shiftKey) {
        event.preventDefault();
        setShowPrintPreview(true);
      } else if (key === 's') {
        event.preventDefault();
        if (event.shiftKey) requestLocalSaveAs();
        else requestPrimarySave();
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
  const requestNativeExport = () => {
    if (artifact.compatibility?.issues.length) setCompatibilityMode('native');
    else void actions.exportArtifact();
  };
  const officeFileActions: readonly WorkOfficeFileAction[] =
    artifact.kind === 'pdf'
      ? []
      : [
          {
            id: 'save',
            label: '保存',
            icon: <Save size={16} />,
            shortcut: 'Cmd/Ctrl+S',
            disabled: actions.saveState === 'saving' || actions.localSaveState === 'saving',
            onSelect: requestPrimarySave,
          },
          {
            id: 'save-as',
            label: '另存为',
            icon: <FolderOutput size={16} />,
            shortcut: 'Cmd/Ctrl+Shift+S',
            onSelect: requestLocalSaveAs,
          },
          {
            id: 'print',
            label: '打印',
            icon: <Printer size={16} />,
            shortcut: 'Cmd/Ctrl+P',
            separatorBefore: true,
            onSelect: () => setShowPrintPreview(true),
          },
          {
            id: 'export',
            label: `导出 ${workArtifactExtension(artifact.kind).toUpperCase()}`,
            icon: <Download size={16} />,
            disabled: actions.exporting,
            onSelect: requestNativeExport,
          },
          ...(artifact.source
            ? [
                {
                  id: 'download-source',
                  label: '下载原文件',
                  icon: <FileDown size={16} />,
                  onSelect: () => void actions.downloadSource(),
                },
              ]
            : []),
          {
            id: 'versions',
            label: '版本记录',
            icon: <History size={16} />,
            separatorBefore: true,
            onSelect: () => setShowVersions(true),
          },
        ];

  return (
    <section className={`work-editor-shell ${artifact.kind}`}>
      <header className='work-editor-header'>
        <IconButton className='work-editor-back' label='返回办公文件中心' onClick={() => void actions.closeArtifact()}>
          <ArrowLeft size={17} />
        </IconButton>
        <span className={`work-file-kind-icon ${artifact.kind}`}>
          <WorkKindIcon kind={artifact.kind} />
        </span>
        <div className='work-editor-identity'>
          <OfficeTextField
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
          <IconButton
            label={artifact.favorite ? '取消收藏' : '收藏'}
            selected={artifact.favorite}
            className={`work-icon-button ${artifact.favorite ? 'active' : ''}`}
            onClick={() => actions.toggleFavorite(artifact.id)}
          >
            <Star size={16} fill={artifact.favorite ? 'currentColor' : 'none'} />
          </IconButton>
          {artifact.kind !== 'pdf' && (
            <Button
              className='work-local-save-button'
              aria-label={actions.activeLocalBinding ? '保存到原本地文件' : '保存到 A3S'}
              title={actions.activeLocalBinding?.path ?? '保存到 A3S'}
              disabled={actions.saveState === 'saving' || actions.localSaveState === 'saving'}
              loading={actions.saveState === 'saving' || actions.localSaveState === 'saving'}
              onClick={requestPrimarySave}
            >
              {actions.saveState !== 'saving' && actions.localSaveState !== 'saving' && <Save size={15} />}
              保存
            </Button>
          )}
          {artifact.kind !== 'pdf' && (
            <SegmentedControl<'edit' | 'preview'>
              ariaLabel='编辑或预览'
              value={preview ? 'preview' : 'edit'}
              size='compact'
              className='work-preview-switch'
              items={[
                { id: 'edit', label: '编辑', ariaLabel: '编辑', icon: <Pencil size={14} /> },
                { id: 'preview', label: '预览', ariaLabel: '预览', icon: <Eye size={15} /> },
              ]}
              onChange={(mode) => setPreview(mode === 'preview')}
            />
          )}
          {onToggleCopilot && (
            <Button
              className={`work-editor-ai-button ${copilotOpen ? 'active' : ''}`}
              aria-label={copilotOpen ? '关闭 AI 助手' : '打开 AI 助手'}
              aria-pressed={copilotOpen}
              title={copilotOpen ? '关闭 AI 助手' : '打开 AI 助手'}
              onClick={onToggleCopilot}
            >
              <Sparkles size={15} />
              AI 助手
            </Button>
          )}
          {artifact.kind === 'pdf' && (
            <>
              {artifact.source && (
                <IconButton
                  className='work-icon-button'
                  label={`下载原始文件 ${artifact.source.name}`}
                  tooltip={`下载原始文件：${artifact.source.name}`}
                  onClick={() => void actions.downloadSource()}
                >
                  <FileDown size={16} />
                </IconButton>
              )}
              <IconButton className='work-icon-button' label='查看版本历史' onClick={() => setShowVersions(true)}>
                <History size={16} />
              </IconButton>
              <Button
                className='work-export-button'
                disabled={actions.exporting}
                loading={actions.exporting}
                onClick={() => void actions.downloadSource()}
              >
                {!actions.exporting && <Download size={15} />}
                下载 PDF
              </Button>
            </>
          )}
        </div>
      </header>

      {actions.activeLocalBinding && actions.localSaveState === 'conflict' ? (
        <output className='work-source-copy-banner local-binding conflict'>
          <AlertTriangle size={14} />
          <span>
            本地文件已在外部修改：
            <strong title={actions.activeLocalBinding.path}>{actions.activeLocalBinding.path}</strong>
          </span>
        </output>
      ) : artifact.source ? (
        <output className='work-source-copy-banner'>
          <Info size={14} />
          <span>
            副本：<strong>{artifact.source.name}</strong>
            {' · 原文件不受影响'}
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
            key={artifact.id}
            content={artifact.content}
            preview={preview}
            saveStatus={workSaveStatusText(actions.saveState, actions.storageMode)}
            fileActions={officeFileActions}
            onChange={updateContent}
            onAgentRequest={onAgentRequest}
          />
        )}
        {artifact.content.type === 'spreadsheet' && (
          <Suspense fallback={<WorkEditorLoadingState title='正在准备表格编辑器' />}>
            <SpreadsheetEditor
              key={artifact.id}
              content={artifact.content}
              preview={preview}
              saveStatus={workSaveStatusText(actions.saveState, actions.storageMode)}
              fileActions={officeFileActions}
              onChange={updateContent}
              onAgentRequest={onAgentRequest}
            />
          </Suspense>
        )}
        {artifact.content.type === 'presentation' && (
          <PresentationEditor
            key={artifact.id}
            content={artifact.content}
            preview={preview}
            saveStatus={workSaveStatusText(actions.saveState, actions.storageMode)}
            fileActions={officeFileActions}
            onChange={updateContent}
            onAgentRequest={onAgentRequest}
            onStartSlideshow={() => setPreview(true)}
          />
        )}
        {artifact.content.type === 'pdf' && (
          <Suspense fallback={<WorkEditorLoadingState title='正在准备 PDF 预览器' />}>
            <PdfViewer
              key={artifact.id}
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
