import { PDFViewer, type ExportPlugin, type PluginRegistry } from '@embedpdf/react-pdf-viewer';
import { AlertCircle, Check, Loader2, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type PdfSaveState = 'idle' | 'saving' | 'saved' | 'error';

const PDFIUM_WASM_PATH = '/workspace/vendor/embedpdf/pdfium.wasm';

export function PdfViewer({
  fileName = 'document.pdf',
  loadSource,
  onSave,
  saveLabel = '保存到 A3S',
  sourceKey,
}: {
  fileName?: string;
  loadSource: () => Promise<Blob>;
  onSave?: (pdf: Blob) => Promise<boolean>;
  saveLabel?: string;
  sourceKey?: string;
}) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [saveState, setSaveState] = useState<PdfSaveState>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const registryRef = useRef<PluginRegistry | null>(null);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    registryRef.current = null;
    setViewerReady(false);
    setSaveState('idle');
    setSourceUrl(null);
    setLoadError(null);

    void loadSource()
      .then((source) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(
          source.type === 'application/pdf' ? source : new Blob([source], { type: 'application/pdf' })
        );
        setSourceUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!disposed) setLoadError(pdfErrorMessage(error));
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [loadSource, retryCount, sourceKey]);

  const savePdf = useCallback(async () => {
    const registry = registryRef.current;
    if (!registry || !onSave || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await registry.pluginsReady();
      const exportPlugin = registry.getPlugin<ExportPlugin>('export');
      if (!exportPlugin) throw new Error('EmbedPDF export plugin is unavailable.');
      const buffer = await exportPlugin.provides().saveAsCopy().toPromise();
      const saved = await onSave(new Blob([buffer], { type: 'application/pdf' }));
      setSaveState(saved ? 'saved' : 'error');
    } catch {
      setSaveState('error');
    }
  }, [onSave, saveState]);

  useEffect(() => {
    if (!onSave) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void savePdf();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onSave, savePdf]);

  if (loadError) {
    return (
      <section className='work-pdf-state error' role='alert'>
        <AlertCircle size={24} />
        <strong>PDF 加载失败</strong>
        <span>{loadError}</span>
        <button type='button' onClick={() => setRetryCount((value) => value + 1)}>
          重试
        </button>
      </section>
    );
  }

  if (!sourceUrl) {
    return (
      <output className='work-pdf-state' aria-live='polite'>
        <Loader2 className='spin' size={22} />
        正在加载 PDF…
      </output>
    );
  }

  return (
    <section className='work-pdf-viewer' aria-label={`PDF 编辑器：${fileName}`}>
      {onSave && (
        <div className='work-pdf-integration-bar'>
          <span>
            <strong>EmbedPDF · PDFium</strong>
            批注、表单、签名、盖章和涂黑会写入导出的 PDF
          </span>
          <output className={saveState} aria-label='PDF 保存状态'>
            {saveState === 'saving' && '正在生成 PDF…'}
            {saveState === 'saved' && (
              <>
                <Check size={13} /> 已保存
              </>
            )}
            {saveState === 'error' && '保存失败，请重试'}
          </output>
          <button type='button' disabled={!viewerReady || saveState === 'saving'} onClick={() => void savePdf()}>
            <Save size={14} />
            {saveLabel}
          </button>
        </div>
      )}
      <div className='work-pdf-embed'>
        <PDFViewer
          key={sourceUrl}
          className='work-pdf-native-viewer'
          style={{ width: '100%', height: '100%' }}
          config={{
            src: sourceUrl,
            // EmbedPDF creates a Blob worker, so a root-relative URL has no
            // usable base inside WorkerGlobalScope. Keep this absolute.
            wasmUrl: new URL(PDFIUM_WASM_PATH, window.location.href).href,
            tabBar: 'never',
            theme: {
              preference: 'system',
              light: { accent: { primary: '#2867d8' } },
              dark: { accent: { primary: '#7da7ff' } },
            },
            i18n: { defaultLocale: 'zh-CN' },
            annotations: { annotationAuthor: 'A3S Work 用户', autoCommit: true },
            export: { defaultFileName: fileName },
            fonts: { ui: null, signature: null },
            disabledCategories: onSave ? undefined : ['annotation', 'redaction', 'form', 'history'],
          }}
          onReady={(registry) => {
            registryRef.current = registry;
            setViewerReady(true);
          }}
        />
      </div>
    </section>
  );
}

function pdfErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '无法读取这个 PDF 文件。';
}
