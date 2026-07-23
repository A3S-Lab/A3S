import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkActions } from '../use-work-controller';
import { createWorkArtifact } from '../work-templates';
import { WorkEditorShell } from './work-editor-shell';

describe('Work presentation print controls', () => {
  afterEach(cleanup);

  it('opens a dedicated preview and switches both PDF surfaces to the selected handout layout', () => {
    const artifact = createWorkArtifact('strategy-deck');
    const actions = {
      activeArtifact: artifact,
      saveState: 'saved',
      storageMode: 'local',
      exporting: false,
      exportingPdf: false,
      closeArtifact: vi.fn(),
      saveNow: vi.fn(),
      updateArtifact: vi.fn(),
      toggleFavorite: vi.fn(),
      downloadSource: vi.fn(),
      exportArtifact: vi.fn(),
      exportPdf: vi.fn(),
      sourceBlob: vi.fn(),
    } as unknown as WorkActions;

    render(<WorkEditorShell actions={actions} />);
    openPrintPreview();
    chooseOfficeOption('演示打印版式', '讲义 · 每页 2 张');

    expect(
      document.querySelectorAll('[data-work-pdf-surface="export"] [data-presentation-print-layout="handout-2"]')
    ).toHaveLength(2);
    expect(
      document.querySelectorAll('[data-work-pdf-surface="preview"] [data-presentation-print-layout="handout-2"]')
    ).toHaveLength(2);
    expect(screen.getByLabelText('打印页数')).toHaveTextContent('2 页');
  });

  it('opens print preview with Cmd/Ctrl+P and passes the selected page range to PDF export', () => {
    const artifact = createWorkArtifact('strategy-deck');
    const actions = {
      activeArtifact: artifact,
      saveState: 'saved',
      storageMode: 'local',
      exporting: false,
      exportingPdf: false,
      closeArtifact: vi.fn(),
      saveNow: vi.fn().mockResolvedValue(true),
      updateArtifact: vi.fn(),
      toggleFavorite: vi.fn(),
      downloadSource: vi.fn(),
      exportArtifact: vi.fn(),
      exportPdf: vi.fn(),
      sourceBlob: vi.fn(),
    } as unknown as WorkActions;

    render(<WorkEditorShell actions={actions} />);
    fireEvent.keyDown(window, { key: 'p', metaKey: true });
    chooseOfficeOption('打印页面范围', '自定义范围');
    fireEvent.change(screen.getByLabelText('自定义页码范围'), { target: { value: '1, 3' } });
    fireEvent.click(screen.getByRole('button', { name: '导出所选页面为 PDF' }));

    expect(actions.exportPdf).toHaveBeenCalledWith({ pageIndexes: [0, 2] });
  });

  it('retains the selected range through compatibility confirmation', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    artifact.compatibility = {
      sourceFormat: 'PPTX',
      sourceName: 'Strategy.pptx',
      assessedAt: Date.now(),
      issues: [
        {
          code: 'pptx.animation',
          severity: 'warning',
          feature: 'Animations',
          message: 'Animations are not printed.',
        },
      ],
    };
    const actions = {
      activeArtifact: artifact,
      saveState: 'saved',
      storageMode: 'local',
      exporting: false,
      exportingPdf: false,
      closeArtifact: vi.fn(),
      saveNow: vi.fn().mockResolvedValue(true),
      updateArtifact: vi.fn(),
      toggleFavorite: vi.fn(),
      downloadSource: vi.fn(),
      exportArtifact: vi.fn(),
      exportPdf: vi.fn().mockResolvedValue(undefined),
      sourceBlob: vi.fn(),
    } as unknown as WorkActions;

    render(<WorkEditorShell actions={actions} />);
    openPrintPreview();
    chooseOfficeOption('打印页面范围', '自定义范围');
    fireEvent.change(screen.getByLabelText('自定义页码范围'), { target: { value: '2-3' } });
    fireEvent.click(screen.getByRole('button', { name: '导出所选页面为 PDF' }));

    expect(screen.getByRole('dialog', { name: '导出前兼容性检查' })).toBeInTheDocument();
    expect(actions.exportPdf).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '仍然导出' }));

    await waitFor(() => expect(actions.exportPdf).toHaveBeenCalledWith({ pageIndexes: [1, 2] }));
  });

  it('persists pending edits before opening the native print dialog', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const actions = {
      activeArtifact: artifact,
      saveState: 'dirty',
      storageMode: 'local',
      exporting: false,
      exportingPdf: false,
      closeArtifact: vi.fn(),
      saveNow: vi.fn().mockResolvedValue(true),
      updateArtifact: vi.fn(),
      toggleFavorite: vi.fn(),
      downloadSource: vi.fn(),
      exportArtifact: vi.fn(),
      exportPdf: vi.fn(),
      sourceBlob: vi.fn(),
    } as unknown as WorkActions;

    render(<WorkEditorShell actions={actions} />);
    openPrintPreview();
    fireEvent.click(screen.getByRole('button', { name: '打印所选页面' }));

    await waitFor(() => {
      expect(actions.saveNow).toHaveBeenCalled();
      expect(print).toHaveBeenCalled();
    });
    print.mockRestore();
  });

  it('uses Cmd/Ctrl+S to write a bound Office artifact back to its local file', () => {
    const artifact = createWorkArtifact('strategy-deck');
    const actions = {
      activeArtifact: artifact,
      activeLocalBinding: {
        artifactId: artifact.id,
        path: '/docs/Strategy.pptx',
        fingerprint: 'sha256:original',
        size: 12,
        updatedAt: Date.now(),
      },
      localSaveState: 'idle',
      localConflict: null,
      saveState: 'saved',
      storageMode: 'local',
      exporting: false,
      exportingPdf: false,
      closeArtifact: vi.fn(),
      saveNow: vi.fn(),
      saveLocalFile: vi.fn().mockResolvedValue(true),
      saveLocalFileAs: vi.fn(),
      checkLocalFile: vi.fn().mockResolvedValue(true),
      dismissLocalConflict: vi.fn(),
      updateArtifact: vi.fn(),
      toggleFavorite: vi.fn(),
      downloadSource: vi.fn(),
      exportArtifact: vi.fn(),
      exportPdf: vi.fn(),
      sourceBlob: vi.fn(),
    } as unknown as WorkActions;

    render(<WorkEditorShell actions={actions} defaultLocalDirectory='/docs' onPickLocalDirectory={vi.fn()} />);
    fireEvent.keyDown(window, { key: 's', metaKey: true });

    expect(actions.saveLocalFile).toHaveBeenCalled();
    expect(actions.saveNow).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '保存到原本地文件' })).toHaveAttribute('title', '/docs/Strategy.pptx');
    expect(screen.queryByText(/本地文件：/)).not.toBeInTheDocument();
  });

  it('uses Cmd/Ctrl+Shift+S for Save As instead of overwriting the bound file', () => {
    const artifact = createWorkArtifact('strategy-deck');
    const actions = {
      activeArtifact: artifact,
      activeLocalBinding: {
        artifactId: artifact.id,
        path: '/docs/Strategy.pptx',
        fingerprint: 'sha256:original',
        size: 12,
        updatedAt: Date.now(),
      },
      localSaveState: 'idle',
      localConflict: null,
      saveState: 'saved',
      storageMode: 'local',
      exporting: false,
      exportingPdf: false,
      closeArtifact: vi.fn(),
      saveNow: vi.fn(),
      saveLocalFile: vi.fn().mockResolvedValue(true),
      saveLocalFileAs: vi.fn(),
      checkLocalFile: vi.fn().mockResolvedValue(true),
      dismissLocalConflict: vi.fn(),
      updateArtifact: vi.fn(),
      toggleFavorite: vi.fn(),
      downloadSource: vi.fn(),
      exportArtifact: vi.fn(),
      exportPdf: vi.fn(),
      sourceBlob: vi.fn(),
    } as unknown as WorkActions;

    render(<WorkEditorShell actions={actions} defaultLocalDirectory='/docs' onPickLocalDirectory={vi.fn()} />);
    fireEvent.keyDown(window, { key: 's', metaKey: true, shiftKey: true });

    expect(screen.getByRole('dialog', { name: '另存为本地 Office 文件' })).toBeInTheDocument();
    expect(actions.saveLocalFile).not.toHaveBeenCalled();
    expect(actions.saveNow).not.toHaveBeenCalled();
  });

  it('does not replay an Office shortcut already handled by the focused editor', () => {
    const artifact = createWorkArtifact('strategy-deck');
    const actions = {
      activeArtifact: artifact,
      saveState: 'saved',
      storageMode: 'local',
      exporting: false,
      exportingPdf: false,
      closeArtifact: vi.fn(),
      saveNow: vi.fn(),
      updateArtifact: vi.fn(),
      toggleFavorite: vi.fn(),
      downloadSource: vi.fn(),
      exportArtifact: vi.fn(),
      exportPdf: vi.fn(),
      sourceBlob: vi.fn(),
    } as unknown as WorkActions;
    render(<WorkEditorShell actions={actions} />);
    const event = new KeyboardEvent('keydown', {
      key: 's',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();

    window.dispatchEvent(event);

    expect(actions.saveNow).not.toHaveBeenCalled();
  });

  it('does not take save or print shortcuts away from an excluded side panel', () => {
    const artifact = createWorkArtifact('strategy-deck');
    const actions = {
      activeArtifact: artifact,
      saveState: 'saved',
      storageMode: 'local',
      exporting: false,
      exportingPdf: false,
      closeArtifact: vi.fn(),
      saveNow: vi.fn(),
      updateArtifact: vi.fn(),
      toggleFavorite: vi.fn(),
      downloadSource: vi.fn(),
      exportArtifact: vi.fn(),
      exportPdf: vi.fn(),
      sourceBlob: vi.fn(),
    } as unknown as WorkActions;

    render(
      <>
        <WorkEditorShell actions={actions} />
        <aside data-office-shortcuts='ignore'>
          <input aria-label='AI 指令' />
        </aside>
      </>
    );
    const prompt = screen.getByRole('textbox', { name: 'AI 指令' });

    expect(fireEvent.keyDown(prompt, { key: 's', metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(prompt, { key: 'p', metaKey: true })).toBe(true);

    expect(actions.saveNow).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: '打印预览' })).not.toBeInTheDocument();
  });

  it('does not run background save or print shortcuts while Save As is open', () => {
    const artifact = createWorkArtifact('strategy-deck');
    const actions = {
      activeArtifact: artifact,
      activeLocalBinding: null,
      localSaveState: 'idle',
      localConflict: null,
      saveState: 'saved',
      storageMode: 'local',
      exporting: false,
      exportingPdf: false,
      closeArtifact: vi.fn(),
      saveNow: vi.fn(),
      saveLocalFile: vi.fn(),
      saveLocalFileAs: vi.fn(),
      checkLocalFile: vi.fn(),
      dismissLocalConflict: vi.fn(),
      updateArtifact: vi.fn(),
      toggleFavorite: vi.fn(),
      downloadSource: vi.fn(),
      exportArtifact: vi.fn(),
      exportPdf: vi.fn(),
      sourceBlob: vi.fn(),
    } as unknown as WorkActions;

    render(
      <WorkEditorShell
        actions={actions}
        defaultLocalDirectory='/docs'
        onPickLocalDirectory={vi.fn(async () => '/docs')}
      />
    );
    fireEvent.keyDown(window, { key: 's', metaKey: true, shiftKey: true });
    const fileName = screen.getByRole('textbox', { name: '本地文件名' });

    expect(fireEvent.keyDown(fileName, { key: 's', metaKey: true })).toBe(false);
    expect(fireEvent.keyDown(fileName, { key: 'p', metaKey: true })).toBe(false);

    expect(actions.saveNow).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '另存为本地 Office 文件' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '打印预览' })).not.toBeInTheDocument();
  });
});

function openPrintPreview() {
  fireEvent.click(screen.getByRole('button', { name: '文件' }));
  fireEvent.click(screen.getByRole('menuitem', { name: /^打印/ }));
}

function chooseOfficeOption(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}
