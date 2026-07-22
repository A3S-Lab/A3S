import type { editor } from 'monaco-editor';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachWorkspaceEditorModel,
  clearWorkspaceEditorModels,
  disposeWorkspaceEditorModelsExcept,
  rebaseWorkspaceEditorModelPath,
  saveWorkspaceEditorModel,
  workspaceEditorModelPath,
} from './monaco-editor-model-store';

describe('workspace Monaco model store', () => {
  afterEach(() => clearWorkspaceEditorModels());

  it('isolates the same file by task scope while preserving its virtual directory and extension', () => {
    const taskA = workspaceEditorModelPath('task-a', '/repo/src/app.ts');
    const taskB = workspaceEditorModelPath('task-b', '/repo/src/app.ts');

    expect(taskA).toBe('a3s-code://workspace/task-a/repo/src/app.ts');
    expect(taskB).toBe('a3s-code://workspace/task-b/repo/src/app.ts');
    expect(taskA).not.toBe(taskB);
    expect(workspaceEditorModelPath('task-a', 'C:\\repo\\src\\app.ts')).toBe(
      'a3s-code://workspace/task-a/C%3A/repo/src/app.ts'
    );
  });

  it('restores a retained view state and disposes only models no longer owned by an open tab', () => {
    const modelA = fakeModel();
    const modelB = fakeModel();
    const stateA = viewState('a');
    const stateB = viewState('b');
    const pathA = workspaceEditorModelPath('task-a', '/repo/a.ts');
    const pathB = workspaceEditorModelPath('task-a', '/repo/b.ts');
    saveWorkspaceEditorModel(pathA, modelA.value, stateA);
    saveWorkspaceEditorModel(pathB, modelB.value, stateB);

    expect(attachWorkspaceEditorModel(pathA, modelA.value)).toBe(stateA);

    disposeWorkspaceEditorModelsExcept(new Set([pathA]));

    expect(modelA.dispose).not.toHaveBeenCalled();
    expect(modelB.dispose).toHaveBeenCalledTimes(1);

    clearWorkspaceEditorModels();
    expect(modelA.dispose).toHaveBeenCalledTimes(1);
    expect(modelB.dispose).toHaveBeenCalledTimes(1);
  });

  it('replaces a stale model instance without losing the saved view state', () => {
    const stale = fakeModel();
    const replacement = fakeModel();
    const state = viewState('saved');
    const path = workspaceEditorModelPath('task-a', '/repo/app.ts');
    saveWorkspaceEditorModel(path, stale.value, state);

    expect(attachWorkspaceEditorModel(path, replacement.value)).toBe(state);
    expect(stale.dispose).toHaveBeenCalledTimes(1);

    clearWorkspaceEditorModels();
    expect(replacement.dispose).toHaveBeenCalledTimes(1);
  });

  it('preserves model identity across rename without colliding with a reopened old path', () => {
    const scope = 'task-a';
    const previousPath = '/repo/src/app.ts';
    const nextPath = '/repo/lib/app.ts';
    const modelPath = workspaceEditorModelPath(scope, previousPath);
    const model = fakeModel();
    saveWorkspaceEditorModel(modelPath, model.value, viewState('renamed'));

    rebaseWorkspaceEditorModelPath(scope, previousPath, nextPath);

    expect(workspaceEditorModelPath(scope, nextPath)).toBe(modelPath);
    disposeWorkspaceEditorModelsExcept(new Set([workspaceEditorModelPath(scope, nextPath)]));
    expect(model.dispose).not.toHaveBeenCalled();

    const reopenedOldPath = workspaceEditorModelPath(scope, previousPath);
    expect(reopenedOldPath).not.toBe(modelPath);
    expect(reopenedOldPath).toBe(`${modelPath}?instance=2`);

    disposeWorkspaceEditorModelsExcept(new Set([reopenedOldPath]));
    expect(model.dispose).toHaveBeenCalledTimes(1);
    expect(workspaceEditorModelPath(scope, previousPath)).toBe(reopenedOldPath);

    disposeWorkspaceEditorModelsExcept(new Set());
    expect(workspaceEditorModelPath(scope, previousPath)).toBe(modelPath);
  });
});

function fakeModel(): { value: editor.ITextModel; dispose: ReturnType<typeof vi.fn> } {
  const dispose = vi.fn();
  let disposed = false;
  dispose.mockImplementation(() => {
    disposed = true;
  });
  return {
    value: {
      dispose,
      isDisposed: () => disposed,
    } as unknown as editor.ITextModel,
    dispose,
  };
}

function viewState(id: string): editor.ICodeEditorViewState {
  return { cursorState: [], viewState: { id } } as unknown as editor.ICodeEditorViewState;
}
