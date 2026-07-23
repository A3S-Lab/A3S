import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkArtifact } from '../work-templates';
import type { WorkPresentationPrintLayout } from '../work-types';
import { WorkPrintPreviewDialog } from './work-print-preview-dialog';

function chooseOfficeOption(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

describe('Work print preview', () => {
  afterEach(() => {
    cleanup();
    document.body.classList.remove('work-print-preview-open');
  });

  it('navigates the paginated output and exports only the current page', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    const onExportPdf = vi.fn().mockResolvedValue(undefined);
    render(
      <PreviewHarness artifact={artifact} onExportPdf={onExportPdf} onPrint={vi.fn().mockResolvedValue(undefined)} />
    );

    expect(screen.getByRole('dialog', { name: '打印预览' })).toBeInTheDocument();
    expect(screen.getByLabelText('打印页数')).toHaveTextContent('3 页');
    expect(screen.getAllByRole('button', { name: /预览第 \d+ 页/ })).toHaveLength(3);
    expect(document.body).toHaveClass('work-print-preview-open');

    fireEvent.click(screen.getByRole('button', { name: '下一打印页' }));
    chooseOfficeOption('打印页面范围', '当前页面');
    fireEvent.click(screen.getByRole('button', { name: '导出所选页面为 PDF' }));

    await waitFor(() => expect(onExportPdf).toHaveBeenCalledWith([1]));
  });

  it('validates custom ranges and applies them to export and native print', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    const onExportPdf = vi.fn().mockResolvedValue(undefined);
    const onPrint = vi.fn().mockResolvedValue(undefined);
    render(<PreviewHarness artifact={artifact} onExportPdf={onExportPdf} onPrint={onPrint} />);

    chooseOfficeOption('打印页面范围', '自定义范围');
    fireEvent.change(screen.getByLabelText('自定义页码范围'), { target: { value: '1, 3' } });
    fireEvent.click(screen.getByRole('button', { name: '导出所选页面为 PDF' }));
    fireEvent.click(screen.getByRole('button', { name: '打印所选页面' }));

    await waitFor(() => {
      expect(onExportPdf).toHaveBeenCalledWith([0, 2]);
      expect(onPrint).toHaveBeenCalledWith([0, 2]);
    });
    const pages = document.querySelectorAll<HTMLElement>('[data-work-pdf-surface="preview"] [data-work-pdf-page]');
    expect(pages[0]).not.toHaveAttribute('data-print-excluded');
    expect(pages[1]).toHaveAttribute('data-print-excluded', 'true');
    expect(pages[2]).not.toHaveAttribute('data-print-excluded');

    fireEvent.change(screen.getByLabelText('自定义页码范围'), { target: { value: '4' } });
    expect(screen.getByRole('alert')).toHaveTextContent('1 到 3');
    expect(screen.getByRole('button', { name: '导出所选页面为 PDF' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '打印所选页面' })).toBeDisabled();
  });

  it('rebuilds pages for presentation notes and handout layouts', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    render(
      <PreviewHarness
        artifact={artifact}
        onExportPdf={vi.fn().mockResolvedValue(undefined)}
        onPrint={vi.fn().mockResolvedValue(undefined)}
      />
    );

    chooseOfficeOption('演示打印版式', '讲义 · 每页 2 张');

    await waitFor(() => {
      expect(screen.getByLabelText('打印页数')).toHaveTextContent('2 页');
      expect(screen.getAllByRole('button', { name: /预览第 \d+ 页/ })).toHaveLength(2);
    });
    expect(document.querySelector('[data-work-pdf-surface="preview"]')).toHaveAttribute(
      'data-presentation-layout',
      'handout-2'
    );
  });

  it('supports keyboard navigation and zoom without leaving the dialog', () => {
    const artifact = createWorkArtifact('strategy-deck');
    render(
      <PreviewHarness
        artifact={artifact}
        onExportPdf={vi.fn().mockResolvedValue(undefined)}
        onPrint={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const canvas = screen.getByRole('region', { name: '打印页面预览' });
    const zoomOut = screen.getByRole('button', { name: '缩小打印预览' });
    expect(zoomOut).toHaveFocus();
    fireEvent.keyDown(zoomOut, { key: 'End' });
    expect(screen.getByLabelText('当前打印页')).toHaveTextContent('3 / 3');

    fireEvent.keyDown(zoomOut, { key: '+' });
    expect(screen.getByLabelText('打印预览缩放比例')).toHaveTextContent('80%');
    expect(canvas).toBeInTheDocument();
  });

  it.each([
    ['blank-document', '.work-pdf-export-page.document'],
    ['blank-spreadsheet', '.work-pdf-export-page.spreadsheet'],
  ])('uses the shared preview workflow for %s artifacts', (templateId, pageSelector) => {
    const artifact = createWorkArtifact(templateId);
    render(
      <PreviewHarness
        artifact={artifact}
        onExportPdf={vi.fn().mockResolvedValue(undefined)}
        onPrint={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByLabelText('打印页数')).toHaveTextContent(/^[1-9]\d* 页$/);
    expect(document.querySelector(`[data-work-pdf-surface="preview"] ${pageSelector}`)).toBeInTheDocument();
    expect(screen.queryByLabelText('演示打印版式')).not.toBeInTheDocument();
  });
});

function PreviewHarness({
  artifact,
  onExportPdf,
  onPrint,
}: {
  artifact: ReturnType<typeof createWorkArtifact>;
  onExportPdf: (pageIndexes: number[]) => Promise<void>;
  onPrint: (pageIndexes: number[]) => Promise<void>;
}) {
  const [layout, setLayout] = useState<WorkPresentationPrintLayout>('slides');
  return (
    <WorkPrintPreviewDialog
      artifact={artifact}
      presentationLayout={layout}
      exportingPdf={false}
      onPresentationLayoutChange={setLayout}
      onClose={vi.fn()}
      onExportPdf={onExportPdf}
      onPrint={onPrint}
    />
  );
}
