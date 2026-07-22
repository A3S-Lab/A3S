import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkArtifact } from '../work-templates';
import type { WorkSpreadsheetContent } from '../work-types';
import { SpreadsheetEditor } from './spreadsheet-editor';

const workbookMocks = vi.hoisted(() => ({
  allowEdit: undefined as boolean | undefined,
  calculateFormula: vi.fn(),
  mounts: 0,
  onChange: undefined as ((sheets: WorkSpreadsheetContent['sheets']) => void) | undefined,
  sheets: undefined as WorkSpreadsheetContent['sheets'] | undefined,
}));

vi.mock('@fortune-sheet/react', async () => {
  const React = await import('react');
  return {
    Workbook: React.forwardRef(
      (
        {
          allowEdit,
          data,
          onChange,
        }: {
          allowEdit?: boolean;
          data: WorkSpreadsheetContent['sheets'];
          onChange?: (sheets: WorkSpreadsheetContent['sheets']) => void;
        },
        ref: React.ForwardedRef<{ calculateFormula: typeof workbookMocks.calculateFormula }>
      ) => {
        React.useEffect(() => {
          workbookMocks.mounts += 1;
        }, []);
        React.useImperativeHandle(ref, () => ({
          calculateFormula: workbookMocks.calculateFormula,
        }));
        workbookMocks.allowEdit = allowEdit;
        workbookMocks.onChange = onChange;
        workbookMocks.sheets = data;
        return <div data-testid='fortune-sheet'>{data.map((sheet) => sheet.name).join(',')}</div>;
      }
    ),
  };
});

describe('Work spreadsheet editor regressions', () => {
  afterEach(() => {
    cleanup();
    workbookMocks.allowEdit = undefined;
    workbookMocks.calculateFormula.mockReset();
    workbookMocks.mounts = 0;
    workbookMocks.onChange = undefined;
    workbookMocks.sheets = undefined;
  });

  it('keeps the live workbook mounted while switching to read-only preview', async () => {
    render(<SpreadsheetPreviewHarness initial={spreadsheetContent()} />);

    await waitFor(() => expect(workbookMocks.mounts).toBe(1));
    expect(workbookMocks.allowEdit).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '切换表格预览' }));

    await waitFor(() => expect(workbookMocks.allowEdit).toBe(false));
    expect(workbookMocks.mounts).toBe(1);
  });

  it('provides a complete A1 selection when a workbook has no saved selection', () => {
    render(<SpreadsheetEditor content={spreadsheetContent()} preview={false} onChange={vi.fn()} />);

    expect(workbookMocks.sheets?.[0].luckysheet_select_save).toEqual([
      {
        row: [0, 0],
        column: [0, 0],
        row_focus: 0,
        column_focus: 0,
      },
    ]);
  });

  it('restores matrix cells through the FortuneSheet celldata input', () => {
    const content = spreadsheetContent();
    content.sheets[0].data![0][0] = { v: '预览回归通过', m: '预览回归通过' };

    render(<SpreadsheetEditor content={content} preview={false} onChange={vi.fn()} />);

    expect(workbookMocks.sheets?.[0].celldata).toEqual([
      {
        r: 0,
        c: 0,
        v: { v: '预览回归通过', m: '预览回归通过' },
      },
    ]);
  });

  it('keeps the FortuneSheet change callback stable across parent renders', () => {
    const content = spreadsheetContent();
    const onChange = vi.fn();
    const { rerender } = render(<SpreadsheetEditor content={content} preview={false} onChange={onChange} />);
    const firstCallback = workbookMocks.onChange;

    rerender(<SpreadsheetEditor content={{ ...content }} preview={false} onChange={onChange} />);

    expect(workbookMocks.onChange).toBe(firstCallback);
  });
});

function SpreadsheetPreviewHarness({ initial }: { initial: WorkSpreadsheetContent }) {
  const [preview, setPreview] = useState(false);
  return (
    <>
      <button type='button' onClick={() => setPreview((value) => !value)}>
        切换表格预览
      </button>
      <SpreadsheetEditor content={initial} preview={preview} onChange={() => undefined} />
    </>
  );
}

function spreadsheetContent(): WorkSpreadsheetContent {
  const artifact = createWorkArtifact('blank-spreadsheet');
  if (artifact.content.type !== 'spreadsheet') throw new Error('Spreadsheet template is invalid');
  return artifact.content;
}
