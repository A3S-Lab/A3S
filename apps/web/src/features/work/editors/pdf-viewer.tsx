import { type ExportPlugin, PDFViewer, type PluginRegistry } from '@embedpdf/react-pdf-viewer';
import { AlertCircle, Check, Loader2, Save } from 'lucide-react';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Button, StateView, StatusBadge } from '../../../design-system/primitives';
import { isOfficeShortcutBlocked } from './office-shortcuts';

type PdfSaveState = 'idle' | 'saving' | 'saved' | 'error';

const PDFIUM_WASM_PATH = '/vendor/embedpdf/pdfium.wasm';
const PDF_VIEWER_READY_TIMEOUT_MS = 20_000;

export function PdfViewer({
  fileName = 'document.pdf',
  loadSource,
  onSave,
  saveLabel = '保存',
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
  const embedRef = useRef<HTMLDivElement>(null);

  usePdfViewerControls(embedRef, Boolean(sourceUrl && viewerReady));

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

  useEffect(() => {
    if (!sourceUrl || viewerReady || loadError) return;
    const timeout = window.setTimeout(() => {
      registryRef.current = null;
      setLoadError('PDF 阅读器加载超时。');
    }, PDF_VIEWER_READY_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [loadError, sourceUrl, viewerReady]);

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
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.shiftKey ||
        isOfficeShortcutBlocked(event.target) ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 's'
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      void savePdf();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onSave, savePdf]);

  if (loadError) {
    return (
      <StateView
        className='work-pdf-state'
        tone='danger'
        role='alert'
        icon={<AlertCircle size={24} />}
        title='无法打开 PDF'
        description='请重试。'
        descriptionTitle={loadError}
        actions={<Button onClick={() => setRetryCount((value) => value + 1)}>重试</Button>}
      />
    );
  }

  if (!sourceUrl) {
    return (
      <StateView
        className='work-pdf-state'
        role='status'
        icon={<Loader2 className='spin' size={22} />}
        title='正在加载 PDF…'
      />
    );
  }

  return (
    <section className='work-pdf-viewer' aria-label={`PDF 编辑器：${fileName}`}>
      {onSave && (
        <div className='work-pdf-integration-bar'>
          <output className={saveState} aria-label='PDF 保存状态'>
            {saveState === 'saving' && <StatusBadge tone='info'>正在保存…</StatusBadge>}
            {saveState === 'saved' && (
              <StatusBadge tone='success'>
                <Check size={13} /> 已保存
              </StatusBadge>
            )}
            {saveState === 'error' && <StatusBadge tone='danger'>保存失败，请重试</StatusBadge>}
          </output>
          <Button
            tone='secondary'
            title={`${saveLabel}（Cmd/Ctrl+S）`}
            disabled={!viewerReady || saveState === 'saving'}
            onClick={() => void savePdf()}
          >
            <Save size={14} />
            {saveLabel}
          </Button>
        </div>
      )}
      <div className='work-pdf-embed' ref={embedRef}>
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

function usePdfViewerControls(containerRef: RefObject<HTMLDivElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let root: ShadowRoot | null = null;
    let rootObserver: MutationObserver | null = null;
    let rootFrame = 0;
    let focusFrame = 0;
    let dialogFocusFrame = 0;
    let menuFocusFrame = 0;
    let rootAttempts = 0;
    let focusAttempts = 0;
    let pendingSearchFocus = false;
    let activeDialog: HTMLElement | null = null;
    let dialogReturnFocus: HTMLElement | null = null;
    let activeMenu: HTMLElement | null = null;
    let menuReturnFocus: HTMLElement | null = null;
    let lastControlFocus: HTMLElement | null = null;
    let dialogSequence = 0;

    const searchInput = () =>
      [...(root?.querySelectorAll<HTMLInputElement>('input[type="text"][placeholder]:not([name="zoom"])') ?? [])].find(
        (input) => !input.disabled && input.getAttribute('aria-hidden') !== 'true' && !input.closest('[hidden]')
      ) ?? null;

    const searchButton = () => {
      const item = root?.querySelector<HTMLElement>('[data-epdf-i="search-button"]');
      return item instanceof HTMLButtonElement ? item : (item?.querySelector<HTMLButtonElement>('button') ?? null);
    };

    const focusSearchInput = (): boolean => {
      const input = searchInput();
      if (!input) return false;
      input.setAttribute('aria-label', '在 PDF 中搜索');
      input.focus();
      pendingSearchFocus = false;
      return true;
    };

    const scheduleSearchFocus = () => {
      pendingSearchFocus = true;
      focusAttempts = 0;
      cancelAnimationFrame(focusFrame);
      const focusWhenReady = () => {
        if (disposed || focusSearchInput()) return;
        focusAttempts += 1;
        if (focusAttempts < 12) focusFrame = requestAnimationFrame(focusWhenReady);
      };
      focusFrame = requestAnimationFrame(focusWhenReady);
    };

    const enhanceDialog = () => {
      if (!root) return;
      const nextDialog = pdfNativeDialog(root);
      if (activeDialog && activeDialog !== nextDialog) {
        const returnTarget = dialogReturnFocus;
        activeDialog = null;
        dialogReturnFocus = null;
        cancelAnimationFrame(dialogFocusFrame);
        if (!nextDialog && returnTarget?.isConnected) {
          dialogFocusFrame = requestAnimationFrame(() => {
            dialogFocusFrame = requestAnimationFrame(() => {
              if (returnTarget.isConnected) returnTarget.focus();
            });
          });
        }
      }
      if (!nextDialog) return;

      const heading = pdfDialogHeading(nextDialog);
      if (heading) {
        if (!heading.id) {
          dialogSequence += 1;
          heading.id = `a3s-pdf-dialog-${dialogSequence}`;
        }
        nextDialog.setAttribute('aria-labelledby', heading.id);
      }
      if (nextDialog.getAttribute('role') !== 'dialog') nextDialog.setAttribute('role', 'dialog');
      if (nextDialog.getAttribute('aria-modal') !== 'true') nextDialog.setAttribute('aria-modal', 'true');

      const closeButton = pdfDialogCloseButton(nextDialog);
      if (closeButton && !closeButton.getAttribute('aria-label') && !closeButton.textContent?.trim()) {
        closeButton.setAttribute(
          'aria-label',
          heading?.textContent?.trim() ? `关闭${heading.textContent.trim()}` : '关闭'
        );
      }
      if (activeDialog === nextDialog) return;

      const previousFocus = root.activeElement;
      dialogReturnFocus =
        previousFocus instanceof HTMLElement && previousFocus.isConnected && !nextDialog.contains(previousFocus)
          ? previousFocus
          : menuReturnFocus?.isConnected
            ? menuReturnFocus
            : lastControlFocus?.isConnected && !nextDialog.contains(lastControlFocus)
              ? lastControlFocus
              : null;
      menuReturnFocus = null;
      activeDialog = nextDialog;
      cancelAnimationFrame(dialogFocusFrame);
      dialogFocusFrame = requestAnimationFrame(() => {
        if (disposed || !activeDialog || !root?.contains(activeDialog) || activeDialog.contains(root.activeElement))
          return;
        pdfDialogFocusTarget(activeDialog)?.focus();
      });
    };

    const enhanceMenu = () => {
      if (!root) return;
      const nextMenu = pdfNativeMenu(root);
      if (activeMenu && activeMenu !== nextMenu) {
        const returnTarget = menuReturnFocus;
        activeMenu = null;
        cancelAnimationFrame(menuFocusFrame);
        if (!nextMenu && !pdfNativeDialog(root) && returnTarget?.isConnected) {
          menuFocusFrame = requestAnimationFrame(() => returnTarget.focus());
        }
      }
      if (!nextMenu) return;

      const items = pdfMenuItems(nextMenu);
      if (!items.length) return;
      if (nextMenu.getAttribute('role') !== 'menu') nextMenu.setAttribute('role', 'menu');
      if (activeMenu === nextMenu) {
        if (!nextMenu.contains(root.activeElement) && root.activeElement === menuReturnFocus) {
          cancelAnimationFrame(menuFocusFrame);
          menuFocusFrame = requestAnimationFrame(() => pdfMenuItems(nextMenu)[0]?.focus());
        }
        return;
      }

      const previousFocus = root.activeElement;
      menuReturnFocus =
        previousFocus instanceof HTMLElement && !nextMenu.contains(previousFocus) ? previousFocus : null;
      if (menuReturnFocus?.isConnected) lastControlFocus = menuReturnFocus;
      const menuLabel = pdfControlLabel(menuReturnFocus);
      if (menuLabel && !nextMenu.getAttribute('aria-label') && !nextMenu.getAttribute('aria-labelledby')) {
        nextMenu.setAttribute('aria-label', menuLabel);
      }
      activeMenu = nextMenu;
      cancelAnimationFrame(menuFocusFrame);
      menuFocusFrame = requestAnimationFrame(() => {
        if (disposed || !activeMenu || !root?.contains(activeMenu) || activeMenu.contains(root.activeElement)) return;
        pdfMenuItems(activeMenu)[0]?.focus();
      });
    };

    const enhanceControls = () => {
      if (!root) return;
      const overflowItem = root.querySelector<HTMLElement>('[data-epdf-i="overflow-tabs-button"]');
      const overflowButton =
        overflowItem instanceof HTMLButtonElement
          ? overflowItem
          : overflowItem?.querySelector<HTMLButtonElement>('button');
      if (overflowButton) {
        overflowButton.setAttribute('aria-label', '更多工具');
        overflowButton.setAttribute('title', '更多工具');
      }
      const zoomInput = root.querySelector<HTMLInputElement>('input[name="zoom"]');
      zoomInput?.setAttribute('aria-label', '缩放比例');
      const pageNumberInput = root.querySelector<HTMLInputElement>(
        'input[type="text"][inputmode="numeric"]:not([name="zoom"])'
      );
      pageNumberInput?.setAttribute('aria-label', '页码');
      searchInput()?.setAttribute('aria-label', '在 PDF 中搜索');
      if (pendingSearchFocus) focusSearchInput();
      enhanceDialog();
      enhanceMenu();
    };

    const onShadowClick = (event: Event) => {
      const path = event.composedPath();
      const clickedControl = path.find(
        (node) =>
          node instanceof HTMLButtonElement ||
          node instanceof HTMLInputElement ||
          node instanceof HTMLSelectElement ||
          node instanceof HTMLTextAreaElement
      );
      if (clickedControl instanceof HTMLElement && !clickedControl.closest('[role="dialog"], [role="menuitem"]')) {
        lastControlFocus = clickedControl;
      }
      const openedSearch = path.some(
        (node) => node instanceof Element && node.getAttribute('data-epdf-i') === 'search-button'
      );
      if (openedSearch) scheduleSearchFocus();
    };

    const connectRoot = () => {
      const nextRoot = container.querySelector<HTMLElement>('embedpdf-container')?.shadowRoot ?? null;
      if (!nextRoot) {
        rootAttempts += 1;
        if (!disposed && rootAttempts < 60) rootFrame = requestAnimationFrame(connectRoot);
        return;
      }
      if (root !== nextRoot) {
        root?.removeEventListener('click', onShadowClick);
        rootObserver?.disconnect();
        root = nextRoot;
        root.addEventListener('click', onShadowClick);
        rootObserver = new MutationObserver(enhanceControls);
        rootObserver.observe(root, {
          attributeFilter: ['class', 'hidden', 'role', 'style'],
          attributes: true,
          childList: true,
          subtree: true,
        });
      }
      enhanceControls();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const currentDialog = root ? pdfNativeDialog(root) : null;
      if (event.key === 'Escape' && currentDialog) {
        const closeButton = pdfDialogCloseButton(currentDialog);
        if (!closeButton) return;
        dialogReturnFocus =
          dialogReturnFocus?.isConnected && !currentDialog.contains(dialogReturnFocus)
            ? dialogReturnFocus
            : menuReturnFocus?.isConnected && !currentDialog.contains(menuReturnFocus)
              ? menuReturnFocus
              : lastControlFocus?.isConnected && !currentDialog.contains(lastControlFocus)
                ? lastControlFocus
                : null;
        event.preventDefault();
        event.stopImmediatePropagation();
        closeButton.click();
        return;
      }
      const currentMenu = root ? pdfNativeMenu(root) : null;
      if (currentMenu) {
        const items = pdfMenuItems(currentMenu);
        if (event.key === 'Escape' && menuReturnFocus) {
          const returnTarget = menuReturnFocus;
          event.preventDefault();
          event.stopImmediatePropagation();
          returnTarget.click();
          cancelAnimationFrame(menuFocusFrame);
          menuFocusFrame = requestAnimationFrame(() => {
            if (returnTarget.isConnected) returnTarget.focus();
          });
          return;
        }
        if (items.length && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const currentIndex = items.indexOf(root?.activeElement as HTMLButtonElement);
          const nextIndex =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? items.length - 1
                : event.key === 'ArrowDown'
                  ? (currentIndex + 1 + items.length) % items.length
                  : (currentIndex - 1 + items.length) % items.length;
          items[nextIndex]?.focus();
          return;
        }
      }
      const currentSearchInput = searchInput();
      if (event.key === 'Escape' && currentSearchInput && root?.activeElement === currentSearchInput) {
        const button = searchButton();
        if (!button) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        pendingSearchFocus = false;
        cancelAnimationFrame(focusFrame);
        button.click();
        focusFrame = requestAnimationFrame(() => {
          focusFrame = requestAnimationFrame(() => button.focus());
        });
        return;
      }
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.shiftKey ||
        isOfficeShortcutBlocked(event.target) ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLocaleLowerCase() !== 'f'
      ) {
        return;
      }
      connectRoot();
      if (!root) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (focusSearchInput()) return;
      const button = searchButton();
      if (!button) return;
      button.click();
      scheduleSearchFocus();
    };

    const containerObserver = new MutationObserver(connectRoot);
    containerObserver.observe(container, { childList: true, subtree: true });
    window.addEventListener('keydown', onKeyDown, { capture: true });
    connectRoot();

    return () => {
      disposed = true;
      cancelAnimationFrame(rootFrame);
      cancelAnimationFrame(focusFrame);
      cancelAnimationFrame(dialogFocusFrame);
      cancelAnimationFrame(menuFocusFrame);
      containerObserver.disconnect();
      rootObserver?.disconnect();
      root?.removeEventListener('click', onShadowClick);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [active, containerRef]);
}

function pdfNativeDialog(root: ShadowRoot): HTMLElement | null {
  return (
    [...root.querySelectorAll<HTMLElement>('div')].find((element) => {
      const style = window.getComputedStyle(element);
      const fixed = style.position === 'fixed' || element.style.position === 'fixed';
      const zeroInset =
        element.style.inset === '0px' ||
        (isZeroInset(style.top) && isZeroInset(style.right) && isZeroInset(style.bottom) && isZeroInset(style.left)) ||
        (element.classList.contains('fixed') && element.classList.contains('inset-0'));
      return fixed && zeroInset && Boolean(pdfDialogHeading(element)) && Boolean(element.querySelector('button'));
    }) ?? null
  );
}

function pdfDialogHeading(dialog: HTMLElement): HTMLElement | null {
  return dialog.querySelector<HTMLElement>('h1, h2, h3, [role="heading"]');
}

function pdfDialogCloseButton(dialog: HTMLElement): HTMLButtonElement | null {
  const heading = pdfDialogHeading(dialog);
  return heading?.parentElement?.querySelector<HTMLButtonElement>('button') ?? null;
}

function pdfDialogFocusTarget(dialog: HTMLElement): HTMLElement | null {
  return (
    pdfDialogCloseButton(dialog) ??
    dialog.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

function pdfNativeMenu(root: ShadowRoot): HTMLElement | null {
  const candidates = [...root.querySelectorAll<HTMLElement>('[data-epdf-i$="-menu"], [role="menu"]')];
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (candidate.closest('[role="dialog"]') || candidate.closest('[hidden]')) continue;
    const style = window.getComputedStyle(candidate);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (pdfMenuItems(candidate).length) return candidate;
  }
  return null;
}

function pdfMenuItems(menu: HTMLElement): HTMLButtonElement[] {
  return [...menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([disabled])')];
}

function pdfControlLabel(control: HTMLElement | null): string {
  if (!control) return '';
  return (
    control.getAttribute('aria-label')?.trim() ||
    control.getAttribute('title')?.trim() ||
    control.textContent?.trim() ||
    ''
  );
}

function isZeroInset(value: string): boolean {
  return value === '0px' || value === '0';
}

function pdfErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '无法读取这个 PDF 文件。';
}
