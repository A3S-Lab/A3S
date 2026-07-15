import { Check, ChevronUp, Folder, FolderOpen, LoaderCircle, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useSnapshot } from 'valtio';
import { appState, formatApiError } from '../../../state/app-state';
import type { CodeSession } from '../../../types/api';
import type { TaskActions } from '../task-actions';
import { ComposerPopover } from './composer-popover';

interface WorkspaceCandidate {
  path: string;
  name: string;
}

export function NewTaskWorkspaceControl({ actions }: { actions: TaskActions }) {
  const state = useSnapshot(appState);
  const [query, setQuery] = useState('');
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [openingLocalFolder, setOpeningLocalFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedPath = state.newTaskConfig.workspace.trim() || state.workspaceRoot || state.health?.workspace || '';
  const workspaces = useMemo(
    () => workspaceCandidates(selectedPath, state.health?.workspace, state.sessions),
    [selectedPath, state.health?.workspace, state.sessions]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleWorkspaces = workspaces.filter((workspace) => {
    if (!normalizedQuery) return true;
    return `${workspace.name}\n${workspace.path}`.toLocaleLowerCase().includes(normalizedQuery);
  });
  const busy = Boolean(pendingPath || openingLocalFolder);

  return (
    <ComposerPopover
      label={`工作区：${workspaceName(selectedPath)}`}
      panelLabel='选择新任务工作区'
      className='new-task-workspace-control'
      disabled={Boolean(state.streamingSessionId)}
      onOpenChange={(open) => {
        if (open) return;
        setQuery('');
        setError(null);
      }}
      trigger={
        <>
          <Folder size={14} />
          <span>{workspaceName(selectedPath)}</span>
          <ChevronUp className='new-task-workspace-chevron' size={12} />
        </>
      }
    >
      {(close) => {
        const selectWorkspace = async (path: string) => {
          if (busy) return;
          setPendingPath(path);
          setError(null);
          try {
            await actions.selectNewTaskWorkspace(path);
            setQuery('');
            close();
          } catch (selectionError) {
            setError(formatApiError(selectionError));
          } finally {
            setPendingPath(null);
          }
        };
        const openLocalFolder = async () => {
          if (busy) return;
          setOpeningLocalFolder(true);
          setError(null);
          try {
            const path = await actions.pickNewTaskWorkspace();
            if (path) {
              setQuery('');
              close();
            }
          } catch (selectionError) {
            setError(formatApiError(selectionError));
          } finally {
            setOpeningLocalFolder(false);
          }
        };
        return (
          <>
            <label className='new-task-workspace-search'>
              <Search size={14} />
              <input
                type='search'
                aria-label='搜索工作区'
                ref={(input) => input?.focus({ preventScroll: true })}
                placeholder='搜索工作区'
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </label>
            <div className='new-task-workspace-list' role='listbox' aria-label='最近工作区'>
              {visibleWorkspaces.map((workspace) => {
                const selected = sameWorkspace(workspace.path, selectedPath);
                const loading = sameWorkspace(workspace.path, pendingPath ?? '');
                return (
                  <button
                    type='button'
                    role='option'
                    aria-selected={selected}
                    disabled={busy}
                    title={workspace.path}
                    key={workspace.path}
                    onClick={() => void selectWorkspace(workspace.path)}
                  >
                    <Folder size={15} />
                    <span>
                      <strong>{highlightMatch(workspace.name, query)}</strong>
                      <small>{highlightMatch(workspace.path, query)}</small>
                    </span>
                    {loading ? <LoaderCircle className='spin' size={14} /> : selected ? <Check size={14} /> : null}
                  </button>
                );
              })}
              {!visibleWorkspaces.length && <p>没有匹配的工作区</p>}
            </div>
            <div className='new-task-workspace-actions'>
              <button type='button' disabled={busy} onClick={() => void openLocalFolder()}>
                <FolderOpen size={15} />
                <span>
                  <strong>打开本地文件夹</strong>
                  <small>从这台电脑选择 Code 要处理的目录</small>
                </span>
                {openingLocalFolder && <LoaderCircle className='spin' size={14} />}
              </button>
            </div>
            {error && (
              <p className='new-task-workspace-error' role='alert'>
                {error}
              </p>
            )}
          </>
        );
      }}
    </ComposerPopover>
  );
}

function workspaceCandidates(
  selectedPath: string,
  defaultPath: string | undefined,
  sessions: readonly CodeSession[]
): WorkspaceCandidate[] {
  const paths = [selectedPath, defaultPath, ...sessions.map((session) => session.workspace)];
  const seen = new Set<string>();
  const candidates: WorkspaceCandidate[] = [];
  for (const path of paths) {
    const normalized = path?.trim();
    if (!normalized) continue;
    const key = workspaceKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ path: normalized, name: workspaceName(normalized) });
    if (candidates.length === 8) break;
  }
  return candidates;
}

function highlightMatch(text: string, query: string): ReactNode {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return text;
  const index = text.toLocaleLowerCase().indexOf(normalizedQuery);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + normalizedQuery.length)}</mark>
      {text.slice(index + normalizedQuery.length)}
    </>
  );
}

function sameWorkspace(left: string, right: string): boolean {
  return workspaceKey(left) === workspaceKey(right);
}

function workspaceKey(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLocaleLowerCase() : normalized;
}

function workspaceName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || '当前工作区';
}
