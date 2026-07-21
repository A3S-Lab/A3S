import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef, useState } from 'react';
import { codeApi } from '../../lib/api';
import { showToast } from '../../state/app-state';
import { createWorkArtifactBlob, exportWorkArtifact, importWorkFile } from './work-file-io';
import { fileNameWithoutExtension } from './work-file-download';
import { createWorkLocalArtifact, workLocalArtifactFileName } from './work-local-artifact-create';
import {
  fingerprintWorkFile,
  readWorkLocalFileBinding,
  readWorkLocalFileBindingByPath,
  removeWorkLocalFileBinding,
  saveWorkLocalFileBinding,
  WorkLocalFileConflictError,
  WorkLocalFileExistsError,
  writeWorkLocalFileAtomically,
} from './work-local-file-binding';
import { joinLocalPath } from './work-local-files';
import {
  copyWorkArtifact,
  deleteWorkArtifact,
  downloadWorkSource,
  listWorkArtifactVersions,
  loadWorkLibrary,
  purgeWorkArtifact,
  purgeWorkFolder,
  readWorkSourceBlob,
  restoreWorkArtifact,
  restoreWorkArtifactVersion,
  restoreWorkFolder,
  saveWorkArtifact,
  saveWorkFolder,
  saveWorkSource,
  trashWorkFolder,
} from './work-repository';
import { createWorkArtifact, createWorkId } from './work-templates';
import type { WorkPdfExportOptions } from './work-pdf-export';
import type {
  WorkArtifact,
  WorkArtifactVersion,
  WorkFolder,
  WorkLibraryView,
  WorkSaveState,
  WorkStorageMode,
} from './work-types';

const SAVE_DELAY_MS = 550;

export type WorkLocalSaveState = 'idle' | 'checking' | 'saving' | 'saved' | 'conflict' | 'error';

export interface WorkLocalFileConflict {
  path: string;
  missing: boolean;
}

interface WorkImportOptions {
  localPath?: string;
}

export function useWorkController() {
  const [artifacts, setArtifacts] = useState<WorkArtifact[]>([]);
  const [folders, setFolders] = useState<WorkFolder[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<WorkArtifact | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [libraryView, setLibraryViewState] = useState<WorkLibraryView>('home');
  const [storageMode, setStorageMode] = useState<WorkStorageMode>('local');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<WorkSaveState>('saved');
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    artifact: WorkArtifact;
    file: File;
    options?: WorkImportOptions;
  } | null>(null);
  const [localSaveState, setLocalSaveState] = useState<WorkLocalSaveState>('idle');
  const [localConflict, setLocalConflict] = useState<WorkLocalFileConflict | null>(null);
  const [, setLocalBindingVersion] = useState(0);
  const pendingSave = useRef<WorkArtifact | null>(null);
  const saveTimer = useRef<number | null>(null);
  const saveSequence = useRef(0);
  const activeLocalBinding = activeArtifact ? readWorkLocalFileBinding(activeArtifact.id) : null;

  const refresh = useMemoizedFn(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const library = await loadWorkLibrary();
      setArtifacts(library.artifacts);
      setFolders(library.folders);
      setStorageMode(library.storage);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '无法读取 Work 文件');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void refresh();
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      if (pendingSave.current) void saveWorkArtifact(pendingSave.current);
    };
  }, [refresh]);

  useEffect(() => {
    setLocalSaveState('idle');
    setLocalConflict(null);
  }, [activeArtifact?.id]);

  const persistNow = useMemoizedFn(async (artifact?: WorkArtifact | null) => {
    const snapshot = artifact ?? pendingSave.current;
    if (!snapshot) return true;
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    pendingSave.current = null;
    saveSequence.current += 1;
    const sequence = saveSequence.current;
    setSaveState('saving');
    try {
      const saved = await saveWorkArtifact(snapshot);
      setArtifacts((items) =>
        items.map((item) => (item.id === saved.id && item.revision <= snapshot.revision ? cloneArtifact(saved) : item))
      );
      if (sequence === saveSequence.current && !pendingSave.current) {
        setActiveArtifact((current) =>
          current?.id === saved.id && current.revision <= snapshot.revision ? cloneArtifact(saved) : current
        );
        setSaveState('saved');
      }
      return true;
    } catch (error) {
      if (sequence === saveSequence.current) setSaveState('error');
      showToast(saveErrorMessage(error), 'error');
      pendingSave.current = snapshot;
      return false;
    }
  });

  const scheduleSave = useMemoizedFn((artifact: WorkArtifact) => {
    pendingSave.current = artifact;
    setSaveState('dirty');
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void persistNow();
    }, SAVE_DELAY_MS);
  });

  const setLibraryView = useMemoizedFn((view: WorkLibraryView) => {
    setLibraryViewState(view);
    if (view !== 'folder') setActiveFolderId(null);
  });

  const openFolder = useMemoizedFn((id: string) => {
    setActiveFolderId(id);
    setLibraryViewState('folder');
  });

  const createArtifact = useMemoizedFn(async (templateId: string) => {
    if (!(await persistNow())) return;
    const artifact = createWorkArtifact(templateId);
    if (libraryView === 'folder') artifact.folderId = activeFolderId;
    setArtifacts((current) => [artifact, ...current]);
    setActiveArtifact(artifact);
    setSaveState('saving');
    try {
      const saved = await saveWorkArtifact(artifact);
      replaceArtifact(saved, setArtifacts, setActiveArtifact);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      showToast(saveErrorMessage(error, '无法创建文件'), 'error');
    }
  });

  const createLocalArtifact = useMemoizedFn(
    async (templateId: string, directory: string, requestedName: string): Promise<'created' | 'exists' | 'error'> => {
      if (!(await persistNow())) return 'error';
      setLocalSaveState('saving');
      setLocalConflict(null);
      try {
        const result = await createWorkLocalArtifact(templateId, directory, requestedName);
        saveWorkLocalFileBinding(result.binding);
        setLocalBindingVersion((value) => value + 1);
        setArtifacts((current) => [cloneArtifact(result.artifact), ...current]);
        setActiveArtifact(cloneArtifact(result.artifact));
        setSaveState('saved');
        setLocalSaveState('saved');
        showToast(`已创建 ${result.binding.path}`, 'success');
        return 'created';
      } catch (error) {
        if (error instanceof WorkLocalFileExistsError) {
          setLocalSaveState('idle');
          return 'exists';
        }
        setLocalSaveState('error');
        showToast(saveErrorMessage(error, '无法创建本地 Office 文件'), 'error');
        return 'error';
      }
    }
  );

  const openArtifact = useMemoizedFn(async (id: string) => {
    if (!(await persistNow())) return;
    const artifact = artifacts.find((item) => item.id === id);
    if (!artifact || artifact.trashedAt) return;
    const opened = {
      ...cloneArtifact(artifact),
      lastOpenedAt: Date.now(),
      updatedAt: Date.now(),
      revision: artifact.revision + 1,
    };
    setActiveArtifact(opened);
    setArtifacts((current) => sortArtifacts(current.map((item) => (item.id === id ? opened : item))));
    scheduleSave(opened);
  });

  const closeArtifact = useMemoizedFn(async () => {
    if (!(await persistNow())) return;
    setActiveArtifact(null);
    setSaveState('saved');
  });

  const updateArtifact = useMemoizedFn((update: (artifact: WorkArtifact) => WorkArtifact) => {
    if (!activeArtifact) return;
    const next = update(cloneArtifact(activeArtifact));
    next.updatedAt = Date.now();
    next.revision = activeArtifact.revision + 1;
    setActiveArtifact(next);
    setArtifacts((items) => items.map((item) => (item.id === next.id ? next : item)));
    scheduleSave(next);
  });

  const removeArtifact = useMemoizedFn(async (id: string) => {
    const artifact = artifacts.find((item) => item.id === id);
    if (!artifact) return;
    if (activeArtifact?.id === id) await closeArtifact();
    try {
      if (artifact.trashedAt) {
        await purgeWorkArtifact(id);
        removeWorkLocalFileBinding(id);
        setLocalBindingVersion((value) => value + 1);
        setArtifacts((current) => current.filter((item) => item.id !== id));
        showToast('文件已永久删除', 'success');
      } else {
        const trashed = await deleteWorkArtifact(id);
        if (trashed) replaceArtifact(trashed, setArtifacts);
        showToast('文件已移到回收站', 'success');
      }
    } catch (error) {
      showToast(saveErrorMessage(error, '无法删除文件'), 'error');
    }
  });

  const restoreArtifact = useMemoizedFn(async (id: string) => {
    const artifact = artifacts.find((item) => item.id === id);
    if (!artifact) return;
    try {
      replaceArtifact(await restoreWorkArtifact(artifact), setArtifacts);
      showToast('文件已恢复', 'success');
    } catch (error) {
      showToast(saveErrorMessage(error, '无法恢复文件'), 'error');
    }
  });

  const copyArtifact = useMemoizedFn(async (id: string) => {
    const artifact = artifacts.find((item) => item.id === id);
    if (!artifact) return;
    try {
      const copy = await copyWorkArtifact(artifact);
      setArtifacts((current) => [copy, ...current]);
      showToast('已创建文件副本', 'success');
    } catch (error) {
      showToast(saveErrorMessage(error, '无法复制文件'), 'error');
    }
  });

  const patchStoredArtifact = useMemoizedFn(async (id: string, patch: Partial<WorkArtifact>) => {
    const artifact = artifacts.find((item) => item.id === id);
    if (!artifact) return;
    const next = {
      ...cloneArtifact(artifact),
      ...patch,
      updatedAt: Date.now(),
      revision: artifact.revision + 1,
    };
    try {
      const saved = await saveWorkArtifact(next);
      replaceArtifact(saved, setArtifacts, setActiveArtifact);
    } catch (error) {
      showToast(saveErrorMessage(error, '无法更新文件'), 'error');
    }
  });

  const toggleFavorite = useMemoizedFn((id: string) => {
    const artifact = artifacts.find((item) => item.id === id);
    if (!artifact) return;
    if (activeArtifact?.id === id) {
      updateArtifact((current) => ({ ...current, favorite: !current.favorite }));
      return;
    }
    void patchStoredArtifact(id, { favorite: !artifact.favorite });
  });

  const createFolder = useMemoizedFn(async (name: string) => {
    const value = name.trim();
    if (!value) return;
    const now = Date.now();
    const folder: WorkFolder = {
      id: createWorkId('folder'),
      name: value,
      parentId: libraryView === 'folder' ? activeFolderId : null,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    try {
      const saved = await saveWorkFolder(folder);
      setFolders((current) => [...current, saved]);
      showToast('文件夹已创建', 'success');
    } catch (error) {
      showToast(saveErrorMessage(error, '无法创建文件夹'), 'error');
    }
  });

  const patchFolder = useMemoizedFn(async (id: string, patch: Partial<WorkFolder>) => {
    const folder = folders.find((item) => item.id === id);
    if (!folder) return;
    try {
      const saved = await saveWorkFolder({
        ...cloneFolder(folder),
        ...patch,
        updatedAt: Date.now(),
        revision: folder.revision + 1,
      });
      setFolders((current) => current.map((item) => (item.id === id ? saved : item)));
    } catch (error) {
      showToast(saveErrorMessage(error, '无法更新文件夹'), 'error');
    }
  });

  const removeFolder = useMemoizedFn(async (id: string) => {
    const folder = folders.find((item) => item.id === id);
    if (!folder) return;
    try {
      if (folder.trashedAt) {
        await purgeWorkFolder(id);
        setFolders((current) => current.filter((item) => item.id !== id));
        showToast('文件夹已永久删除', 'success');
      } else {
        const trashed = await trashWorkFolder(folder);
        setFolders((current) => current.map((item) => (item.id === id ? trashed : item)));
        showToast('文件夹已移到回收站', 'success');
      }
    } catch (error) {
      showToast(saveErrorMessage(error, '无法删除文件夹'), 'error');
    }
  });

  const restoreFolder = useMemoizedFn(async (id: string) => {
    const folder = folders.find((item) => item.id === id);
    if (!folder) return;
    try {
      const restored = await restoreWorkFolder(folder);
      setFolders((current) => current.map((item) => (item.id === id ? restored : item)));
      showToast('文件夹已恢复', 'success');
    } catch (error) {
      showToast(saveErrorMessage(error, '无法恢复文件夹'), 'error');
    }
  });

  const persistImportedFile = useMemoizedFn(async (artifact: WorkArtifact, file: File, options?: WorkImportOptions) => {
    let imported = cloneArtifact(artifact);
    if (libraryView === 'folder') imported.folderId = activeFolderId;
    try {
      imported = await saveWorkArtifact(imported);
      imported = await saveWorkSource(imported, file);
      if (options?.localPath) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        saveWorkLocalFileBinding({
          artifactId: imported.id,
          path: options.localPath,
          fingerprint: await fingerprintWorkFile(bytes),
          size: bytes.byteLength,
          updatedAt: Date.now(),
        });
        setLocalBindingVersion((value) => value + 1);
      }
      setArtifacts((current) => [imported, ...current]);
      setActiveArtifact(imported);
      setSaveState('saved');
      showToast(`已导入 ${file.name}`, 'success');
      return true;
    } catch (error) {
      showToast(saveErrorMessage(error, '文件导入失败'), 'error');
      return false;
    }
  });

  const importFile = useMemoizedFn(async (file: File, options?: WorkImportOptions) => {
    try {
      if (options?.localPath) {
        const binding = readWorkLocalFileBindingByPath(options.localPath);
        const boundArtifact = binding
          ? artifacts.find((artifact) => artifact.id === binding.artifactId && !artifact.trashedAt)
          : null;
        if (binding && boundArtifact) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          if ((await fingerprintWorkFile(bytes)) === binding.fingerprint) {
            await openArtifact(boundArtifact.id);
            showToast(`已重新打开 ${file.name}`, 'success');
            return;
          }
        }
      }
      if (!(await persistNow())) return;
      const artifact = await importWorkFile(file);
      const hasCompatibilityIssues = Boolean(artifact.compatibility?.issues.length);
      if (hasCompatibilityIssues) {
        setPendingImport({ artifact, file, options });
        return;
      }
      setImporting(true);
      await persistImportedFile(artifact, file, options);
    } catch (error) {
      showToast(saveErrorMessage(error, '文件导入失败'), 'error');
    } finally {
      setImporting(false);
    }
  });

  const confirmImport = useMemoizedFn(async () => {
    if (!pendingImport || importing) return false;
    setImporting(true);
    try {
      const saved = await persistImportedFile(pendingImport.artifact, pendingImport.file, pendingImport.options);
      if (saved) setPendingImport(null);
      return saved;
    } finally {
      setImporting(false);
    }
  });

  const cancelImport = useMemoizedFn(() => {
    if (!importing) setPendingImport(null);
  });

  const exportArtifact = useMemoizedFn(async () => {
    if (!activeArtifact || exporting) return;
    setExporting(true);
    try {
      await persistNow(activeArtifact);
      await exportWorkArtifact(activeArtifact);
      showToast('文件已导出', 'success');
    } catch (error) {
      showToast(saveErrorMessage(error, '文件导出失败'), 'error');
    } finally {
      setExporting(false);
    }
  });

  const checkLocalFile = useMemoizedFn(async () => {
    const binding = activeArtifact ? readWorkLocalFileBinding(activeArtifact.id) : null;
    if (!binding) return true;
    setLocalSaveState('checking');
    try {
      if (!(await codeApi.pathExists(binding.path)).exists) {
        setLocalConflict({ path: binding.path, missing: true });
        setLocalSaveState('conflict');
        return false;
      }
      const current = await codeApi.readBinaryFile(binding.path);
      const fingerprint = await fingerprintWorkFile(current);
      if (fingerprint !== binding.fingerprint) {
        setLocalConflict({ path: binding.path, missing: false });
        setLocalSaveState('conflict');
        return false;
      }
      setLocalConflict(null);
      setLocalSaveState('idle');
      return true;
    } catch {
      setLocalConflict(null);
      setLocalSaveState('error');
      return false;
    }
  });

  const saveLocalFile = useMemoizedFn(async (options: { force?: boolean } = {}) => {
    if (!activeArtifact) return false;
    const binding = readWorkLocalFileBinding(activeArtifact.id);
    if (!binding) return false;
    if (!(await persistNow(activeArtifact))) return false;
    setLocalSaveState('saving');
    setLocalConflict(null);
    try {
      const bytes = await artifactBytes(activeArtifact);
      const snapshot = await writeWorkLocalFileAtomically(codeApi, binding.path, bytes, {
        expectedFingerprint: options.force ? undefined : binding.fingerprint,
        allowOverwrite: options.force,
      });
      saveWorkLocalFileBinding({
        ...binding,
        ...snapshot,
        updatedAt: Date.now(),
      });
      setLocalBindingVersion((value) => value + 1);
      setLocalSaveState('saved');
      showToast(`已保存到 ${binding.path}`, 'success');
      return true;
    } catch (error) {
      if (error instanceof WorkLocalFileConflictError) {
        setLocalConflict({
          path: binding.path,
          missing: error.actualFingerprint === null,
        });
        setLocalSaveState('conflict');
        showToast('本地文件已在 A3S Work 外部更改，请先确认如何处理。', 'info');
        return false;
      }
      setLocalSaveState('error');
      showToast(saveErrorMessage(error, '无法保存到本地文件'), 'error');
      return false;
    }
  });

  const saveLocalFileAs = useMemoizedFn(
    async (
      directory: string,
      requestedName: string,
      options: { allowOverwrite?: boolean } = {}
    ): Promise<'saved' | 'exists' | 'error'> => {
      if (!activeArtifact) return 'error';
      setLocalSaveState('saving');
      setLocalConflict(null);
      try {
        const fileName = workLocalArtifactFileName(requestedName, activeArtifact.kind);
        const path = joinLocalPath(directory, fileName);
        if (!(await persistNow(activeArtifact))) {
          setLocalSaveState('error');
          return 'error';
        }
        const bytes = await artifactBytes(activeArtifact);
        const snapshot = await writeWorkLocalFileAtomically(codeApi, path, bytes, {
          allowOverwrite: Boolean(options.allowOverwrite),
        });
        saveWorkLocalFileBinding({
          artifactId: activeArtifact.id,
          path,
          ...snapshot,
          updatedAt: Date.now(),
        });
        setLocalBindingVersion((value) => value + 1);
        const title = fileNameWithoutExtension(fileName);
        if (title !== activeArtifact.title) {
          const renamed = {
            ...cloneArtifact(activeArtifact),
            title,
            revision: activeArtifact.revision + 1,
            updatedAt: Date.now(),
          };
          setActiveArtifact(renamed);
          setArtifacts((items) => items.map((item) => (item.id === renamed.id ? renamed : item)));
          await persistNow(renamed);
        }
        setLocalSaveState('saved');
        showToast(`已另存为 ${path}`, 'success');
        return 'saved';
      } catch (error) {
        if (error instanceof WorkLocalFileExistsError) {
          setLocalSaveState('idle');
          return 'exists';
        }
        setLocalSaveState('error');
        showToast(saveErrorMessage(error, '无法另存本地文件'), 'error');
        return 'error';
      }
    }
  );

  const dismissLocalConflict = useMemoizedFn(() => {
    setLocalConflict(null);
    setLocalSaveState('idle');
  });

  const exportPdf = useMemoizedFn(async (options: WorkPdfExportOptions = {}) => {
    if (!activeArtifact || activeArtifact.kind === 'pdf' || exportingPdf) return;
    setExportingPdf(true);
    try {
      if (!(await persistNow(activeArtifact))) return;
      const { exportWorkArtifactPdf } = await import('./work-pdf-export');
      await exportWorkArtifactPdf(activeArtifact, options);
      showToast('PDF 已导出', 'success');
    } catch (error) {
      showToast(saveErrorMessage(error, 'PDF 导出失败'), 'error');
    } finally {
      setExportingPdf(false);
    }
  });

  const artifactVersions = useMemoizedFn(async (): Promise<WorkArtifactVersion[]> => {
    if (!activeArtifact) return [];
    return listWorkArtifactVersions(activeArtifact);
  });

  const restoreVersion = useMemoizedFn(async (version: number) => {
    if (!activeArtifact || !(await persistNow())) return false;
    try {
      const restored = await restoreWorkArtifactVersion(activeArtifact, version);
      replaceArtifact(restored, setArtifacts, setActiveArtifact);
      setSaveState('saved');
      showToast(`已恢复到第 ${version} 版`, 'success');
      return true;
    } catch (error) {
      showToast(saveErrorMessage(error, '无法恢复历史版本'), 'error');
      return false;
    }
  });

  const downloadSource = useMemoizedFn(async () => {
    if (!activeArtifact) return;
    try {
      await downloadWorkSource(activeArtifact);
    } catch (error) {
      showToast(saveErrorMessage(error, '原始文件下载失败'), 'error');
    }
  });

  const sourceBlob = useMemoizedFn(async (): Promise<Blob> => {
    if (!activeArtifact) throw new Error('没有打开的文件');
    return readWorkSourceBlob(activeArtifact);
  });

  const savePdfSource = useMemoizedFn(async (pdf: Blob): Promise<boolean> => {
    if (!activeArtifact || activeArtifact.kind !== 'pdf') return false;
    const artifact = activeArtifact;
    const binding = readWorkLocalFileBinding(artifact.id);
    setSaveState('saving');
    setLocalConflict(null);
    try {
      if (!(await persistNow(artifact))) return false;
      const fileName = artifact.source?.name ?? `${artifact.title}.pdf`;
      const source = new File([pdf], fileName, { type: 'application/pdf' });
      const saved = await saveWorkSource(artifact, source);
      replaceArtifact(saved, setArtifacts, setActiveArtifact);
      setSaveState('saved');

      if (!binding) {
        showToast('PDF 修改已保存到 A3S', 'success');
        return true;
      }

      setLocalSaveState('saving');
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      const snapshot = await writeWorkLocalFileAtomically(codeApi, binding.path, bytes, {
        expectedFingerprint: binding.fingerprint,
      });
      saveWorkLocalFileBinding({ ...binding, ...snapshot, updatedAt: Date.now() });
      setLocalBindingVersion((value) => value + 1);
      setLocalSaveState('saved');
      showToast(`PDF 修改已保存到 A3S 并写回 ${binding.path}`, 'success');
      return true;
    } catch (error) {
      if (error instanceof WorkLocalFileConflictError && binding) {
        setLocalConflict({
          path: binding.path,
          missing: error.actualFingerprint === null,
        });
        setLocalSaveState('conflict');
        showToast('PDF 已保存到 A3S，但本地文件已在外部更改。', 'info');
        return false;
      }
      setSaveState('error');
      setLocalSaveState('error');
      showToast(saveErrorMessage(error, 'PDF 保存失败'), 'error');
      return false;
    }
  });

  return {
    artifacts,
    folders,
    activeArtifact,
    activeFolderId,
    libraryView,
    storageMode,
    loading,
    loadError,
    saveState,
    exporting,
    exportingPdf,
    importing,
    pendingImport,
    activeLocalBinding,
    localSaveState,
    localConflict,
    setLibraryView,
    openFolder,
    refresh,
    createArtifact,
    createLocalArtifact,
    openArtifact,
    closeArtifact,
    updateArtifact,
    removeArtifact,
    restoreArtifact,
    copyArtifact,
    patchStoredArtifact,
    toggleFavorite,
    createFolder,
    patchFolder,
    removeFolder,
    restoreFolder,
    importFile,
    confirmImport,
    cancelImport,
    exportArtifact,
    exportPdf,
    checkLocalFile,
    saveLocalFile,
    saveLocalFileAs,
    dismissLocalConflict,
    artifactVersions,
    restoreVersion,
    downloadSource,
    sourceBlob,
    savePdfSource,
    saveNow: persistNow,
  };
}

export type WorkActions = ReturnType<typeof useWorkController>;

function replaceArtifact(
  artifact: WorkArtifact,
  setArtifacts: React.Dispatch<React.SetStateAction<WorkArtifact[]>>,
  setActiveArtifact?: React.Dispatch<React.SetStateAction<WorkArtifact | null>>
): void {
  setArtifacts((items) => items.map((item) => (item.id === artifact.id ? cloneArtifact(artifact) : item)));
  setActiveArtifact?.((current) => (current?.id === artifact.id ? cloneArtifact(artifact) : current));
}

function cloneArtifact(artifact: WorkArtifact): WorkArtifact {
  if (typeof structuredClone === 'function') return structuredClone(artifact);
  return JSON.parse(JSON.stringify(artifact)) as WorkArtifact;
}

function cloneFolder(folder: WorkFolder): WorkFolder {
  if (typeof structuredClone === 'function') return structuredClone(folder);
  return JSON.parse(JSON.stringify(folder)) as WorkFolder;
}

function sortArtifacts(artifacts: WorkArtifact[]): WorkArtifact[] {
  return [...artifacts].sort(
    (left, right) => right.lastOpenedAt - left.lastOpenedAt || right.updatedAt - left.updatedAt
  );
}

function saveErrorMessage(error: unknown, fallback = '文件保存失败'): string {
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes('changed on the server') || error.message.includes('current revision')) {
    return '服务器上的文件已更新；当前编辑内容仍保留，请刷新后处理冲突';
  }
  return error.message || fallback;
}

async function artifactBytes(artifact: WorkArtifact): Promise<Uint8Array> {
  const blob = artifact.kind === 'pdf' ? await readWorkSourceBlob(artifact) : await createWorkArtifactBlob(artifact);
  return new Uint8Array(await blob.arrayBuffer());
}
