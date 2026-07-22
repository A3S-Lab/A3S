import type { ConfigValidation, GitStatus, WorkspaceEntry, WorkspaceSearchFile } from '../../types/api';
import type { TaskView } from '../code/code-state';
import type { WorkspaceSearchScope } from './workspace-search';

export const workspaceSnapshotsStorageKey = 'a3s-code-web.workspace-task-snapshots';
const workspaceSnapshotsStorageVersion = 1;

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
  revision: string | null;
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
export type WorkspacePresentation = 'docked' | 'fullscreen';

export interface WorkspaceTaskState {
  editorModelScope: string;
  workspacePresentation: WorkspacePresentation;
  reviewSourceTaskId: string | null;
  reviewIntent: 'review' | 'select-context';
  workspaceSearchResults: WorkspaceSearchFile[];
  workspaceSearchQuery: string;
  workspaceSearchScope: WorkspaceSearchScope;
  workspaceSearchResultScope: WorkspaceSearchScope | null;
  workspaceSearchResultRoot: string | null;
  workspaceSearchResultsTruncated: boolean;
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
  fileConflict: { tabId: string; path: string; diskContent: string; diskRevision: string | null } | null;
  workspaceReplaceLoading: boolean;
}

export interface WorkspaceTaskSnapshot {
  taskView: TaskView;
  state: WorkspaceTaskState;
}

export interface WorkspaceState extends WorkspaceTaskState {
  workspaceSnapshotsByTask: Record<string, WorkspaceTaskSnapshot>;
  workspaceGeneration: number;
}

export function createWorkspaceTaskState(workspaceRoot = ''): WorkspaceTaskState {
  return {
    editorModelScope: createEditorModelScope(),
    workspacePresentation: 'docked',
    reviewSourceTaskId: null,
    reviewIntent: 'review',
    workspaceSearchResults: [],
    workspaceSearchQuery: '',
    workspaceSearchScope: 'source',
    workspaceSearchResultScope: null,
    workspaceSearchResultRoot: null,
    workspaceSearchResultsTruncated: false,
    workspaceSearchLoading: false,
    workspaceSearchError: null,
    gitStatus: null,
    gitStatusLoading: false,
    gitStatusError: null,
    gitDiffError: null,
    gitActionLoading: false,
    lastCommitReceipt: null,
    workspaceRoot,
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

export function createWorkspaceState(activeTaskKey?: string): WorkspaceState {
  const workspaceSnapshotsByTask = readWorkspaceTaskSnapshots();
  const activeSnapshot = activeTaskKey ? workspaceSnapshotsByTask[activeTaskKey] : undefined;
  return {
    ...(activeSnapshot ? cloneWorkspaceTaskState(activeSnapshot.state) : createWorkspaceTaskState()),
    workspaceSnapshotsByTask,
    workspaceGeneration: 0,
  };
}

export function persistWorkspaceTaskSnapshots(
  snapshots: Readonly<Record<string, WorkspaceTaskSnapshot>>,
  activeTaskKey: string,
  activeState: WorkspaceTaskState,
  activeTaskView: TaskView
): boolean {
  const nextSnapshots = Object.fromEntries(
    Object.entries(snapshots).map(([key, snapshot]) => [
      key,
      captureWorkspaceTaskSnapshot(snapshot.state, snapshot.taskView),
    ])
  );
  nextSnapshots[activeTaskKey] = captureWorkspaceTaskSnapshot(activeState, activeTaskView);
  const payload = { version: workspaceSnapshotsStorageVersion, snapshots: nextSnapshots };
  if (writeWorkspaceTaskSnapshots(payload)) return true;

  const recoveryPayload = {
    version: workspaceSnapshotsStorageVersion,
    snapshots: Object.fromEntries(
      Object.entries(nextSnapshots).map(([key, snapshot]) => [key, compactWorkspaceSnapshot(snapshot)])
    ),
  };
  return writeWorkspaceTaskSnapshots(recoveryPayload);
}

function readWorkspaceTaskSnapshots(): Record<string, WorkspaceTaskSnapshot> {
  try {
    const parsed = JSON.parse(localStorage.getItem(workspaceSnapshotsStorageKey) ?? 'null') as unknown;
    if (!isRecord(parsed) || parsed.version !== workspaceSnapshotsStorageVersion || !isRecord(parsed.snapshots)) {
      return {};
    }
    const snapshots: Record<string, WorkspaceTaskSnapshot> = {};
    for (const [key, value] of Object.entries(parsed.snapshots)) {
      const snapshot = normalizeWorkspaceTaskSnapshot(value);
      if (snapshot) snapshots[key] = snapshot;
    }
    return snapshots;
  } catch {
    return {};
  }
}

function writeWorkspaceTaskSnapshots(payload: {
  version: number;
  snapshots: Record<string, WorkspaceTaskSnapshot>;
}): boolean {
  try {
    const serialized = JSON.stringify(payload);
    if (localStorage.getItem(workspaceSnapshotsStorageKey) !== serialized) {
      localStorage.setItem(workspaceSnapshotsStorageKey, serialized);
    }
    return true;
  } catch {
    return false;
  }
}

function normalizeWorkspaceTaskSnapshot(value: unknown): WorkspaceTaskSnapshot | null {
  if (!isRecord(value) || !isTaskView(value.taskView) || !isWorkspaceTaskStateShape(value.state)) return null;
  try {
    const snapshot = captureWorkspaceTaskSnapshot(value.state as unknown as WorkspaceTaskState, value.taskView);
    return snapshot.state.editorTabs.every(isWorkspaceEditorTab) ? snapshot : null;
  } catch {
    return null;
  }
}

function isWorkspaceTaskStateShape(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const arrayKeys = ['workspaceSearchResults', 'editorTabs'] as const;
  const recordKeys = ['filesByDirectory', 'expandedDirectories', 'directoryLoading', 'directoryErrors'] as const;
  if (!arrayKeys.every((key) => Array.isArray(value[key]))) return false;
  if (!recordKeys.every((key) => isRecord(value[key]))) return false;
  const filesByDirectory = value.filesByDirectory;
  if (!isRecord(filesByDirectory) || !Object.values(filesByDirectory).every(Array.isArray)) return false;
  if (typeof value.workspaceRoot !== 'string' || typeof value.workspaceSearchQuery !== 'string') return false;
  return (value.workspaceSearchResults as unknown[]).every((file) => isRecord(file) && Array.isArray(file.matches));
}

function isWorkspaceEditorTab(value: WorkspaceEditorTab): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.path !== 'string') return false;
  if (value.kind === 'diff') {
    return (
      typeof value.original === 'string' &&
      typeof value.modified === 'string' &&
      typeof value.unified === 'string' &&
      typeof value.staged === 'boolean'
    );
  }
  return value.kind === 'file' && typeof value.content === 'string' && typeof value.draft === 'string';
}

function isTaskView(value: unknown): value is TaskView {
  return value === 'conversation' || value === 'review' || value === 'activity';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function compactWorkspaceSnapshot(snapshot: WorkspaceTaskSnapshot): WorkspaceTaskSnapshot {
  const state = cloneWorkspaceTaskState(snapshot.state);
  state.workspaceSearchResults = [];
  state.workspaceSearchResultScope = null;
  state.workspaceSearchResultRoot = null;
  state.workspaceSearchResultsTruncated = false;
  state.workspaceSearchError = null;
  state.gitStatus = null;
  state.gitStatusError = null;
  state.gitDiffError = null;
  state.filesByDirectory = {};
  state.directoryLoading = {};
  state.directoryErrors = {};
  state.fileLoadError = null;
  state.fileConflict = null;
  state.pendingEditorTabCloseId = null;
  state.editorTabs = state.editorTabs.map(compactEditorTab);
  return { taskView: snapshot.taskView, state };
}

function compactEditorTab(tab: WorkspaceEditorTab): WorkspaceEditorTab {
  if (tab.kind === 'diff') {
    return {
      ...tab,
      original: '',
      modified: '',
      unified: '',
      loading: false,
      loadError: '差异内容未随刷新恢复，请重试。',
    };
  }
  if (isFileEditorTabDirty(tab)) {
    return { ...tab, loading: false, saving: false, configValidation: null };
  }
  return {
    ...tab,
    content: '',
    draft: '',
    loading: false,
    loadError: '文件内容未随刷新恢复，请重试。',
    saving: false,
    configValidation: null,
  };
}

export function captureWorkspaceTaskSnapshot(state: WorkspaceTaskState, taskView: TaskView): WorkspaceTaskSnapshot {
  return { taskView, state: cloneWorkspaceTaskState(state) };
}

export function restoreWorkspaceTaskState(target: WorkspaceTaskState, source: WorkspaceTaskState): void {
  Object.assign(target, cloneWorkspaceTaskState(source));
}

function cloneWorkspaceTaskState(state: WorkspaceTaskState): WorkspaceTaskState {
  return {
    editorModelScope:
      typeof state.editorModelScope === 'string' && state.editorModelScope.trim()
        ? state.editorModelScope
        : createEditorModelScope(),
    workspacePresentation: state.workspacePresentation === 'fullscreen' ? 'fullscreen' : 'docked',
    reviewSourceTaskId: state.reviewSourceTaskId,
    reviewIntent: state.reviewIntent,
    workspaceSearchResults: state.workspaceSearchResults.map((file) => ({
      ...file,
      matches: file.matches.map((match) => ({ ...match })),
    })),
    workspaceSearchQuery: state.workspaceSearchQuery,
    workspaceSearchScope: state.workspaceSearchScope,
    workspaceSearchResultScope: state.workspaceSearchResultScope,
    workspaceSearchResultRoot: state.workspaceSearchResultRoot,
    workspaceSearchResultsTruncated: state.workspaceSearchResultsTruncated,
    workspaceSearchLoading: false,
    workspaceSearchError: state.workspaceSearchError,
    gitStatus: state.gitStatus
      ? { ...state.gitStatus, files: state.gitStatus.files.map((file) => ({ ...file })) }
      : null,
    gitStatusLoading: false,
    gitStatusError: state.gitStatusError,
    gitDiffError: state.gitDiffError ? { ...state.gitDiffError } : null,
    gitActionLoading: false,
    lastCommitReceipt: state.lastCommitReceipt ? { ...state.lastCommitReceipt } : null,
    workspaceRoot: state.workspaceRoot,
    filesByDirectory: Object.fromEntries(
      Object.entries(state.filesByDirectory).map(([path, entries]) => [path, entries.map((entry) => ({ ...entry }))])
    ),
    expandedDirectories: { ...state.expandedDirectories },
    directoryLoading: Object.fromEntries(Object.keys(state.directoryLoading).map((path) => [path, false])),
    directoryErrors: { ...state.directoryErrors },
    editorTabs: state.editorTabs.map(cloneEditorTab),
    activeEditorTabId: state.activeEditorTabId,
    pendingEditorTabCloseId: state.pendingEditorTabCloseId,
    fileLoadError: state.fileLoadError
      ? { selection: { ...state.fileLoadError.selection }, message: state.fileLoadError.message }
      : null,
    fileConflict: state.fileConflict
      ? {
          ...state.fileConflict,
          diskRevision: typeof state.fileConflict.diskRevision === 'string' ? state.fileConflict.diskRevision : null,
        }
      : null,
    workspaceReplaceLoading: false,
  };
}

function cloneEditorTab(tab: WorkspaceEditorTab): WorkspaceEditorTab {
  if (tab.kind === 'diff') {
    return {
      ...tab,
      loading: false,
      loadError: tab.loadError ?? (tab.loading ? '差异加载已暂停，请重试。' : null),
    };
  }
  return {
    ...tab,
    revision: typeof tab.revision === 'string' ? tab.revision : null,
    location: tab.location ? { ...tab.location } : null,
    loading: false,
    loadError: tab.loadError ?? (tab.loading ? '文件加载已暂停，请重试。' : null),
    saving: false,
    configValidation: tab.configValidation
      ? {
          ...tab.configValidation,
          issues: [...tab.configValidation.issues],
          summary: tab.configValidation.summary ? { ...tab.configValidation.summary } : tab.configValidation.summary,
        }
      : null,
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

export function workspaceAbsolutePath(path: string, root: string): string {
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return path;
  if (!root) return path;
  const separator = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  return `${root.replace(/[\\/]$/, '')}${separator}${path}`;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

let editorModelScopeSequence = 0;

function createEditorModelScope(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  editorModelScopeSequence += 1;
  return `workspace-${Date.now().toString(36)}-${editorModelScopeSequence.toString(36)}`;
}
