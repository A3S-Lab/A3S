import type { WorkspaceFileCatalog } from '../../types/api';
import type { WorkspaceFileSelection } from './workspace-state';
import type { WorkspaceSearchOptions } from './workspace-search';

export interface WorkspaceActions {
  canNavigateEditorBack: boolean;
  canNavigateEditorForward: boolean;
  refreshDirectory(path?: string): Promise<void>;
  toggleDirectory(path: string): Promise<void>;
  findWorkspaceFiles(query: string, maxResults?: number): Promise<WorkspaceFileCatalog>;
  selectFile(file: WorkspaceFileSelection): Promise<boolean>;
  navigateEditorBack(): Promise<boolean>;
  navigateEditorForward(): Promise<boolean>;
  updateEditorPosition(tabId: string, position: { line: number; column: number }): void;
  consumeEditorLocation(tabId: string): void;
  activateEditorTab(tabId: string): void;
  closeEditorTab(tabId: string): void;
  closeEditorTabs(tabIds: readonly string[]): void;
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
  searchWorkspace(query: string, options: WorkspaceSearchOptions): Promise<void>;
  replaceWorkspace(query: string, replacement: string, filePaths: string[]): Promise<void>;
  refreshGitStatus(): Promise<void>;
  loadGitDiff(path: string, staged?: boolean): Promise<void>;
  setGitStaged(paths: string[], staged: boolean): Promise<void>;
  commitGitChanges(message: string): Promise<void>;
}
