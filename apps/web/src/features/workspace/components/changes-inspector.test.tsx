import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { ChangesInspector } from './changes-inspector';

describe('ChangesInspector', () => {
  afterEach(() => {
    cleanup();
    appState.gitDiffError = null;
    appState.gitStatusError = null;
  });

  it('uses an explicit commit workflow for staged changes', () => {
    appState.gitStatusLoading = false;
    appState.gitActionLoading = false;
    appState.lastCommitReceipt = null;
    appState.gitStatus = {
      isGitRepo: true,
      branch: 'main',
      files: [{ path: 'src/app.ts', indexStatus: 'M', worktreeStatus: ' ', status: 'M' }],
    };
    const commitGitChanges = vi.fn(async () => undefined);
    const actions = {
      refreshGitStatus: vi.fn(),
      loadGitDiff: vi.fn(),
      setGitStaged: vi.fn(),
      commitGitChanges,
    } as unknown as WorkspaceActions;
    render(<ChangesInspector actions={actions} />);
    expect(screen.getByRole('region', { name: '工作区变更列表' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '提交 (1)' }));
    expect(screen.getByRole('heading', { name: '提交暂存的更改' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '提交说明' }), {
      target: { value: 'feat: complete web workspace' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建提交' }));
    expect(commitGitChanges).toHaveBeenCalledWith('feat: complete web workspace');
  });

  it('keeps a dismissible receipt after a successful commit', () => {
    appState.gitStatusLoading = false;
    appState.gitActionLoading = false;
    appState.gitStatus = { isGitRepo: true, branch: 'main', files: [] };
    appState.lastCommitReceipt = {
      summary: '[main abc1234] feat: complete review',
      message: 'feat: complete review',
      branch: 'main',
    };
    render(<ChangesInspector actions={{ refreshGitStatus: vi.fn() } as unknown as WorkspaceActions} />);
    expect(screen.getByRole('region', { name: '最近提交回执' })).toHaveTextContent('abc1234');
    fireEvent.click(screen.getByRole('button', { name: '关闭提交回执' }));
    expect(appState.lastCommitReceipt).toBeNull();
  });

  it('keeps the commit message and confirmation open when commit fails', async () => {
    appState.gitStatusLoading = false;
    appState.gitActionLoading = false;
    appState.lastCommitReceipt = null;
    appState.gitStatus = {
      isGitRepo: true,
      branch: 'main',
      files: [{ path: 'src/app.ts', indexStatus: 'M', worktreeStatus: ' ', status: 'M' }],
    };
    const commitGitChanges = vi.fn(async () => {
      throw new Error('commit failed');
    });
    render(
      <ChangesInspector actions={{ refreshGitStatus: vi.fn(), commitGitChanges } as unknown as WorkspaceActions} />
    );
    fireEvent.click(screen.getByRole('button', { name: '提交 (1)' }));
    fireEvent.change(screen.getByRole('textbox', { name: '提交说明' }), {
      target: { value: 'fix: preserve commit context' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建提交' }));
    await waitFor(() => expect(commitGitChanges).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: '提交暂存的更改' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '提交说明' })).toHaveValue('fix: preserve commit context');
  });

  it('shows Git load failure instead of pretending the workspace is not a repository', () => {
    appState.gitStatus = null;
    appState.gitStatusLoading = false;
    appState.gitStatusError = 'Git service unavailable';
    appState.gitActionLoading = false;
    const refreshGitStatus = vi.fn(async () => undefined);
    render(<ChangesInspector actions={{ refreshGitStatus } as unknown as WorkspaceActions} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无法读取 Git 状态');
    expect(screen.queryByText('当前工作区不是 Git 仓库')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载 Git 状态' }));
    expect(refreshGitStatus).toHaveBeenCalled();
  });

  it('keeps a failed diff target visible and retryable', () => {
    appState.gitStatusLoading = false;
    appState.gitStatusError = null;
    appState.gitActionLoading = false;
    appState.gitStatus = {
      isGitRepo: true,
      branch: 'main',
      files: [{ path: 'src/app.ts', indexStatus: ' ', worktreeStatus: 'M', status: 'M' }],
    };
    appState.gitDiffError = { path: 'src/app.ts', staged: false, message: 'Diff service unavailable' };
    const loadGitDiff = vi.fn(async () => undefined);

    render(<ChangesInspector actions={{ refreshGitStatus: vi.fn(), loadGitDiff } as unknown as WorkspaceActions} />);

    expect(screen.getByRole('alert')).toHaveTextContent('无法读取 src/app.ts');
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(loadGitDiff).toHaveBeenCalledWith('src/app.ts', false);
  });
});
