import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as monaco from 'monaco-editor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../../lib/api';
import type { CodeIntelligenceStatus } from '../../../types/api';
import { MonacoCodeEditor } from './monaco-code-editor';

const testMonaco = monaco as unknown as {
  __actions: Array<{ id: string; run: () => void | Promise<void> }>;
  __documentSymbolProviders: Array<{
    languageSelector: string;
    provider: {
      displayName?: string;
      provideDocumentSymbols: (model: unknown, token: unknown) => Promise<unknown>;
    };
  }>;
  __position: { lineNumber: number; column: number };
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

const startingStatus: CodeIntelligenceStatus = {
  state: 'starting',
  capabilities: {
    documentSymbols: false,
    workspaceSymbols: false,
    definition: false,
    declaration: false,
    references: false,
    implementations: false,
    diagnostics: false,
  },
  languages: [],
  message: 'Starts on first semantic query',
};

const unavailableStatus: CodeIntelligenceStatus = {
  ...startingStatus,
  state: 'unavailable',
  message: '代码导航运行时已停止',
};

describe('Monaco code-intelligence bridge', () => {
  beforeEach(() => {
    testMonaco.__actions.splice(0);
    testMonaco.__documentSymbolProviders.splice(0);
    testMonaco.__position = { lineNumber: 1, column: 1 };
    testMonaco.editor.setModelMarkers.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads saved-document diagnostics into the existing Monaco model', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [
        {
          location: {
            path: 'src/app.ts',
            range: {
              start: { line: 1, character: 2 },
              end: { line: 1, character: 6 },
            },
          },
          severity: 'error',
          code: 'E100',
          source: 'rust',
          message: 'Broken expression',
        },
      ],
      truncated: false,
      workspaceRevision: 4,
      document: { revision: 3, contentHash: 'hash', stale: false },
    });
    const onStatusChange = vi.fn();

    renderEditor({ sessionId: 'task/a', onStatusChange });

    await waitFor(() =>
      expect(testMonaco.editor.setModelMarkers).toHaveBeenCalledWith(testMonaco.__model, 'a3s-code-intelligence', [
        expect.objectContaining({
          startLineNumber: 2,
          startColumn: 3,
          endLineNumber: 2,
          endColumn: 7,
          severity: 8,
          message: 'Broken expression',
        }),
      ])
    );
    expect(codeApi.codeDiagnostics).toHaveBeenCalledWith('src/app.ts', {
      sessionId: 'task/a',
      signal: expect.any(AbortSignal),
    });
    expect(onStatusChange).toHaveBeenLastCalledWith('代码导航就绪 · 1 个问题');
  });

  it('starts a dormant runtime with the first diagnostics query', async () => {
    const status = vi
      .spyOn(codeApi, 'codeIntelligenceStatus')
      .mockResolvedValueOnce(startingStatus)
      .mockResolvedValueOnce(readyStatus);
    const diagnostics = vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 1, contentHash: 'hash', stale: false },
    });
    const onStatusChange = vi.fn();

    renderEditor({ onStatusChange });

    await waitFor(() => expect(diagnostics).toHaveBeenCalledWith('src/app.ts', expect.any(Object)));
    await waitFor(() => expect(status).toHaveBeenCalledTimes(2));
    expect(onStatusChange).toHaveBeenLastCalledWith('代码导航就绪 · 0 个问题');
  });

  it('starts a second language while another language is already ready', async () => {
    const mixedStatus: CodeIntelligenceStatus = {
      ...startingStatus,
      state: 'ready',
      languages: [
        { language: 'rust', state: 'ready', capabilities: startingStatus.capabilities, message: null },
        {
          language: 'typescript-javascript',
          state: 'starting',
          capabilities: startingStatus.capabilities,
          message: 'Starts on first semantic query',
        },
      ],
    };
    const status = vi
      .spyOn(codeApi, 'codeIntelligenceStatus')
      .mockResolvedValueOnce(mixedStatus)
      .mockResolvedValueOnce(readyStatus);
    const diagnostics = vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 1, contentHash: 'hash', stale: false },
    });

    renderEditor();

    await waitFor(() => expect(diagnostics).toHaveBeenCalledWith('src/app.ts', expect.any(Object)));
    await waitFor(() => expect(status).toHaveBeenCalledTimes(2));
  });

  it('does not label a runtime unavailable after startup as ready', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus')
      .mockResolvedValueOnce(startingStatus)
      .mockResolvedValueOnce(unavailableStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 1, contentHash: 'hash', stale: false },
    });
    const onStatusChange = vi.fn();

    renderEditor({ onStatusChange });

    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('代码导航运行时已停止 · 0 个问题'));
  });

  it('retries an unavailable runtime and reports recovery after the query', async () => {
    const status = vi
      .spyOn(codeApi, 'codeIntelligenceStatus')
      .mockResolvedValueOnce(unavailableStatus)
      .mockResolvedValueOnce(readyStatus);
    const diagnostics = vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 3,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });
    const onStatusChange = vi.fn();

    renderEditor({ onStatusChange });

    await waitFor(() => expect(diagnostics).toHaveBeenCalledWith('src/app.ts', expect.any(Object)));
    await waitFor(() => expect(status).toHaveBeenCalledTimes(2));
    expect(onStatusChange).toHaveBeenLastCalledWith('代码导航就绪 · 0 个问题');
  });

  it('keeps a successful navigation result but reports a post-query runtime failure', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus')
      .mockResolvedValueOnce(startingStatus)
      .mockResolvedValueOnce(startingStatus)
      .mockResolvedValueOnce(unavailableStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 1, contentHash: 'hash', stale: false },
    });
    vi.spyOn(codeApi, 'codeNavigation').mockResolvedValue({
      items: [
        {
          path: 'src/target.ts',
          range: {
            start: { line: 2, character: 1 },
            end: { line: 2, character: 4 },
          },
        },
      ],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 1, contentHash: 'hash', stale: false },
    });
    const onNavigate = vi.fn(async () => true);
    const onStatusChange = vi.fn();
    renderEditor({ onNavigate, onStatusChange });
    await waitFor(() => expect(codeApi.codeIntelligenceStatus).toHaveBeenCalledTimes(2));

    const action = testMonaco.__actions.find((candidate) => candidate.id === 'a3s.code-navigation.definition');
    await act(async () => action?.run());

    expect(onNavigate).toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith('已打开定义 · 代码导航运行时已停止');
  });

  it('reports a post-query runtime failure when navigation has no target', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus')
      .mockResolvedValueOnce(startingStatus)
      .mockResolvedValueOnce(startingStatus)
      .mockResolvedValueOnce(unavailableStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 1, contentHash: 'hash', stale: false },
    });
    vi.spyOn(codeApi, 'codeNavigation').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 1, contentHash: 'hash', stale: false },
    });
    const onStatusChange = vi.fn();
    renderEditor({ onStatusChange });
    await waitFor(() => expect(codeApi.codeIntelligenceStatus).toHaveBeenCalledTimes(2));

    const action = testMonaco.__actions.find((candidate) => candidate.id === 'a3s.code-navigation.definition');
    await act(async () => action?.run());

    expect(onStatusChange).toHaveBeenLastCalledWith('未找到定义 · 代码导航运行时已停止');
  });

  it('routes a definition result through the existing workspace file selection', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });
    vi.spyOn(codeApi, 'codeNavigation').mockResolvedValue({
      items: [
        {
          path: 'src/target.ts',
          range: {
            start: { line: 7, character: 2 },
            end: { line: 7, character: 8 },
          },
        },
      ],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });
    const onNavigate = vi.fn(async () => true);
    renderEditor({ sessionId: 'task/a', onNavigate });
    await waitFor(() => expect(codeApi.codeIntelligenceStatus).toHaveBeenCalled());
    testMonaco.__position = { lineNumber: 4, column: 6 };

    const action = testMonaco.__actions.find((candidate) => candidate.id === 'a3s.code-navigation.definition');
    expect(action).toBeDefined();
    await act(async () => action?.run());

    expect(codeApi.codeNavigation).toHaveBeenCalledWith('src/app.ts', 3, 5, 'definition', {
      sessionId: 'task/a',
      signal: expect.any(AbortSignal),
    });
    expect(onNavigate).toHaveBeenCalledWith({
      path: '/repo/src/target.ts',
      isBinary: false,
      line: 8,
      column: 3,
    });
  });

  it('offers every navigation location and opens the selected result', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });
    vi.spyOn(codeApi, 'codeNavigation').mockResolvedValue({
      items: [
        {
          path: 'src/first.ts',
          range: {
            start: { line: 1, character: 2 },
            end: { line: 1, character: 7 },
          },
        },
        {
          path: 'src/second.ts',
          range: {
            start: { line: 8, character: 4 },
            end: { line: 8, character: 10 },
          },
        },
      ],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });
    const onNavigate = vi.fn(async () => true);
    const onStatusChange = vi.fn();
    renderEditor({ onNavigate, onStatusChange });
    await waitFor(() => expect(codeApi.codeIntelligenceStatus).toHaveBeenCalled());

    const action = testMonaco.__actions.find((candidate) => candidate.id === 'a3s.code-navigation.references');
    await act(async () => action?.run());

    expect(onNavigate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: '引用导航结果' });
    const firstResult = screen.getByRole('button', { name: /src\/first\.ts/ });
    expect(dialog).toBeInTheDocument();
    expect(firstResult).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: '关闭导航结果' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(firstResult).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: /src\/second\.ts/ }));

    expect(onNavigate).toHaveBeenCalledWith({
      path: '/repo/src/second.ts',
      isBinary: false,
      line: 9,
      column: 5,
    });
    expect(screen.queryByRole('dialog', { name: '引用导航结果' })).not.toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith('已打开引用');
  });

  it('keeps only the latest navigation request when an older response arrives late', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });
    const first = deferredNavigationResult();
    const second = deferredNavigationResult();
    const navigation = vi
      .spyOn(codeApi, 'codeNavigation')
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const onNavigate = vi.fn(async () => true);
    renderEditor({ onNavigate });
    await waitFor(() => expect(codeApi.codeIntelligenceStatus).toHaveBeenCalled());
    const action = testMonaco.__actions.find((candidate) => candidate.id === 'a3s.code-navigation.definition');

    const firstRun = action?.run();
    await waitFor(() => expect(navigation).toHaveBeenCalledTimes(1));
    const firstSignal = navigation.mock.calls[0][4]?.signal;
    const secondRun = action?.run();
    await waitFor(() => expect(navigation).toHaveBeenCalledTimes(2));
    expect(firstSignal?.aborted).toBe(true);
    second.resolve(navigationResult('src/latest.ts'));
    await act(async () => secondRun);
    first.resolve({
      ...navigationResult('src/stale-a.ts'),
      items: [navigationResult('src/stale-a.ts').items[0], navigationResult('src/stale-b.ts').items[0]],
    });
    await act(async () => firstRun);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ path: '/repo/src/latest.ts' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('registers a saved-document outline provider with recursive UTF-16 ranges', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });
    const outline = vi.spyOn(codeApi, 'codeOutline').mockResolvedValue({
      items: [
        {
          name: 'Example',
          detail: 'struct',
          kind: 'struct',
          range: {
            start: { line: 1, character: 2 },
            end: { line: 8, character: 1 },
          },
          selectionRange: {
            start: { line: 1, character: 9 },
            end: { line: 1, character: 16 },
          },
          children: [
            {
              name: 'run',
              detail: null,
              kind: 'method',
              range: {
                start: { line: 3, character: 2 },
                end: { line: 5, character: 3 },
              },
              selectionRange: {
                start: { line: 3, character: 5 },
                end: { line: 3, character: 8 },
              },
              children: [],
            },
          ],
        },
      ],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });
    const onStatusChange = vi.fn();
    renderEditor({ sessionId: 'task/a', savedDocument: false, onStatusChange });
    await waitFor(() => expect(testMonaco.__documentSymbolProviders).toHaveLength(1));
    await waitFor(() => expect(codeApi.codeIntelligenceStatus).toHaveBeenCalled());

    const registration = testMonaco.__documentSymbolProviders[0];
    onStatusChange.mockClear();
    const symbols = await registration.provider.provideDocumentSymbols(testMonaco.__model, cancellationToken());

    expect(registration.languageSelector).toBe('typescript');
    expect(registration.provider.displayName).toBe('Code Intelligence');
    expect(outline).toHaveBeenCalledWith('src/app.ts', {
      sessionId: 'task/a',
      signal: expect.any(AbortSignal),
    });
    expect(symbols).toEqual([
      expect.objectContaining({
        name: 'Example',
        detail: 'struct',
        kind: 22,
        range: { startLineNumber: 2, startColumn: 3, endLineNumber: 9, endColumn: 2 },
        selectionRange: { startLineNumber: 2, startColumn: 10, endLineNumber: 2, endColumn: 17 },
        children: [
          expect.objectContaining({
            name: 'run',
            kind: 5,
            range: { startLineNumber: 4, startColumn: 3, endLineNumber: 6, endColumn: 4 },
          }),
        ],
      }),
    ]);
    expect(onStatusChange).toHaveBeenLastCalledWith('代码导航就绪 · 0 个问题 · 基于已保存版本');
  });

  it('does not query a file outside the served workspace', async () => {
    const status = vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    const diagnostics = vi.spyOn(codeApi, 'codeDiagnostics');
    const onStatusChange = vi.fn();

    renderEditor({ path: '/other/app.ts', onStatusChange });

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('代码导航不可用：文件不在工作区内'));
    expect(status).not.toHaveBeenCalled();
    expect(diagnostics).not.toHaveBeenCalled();
  });

  it('labels dirty-buffer results as based on the saved document', async () => {
    vi.spyOn(codeApi, 'codeIntelligenceStatus').mockResolvedValue(readyStatus);
    vi.spyOn(codeApi, 'codeDiagnostics').mockResolvedValue({
      items: [],
      truncated: false,
      workspaceRevision: 2,
      document: { revision: 2, contentHash: 'hash', stale: false },
    });
    const onStatusChange = vi.fn();

    renderEditor({ savedDocument: false, onStatusChange });

    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('代码导航就绪 · 0 个问题 · 基于已保存版本'));
  });
});

function renderEditor(
  overrides: Partial<React.ComponentProps<typeof MonacoCodeEditor>> = {}
): ReturnType<typeof render> {
  return render(
    <MonacoCodeEditor
      path='/repo/src/app.ts'
      value='const value = 1;'
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
      {...overrides}
    />
  );
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

function navigationResult(path: string) {
  return {
    items: [
      {
        path,
        range: {
          start: { line: 2, character: 1 },
          end: { line: 2, character: 4 },
        },
      },
    ],
    truncated: false,
    workspaceRevision: 2,
    document: { revision: 2, contentHash: 'hash', stale: false },
  };
}

function deferredNavigationResult() {
  let resolve!: (value: ReturnType<typeof navigationResult>) => void;
  const promise = new Promise<ReturnType<typeof navigationResult>>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
