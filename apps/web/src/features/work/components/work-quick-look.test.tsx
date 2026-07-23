import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceEntry } from '../../../types/api';
import { WorkQuickLook } from './work-quick-look';

describe('Work Quick Look', () => {
  afterEach(cleanup);

  it('renders text safely and supports Finder-style keyboard navigation', async () => {
    const current = entry('Notes.md');
    const previous = entry('Before.txt');
    const next = entry('After.txt');
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkQuickLook
        entry={current}
        previousEntry={previous}
        nextEntry={next}
        onNavigate={onNavigate}
        onOpen={vi.fn()}
        onClose={onClose}
        loadPreview={vi.fn().mockResolvedValue({ kind: 'text', text: '<script>alert(1)</script>' })}
      />
    );

    await waitFor(() => expect(screen.getByRole('article', { name: '文本文件预览' })).toBeInTheDocument());
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();

    const surface = document.querySelector<HTMLElement>('.work-quick-look')!;
    fireEvent.keyDown(surface, { key: 'ArrowLeft' });
    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    fireEvent.keyDown(surface, { key: ' ' });

    expect(onNavigate).toHaveBeenNthCalledWith(1, previous);
    expect(onNavigate).toHaveBeenNthCalledWith(2, next);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens supported files only after an explicit action', async () => {
    const current = entry('Report.docx');
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkQuickLook
        entry={current}
        previousEntry={null}
        nextEntry={null}
        onNavigate={vi.fn()}
        onOpen={onOpen}
        onClose={onClose}
        loadPreview={vi.fn().mockResolvedValue({
          kind: 'unsupported',
          reason: '测试占位预览',
        })}
      />
    );

    await waitFor(() => expect(screen.getByText('测试占位预览')).toBeInTheDocument());
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(current);
  });
});

function entry(name: string): WorkspaceEntry {
  return {
    name,
    path: `/docs/${name}`,
    isDirectory: false,
    isFile: true,
    size: 128,
    mtimeMs: 10,
    extension: name.split('.').pop(),
    isBinary: name.endsWith('.docx'),
  };
}
