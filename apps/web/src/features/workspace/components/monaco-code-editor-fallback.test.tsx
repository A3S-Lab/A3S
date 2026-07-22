import { act, cleanup, render, waitFor } from '@testing-library/react';
import * as monaco from 'monaco-editor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, codeApi } from '../../../lib/api';
import type { CodeIntelligenceStatus } from '../../../types/api';
import { MonacoCodeEditor } from './monaco-code-editor';
import { workspaceEditorModelPath } from './monaco-editor-model-store';

const testMonaco = monaco as unknown as {
  __actions: Array<{ id: string; run: () => void | Promise<void> }>;
  __documentSymbolProviders: Array<{
    languageSelector: string;
    provider: {
      provideDocumentSymbols: (model: unknown, token: unknown) => Promise<unknown>;
    };
  }>;
  __model: unknown;
  editor: { setModelMarkers: ReturnType<typeof vi.fn> };
};

const readyStatus: CodeIntelligenceStatus = {
  state: 'ready',
  capabilities: {
    documentSymbols: true,
    workspaceSymbols: true,
    definition: true,
    declaration: true,
    references: true,
    implementations: true,
    diagnostics: true,
  },
  languages: [],
  message: null,
};

describe('Monaco unsupported-language fallback', () => {
  beforeEach(() => {
    testMonaco.__actions.splice(0);
    testMonaco.__documentSymbolProviders.splice(0);
    testMonaco.editor.setModelMarkers.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps unsupported saved-document diagnostics out of the status bar', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockRejectedValue(currentUnsupportedError());
    const onStatusChange = vi.fn();

    renderEditor({ onStatusChange });

    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('本地编辑功能可用'));
    expect(testMonaco.editor.setModelMarkers).toHaveBeenLastCalledWith(testMonaco.__model, 'a3s-code-intelligence', []);
    expect(statusHistory(onStatusChange)).not.toContain('CODE_INTELLIGENCE_UNSUPPORTED');
    expect(statusHistory(onStatusChange)).not.toContain('no language profile');
  });

  it('returns no native symbols quietly so Monaco JSON outline providers remain usable', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue(emptyDiagnostics());
    const outline = vi.spyOn(codeApi, 'codeOutline').mockRejectedValue(normalizedUnsupportedError());
    const onStatusChange = vi.fn();

    renderEditor({ onStatusChange });
    await waitFor(() => expect(testMonaco.__documentSymbolProviders).toHaveLength(1));
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('代码导航就绪 · 0 个问题'));
    onStatusChange.mockClear();

    const registration = testMonaco.__documentSymbolProviders[0];
    const symbols = await registration.provider.provideDocumentSymbols(testMonaco.__model, cancellationToken());

    expect(registration.languageSelector).toBe('json');
    expect(outline).toHaveBeenCalledWith('package.json', expect.any(Object));
    expect(symbols).toEqual([]);
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('reuses a language-level unsupported result across native document operations', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    const diagnostics = vi.spyOn(codeApi, 'codeDiagnostics').mockRejectedValue(currentUnsupportedError());
    const outline = vi.spyOn(codeApi, 'codeOutline').mockRejectedValue(new Error('outline should not be queried'));
    const navigation = vi
      .spyOn(codeApi, 'codeNavigation')
      .mockRejectedValue(new Error('navigation should not be queried'));
    const onStatusChange = vi.fn();

    const view = renderEditor({ onStatusChange });
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('本地编辑功能可用'));

    view.rerender(editorElement({ savedDocument: false, onStatusChange }));
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('本地编辑功能可用'));

    const symbols = await testMonaco.__documentSymbolProviders[0].provider.provideDocumentSymbols(
      testMonaco.__model,
      cancellationToken()
    );
    const action = testMonaco.__actions.find((candidate) => candidate.id === 'a3s.code-navigation.definition');
    await act(async () => action?.run());

    expect(diagnostics).toHaveBeenCalledTimes(1);
    expect(outline).not.toHaveBeenCalled();
    expect(navigation).not.toHaveBeenCalled();
    expect(symbols).toEqual([]);
    expect(onStatusChange).toHaveBeenLastCalledWith('此文件类型不支持定义导航');
  });

  it('keeps genuine diagnostics failures visible without leaking transport details', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockRejectedValue(
      new ApiError('connect ECONNREFUSED 127.0.0.1:3021', 503, { message: 'upstream unavailable' })
    );
    const onStatusChange = vi.fn();

    renderEditor({ onStatusChange });

    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('代码诊断暂时不可用'));
    expect(statusHistory(onStatusChange)).not.toContain('ECONNREFUSED');
    expect(statusHistory(onStatusChange)).not.toContain('upstream unavailable');
  });

  it('reports unsupported cursor navigation as a file-type limitation', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue(emptyDiagnostics());
    vi.spyOn(codeApi, 'codeNavigation').mockRejectedValue(currentUnsupportedError());
    const onStatusChange = vi.fn();

    renderEditor({ onStatusChange });
    await waitFor(() => expect(testMonaco.__actions).not.toHaveLength(0));
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('代码导航就绪 · 0 个问题'));

    const action = testMonaco.__actions.find((candidate) => candidate.id === 'a3s.code-navigation.definition');
    await act(async () => action?.run());

    expect(onStatusChange).toHaveBeenLastCalledWith('此文件类型不支持定义导航');
    expect(statusHistory(onStatusChange)).not.toContain('CODE_INTELLIGENCE_UNSUPPORTED');
  });

  it('keeps genuine outline failures visible without replacing them with backend text', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue(emptyDiagnostics());
    vi.spyOn(codeApi, 'codeOutline').mockRejectedValue(
      new ApiError('socket closed while reading symbols', 502, { message: 'gateway disconnected' })
    );
    const onStatusChange = vi.fn();

    renderEditor({ onStatusChange });
    await waitFor(() => expect(testMonaco.__documentSymbolProviders).toHaveLength(1));
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('代码导航就绪 · 0 个问题'));
    onStatusChange.mockClear();

    await testMonaco.__documentSymbolProviders[0].provider.provideDocumentSymbols(
      testMonaco.__model,
      cancellationToken()
    );

    expect(onStatusChange).toHaveBeenLastCalledWith('文件符号暂时不可用');
    expect(statusHistory(onStatusChange)).not.toContain('socket closed');
    expect(statusHistory(onStatusChange)).not.toContain('gateway disconnected');
  });
});

function renderEditor(
  overrides: Partial<React.ComponentProps<typeof MonacoCodeEditor>> = {}
): ReturnType<typeof render> {
  return render(editorElement(overrides));
}

function editorElement(overrides: Partial<React.ComponentProps<typeof MonacoCodeEditor>> = {}): React.ReactElement {
  return (
    <MonacoCodeEditor
      path='/repo/package.json'
      modelPath={workspaceEditorModelPath('new-task', '/repo/package.json')}
      value='{"scripts": {"test": "vitest"}}'
      location={null}
      readOnly={false}
      dark={false}
      workspaceRoot='/repo'
      sessionId={null}
      savedDocument
      onChange={vi.fn()}
      onSave={vi.fn()}
      onClose={vi.fn()}
      onNavigate={vi.fn(async () => true)}
      onStatusChange={vi.fn()}
      onEditorStatusChange={vi.fn()}
      {...overrides}
    />
  );
}

function emptyDiagnostics() {
  return {
    items: [],
    truncated: false,
    workspaceRevision: 2,
    document: { revision: 1, contentHash: 'hash', stale: false },
  };
}

function currentUnsupportedError(): ApiError {
  return new ApiError(
    "CODE_INTELLIGENCE_UNSUPPORTED: Code Intelligence operation 'language' is unsupported: no language profile supports saved document package.json",
    501,
    {
      statusCode: 501,
      message:
        "CODE_INTELLIGENCE_UNSUPPORTED: Code Intelligence operation 'language' is unsupported: no language profile supports saved document package.json",
      error: 'Not Implemented',
    }
  );
}

function normalizedUnsupportedError(): ApiError {
  return new ApiError('The selected file type has no native language profile', 501, {
    statusCode: 'CODE_INTELLIGENCE_UNSUPPORTED',
    message: 'The selected file type has no native language profile',
  });
}

function cancellationToken(): {
  isCancellationRequested: boolean;
  onCancellationRequested: () => { dispose: () => void };
} {
  return {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: vi.fn() }),
  };
}

function statusHistory(callback: ReturnType<typeof vi.fn>): string {
  return callback.mock.calls.map(([label]) => String(label)).join('\n');
}
