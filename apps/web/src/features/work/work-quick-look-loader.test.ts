import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceEntry } from '../../types/api';
import { loadWorkQuickLook, type WorkQuickLookApi } from './work-quick-look-loader';
import { createWorkArtifact } from './work-templates';

const fileIo = vi.hoisted(() => ({
  importWorkFile: vi.fn(),
}));

vi.mock('./work-file-io', () => fileIo);

describe('Work Quick Look loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileIo.importWorkFile.mockResolvedValue(createWorkArtifact('blank-spreadsheet'));
  });

  it('describes folders without recursively reading them', async () => {
    const api = quickLookApi();

    await expect(loadWorkQuickLook(entry({ isDirectory: true, isFile: false }), api)).resolves.toEqual({
      kind: 'directory',
    });
    expect(api.readFile).not.toHaveBeenCalled();
    expect(api.readBinaryFile).not.toHaveBeenCalled();
  });

  it('reads common text formats as escaped text content', async () => {
    const api = quickLookApi();
    vi.mocked(api.readFile).mockResolvedValue({ content: '<script>alert(1)</script>\n# Notes' });

    const preview = await loadWorkQuickLook(entry({ name: 'Notes.md', path: '/docs/Notes.md', isBinary: false }), api);

    expect(preview).toEqual({ kind: 'text', text: '<script>alert(1)</script>\n# Notes' });
    expect(api.readFile).toHaveBeenCalledWith('/docs/Notes.md');
  });

  it('loads raster images and PDFs as typed blobs', async () => {
    const api = quickLookApi();
    vi.mocked(api.readBinaryFile).mockResolvedValue(Uint8Array.from([1, 2, 3]));

    const image = await loadWorkQuickLook(entry({ name: 'Photo.png', path: '/docs/Photo.png' }), api);
    const pdf = await loadWorkQuickLook(entry({ name: 'Plan.pdf', path: '/docs/Plan.pdf' }), api);

    expect(image).toMatchObject({ kind: 'image', blob: expect.any(Blob) });
    expect(image.kind === 'image' && image.blob.type).toBe('image/png');
    expect(pdf).toMatchObject({ kind: 'pdf', blob: expect.any(Blob) });
    expect(pdf.kind === 'pdf' && pdf.blob.type).toBe('application/pdf');
  });

  it('imports an Office file only into an in-memory preview artifact', async () => {
    const api = quickLookApi();
    const artifact = createWorkArtifact('blank-spreadsheet');
    fileIo.importWorkFile.mockResolvedValue(artifact);
    vi.mocked(api.readBinaryFile).mockResolvedValue(Uint8Array.from([7, 8, 9]));

    const preview = await loadWorkQuickLook(entry({ name: 'Budget.xlsx', path: '/docs/Budget.xlsx' }), api);

    expect(preview).toEqual({ kind: 'artifact', artifact });
    expect(fileIo.importWorkFile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Budget.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
  });

  it('refuses oversized or unknown binary previews before reading bytes', async () => {
    const api = quickLookApi();

    const oversized = await loadWorkQuickLook(
      entry({ name: 'Archive.pdf', path: '/docs/Archive.pdf', size: 51 * 1024 * 1024 }),
      api
    );
    const unknown = await loadWorkQuickLook(entry({ name: 'Model.bin', path: '/docs/Model.bin' }), api);

    expect(oversized).toMatchObject({ kind: 'unsupported', reason: expect.stringContaining('50 MB') });
    expect(unknown).toMatchObject({ kind: 'unsupported', reason: expect.stringContaining('没有安全的内置预览器') });
    expect(api.readBinaryFile).not.toHaveBeenCalled();
  });
});

function quickLookApi(): WorkQuickLookApi {
  return {
    readFile: vi.fn(),
    readBinaryFile: vi.fn(),
  };
}

function entry(overrides: Partial<WorkspaceEntry> = {}): WorkspaceEntry {
  return {
    name: 'Report.docx',
    path: '/docs/Report.docx',
    isDirectory: false,
    isFile: true,
    size: 1024,
    mtimeMs: 10,
    extension: 'docx',
    isBinary: true,
    ...overrides,
  };
}
