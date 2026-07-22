import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { WorkspaceFileCatalog } from '../../../types/api';
import type { WorkspaceActions } from '../workspace-actions';
import { fileEditorTabId } from '../workspace-state';
import { WorkspaceQuickOpen } from './workspace-quick-open';

describe('WorkspaceQuickOpen', () => {
  beforeEach(() => {
    appState.activeSessionId = 'task-1';
    appState.workspaceRoot = '/repo';
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    appState.fileQuickOpenOpen = true;
  });

  afterEach(() => {
    cleanup();
    appState.activeSessionId = null;
    appState.workspaceRoot = '';
    appState.editorTabs = [];
    appState.activeEditorTabId = null;
    appState.fileQuickOpenOpen = false;
  });

  it('puts open files first and opens the keyboard-selected result', async () => {
    const readmeId = fileEditorTabId('/repo/README.md');
    appState.editorTabs = [fileTab('/repo/README.md')];
    appState.activeEditorTabId = readmeId;
    const findWorkspaceFiles = vi
      .fn()
      .mockResolvedValue(catalog([file('/repo/src/app.ts', 'src/app.ts'), file('/repo/README.md', 'README.md')]));
    const selectFile = vi.fn().mockResolvedValue(true);

    render(<WorkspaceQuickOpen actions={{ findWorkspaceFiles, selectFile } as unknown as WorkspaceActions} />);

    const input = screen.getByRole('combobox', { name: '按文件名或路径搜索' });
    expect(input).toHaveFocus();
    await screen.findByRole('option', { name: /README\.md/ });
    await screen.findByRole('option', { name: /app\.ts/ });
    expect(screen.getAllByRole('option')[0]).toHaveAccessibleName(/README\.md.*已打开/);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(selectFile).toHaveBeenCalledWith({ path: '/repo/src/app.ts', isBinary: false }));
    expect(appState.fileQuickOpenOpen).toBe(false);
  });

  it('publishes only the newest debounced query response', async () => {
    const first = deferred<WorkspaceFileCatalog>();
    const second = deferred<WorkspaceFileCatalog>();
    const findWorkspaceFiles = vi.fn((query: string) => {
      if (!query) return Promise.resolve(catalog([]));
      return query === 'a' ? first.promise : second.promise;
    });

    render(<WorkspaceQuickOpen actions={{ findWorkspaceFiles, selectFile: vi.fn() } as unknown as WorkspaceActions} />);
    const input = screen.getByRole('combobox', { name: '按文件名或路径搜索' });
    fireEvent.change(input, { target: { value: 'a' } });
    await waitFor(() => expect(findWorkspaceFiles).toHaveBeenCalledWith('a', 120));
    fireEvent.change(input, { target: { value: 'app' } });
    await waitFor(() => expect(findWorkspaceFiles).toHaveBeenCalledWith('app', 120));

    await act(async () => second.resolve(catalog([file('/repo/src/app.ts', 'src/app.ts')])));
    expect(await screen.findByRole('option', { name: /app\.ts/ })).toBeInTheDocument();
    await act(async () => first.resolve(catalog([file('/repo/archive.txt', 'archive.txt')])));
    expect(screen.queryByRole('option', { name: /archive\.txt/ })).not.toBeInTheDocument();
  });

  it('reports truncation and retries a recoverable catalog failure', async () => {
    const findWorkspaceFiles = vi
      .fn()
      .mockRejectedValueOnce(new Error('index unavailable'))
      .mockResolvedValueOnce({
        ...catalog([file('/repo/src/recovered.ts', 'src/recovered.ts')]),
        total: 321,
        truncated: true,
      });

    render(<WorkspaceQuickOpen actions={{ findWorkspaceFiles, selectFile: vi.fn() } as unknown as WorkspaceActions} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('index unavailable');
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(await screen.findByRole('option', { name: /recovered\.ts/ })).toBeInTheDocument();
    expect(screen.getByText('显示前 1 / 321 个结果，请继续输入以缩小范围')).toBeInTheDocument();
  });

  it('announces binary file status as part of the result name', async () => {
    const findWorkspaceFiles = vi
      .fn()
      .mockResolvedValue(catalog([file('/repo/public/logo.png', 'public/logo.png', true)]));

    render(<WorkspaceQuickOpen actions={{ findWorkspaceFiles, selectFile: vi.fn() } as unknown as WorkspaceActions} />);

    expect(await screen.findByRole('option', { name: /logo\.png.*二进制/ })).toBeInTheDocument();
  });
});

function catalog(items: WorkspaceFileCatalog['items']): WorkspaceFileCatalog {
  return { workspaceRoot: '/repo', items, total: items.length, truncated: false };
}

function file(path: string, relativePath: string, isBinary = false) {
  return { path, relativePath, name: relativePath.split('/').pop() ?? relativePath, isBinary };
}

function fileTab(path: string) {
  return {
    id: fileEditorTabId(path),
    kind: 'file' as const,
    path,
    content: '',
    draft: '',
    revision: null,
    isBinary: false,
    location: null,
    loading: false,
    loadError: null,
    saving: false,
    configValidation: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
