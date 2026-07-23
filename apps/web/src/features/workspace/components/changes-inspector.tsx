import { CheckCircle2, GitBranch, LoaderCircle, RefreshCw, Undo2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import {
  Button,
  Dialog,
  Field,
  IconButton,
  InlineNotice,
  StateView,
  StatusBadge,
} from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { WorkspaceActions } from '../workspace-actions';
import { WorkspaceFileIcon } from './workspace-file-icon';

export function ChangesInspector({
  actions,
  compactOpen = false,
  onCompactClose,
}: {
  actions: WorkspaceActions;
  compactOpen?: boolean;
  onCompactClose?: () => void;
}) {
  const state = useSnapshot(appState);
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  useEffect(() => {
    if (!state.gitStatus && !state.gitStatusLoading) void actions.refreshGitStatus();
  }, [actions, state.gitStatus, state.gitStatusLoading]);
  const status = state.gitStatus;
  const staged = status?.files.filter((file) => Boolean(file.indexStatus.trim() && file.indexStatus !== '?')) ?? [];
  const unstaged =
    status?.files.filter((file) => Boolean(file.worktreeStatus.trim() || file.indexStatus === '?')) ?? [];
  const closeCommit = () => {
    if (appState.gitActionLoading) return;
    setCommitOpen(false);
    setCommitMessage('');
  };
  const commit = async () => {
    const message = commitMessage.trim();
    if (!message || appState.gitActionLoading) return;
    try {
      await actions.commitGitChanges(message);
      closeCommit();
    } catch {
      // Preserve the reviewed commit message and staged selection for retry.
    }
  };
  return (
    <aside className={`changes-inspector ${compactOpen ? 'compact-open' : ''}`} aria-label='变更与 Git'>
      <header>
        <div>
          <span className='eyebrow'>CHANGES</span>
          <strong>{status?.branch || 'Git'}</strong>
        </div>
        <span className='changes-header-actions'>
          {state.gitActionLoading && <output className='changes-busy'>正在处理…</output>}
          <IconButton
            label='刷新 Git 状态'
            disabled={state.gitStatusLoading || state.gitActionLoading}
            onClick={() => {
              void actions.refreshGitStatus();
            }}
          >
            <RefreshCw className={state.gitStatusLoading ? 'spin' : ''} size={15} />
          </IconButton>
          {onCompactClose && (
            <IconButton className='changes-compact-close' label='关闭工作区变更' onClick={onCompactClose}>
              <X size={15} />
            </IconButton>
          )}
        </span>
      </header>
      <section className='changes-scroll' aria-label='工作区变更列表'>
        {state.gitStatusLoading ? (
          <StateView
            className='changes-state'
            size='compact'
            role='status'
            icon={<LoaderCircle className='spin' size={18} />}
            title='读取 Git 状态'
          />
        ) : state.gitStatusError && !status ? (
          <StateView
            className='changes-state'
            size='compact'
            tone='danger'
            role='alert'
            icon={<GitBranch size={22} />}
            title='无法读取 Git 状态'
            description={state.gitStatusError}
            actions={
              <Button
                onClick={() => {
                  void actions.refreshGitStatus();
                }}
              >
                重新加载 Git 状态
              </Button>
            }
          />
        ) : !status?.isGitRepo ? (
          <StateView
            className='changes-state'
            size='compact'
            icon={<GitBranch size={22} />}
            title='当前工作区不是 Git 仓库'
          />
        ) : (
          <>
            {state.gitStatusError && (
              <InlineNotice
                className='changes-inline-notice'
                tone='danger'
                role='alert'
                actions={
                  <Button
                    tone='quiet'
                    type='button'
                    onClick={() => {
                      void actions.refreshGitStatus();
                    }}
                  >
                    重试
                  </Button>
                }
              >
                {state.gitStatusError} 当前仍显示上一次 Git 状态。
              </InlineNotice>
            )}
            {state.gitDiffError && (
              <InlineNotice
                className='changes-inline-notice'
                tone='danger'
                role='alert'
                actions={
                  <Button
                    tone='quiet'
                    type='button'
                    onClick={() => {
                      const error = appState.gitDiffError;
                      if (error) void actions.loadGitDiff(error.path, error.staged);
                    }}
                  >
                    重试
                  </Button>
                }
              >
                无法读取{state.gitDiffError.path ? ` ${state.gitDiffError.path}` : '工作区'}的差异：
                {state.gitDiffError.message}
              </InlineNotice>
            )}
            <ChangeGroup
              title='更改'
              files={unstaged}
              action='暂存'
              onOpen={(path) => {
                void actions.loadGitDiff(path, false);
              }}
              onAction={(path) => {
                void actions.setGitStaged([path], true);
              }}
              disabled={state.gitActionLoading}
            />
            <ChangeGroup
              title='已暂存'
              files={staged}
              action='取消暂存'
              onOpen={(path) => {
                void actions.loadGitDiff(path, true);
              }}
              onAction={(path) => {
                void actions.setGitStaged([path], false);
              }}
              disabled={state.gitActionLoading}
            />
            {!status.files.length && (
              <StateView
                className='changes-state changes-clean'
                size='compact'
                tone='success'
                title={<StatusBadge tone='success'>工作区干净</StatusBadge>}
              />
            )}
          </>
        )}
        {state.lastCommitReceipt && (
          <section className='commit-receipt' aria-label='最近提交回执'>
            <CheckCircle2 size={16} />
            <div>
              <strong>{state.lastCommitReceipt.summary}</strong>
              <span>{state.lastCommitReceipt.message}</span>
              <small>{state.lastCommitReceipt.branch}</small>
            </div>
            <IconButton
              label='关闭提交回执'
              onClick={() => {
                appState.lastCommitReceipt = null;
              }}
            >
              <X size={13} />
            </IconButton>
          </section>
        )}
      </section>
      <footer>
        <Button
          disabled={!staged.length || state.gitActionLoading}
          loading={state.gitActionLoading}
          onClick={() => setCommitOpen(true)}
        >
          <GitBranch size={14} />
          提交 {staged.length ? `(${staged.length})` : ''}
        </Button>
      </footer>
      {commitOpen && (
        <Dialog
          title='提交暂存的更改'
          description={`将在 ${status?.branch || '当前分支'} 提交 ${staged.length} 个已暂存文件。`}
          closeDisabled={state.gitActionLoading}
          onClose={closeCommit}
          footer={
            <>
              <Button tone='quiet' disabled={state.gitActionLoading} onClick={closeCommit}>
                取消
              </Button>
              <Button
                tone='primary'
                disabled={!commitMessage.trim()}
                loading={state.gitActionLoading}
                onClick={() => {
                  void commit();
                }}
              >
                创建提交
              </Button>
            </>
          }
        >
          <Field label='提交说明'>
            <input
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && commitMessage.trim()) void commit();
              }}
              placeholder='描述这次更改'
            />
          </Field>
        </Dialog>
      )}
    </aside>
  );
}

function ChangeGroup({
  title,
  files,
  action,
  onOpen,
  onAction,
  disabled,
}: {
  title: string;
  files: ReadonlyArray<{ path: string; status: string }>;
  action: string;
  onOpen: (path: string) => void;
  onAction: (path: string) => void;
  disabled: boolean;
}) {
  if (!files.length) return null;
  return (
    <section className='change-group'>
      <header>
        <strong>{title}</strong>
        <span>{files.length}</span>
      </header>
      {files.map((file) => (
        <div key={file.path}>
          <button type='button' disabled={disabled} onClick={() => onOpen(file.path)}>
            <WorkspaceFileIcon path={file.path} size={14} />
            <span className='change-file-copy'>
              <strong>{basename(file.path)}</strong>
              {dirname(file.path) && <small>{dirname(file.path)}</small>}
            </span>
            <span className='change-file-status'>{normalizedGitStatus(file.status)}</span>
          </button>
          <IconButton disabled={disabled} label={`${action} ${file.path}`} onClick={() => onAction(file.path)}>
            {action === '暂存' ? '+' : <Undo2 size={12} />}
          </IconButton>
        </div>
      ))}
    </section>
  );
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() || path;
}

function dirname(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

function normalizedGitStatus(status: string): string {
  const normalized = status.trim();
  if (normalized === '??') return 'U';
  return normalized.slice(-1) || 'M';
}
