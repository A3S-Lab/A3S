import { useCallback, useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { codeApi } from '../../../lib/api';
import { appState, formatApiError, showToast } from '../../../state/app-state';
import type { WorkspaceEntry } from '../../../types/api';
import type { CodeActions } from '../../code/use-code-controller';
import { codeDefaultWorkspace } from '../../workspace/code-default-workspace';
import { WorkCodeWorkspace } from '../components/work-code-workspace';
import { WorkCompatibilityDialog } from '../components/work-compatibility-dialog';
import { WorkCopilot } from '../components/work-copilot';
import { WorkEditorShell } from '../components/work-editor-shell';
import { WorkFilesWorkspace } from '../components/work-files-workspace';
import { WorkHome } from '../components/work-home';
import { WorkLocalArtifactCreateDialog } from '../components/work-local-artifact-create-dialog';
import { WorkSidebar } from '../components/work-sidebar';
import { useWorkCodeController } from '../use-work-code-controller';
import { useWorkController } from '../use-work-controller';
import { useWorkFilesController } from '../use-work-files-controller';
import { type WorkAgentProposalRequest, workAgentProposalInstruction } from '../work-agent-proposal';
import { prepareWorkAgentRequest, type WorkAgentRequest, type WorkEditorAgentRequest } from '../work-agent-request';
import { WORK_IMPORT_ACCEPT } from '../work-file-io';
import { isWorkOfficePath, isWorkTextEditorEntry, localPathBasename, workFileMimeType } from '../work-local-files';

const surfaceStorageKey = 'a3s-work.surface';
const copilotStorageKey = 'a3s-work.copilot-open';

export function WorkProduct({ actions: codeActions }: { actions: CodeActions }) {
  const state = useSnapshot(appState);
  const actions = useWorkController();
  const files = useWorkFilesController(
    codeDefaultWorkspace({
      newTaskWorkspace: state.newTaskConfig.workspace,
      serviceWorkspace: state.health?.workspace,
      currentWorkspace: state.workspaceRoot,
    })
  );
  const code = useWorkCodeController(files.rootPath);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [surface, setSurface] = useState<'files' | 'library'>(readSurface);
  const [copilotOpen, setCopilotOpen] = useState(readCopilotOpen);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [agentProposal, setAgentProposal] = useState<WorkAgentProposalRequest | null>(null);
  const [localCreateRequest, setLocalCreateRequest] = useState<{
    templateId: string;
    directory: string;
  } | null>(null);
  const previousArtifactIdRef = useRef(actions.activeArtifact?.id ?? null);
  const openFilePicker = () => fileInputRef.current?.click();
  const updateSurface = (next: 'files' | 'library') => {
    setSurface(next);
    persistValue(surfaceStorageKey, next);
  };
  const updateCopilotOpen = (open: boolean) => {
    setCopilotOpen(open);
    persistValue(copilotStorageKey, String(open));
  };
  const openLocalCreateDialog = useCallback(
    async (templateId: string) => {
      let directory = files.currentPath || files.rootPath;
      if (!files.rootPath) directory = (await files.pickRoot()) ?? '';
      if (!directory) return;
      setLocalCreateRequest({ templateId, directory });
    },
    [files.currentPath, files.pickRoot, files.rootPath]
  );
  const createForSurface = useCallback(
    (templateId: string) => {
      if (surface === 'files') {
        void openLocalCreateDialog(templateId);
        return;
      }
      void actions.createArtifact(templateId);
    },
    [actions.createArtifact, openLocalCreateDialog, surface]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLocaleLowerCase();
      if (key === 'n') {
        event.preventDefault();
        createForSurface('blank-document');
      } else if (key === 'o') {
        event.preventDefault();
        void files.pickRoot().then((path) => {
          if (path) updateSurface('files');
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [createForSurface, files.pickRoot]);
  useEffect(() => {
    const artifactId = actions.activeArtifact?.id ?? null;
    if (previousArtifactIdRef.current !== artifactId) {
      previousArtifactIdRef.current = artifactId;
      setAgentProposal(null);
    }
  }, [actions.activeArtifact?.id]);
  const openLocalFile = async (entry: WorkspaceEntry) => {
    if (openingPath) return;
    setOpeningPath(entry.path);
    try {
      if (isWorkTextEditorEntry(entry)) {
        await code.openFile({ path: entry.path, isBinary: false });
        return;
      }
      if (!isWorkOfficePath(entry.path)) {
        showToast('这个文件暂不能直接编辑。', 'info');
        return;
      }
      const bytes = await codeApi.readBinaryFile(entry.path);
      const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const file = new File([data], entry.name, { type: workFileMimeType(entry.path) });
      await actions.importFile(file, { localPath: entry.path });
    } catch (error) {
      showToast(formatApiError(error), 'error');
    } finally {
      setOpeningPath(null);
    }
  };
  const requestAgent = async (request: WorkAgentRequest, proposal?: WorkAgentProposalRequest) => {
    let workspaceRoot = request.workspaceRoot || files.rootPath;
    if (!workspaceRoot) workspaceRoot = (await files.pickRoot()) ?? '';
    if (!workspaceRoot) return;
    updateCopilotOpen(true);
    try {
      await prepareWorkAgentRequest(codeActions, {
        ...request,
        workspaceRoot,
      });
      if (proposal) setAgentProposal(proposal);
    } catch (error) {
      showToast(formatApiError(error), 'error');
    }
  };
  const requestDocumentAgent = (request: WorkEditorAgentRequest) => {
    const title = actions.activeArtifact?.title || '当前文档';
    const proposal = request.proposal?.targets.length ? request.proposal : undefined;
    const instruction = proposal ? workAgentProposalInstruction(request.instruction, proposal) : request.instruction;
    return requestAgent(
      {
        workspaceRoot: files.rootPath,
        paths: [],
        instruction: `关于 Work 中正在编辑的“${title}”：\n${instruction}`,
        selection: request.selection,
      },
      proposal
    );
  };

  return (
    <section className='work-product'>
      <input
        ref={fileInputRef}
        className='work-file-input'
        type='file'
        accept={WORK_IMPORT_ACCEPT}
        aria-label='打开 Office 文件'
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void actions.importFile(file);
        }}
      />
      {localCreateRequest && (
        <WorkLocalArtifactCreateDialog
          templateId={localCreateRequest.templateId}
          directory={localCreateRequest.directory}
          onClose={() => setLocalCreateRequest(null)}
          onCreate={async (fileName) => {
            const result = await actions.createLocalArtifact(
              localCreateRequest.templateId,
              localCreateRequest.directory,
              fileName
            );
            if (result === 'created') await files.refresh();
            return result;
          }}
        />
      )}
      {actions.pendingImport?.artifact.compatibility && (
        <WorkCompatibilityDialog
          report={actions.pendingImport.artifact.compatibility}
          mode='import'
          busy={actions.importing}
          onClose={actions.cancelImport}
          onConfirm={() => void actions.confirmImport()}
        />
      )}
      <div className='work-primary-pane'>
        {actions.activeArtifact ? (
          <WorkEditorShell
            actions={actions}
            copilotOpen={copilotOpen}
            onToggleCopilot={() => updateCopilotOpen(!copilotOpen)}
            onAgentRequest={requestDocumentAgent}
            defaultLocalDirectory={files.currentPath || files.rootPath}
            onPickLocalDirectory={async () => {
              const selection = await codeApi.pickWorkspaceDirectory(files.currentPath || files.rootPath || undefined);
              return selection.cancelled ? null : selection.path;
            }}
            onLocalFileSaved={() => void files.refresh()}
          />
        ) : code.tabs.length ? (
          <WorkCodeWorkspace
            actions={code}
            rootPath={files.rootPath}
            assistantOpen={copilotOpen}
            onOpenEntry={openLocalFile}
            onBack={() => {
              code.closeWorkspace();
            }}
            onToggleAssistant={() => updateCopilotOpen(!copilotOpen)}
            onAgentRequest={requestAgent}
          />
        ) : (
          <>
            {state.sidebarOpen && (
              <WorkSidebar
                surface={surface}
                localRootName={files.rootPath ? localPathBasename(files.rootPath) : ''}
                localRootPath={files.rootPath}
                localCurrentPath={files.currentPath}
                recentRootPaths={files.recentRootPaths}
                localFavoritePaths={files.favoritePaths}
                view={actions.libraryView}
                totalCount={actions.artifacts.filter((artifact) => !artifact.trashedAt).length}
                favoriteCount={actions.artifacts.filter((artifact) => artifact.favorite && !artifact.trashedAt).length}
                trashCount={
                  actions.artifacts.filter((artifact) => artifact.trashedAt).length +
                  actions.folders.filter((folder) => folder.trashedAt).length
                }
                folders={actions.folders}
                activeFolderId={actions.activeFolderId}
                onOpenLocalFiles={() => {
                  updateSurface('files');
                  if (files.rootPath) files.navigateTo(files.rootPath);
                }}
                onSelectWorkspace={async (path) => {
                  const selected = await files.selectRoot(path);
                  if (selected) updateSurface('files');
                  return selected;
                }}
                onPickWorkspace={async () => {
                  const selected = await files.pickRoot();
                  if (selected) updateSurface('files');
                  return selected;
                }}
                onOpenLocalFavorite={(path) => {
                  updateSurface('files');
                  files.navigateTo(path);
                }}
                onRemoveLocalFavorite={files.toggleFavoritePath}
                onMoveLocalEntries={files.moveEntries}
                onImportLocalDrop={files.importDroppedItems}
                onCollapse={() => {
                  appState.sidebarOpen = false;
                }}
                onChangeView={(view) => {
                  updateSurface('library');
                  actions.setLibraryView(view);
                }}
                onOpenFolder={(id) => {
                  updateSurface('library');
                  actions.openFolder(id);
                }}
                onCreate={createForSurface}
                onImport={openFilePicker}
              />
            )}
            {surface === 'files' ? (
              <WorkFilesWorkspace
                actions={files}
                openingPath={openingPath}
                copilotOpen={copilotOpen}
                sidebarOpen={state.sidebarOpen}
                onOpenFile={openLocalFile}
                onAgentRequest={requestAgent}
                onCreateArtifact={(templateId) => void openLocalCreateDialog(templateId)}
                onOpenSidebar={() => {
                  appState.sidebarOpen = true;
                }}
                onToggleCopilot={() => updateCopilotOpen(!copilotOpen)}
              />
            ) : (
              <WorkHome
                artifacts={actions.artifacts}
                folders={actions.folders}
                view={actions.libraryView}
                activeFolderId={actions.activeFolderId}
                loading={actions.loading}
                error={actions.loadError}
                sidebarOpen={state.sidebarOpen}
                onOpenSidebar={() => {
                  appState.sidebarOpen = true;
                }}
                onCreate={(templateId) => void actions.createArtifact(templateId)}
                onOpen={(id) => void actions.openArtifact(id)}
                onImport={openFilePicker}
                onToggleFavorite={actions.toggleFavorite}
                onRename={(id, title) => void actions.patchStoredArtifact(id, { title: title.trim() })}
                onCopy={(id) => void actions.copyArtifact(id)}
                onMove={(id, folderId) => void actions.patchStoredArtifact(id, { folderId })}
                onRestore={(id) => void actions.restoreArtifact(id)}
                onDelete={(artifact) => void actions.removeArtifact(artifact.id)}
                onOpenFolder={actions.openFolder}
                onCreateFolder={(name) => void actions.createFolder(name)}
                onRenameFolder={(id, name) => void actions.patchFolder(id, { name: name.trim() })}
                onRestoreFolder={(id) => void actions.restoreFolder(id)}
                onDeleteFolder={(folder) => void actions.removeFolder(folder.id)}
                onRetry={() => void actions.refresh()}
              />
            )}
          </>
        )}
      </div>
      {copilotOpen && (
        <WorkCopilot
          actions={codeActions}
          workspaceRoot={files.rootPath}
          currentPath={files.currentPath}
          onClose={() => updateCopilotOpen(false)}
          onPickRoot={async () => {
            await files.pickRoot();
          }}
          onAgentRequest={requestAgent}
          proposal={agentProposal}
          onDismissProposal={() => setAgentProposal(null)}
        />
      )}
    </section>
  );
}

function readSurface(): 'files' | 'library' {
  try {
    return localStorage.getItem(surfaceStorageKey) === 'library' ? 'library' : 'files';
  } catch {
    return 'files';
  }
}

function readCopilotOpen(): boolean {
  try {
    return localStorage.getItem(copilotStorageKey) !== 'false';
  } catch {
    return true;
  }
}

function persistValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The current product state remains usable when browser storage is unavailable.
  }
}
