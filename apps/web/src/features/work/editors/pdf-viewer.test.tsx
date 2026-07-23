import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from '../../../design-system/primitives';
import { PdfViewer } from './pdf-viewer';

const embedPdfMocks = vi.hoisted(() => ({
  autoReady: true,
  saveAsCopy: vi.fn(() => ({
    toPromise: vi.fn(async () => Uint8Array.from([37, 80, 68, 70]).buffer),
  })),
}));

vi.mock('@embedpdf/react-pdf-viewer', async () => {
  const React = await import('react');
  const registry = {
    pluginsReady: vi.fn(async () => undefined),
    getPlugin: vi.fn(() => ({
      provides: () => ({ saveAsCopy: embedPdfMocks.saveAsCopy }),
    })),
  };
  return {
    PDFViewer: ({
      config,
      onReady,
    }: {
      config: Record<string, unknown>;
      onReady?: (value: typeof registry) => void;
    }) => {
      const hostRef = React.useRef<HTMLDivElement>(null);
      React.useLayoutEffect(() => {
        const host = document.createElement('embedpdf-container');
        const root = host.attachShadow({ mode: 'open' });
        const overflowItem = document.createElement('div');
        overflowItem.dataset.epdfI = 'overflow-tabs-button';
        overflowItem.append(document.createElement('button'));
        const zoom = document.createElement('input');
        zoom.name = 'zoom';
        zoom.type = 'text';
        zoom.setAttribute('aria-label', 'Set zoom');
        const pageNumber = document.createElement('input');
        pageNumber.type = 'text';
        pageNumber.inputMode = 'numeric';
        pageNumber.value = '1';
        pageNumber.setAttribute('aria-label', 'Current page');
        const openPrintSettings = () => {
          const overlay = document.createElement('div');
          overlay.className = 'fixed inset-0';
          Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0px',
          });
          const panel = document.createElement('div');
          const header = document.createElement('div');
          const heading = document.createElement('h2');
          heading.textContent = '打印设置';
          const close = document.createElement('button');
          close.addEventListener('click', () => overlay.remove());
          header.append(heading, close);
          const allPages = document.createElement('input');
          allPages.type = 'radio';
          allPages.name = 'pages';
          const print = document.createElement('button');
          print.textContent = '打印';
          panel.append(header, allPages, print);
          overlay.append(panel);
          root.append(overlay);
        };
        const printSettingsButton = document.createElement('button');
        printSettingsButton.setAttribute('aria-label', '打开打印设置');
        printSettingsButton.addEventListener('click', openPrintSettings);
        const fileOptionsButton = document.createElement('button');
        fileOptionsButton.dataset.epdfI = 'file-options-button';
        fileOptionsButton.setAttribute('aria-label', '文件选项');
        fileOptionsButton.addEventListener('click', () => {
          const current = root.querySelector('[data-epdf-i="file-options-menu"]');
          if (current) {
            current.remove();
            return;
          }
          const menu = document.createElement('div');
          menu.dataset.epdfI = 'file-options-menu';
          menu.style.position = 'fixed';
          for (const label of ['打开', '打印']) {
            const item = document.createElement('button');
            item.type = 'button';
            item.role = 'menuitem';
            item.textContent = label;
            item.addEventListener('click', () => {
              menu.remove();
              if (label === '打印') window.setTimeout(openPrintSettings, 0);
            });
            menu.append(item);
          }
          root.append(menu);
        });
        const pageSettingsButton = document.createElement('button');
        pageSettingsButton.dataset.epdfI = 'page-settings-button';
        pageSettingsButton.setAttribute('aria-label', '页面设置');
        pageSettingsButton.addEventListener('click', () => {
          const current = root.querySelector('[data-epdf-i="page-settings-menu"]');
          if (current) {
            current.remove();
            return;
          }
          const menu = document.createElement('div');
          menu.dataset.epdfI = 'page-settings-menu';
          menu.style.position = 'fixed';
          for (const label of ['单页视图', '双页视图', '垂直滚动']) {
            const item = document.createElement('button');
            item.type = 'button';
            item.role = 'menuitem';
            item.textContent = label;
            item.addEventListener('click', () => menu.remove());
            menu.append(item);
          }
          root.append(menu);
        });
        const searchItem = document.createElement('div');
        searchItem.dataset.epdfI = 'search-button';
        const searchButton = document.createElement('button');
        searchButton.setAttribute('aria-label', '搜索');
        searchButton.addEventListener('click', () => {
          const current = root.querySelector('input[data-pdf-search]');
          if (current) {
            current.remove();
            return;
          }
          const input = document.createElement('input');
          input.type = 'text';
          input.placeholder = '搜索';
          input.dataset.pdfSearch = '';
          root.append(input);
        });
        searchItem.append(searchButton);
        root.append(
          overflowItem,
          zoom,
          pageNumber,
          printSettingsButton,
          fileOptionsButton,
          pageSettingsButton,
          searchItem
        );
        hostRef.current?.append(host);
        return () => host.remove();
      }, []);
      React.useEffect(() => {
        if (embedPdfMocks.autoReady) onReady?.(registry);
      }, [onReady]);
      return (
        <>
          <output data-testid='embedpdf-viewer'>{JSON.stringify(config)}</output>
          <div data-testid='embedpdf-shadow-host' ref={hostRef} />
        </>
      );
    },
  };
});

if (!URL.createObjectURL) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn() });
if (!URL.revokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

describe('Work EmbedPDF editor', () => {
  beforeEach(() => {
    embedPdfMocks.autoReady = true;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:a3s-pdf');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    embedPdfMocks.saveAsCopy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads the full EmbedPDF editor with the local PDFium runtime and Chinese UI', async () => {
    render(
      <PdfViewer
        fileName='方案.pdf'
        loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })}
        onSave={vi.fn(async () => true)}
      />
    );

    const viewer = await screen.findByTestId('embedpdf-viewer');
    const config = JSON.parse(viewer.textContent ?? '{}') as {
      export?: { defaultFileName?: string };
      i18n?: { defaultLocale?: string };
      src?: string;
      wasmUrl?: string;
      worker?: boolean;
    };
    expect(config.src).toBe('blob:a3s-pdf');
    expect(config.wasmUrl).toMatch(/^https?:\/\//);
    expect(new URL(config.wasmUrl ?? '').pathname).toBe('/vendor/embedpdf/pdfium.wasm');
    expect(config.worker).not.toBe(false);
    expect(config.i18n?.defaultLocale).toBe('zh-CN');
    expect(config.export?.defaultFileName).toBe('方案.pdf');
    expect(screen.queryByText(/EmbedPDF|PDFium|批注、表单/)).not.toBeInTheDocument();
  });

  it('saves a real PDF copy generated by the EmbedPDF export plugin', async () => {
    const onSave = vi.fn(async (_pdf: Blob) => true);
    render(
      <PdfViewer
        loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })}
        saveLabel='保存并写回本地'
        onSave={onSave}
      />
    );

    await screen.findByTestId('embedpdf-viewer');
    const saveButton = await screen.findByRole('button', { name: '保存并写回本地' });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const savedPdf = onSave.mock.calls[0]?.[0];
    expect(savedPdf).toBeInstanceOf(Blob);
    expect(savedPdf?.type).toBe('application/pdf');
    expect(Array.from(new Uint8Array(await savedPdf!.arrayBuffer()))).toEqual([37, 80, 68, 70]);
    expect(screen.getByLabelText('PDF 保存状态')).toHaveTextContent('已保存');
    expect(screen.getByText('已保存')).toHaveClass('ds-status-badge', 'success');
  });

  it('handles only the plain Cmd/Ctrl+S save shortcut', async () => {
    const onSave = vi.fn(async (_pdf: Blob) => true);
    render(<PdfViewer loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })} onSave={onSave} />);
    await screen.findByTestId('embedpdf-viewer');
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled());

    fireEvent.keyDown(window, { key: 's', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true, altKey: true });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true, repeat: true });
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  });

  it('does not save the PDF behind an open Office dialog', async () => {
    const onSave = vi.fn(async (_pdf: Blob) => true);
    render(
      <>
        <PdfViewer loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })} onSave={onSave} />
        <Dialog title='版本记录' onClose={vi.fn()}>
          <input aria-label='版本备注' />
        </Dialog>
      </>
    );
    await screen.findByTestId('embedpdf-viewer');
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled());

    await act(async () => {
      expect(fireEvent.keyDown(screen.getByRole('textbox', { name: '版本备注' }), { key: 's', ctrlKey: true })).toBe(
        false
      );
      await Promise.resolve();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not take PDF save or search shortcuts away from an excluded side panel', async () => {
    const onSave = vi.fn(async (_pdf: Blob) => true);
    const { container } = render(
      <>
        <PdfViewer loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })} onSave={onSave} />
        <aside data-office-shortcuts='ignore'>
          <input aria-label='AI 指令' />
        </aside>
      </>
    );
    await screen.findByTestId('embedpdf-viewer');
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled());
    const prompt = screen.getByRole('textbox', { name: 'AI 指令' });

    expect(fireEvent.keyDown(prompt, { key: 's', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(prompt, { key: 'f', ctrlKey: true })).toBe(true);

    await act(async () => Promise.resolve());
    expect(onSave).not.toHaveBeenCalled();
    expect(
      container.querySelector('embedpdf-container')?.shadowRoot?.querySelector('input[data-pdf-search]')
    ).toBeNull();
  });

  it('labels compact viewer controls and opens focused PDF search with Cmd/Ctrl+F', async () => {
    const { container } = render(
      <PdfViewer
        loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })}
        onSave={vi.fn(async () => true)}
      />
    );
    await screen.findByTestId('embedpdf-viewer');
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled());
    const root = container.querySelector('embedpdf-container')?.shadowRoot;
    expect(root).not.toBeNull();

    const overflowButton = root?.querySelector<HTMLButtonElement>('[data-epdf-i="overflow-tabs-button"] button');
    const zoomInput = root?.querySelector<HTMLInputElement>('input[name="zoom"]');
    const pageNumberInput = root?.querySelector<HTMLInputElement>('input[inputmode="numeric"]');
    await waitFor(() => expect(overflowButton).toHaveAccessibleName('更多工具'));
    expect(zoomInput).toHaveAccessibleName('缩放比例');
    expect(pageNumberInput).toHaveAccessibleName('页码');

    expect(fireEvent.keyDown(window, { key: 'f', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(root?.querySelector('input[data-pdf-search]')).not.toBeInTheDocument();
    const searchButton = root?.querySelector<HTMLButtonElement>('[data-epdf-i="search-button"] button');
    fireEvent.click(searchButton!);
    const clickSearchInput = await waitFor(() => {
      const input = root?.querySelector<HTMLInputElement>('input[data-pdf-search]');
      expect(input).toBeInTheDocument();
      return input!;
    });
    await waitFor(() => expect(root?.activeElement).toBe(clickSearchInput));
    expect(fireEvent.keyDown(clickSearchInput, { key: 'Escape' })).toBe(false);
    await waitFor(() => expect(root?.querySelector('input[data-pdf-search]')).not.toBeInTheDocument());
    await waitFor(() => expect(root?.activeElement).toBe(searchButton));

    expect(fireEvent.keyDown(window, { key: 'f', ctrlKey: true })).toBe(false);
    const searchInput = await waitFor(() => {
      const input = root?.querySelector<HTMLInputElement>('input[data-pdf-search]');
      expect(input).toBeInTheDocument();
      return input!;
    });
    await waitFor(() => expect(root?.activeElement).toBe(searchInput));
    expect(searchInput).toHaveAccessibleName('在 PDF 中搜索');
  });

  it('gives native PDF dialogs a modal name, moves focus inside, and restores the trigger', async () => {
    const { container } = render(
      <PdfViewer
        loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })}
        onSave={vi.fn(async () => true)}
      />
    );
    await screen.findByTestId('embedpdf-viewer');
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled());
    const root = container.querySelector('embedpdf-container')?.shadowRoot;
    const trigger = root?.querySelector<HTMLButtonElement>('[aria-label="打开打印设置"]');
    expect(trigger).toBeInTheDocument();

    trigger!.focus();
    fireEvent.click(trigger!);

    const dialog = await waitFor(() => {
      const current = root?.querySelector<HTMLElement>('[role="dialog"]');
      expect(current).toHaveAccessibleName('打印设置');
      expect(current).toHaveAttribute('aria-modal', 'true');
      return current!;
    });
    const close = dialog.querySelector<HTMLButtonElement>('h2 + button');
    expect(close).toHaveAccessibleName('关闭打印设置');
    await waitFor(() => expect(root?.activeElement).toBe(close));

    expect(fireEvent.keyDown(window, { key: 'Escape' })).toBe(false);
    await waitFor(() => expect(root?.querySelector('[role="dialog"]')).not.toBeInTheDocument());
    await waitFor(() => expect(root?.activeElement).toBe(trigger));
  });

  it('moves focus into native PDF menus and supports arrow, boundary, and Escape keys', async () => {
    const { container } = render(
      <PdfViewer
        loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })}
        onSave={vi.fn(async () => true)}
      />
    );
    await screen.findByTestId('embedpdf-viewer');
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled());
    const root = container.querySelector('embedpdf-container')?.shadowRoot;
    const trigger = root?.querySelector<HTMLButtonElement>('[data-epdf-i="page-settings-button"]');
    expect(trigger).toBeInTheDocument();

    trigger!.focus();
    fireEvent.click(trigger!);

    const menu = await waitFor(() => {
      const current = root?.querySelector<HTMLElement>('[data-epdf-i="page-settings-menu"]');
      expect(current).toHaveAttribute('role', 'menu');
      expect(current).toHaveAccessibleName('页面设置');
      return current!;
    });
    const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    await waitFor(() => expect(root?.activeElement).toBe(items[0]));

    expect(fireEvent.keyDown(window, { key: 'ArrowDown' })).toBe(false);
    expect(root?.activeElement).toBe(items[1]);
    expect(fireEvent.keyDown(window, { key: 'End' })).toBe(false);
    expect(root?.activeElement).toBe(items[2]);
    expect(fireEvent.keyDown(window, { key: 'Home' })).toBe(false);
    expect(root?.activeElement).toBe(items[0]);
    expect(fireEvent.keyDown(window, { key: 'ArrowUp' })).toBe(false);
    expect(root?.activeElement).toBe(items[2]);

    expect(fireEvent.keyDown(window, { key: 'Escape' })).toBe(false);
    await waitFor(() => expect(root?.querySelector('[data-epdf-i="page-settings-menu"]')).not.toBeInTheDocument());
    await waitFor(() => expect(root?.activeElement).toBe(trigger));
  });

  it('restores the menu trigger after closing a native dialog opened from a menu item', async () => {
    const { container } = render(
      <PdfViewer
        loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })}
        onSave={vi.fn(async () => true)}
      />
    );
    await screen.findByTestId('embedpdf-viewer');
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled());
    const root = container.querySelector('embedpdf-container')?.shadowRoot;
    const trigger = root?.querySelector<HTMLButtonElement>('[data-epdf-i="file-options-button"]');
    expect(trigger).toBeInTheDocument();

    trigger!.focus();
    fireEvent.click(trigger!);
    const menu = await waitFor(() => {
      const current = root?.querySelector<HTMLElement>('[data-epdf-i="file-options-menu"]');
      expect(current).toHaveAttribute('role', 'menu');
      return current!;
    });
    const print = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (item) => item.textContent === '打印'
    );
    await waitFor(() => expect(root?.activeElement).toBe(menu.querySelector('[role="menuitem"]')));
    fireEvent.click(print!);

    const dialog = await waitFor(() => {
      const current = root?.querySelector<HTMLElement>('[role="dialog"]');
      expect(current).toHaveAccessibleName('打印设置');
      return current!;
    });
    await waitFor(() => expect(dialog.contains(root?.activeElement ?? null)).toBe(true));

    expect(fireEvent.keyDown(window, { key: 'Escape' })).toBe(false);
    await waitFor(() => expect(root?.querySelector('[role="dialog"]')).not.toBeInTheDocument());
    await waitFor(() => expect(root?.activeElement).toBe(trigger));
  });

  it('uses a read-only native viewer when no persistence callback is provided', async () => {
    render(<PdfViewer loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })} />);

    const viewer = await screen.findByTestId('embedpdf-viewer');
    expect(viewer).toHaveTextContent('annotation');
    expect(viewer).toHaveTextContent('redaction');
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });

  it('offers recovery instead of leaving PDF initialization spinning forever', async () => {
    vi.useFakeTimers();
    embedPdfMocks.autoReady = false;

    await act(async () => {
      render(<PdfViewer loadSource={async () => new Blob(['pdf'], { type: 'application/pdf' })} />);
      await Promise.resolve();
    });
    expect(screen.getByTestId('embedpdf-viewer')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(20_000));

    expect(screen.getByRole('alert')).toHaveTextContent('无法打开 PDF');
    expect(screen.getByRole('alert')).toHaveTextContent('请重试');
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});
