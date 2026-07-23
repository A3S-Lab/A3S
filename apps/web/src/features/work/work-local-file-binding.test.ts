import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fingerprintWorkFile,
  moveWorkLocalFileBindings,
  readWorkLocalFileBinding,
  readWorkLocalFileBindingByPath,
  removeWorkLocalFileBinding,
  removeWorkLocalFileBindingsAtPath,
  saveWorkLocalFileBinding,
  WorkLocalFileConflictError,
  WorkLocalFileExistsError,
  writeWorkLocalFileAtomically,
} from './work-local-file-binding';

describe('Work local file bindings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists a path and fingerprint independently from the managed artifact', () => {
    saveWorkLocalFileBinding({
      artifactId: 'artifact-1',
      path: '/Users/a/Documents/Plan.docx',
      fingerprint: 'sha256:original',
      size: 42,
      updatedAt: 100,
    });

    expect(readWorkLocalFileBinding('artifact-1')).toEqual({
      artifactId: 'artifact-1',
      path: '/Users/a/Documents/Plan.docx',
      fingerprint: 'sha256:original',
      size: 42,
      updatedAt: 100,
    });

    removeWorkLocalFileBinding('artifact-1');
    expect(readWorkLocalFileBinding('artifact-1')).toBeNull();
  });

  it('ignores malformed persisted bindings', () => {
    localStorage.setItem('a3s-work.local-file-bindings.v1', JSON.stringify({ 'artifact-1': { path: 3 } }));
    expect(readWorkLocalFileBinding('artifact-1')).toBeNull();
  });

  it('keeps bindings attached when Work renames a local file or containing folder', () => {
    saveWorkLocalFileBinding({
      artifactId: 'artifact-1',
      path: '/docs/Reports/Plan.docx',
      fingerprint: 'sha256:one',
      size: 1,
      updatedAt: 100,
    });
    saveWorkLocalFileBinding({
      artifactId: 'artifact-2',
      path: '/docs/Notes.docx',
      fingerprint: 'sha256:two',
      size: 2,
      updatedAt: 200,
    });

    expect(moveWorkLocalFileBindings('/docs/Reports', '/docs/Research')).toBe(1);
    expect(moveWorkLocalFileBindings('/docs/Notes.docx', '/docs/Meeting notes.docx')).toBe(1);

    expect(readWorkLocalFileBinding('artifact-1')?.path).toBe('/docs/Research/Plan.docx');
    expect(readWorkLocalFileBinding('artifact-2')?.path).toBe('/docs/Meeting notes.docx');
  });

  it('removes bindings for a deleted file or folder tree', () => {
    saveWorkLocalFileBinding({
      artifactId: 'artifact-report',
      path: '/docs/Reports/Plan.docx',
      fingerprint: 'sha256:report',
      size: 1,
      updatedAt: 100,
    });
    saveWorkLocalFileBinding({
      artifactId: 'artifact-notes',
      path: '/docs/Notes.docx',
      fingerprint: 'sha256:notes',
      size: 2,
      updatedAt: 200,
    });

    expect(removeWorkLocalFileBindingsAtPath('/docs/Reports')).toBe(1);
    expect(readWorkLocalFileBinding('artifact-report')).toBeNull();
    expect(readWorkLocalFileBinding('artifact-notes')).not.toBeNull();
  });

  it('keeps one stable artifact binding per local path', () => {
    saveWorkLocalFileBinding({
      artifactId: 'artifact-old',
      path: '/docs/Plan.docx',
      fingerprint: 'sha256:old',
      size: 10,
      updatedAt: 100,
    });
    saveWorkLocalFileBinding({
      artifactId: 'artifact-current',
      path: '/docs/Plan.docx',
      fingerprint: 'sha256:current',
      size: 12,
      updatedAt: 200,
    });

    expect(readWorkLocalFileBinding('artifact-old')).toBeNull();
    expect(readWorkLocalFileBindingByPath('/docs/Plan.docx')).toMatchObject({
      artifactId: 'artifact-current',
      fingerprint: 'sha256:current',
    });
  });
});

describe('atomic Work local file writes', () => {
  it('detects an external change before creating a temporary file', async () => {
    const original = Uint8Array.from([1, 2, 3]);
    const changed = Uint8Array.from([4, 5, 6]);
    const expectedFingerprint = await fingerprintWorkFile(original);
    const api = {
      readBinaryFile: vi.fn().mockResolvedValue(changed),
      writeBinaryFile: vi.fn(),
      renamePath: vi.fn(),
      deletePath: vi.fn(),
      pathExists: vi.fn().mockResolvedValue({ exists: true }),
    };

    await expect(
      writeWorkLocalFileAtomically(api, '/docs/Plan.docx', original, {
        expectedFingerprint,
      })
    ).rejects.toBeInstanceOf(WorkLocalFileConflictError);

    expect(api.writeBinaryFile).not.toHaveBeenCalled();
    expect(api.renamePath).not.toHaveBeenCalled();
  });

  it('requires explicit overwrite approval for Save As', async () => {
    const api = {
      readBinaryFile: vi.fn(),
      writeBinaryFile: vi.fn(),
      renamePath: vi.fn(),
      deletePath: vi.fn(),
      pathExists: vi.fn().mockResolvedValue({ exists: true }),
    };

    await expect(
      writeWorkLocalFileAtomically(api, '/docs/Plan.docx', Uint8Array.from([1]), {
        allowOverwrite: false,
      })
    ).rejects.toBeInstanceOf(WorkLocalFileExistsError);

    expect(api.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('writes a sibling temporary file, replaces the destination, and verifies the bytes', async () => {
    const output = Uint8Array.from([9, 8, 7]);
    const api = {
      readBinaryFile: vi.fn().mockResolvedValue(output),
      writeBinaryFile: vi.fn().mockResolvedValue({ success: true }),
      renamePath: vi.fn().mockResolvedValue({ success: true }),
      deletePath: vi.fn().mockResolvedValue({ success: true }),
      pathExists: vi.fn().mockResolvedValue({ exists: false }),
    };

    const result = await writeWorkLocalFileAtomically(api, '/docs/Plan.docx', output, {
      allowOverwrite: false,
    });

    const temporaryPath = api.writeBinaryFile.mock.calls[0][0] as string;
    expect(temporaryPath).toMatch(/^\/docs\/\.Plan\.docx\.a3s-[^.]+\.tmp$/);
    expect(api.writeBinaryFile).toHaveBeenCalledWith(temporaryPath, output);
    expect(api.renamePath).toHaveBeenCalledWith(temporaryPath, '/docs/Plan.docx');
    expect(result).toEqual({
      fingerprint: await fingerprintWorkFile(output),
      size: output.byteLength,
    });
  });

  it('removes the temporary file when replacement fails', async () => {
    const api = {
      readBinaryFile: vi.fn(),
      writeBinaryFile: vi.fn().mockResolvedValue({ success: true }),
      renamePath: vi.fn().mockRejectedValue(new Error('replace failed')),
      deletePath: vi.fn().mockResolvedValue({ success: true }),
      pathExists: vi.fn().mockResolvedValue({ exists: false }),
    };

    await expect(
      writeWorkLocalFileAtomically(api, '/docs/Plan.docx', Uint8Array.from([1]), {
        allowOverwrite: false,
      })
    ).rejects.toThrow('replace failed');

    expect(api.deletePath).toHaveBeenCalledWith(api.writeBinaryFile.mock.calls[0][0]);
  });
});
