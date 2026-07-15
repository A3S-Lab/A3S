import type { ConfigValidation, GitStatus, WorkspaceEntry, WorkspaceSearchFile } from '../../types/api';

export interface WorkspaceFileSelection {
  path: string;
  isBinary: boolean;
  line?: number;
  column?: number;
}

export interface WorkspaceFileEditorTab {
  id: string;
  kind: 'file';
  path: string;
  content: string;
  draft: string;
  isBinary: boolean;
  location: { line: number; column: number } | null;
  loading: boolean;
  loadError: string | null;
  saving: boolean;
  configValidation: ConfigValidation | null;
}

export interface WorkspaceDiffEditorTab {
  id: string;
  kind: 'diff';
  path: string;
  staged: boolean;
  original: string;
  modified: string;
  unified: string;
  isBinary: boolean;
  loading: boolean;
  loadError: string | null;
}

export type WorkspaceEditorTab = WorkspaceFileEditorTab | WorkspaceDiffEditorTab;

export interface WorkspaceState {
  reviewSourceTaskId: string | null;
  reviewIntent: 'review' | 'select-context';
  workspaceSearchResults: WorkspaceSearchFile[];
  workspaceSearchQuery: string;
  workspaceSearchLoading: boolean;
  workspaceSearchError: string | null;
  gitStatus: GitStatus | null;
  gitStatusLoading: boolean;
  gitStatusError: string | null;
  gitDiffError: { path: string; staged: boolean; message: string } | null;
  gitActionLoading: boolean;
  lastCommitReceipt: { summary: string; message: string; branch: string } | null;
  workspaceRoot: string;
  filesByDirectory: Record<string, WorkspaceEntry[]>;
  expandedDirectories: Record<string, boolean>;
  directoryLoading: Record<string, boolean>;
  directoryErrors: Record<string, string>;
  editorTabs: WorkspaceEditorTab[];
  activeEditorTabId: string | null;
  pendingEditorTabCloseId: string | null;
  fileLoadError: { selection: WorkspaceFileSelection; message: string } | null;
  fileConflict: { tabId: string; path: string; diskContent: string } | null;
  workspaceReplaceLoading: boolean;
}

export function createWorkspaceState(): WorkspaceState {
  return {
    reviewSourceTaskId: null,
    reviewIntent: 'review',
    workspaceSearchResults: [],
    workspaceSearchQuery: '',
    workspaceSearchLoading: false,
    workspaceSearchError: null,
    gitStatus: null,
    gitStatusLoading: false,
    gitStatusError: null,
    gitDiffError: null,
    gitActionLoading: false,
    lastCommitReceipt: null,
    workspaceRoot: '',
    filesByDirectory: {},
    expandedDirectories: {},
    directoryLoading: {},
    directoryErrors: {},
    editorTabs: [],
    activeEditorTabId: null,
    pendingEditorTabCloseId: null,
    fileLoadError: null,
    fileConflict: null,
    workspaceReplaceLoading: false,
  };
}

export function fileEditorTabId(path: string): string {
  return `file:${normalizePath(path)}`;
}

export function diffEditorTabId(path: string, staged: boolean): string {
  return `diff:${staged ? 'staged' : 'working'}:${normalizePath(path)}`;
}

export function isFileEditorTabDirty(tab: Pick<WorkspaceFileEditorTab, 'content' | 'draft'>): boolean {
  return tab.content !== tab.draft;
}

export function workspaceRelativePath(path: string, root: string): string {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(root).replace(/\/$/, '');
  const windows = /^[A-Za-z]:\//.test(normalizedRoot);
  const candidate = windows ? normalizedPath.toLowerCase() : normalizedPath;
  const base = windows ? normalizedRoot.toLowerCase() : normalizedRoot;
  if (candidate === base) return '';
  return candidate.startsWith(`${base}/`) ? normalizedPath.slice(normalizedRoot.length + 1) : normalizedPath;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}
