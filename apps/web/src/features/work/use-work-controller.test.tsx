import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkController } from './use-work-controller';
import { fingerprintWorkFile, readWorkLocalFileBinding, saveWorkLocalFileBinding } from './work-local-file-binding';
import { createWorkArtifact } from './work-templates';

const repository = vi.hoisted(() => ({
  copyWorkArtifact: vi.fn(),
  deleteWorkArtifact: vi.fn(),
  downloadWorkSource: vi.fn(),
  listWorkArtifactVersions: vi.fn(),
  loadWorkLibrary: vi.fn(),
  purgeWorkArtifact: vi.fn(),
  purgeWorkFolder: vi.fn(),
  readWorkSourceBlob: vi.fn(),
  restoreWorkArtifact: vi.fn(),
  restoreWorkArtifactVersion: vi.fn(),
  restoreWorkFolder: vi.fn(),
  saveWorkArtifact: vi.fn(),
  saveWorkFolder: vi.fn(),
  saveWorkSource: vi.fn(),
  trashWorkFolder: vi.fn(),
}));

const fileIo = vi.hoisted(() => ({
  createWorkArtifactBlob: vi.fn(),
  exportWorkArtifact: vi.fn(),
  importWorkFile: vi.fn(),
}));

const localFileApi = vi.hoisted(() => ({
  readBinaryFile: vi.fn(),
  writeBinaryFile: vi.fn(),
  renamePath: vi.fn(),
  deletePath: vi.fn(),
  pathExists: vi.fn(),
}));

vi.mock('./work-repository', () => repository);
vi.mock('./work-file-io', () => fileIo);
vi.mock('../../lib/api', () => ({ codeApi: localFileApi }));

describe('Work controller compatibility review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [],
      folders: [],
      limits: null,
      storage: 'local',
    });
    repository.saveWorkArtifact.mockImplementation(async (artifact) => ({ ...artifact, revision: 1 }));
    repository.saveWorkSource.mockImplementation(async (artifact, file: File) => ({
      ...artifact,
      revision: 2,
      source: {
        name: file.name,
        contentType: file.type,
        size: file.size,
        updatedAt: Date.now(),
      },
    }));
    localFileApi.writeBinaryFile.mockResolvedValue({ success: true });
    localFileApi.renamePath.mockResolvedValue({ success: true });
    localFileApi.deletePath.mockResolvedValue({ success: true });
    localFileApi.pathExists.mockResolvedValue({ exists: false });
  });

  it('does not persist a degraded Office conversion until the user confirms it', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    artifact.title = 'Imported deck';
    artifact.compatibility = {
      sourceFormat: 'PPTX',
      sourceName: 'imported.pptx',
      assessedAt: Date.now(),
      issues: [
        {
          code: 'pptx.animation',
          severity: 'warning',
          feature: 'Animations',
          message: 'Animations will be omitted.',
        },
      ],
    };
    fileIo.importWorkFile.mockResolvedValue(artifact);
    const file = new File(['pptx'], 'imported.pptx');
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.importFile(file));

    expect(result.current.pendingImport?.artifact.id).toBe(artifact.id);
    expect(repository.saveWorkArtifact).not.toHaveBeenCalled();
    expect(repository.saveWorkSource).not.toHaveBeenCalled();

    await act(() => result.current.confirmImport());

    expect(repository.saveWorkArtifact).toHaveBeenCalledWith(expect.objectContaining({ id: artifact.id }));
    expect(repository.saveWorkSource).toHaveBeenCalledWith(expect.objectContaining({ id: artifact.id }), file);
    expect(result.current.pendingImport).toBeNull();
    expect(result.current.activeArtifact).toMatchObject({
      id: artifact.id,
      source: { name: 'imported.pptx' },
    });
  });

  it('binds an imported local Office file to its original path after compatibility review', async () => {
    const artifact = createWorkArtifact('blank-document');
    artifact.title = 'Plan';
    artifact.compatibility = {
      sourceFormat: 'DOCX',
      sourceName: 'Plan.docx',
      assessedAt: Date.now(),
      issues: [
        {
          code: 'docx.layout',
          severity: 'warning',
          feature: 'Layout',
          message: 'Review layout before saving.',
        },
      ],
    };
    fileIo.importWorkFile.mockResolvedValue(artifact);
    const file = new File([Uint8Array.from([1, 2, 3])], 'Plan.docx');
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.importFile(file, { localPath: '/docs/Plan.docx' }));

    expect(readWorkLocalFileBinding(artifact.id)).toBeNull();
    await act(() => result.current.confirmImport());

    expect(result.current.activeLocalBinding).toEqual({
      artifactId: artifact.id,
      path: '/docs/Plan.docx',
      fingerprint: await fingerprintWorkFile(Uint8Array.from([1, 2, 3])),
      size: 3,
      updatedAt: expect.any(Number),
    });
    expect(readWorkLocalFileBinding(artifact.id)?.path).toBe('/docs/Plan.docx');
  });

  it('reopens an unchanged local Office path without creating another managed copy', async () => {
    const artifact = createWorkArtifact('blank-document');
    artifact.title = 'Plan';
    const bytes = Uint8Array.from([1, 2, 3]);
    saveWorkLocalFileBinding({
      artifactId: artifact.id,
      path: '/docs/Plan.docx',
      fingerprint: await fingerprintWorkFile(bytes),
      size: bytes.byteLength,
      updatedAt: Date.now(),
    });
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [artifact],
      folders: [],
      limits: null,
      storage: 'local',
    });
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() =>
      result.current.importFile(new File([bytes], 'Plan.docx'), {
        localPath: '/docs/Plan.docx',
      })
    );

    expect(fileIo.importWorkFile).not.toHaveBeenCalled();
    expect(repository.saveWorkSource).not.toHaveBeenCalled();
    expect(result.current.activeArtifact?.id).toBe(artifact.id);
    expect(result.current.artifacts).toHaveLength(1);
  });

  it('opens a changed disk file as a new bound copy while preserving the previous recovery artifact', async () => {
    const previous = createWorkArtifact('blank-document');
    previous.title = 'Plan recovery';
    const original = Uint8Array.from([1, 2, 3]);
    const changed = Uint8Array.from([4, 5, 6]);
    saveWorkLocalFileBinding({
      artifactId: previous.id,
      path: '/docs/Plan.docx',
      fingerprint: await fingerprintWorkFile(original),
      size: original.byteLength,
      updatedAt: Date.now(),
    });
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [previous],
      folders: [],
      limits: null,
      storage: 'local',
    });
    const imported = createWorkArtifact('blank-document');
    imported.title = 'Plan';
    fileIo.importWorkFile.mockResolvedValue(imported);
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() =>
      result.current.importFile(new File([changed], 'Plan.docx'), {
        localPath: '/docs/Plan.docx',
      })
    );

    expect(result.current.activeArtifact?.id).toBe(imported.id);
    expect(result.current.artifacts.map((artifact) => artifact.id)).toEqual([imported.id, previous.id]);
    expect(readWorkLocalFileBinding(previous.id)).toBeNull();
    expect(readWorkLocalFileBinding(imported.id)).toMatchObject({ path: '/docs/Plan.docx' });
  });

  it('writes an edited bound artifact back through a verified sibling replacement', async () => {
    const artifact = createWorkArtifact('blank-document');
    const original = Uint8Array.from([1, 2, 3]);
    const output = Uint8Array.from([9, 8, 7]);
    saveWorkLocalFileBinding({
      artifactId: artifact.id,
      path: '/docs/Plan.docx',
      fingerprint: await fingerprintWorkFile(original),
      size: original.byteLength,
      updatedAt: Date.now(),
    });
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [artifact],
      folders: [],
      limits: null,
      storage: 'local',
    });
    fileIo.createWorkArtifactBlob.mockResolvedValue(new Blob([output]));
    localFileApi.pathExists.mockResolvedValue({ exists: true });
    localFileApi.readBinaryFile.mockResolvedValueOnce(original).mockResolvedValueOnce(output);
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.openArtifact(artifact.id));

    await act(() => result.current.saveLocalFile());

    expect(localFileApi.writeBinaryFile).toHaveBeenCalledWith(expect.stringMatching(/\.a3s-.*\.tmp$/), output);
    expect(localFileApi.renamePath).toHaveBeenCalledWith(expect.any(String), '/docs/Plan.docx');
    expect(result.current.localSaveState).toBe('saved');
    expect(readWorkLocalFileBinding(artifact.id)?.fingerprint).toBe(await fingerprintWorkFile(output));
  });

  it('does not mark a metadata-only file open as unsaved content', async () => {
    const artifact = createWorkArtifact('blank-document');
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [artifact],
      folders: [],
      limits: null,
      storage: 'local',
    });
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.openArtifact(artifact.id));

    expect(result.current.saveState).toBe('saved');
  });

  it('does not create another managed revision when the current snapshot is already saved', async () => {
    const artifact = createWorkArtifact('blank-document');
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [artifact],
      folders: [],
      limits: null,
      storage: 'local',
    });
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.openArtifact(artifact.id));
    await act(() => result.current.saveNow());
    repository.saveWorkArtifact.mockClear();

    await act(() => result.current.saveNow(result.current.activeArtifact));

    expect(repository.saveWorkArtifact).not.toHaveBeenCalled();
    expect(result.current.saveState).toBe('saved');
  });

  it('joins an in-flight managed save before writing the same revision to a bound file', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    const original = Uint8Array.from([1, 2, 3]);
    const output = Uint8Array.from([9, 8, 7]);
    saveWorkLocalFileBinding({
      artifactId: artifact.id,
      path: '/docs/Quarterly.pptx',
      fingerprint: await fingerprintWorkFile(original),
      size: original.byteLength,
      updatedAt: Date.now(),
    });
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [artifact],
      folders: [],
      limits: null,
      storage: 'local',
    });
    fileIo.createWorkArtifactBlob.mockResolvedValue(new Blob([output]));
    localFileApi.pathExists.mockResolvedValue({ exists: true });
    localFileApi.readBinaryFile.mockResolvedValueOnce(original).mockResolvedValueOnce(output);
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.openArtifact(artifact.id));
    await act(() => result.current.saveNow());
    repository.saveWorkArtifact.mockClear();

    let finishManagedSave!: (artifact: typeof result.current.activeArtifact) => void;
    repository.saveWorkArtifact.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishManagedSave = resolve;
        })
    );
    act(() => {
      result.current.updateArtifact((current) => ({ ...current, title: '季度汇报' }));
    });

    let managedSave!: Promise<boolean>;
    act(() => {
      managedSave = result.current.saveNow();
    });
    await waitFor(() => expect(repository.saveWorkArtifact).toHaveBeenCalledTimes(1));

    let localSave!: Promise<boolean>;
    act(() => {
      localSave = result.current.saveLocalFile();
    });
    await act(async () => Promise.resolve());
    const callsWhileFirstSaveWasPending = repository.saveWorkArtifact.mock.calls.length;
    const snapshot = repository.saveWorkArtifact.mock.calls[0][0];
    await act(async () => {
      finishManagedSave(snapshot);
      await Promise.all([managedSave, localSave]);
    });

    expect(callsWhileFirstSaveWasPending).toBe(1);
    expect(localFileApi.renamePath).toHaveBeenCalledWith(expect.any(String), '/docs/Quarterly.pptx');
    expect(result.current.saveState).toBe('saved');
    expect(result.current.localSaveState).toBe('saved');
  });

  it('serializes a newer edit behind an in-flight save and writes the latest snapshot', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    const original = Uint8Array.from([1, 2, 3]);
    const output = Uint8Array.from([9, 8, 7]);
    saveWorkLocalFileBinding({
      artifactId: artifact.id,
      path: '/docs/Quarterly.pptx',
      fingerprint: await fingerprintWorkFile(original),
      size: original.byteLength,
      updatedAt: Date.now(),
    });
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [artifact],
      folders: [],
      limits: null,
      storage: 'local',
    });
    fileIo.createWorkArtifactBlob.mockResolvedValue(new Blob([output]));
    localFileApi.pathExists.mockResolvedValue({ exists: true });
    localFileApi.readBinaryFile.mockResolvedValueOnce(original).mockResolvedValueOnce(output);
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.openArtifact(artifact.id));
    await act(() => result.current.saveNow());
    repository.saveWorkArtifact.mockClear();

    let finishFirstSave!: (artifact: typeof result.current.activeArtifact) => void;
    repository.saveWorkArtifact.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirstSave = resolve;
        })
    );
    act(() => {
      result.current.updateArtifact((current) => ({ ...current, title: '第一版标题' }));
    });
    let firstSave!: Promise<boolean>;
    act(() => {
      firstSave = result.current.saveNow();
    });
    await waitFor(() => expect(repository.saveWorkArtifact).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.updateArtifact((current) => ({ ...current, title: '最终标题' }));
    });
    let localSave!: Promise<boolean>;
    act(() => {
      localSave = result.current.saveLocalFile();
    });
    await act(async () => Promise.resolve());
    expect(repository.saveWorkArtifact).toHaveBeenCalledTimes(1);

    const firstSnapshot = repository.saveWorkArtifact.mock.calls[0][0];
    await act(async () => {
      finishFirstSave(firstSnapshot);
      await Promise.all([firstSave, localSave]);
    });

    expect(repository.saveWorkArtifact).toHaveBeenCalledTimes(2);
    expect(repository.saveWorkArtifact.mock.calls[1][0]).toMatchObject({ title: '最终标题' });
    expect(fileIo.createWorkArtifactBlob).toHaveBeenCalledWith(expect.objectContaining({ title: '最终标题' }));
    expect(result.current.activeArtifact?.title).toBe('最终标题');
    expect(result.current.saveState).toBe('saved');
    expect(result.current.localSaveState).toBe('saved');
  });

  it('persists an EmbedPDF export to A3S and writes the same PDF back to its bound file', async () => {
    const artifact = createWorkArtifact('blank-document');
    artifact.kind = 'pdf';
    artifact.content = { type: 'pdf' };
    artifact.source = {
      name: 'Proposal.pdf',
      contentType: 'application/pdf',
      size: 3,
      updatedAt: Date.now(),
    };
    const original = Uint8Array.from([1, 2, 3]);
    const output = Uint8Array.from([37, 80, 68, 70]);
    saveWorkLocalFileBinding({
      artifactId: artifact.id,
      path: '/docs/Proposal.pdf',
      fingerprint: await fingerprintWorkFile(original),
      size: original.byteLength,
      updatedAt: Date.now(),
    });
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [artifact],
      folders: [],
      limits: null,
      storage: 'local',
    });
    localFileApi.pathExists.mockResolvedValue({ exists: true });
    localFileApi.readBinaryFile.mockResolvedValueOnce(original).mockResolvedValueOnce(output);
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.openArtifact(artifact.id));

    let saved = false;
    await act(async () => {
      saved = await result.current.savePdfSource(new Blob([output], { type: 'application/pdf' }));
    });

    expect(saved).toBe(true);
    expect(repository.saveWorkSource).toHaveBeenCalledWith(
      expect.objectContaining({ id: artifact.id }),
      expect.objectContaining({ name: 'Proposal.pdf', type: 'application/pdf' })
    );
    expect(localFileApi.writeBinaryFile).toHaveBeenCalledWith(expect.stringMatching(/\.a3s-.*\.tmp$/), output);
    expect(localFileApi.renamePath).toHaveBeenCalledWith(expect.any(String), '/docs/Proposal.pdf');
    expect(result.current.saveState).toBe('saved');
    expect(result.current.localSaveState).toBe('saved');
  });

  it('keeps edited content and exposes a review state when the bound file changed externally', async () => {
    const artifact = createWorkArtifact('blank-document');
    const original = Uint8Array.from([1, 2, 3]);
    const changed = Uint8Array.from([4, 5, 6]);
    saveWorkLocalFileBinding({
      artifactId: artifact.id,
      path: '/docs/Plan.docx',
      fingerprint: await fingerprintWorkFile(original),
      size: original.byteLength,
      updatedAt: Date.now(),
    });
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [artifact],
      folders: [],
      limits: null,
      storage: 'local',
    });
    fileIo.createWorkArtifactBlob.mockResolvedValue(new Blob([Uint8Array.from([9])]));
    localFileApi.pathExists.mockResolvedValue({ exists: true });
    localFileApi.readBinaryFile.mockResolvedValue(changed);
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.openArtifact(artifact.id));

    await act(() => result.current.saveLocalFile());

    expect(localFileApi.writeBinaryFile).not.toHaveBeenCalled();
    expect(result.current.localSaveState).toBe('conflict');
    expect(result.current.localConflict).toMatchObject({ path: '/docs/Plan.docx', missing: false });
    expect(result.current.activeArtifact?.id).toBe(artifact.id);
  });

  it('requires overwrite confirmation before Save As binds an existing destination', async () => {
    const artifact = createWorkArtifact('blank-spreadsheet');
    artifact.title = 'Untitled workbook';
    const output = Uint8Array.from([7, 7, 7]);
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [artifact],
      folders: [],
      limits: null,
      storage: 'local',
    });
    fileIo.createWorkArtifactBlob.mockResolvedValue(new Blob([output]));
    localFileApi.pathExists.mockResolvedValue({ exists: true });
    localFileApi.readBinaryFile.mockResolvedValue(output);
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.openArtifact(artifact.id));

    let firstResult: Awaited<ReturnType<typeof result.current.saveLocalFileAs>> | undefined;
    await act(async () => {
      firstResult = await result.current.saveLocalFileAs('/docs', 'Budget.xlsx');
    });
    expect(firstResult).toBe('exists');
    expect(localFileApi.writeBinaryFile).not.toHaveBeenCalled();

    await act(() => result.current.saveLocalFileAs('/docs', 'Budget.xlsx', { allowOverwrite: true }));

    expect(localFileApi.renamePath).toHaveBeenCalledWith(expect.any(String), '/docs/Budget.xlsx');
    expect(result.current.activeLocalBinding?.path).toBe('/docs/Budget.xlsx');
    expect(result.current.activeArtifact?.title).toBe('Budget');
  });

  it('creates a new Office file directly in a local folder and opens its bound editor', async () => {
    const output = Uint8Array.from([4, 5, 6]);
    fileIo.createWorkArtifactBlob.mockResolvedValue(new Blob([output]));
    localFileApi.readBinaryFile.mockResolvedValue(output);
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let createResult: Awaited<ReturnType<typeof result.current.createLocalArtifact>> | undefined;
    await act(async () => {
      createResult = await result.current.createLocalArtifact('blank-document', '/docs', 'Plan.docx');
    });

    expect(createResult).toBe('created');
    expect(result.current.activeArtifact).toMatchObject({ kind: 'document', title: 'Plan' });
    expect(result.current.activeLocalBinding).toMatchObject({ path: '/docs/Plan.docx', size: 3 });
    expect(localFileApi.renamePath).toHaveBeenCalledWith(expect.any(String), '/docs/Plan.docx');
    expect(repository.saveWorkArtifact).toHaveBeenCalledWith(expect.objectContaining({ title: 'Plan' }));
  });

  it('leaves Save As in an error state when the managed artifact cannot be persisted', async () => {
    const artifact = createWorkArtifact('blank-document');
    repository.loadWorkLibrary.mockResolvedValue({
      artifacts: [artifact],
      folders: [],
      limits: null,
      storage: 'local',
    });
    const { result } = renderHook(() => useWorkController());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.openArtifact(artifact.id));
    repository.saveWorkArtifact.mockRejectedValueOnce(new Error('Managed save failed'));

    let saveResult: Awaited<ReturnType<typeof result.current.saveLocalFileAs>> | undefined;
    await act(async () => {
      saveResult = await result.current.saveLocalFileAs('/docs', 'Plan.docx');
    });

    expect(saveResult).toBe('error');
    expect(result.current.localSaveState).toBe('error');
    expect(localFileApi.writeBinaryFile).not.toHaveBeenCalled();
  });
});
