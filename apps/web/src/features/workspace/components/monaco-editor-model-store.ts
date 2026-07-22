import type { editor } from 'monaco-editor';

interface WorkspaceEditorModelEntry {
  model: editor.ITextModel;
  viewState: editor.ICodeEditorViewState | null;
}

const workspaceEditorModels = new Map<string, WorkspaceEditorModelEntry>();
const workspaceEditorModelPaths = new Map<string, string>();

// Monaco model URIs are immutable. This idempotent registry keeps one logical
// document on the same URI after a file-system rename and allocates a fresh URI
// if the old path is opened again while the renamed document is still alive.
export function workspaceEditorModelPath(scope: string, path: string): string {
  const logicalPath = defaultWorkspaceEditorModelPath(scope, path);
  const existing = workspaceEditorModelPaths.get(logicalPath);
  if (existing) return existing;

  const assignedPaths = new Set(workspaceEditorModelPaths.values());
  let modelPath = logicalPath;
  let instance = 2;
  while (assignedPaths.has(modelPath) || workspaceEditorModels.has(modelPath)) {
    modelPath = `${logicalPath}?instance=${instance}`;
    instance += 1;
  }
  workspaceEditorModelPaths.set(logicalPath, modelPath);
  return modelPath;
}

export function rebaseWorkspaceEditorModelPath(scope: string, previousPath: string, nextPath: string): void {
  const previousLogicalPath = defaultWorkspaceEditorModelPath(scope, previousPath);
  const nextLogicalPath = defaultWorkspaceEditorModelPath(scope, nextPath);
  if (previousLogicalPath === nextLogicalPath) return;
  const modelPath = workspaceEditorModelPaths.get(previousLogicalPath) ?? workspaceEditorModelPath(scope, previousPath);
  workspaceEditorModelPaths.delete(previousLogicalPath);
  workspaceEditorModelPaths.set(nextLogicalPath, modelPath);
}

function defaultWorkspaceEditorModelPath(scope: string, path: string): string {
  const normalizedScope = encodeURIComponent(scope.trim() || 'workspace');
  const normalizedPath = path
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  return `a3s-code://workspace/${normalizedScope}/${normalizedPath || 'untitled'}`;
}

export function attachWorkspaceEditorModel(
  modelPath: string,
  model: editor.ITextModel
): editor.ICodeEditorViewState | null {
  const retained = workspaceEditorModels.get(modelPath);
  if (!retained) {
    workspaceEditorModels.set(modelPath, { model, viewState: null });
    return null;
  }
  if (retained.model !== model) {
    disposeModel(retained.model);
    retained.model = model;
  }
  return retained.viewState;
}

export function saveWorkspaceEditorModel(
  modelPath: string,
  model: editor.ITextModel,
  viewState: editor.ICodeEditorViewState | null
): void {
  const retained = workspaceEditorModels.get(modelPath);
  if (retained && retained.model !== model) disposeModel(retained.model);
  workspaceEditorModels.set(modelPath, { model, viewState });
}

export function disposeWorkspaceEditorModelsExcept(retainedModelPaths: ReadonlySet<string>): void {
  for (const [modelPath, retained] of workspaceEditorModels) {
    if (retainedModelPaths.has(modelPath)) continue;
    disposeModel(retained.model);
    workspaceEditorModels.delete(modelPath);
  }
  for (const [logicalPath, modelPath] of workspaceEditorModelPaths) {
    if (!retainedModelPaths.has(modelPath)) workspaceEditorModelPaths.delete(logicalPath);
  }
}

export function clearWorkspaceEditorModels(): void {
  disposeWorkspaceEditorModelsExcept(new Set());
  workspaceEditorModelPaths.clear();
}

function disposeModel(model: editor.ITextModel): void {
  if (!model.isDisposed()) model.dispose();
}
