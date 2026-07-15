import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../../lib/api';
import { importDroppedWorkspacePayload, type DroppedWorkspacePayload } from './workspace-drop-import';

function droppedFile(name: string, bytes: ArrayLike<number>): File {
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  } as File;
}

afterEach(() => vi.restoreAllMocks());

describe('workspace drop import', () => {
  it('preserves folder structure and avoids overwriting an existing top-level path', async () => {
    vi.spyOn(codeApi, 'pathExists').mockImplementation(async (path) => ({ exists: path === '/repo/src' }));
    const createDirectory = vi.spyOn(codeApi, 'createDirectory').mockResolvedValue({ success: true });
    const writeBinaryFile = vi.spyOn(codeApi, 'writeBinaryFile').mockResolvedValue({ success: true });
    const payload: DroppedWorkspacePayload = {
      roots: [{ name: 'src', isDirectory: true }],
      directories: ['src', 'src/nested'],
      files: [{ relativePath: 'src/nested/app.ts', file: droppedFile('app.ts', [1, 2, 3]) }],
    };

    const result = await importDroppedWorkspacePayload(payload, '/repo');

    expect(result).toEqual({
      importedPaths: ['/repo/src (1)'],
      fileCount: 1,
      directoryCount: 2,
    });
    expect(createDirectory.mock.calls.map(([path]) => path)).toEqual(['/repo/src (1)', '/repo/src (1)/nested']);
    expect(writeBinaryFile).toHaveBeenCalledWith('/repo/src (1)/nested/app.ts', Uint8Array.from([1, 2, 3]), false);
  });

  it('removes newly created import roots when a write fails', async () => {
    vi.spyOn(codeApi, 'pathExists').mockResolvedValue({ exists: false });
    vi.spyOn(codeApi, 'createDirectory').mockResolvedValue({ success: true });
    vi.spyOn(codeApi, 'writeBinaryFile').mockRejectedValue(new Error('write failed'));
    const deletePath = vi.spyOn(codeApi, 'deletePath').mockResolvedValue({ success: true });

    await expect(
      importDroppedWorkspacePayload(
        {
          roots: [{ name: 'assets', isDirectory: true }],
          directories: ['assets'],
          files: [{ relativePath: 'assets/logo.png', file: droppedFile('logo.png', [9]) }],
        },
        '/repo'
      )
    ).rejects.toThrow('write failed');
    expect(deletePath).toHaveBeenCalledWith('/repo/assets');
  });

  it('writes larger files in bounded chunks and appends after the first chunk', async () => {
    vi.spyOn(codeApi, 'pathExists').mockResolvedValue({ exists: false });
    const writeBinaryFile = vi.spyOn(codeApi, 'writeBinaryFile').mockResolvedValue({ success: true });
    const bytes = new Uint8Array(256 * 1024 + 3);
    bytes.set([1, 2, 3], bytes.length - 3);

    await importDroppedWorkspacePayload(
      {
        roots: [{ name: 'archive.bin', isDirectory: false }],
        directories: [],
        files: [{ relativePath: 'archive.bin', file: droppedFile('archive.bin', bytes) }],
      },
      '/repo'
    );

    expect(writeBinaryFile).toHaveBeenCalledTimes(2);
    expect(writeBinaryFile.mock.calls[0]?.[0]).toBe('/repo/archive.bin');
    expect(writeBinaryFile.mock.calls[0]?.[1]).toHaveLength(256 * 1024);
    expect(writeBinaryFile.mock.calls[0]?.[2]).toBe(false);
    expect(writeBinaryFile.mock.calls[1]).toEqual(['/repo/archive.bin', Uint8Array.from([1, 2, 3]), true]);
  });
});
