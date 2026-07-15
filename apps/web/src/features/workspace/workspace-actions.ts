import type { WorkspaceFileSelection } from './workspace-state';

export interface WorkspaceActions {
  refreshDirectory(path?: string): Promise<void>;
  toggleDirectory(path: string): Promise<void>;
  selectFile(file: WorkspaceFileSelection): Promise<boolean>;
  activateEditorTab(tabId: string): void;
  closeEditorTab(tabId: string): void;
  confirmEditorTabClose(): void;
  cancelEditorTabClose(): void;
  updateEditorDraft(tabId: string, content: string): void;
  saveEditorTab(tabId?: string): Promise<boolean>;
  resolveFileConflict(resolution: 'reload' | 'overwrite'): Promise<void>;
  cancelFileConflict(): void;
  validateActiveConfig(): Promise<void>;
  createWorkspaceEntry(parent: string, name: string, kind: 'file' | 'directory'): Promise<void>;
  renameWorkspaceEntry(path: string, name: string): Promise<void>;
  copyWorkspaceEntry(path: string, name: string): Promise<void>;
  deleteWorkspaceEntry(path: string): Promise<void>;
  searchWorkspace(query: string): Promise<void>;
  replaceWorkspace(query: string, replacement: string, filePaths: string[]): Promise<void>;
  refreshGitStatus(): Promise<void>;
  loadGitDiff(path: string, staged?: boolean): Promise<void>;
  setGitStaged(paths: string[], staged: boolean): Promise<void>;
  commitGitChanges(message: string): Promise<void>;
}
