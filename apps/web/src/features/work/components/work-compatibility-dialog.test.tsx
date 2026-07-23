import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkCompatibilityDialog } from './work-compatibility-dialog';

describe('Office compatibility review', () => {
  afterEach(cleanup);

  it('shows a concise Chinese decision first and keeps technical diagnostics on demand', () => {
    render(
      <WorkCompatibilityDialog
        report={{
          sourceFormat: 'DOCX',
          sourceName: '方案.docx',
          assessedAt: Date.now(),
          issues: [
            {
              code: 'docx.page-layout',
              severity: 'warning',
              feature: 'Page layout',
              message: 'Exact pagination and line wrapping may normalize.',
            },
          ],
        }}
        mode='import'
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('排版可能有轻微变化，正文和原文件都会保留。')).toBeInTheDocument();
    expect(screen.queryByText('Exact pagination and line wrapping may normalize.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看技术详情' }));

    expect(screen.getByText('Exact pagination and line wrapping may normalize.')).toBeInTheDocument();
  });
});
