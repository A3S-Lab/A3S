import type { WorkspaceDiffEditorTab, WorkspaceFileEditorTab } from '../workspace-state';
import { workspaceRelativePath } from '../workspace-state';

type WorkspaceEditorTabLabelSource =
  | Readonly<Pick<WorkspaceFileEditorTab, 'id' | 'kind' | 'path'>>
  | Readonly<Pick<WorkspaceDiffEditorTab, 'id' | 'kind' | 'path' | 'staged'>>;

export interface WorkspaceEditorTabLabel {
  name: string;
  detail: string | null;
  ariaLabel: string;
  title: string;
}

interface TabLabelCandidate {
  tab: WorkspaceEditorTabLabelSource;
  name: string;
  relativePath: string;
  parentSegments: string[];
}

export function workspaceEditorTabLabels(
  tabs: readonly WorkspaceEditorTabLabelSource[],
  workspaceRoot: string
): ReadonlyMap<string, WorkspaceEditorTabLabel> {
  const candidates = tabs.map((tab): TabLabelCandidate => {
    const relativePath = workspaceRelativePath(tab.path, workspaceRoot).replace(/\\/g, '/');
    const name = editorTabName(tab);
    return {
      tab,
      name,
      relativePath,
      parentSegments: relativePath.split('/').filter(Boolean).slice(0, -1),
    };
  });
  const collisions = new Map<string, TabLabelCandidate[]>();
  for (const candidate of candidates) {
    const peers = collisions.get(candidate.name);
    if (peers) peers.push(candidate);
    else collisions.set(candidate.name, [candidate]);
  }

  return new Map(
    candidates.map((candidate) => {
      const peers = collisions.get(candidate.name) ?? [candidate];
      const detail = peers.length > 1 ? shortestUniqueParent(candidate, peers) : null;
      const diffDetail = candidate.tab.kind === 'diff' ? (candidate.tab.staged ? '已暂存差异' : '工作树差异') : null;
      const title = diffDetail ? `${candidate.relativePath} · ${diffDetail}` : candidate.relativePath;
      return [
        candidate.tab.id,
        {
          name: candidate.name,
          detail,
          ariaLabel: detail ? `${candidate.name}，${detail}` : candidate.name,
          title,
        },
      ];
    })
  );
}

function editorTabName(tab: WorkspaceEditorTabLabelSource): string {
  const name = basename(tab.path);
  if (tab.kind === 'file') return name;
  return `${name}${tab.staged ? '（已暂存）' : '（工作树）'}`;
}

function shortestUniqueParent(candidate: TabLabelCandidate, peers: readonly TabLabelCandidate[]): string {
  for (let depth = 1; depth <= candidate.parentSegments.length; depth += 1) {
    const detail = parentSuffix(candidate, depth);
    if (peers.every((peer) => peer === candidate || parentSuffix(peer, depth) !== detail)) return detail;
  }
  return parentSuffix(candidate, candidate.parentSegments.length);
}

function parentSuffix(candidate: TabLabelCandidate, depth: number): string {
  if (!candidate.parentSegments.length) return '.';
  return candidate.parentSegments.slice(-Math.max(1, depth)).join('/');
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}
