import type { WorkspaceEntry } from '../../../types/api';

export interface ComposerWorkspaceTreeRow {
  entry: WorkspaceEntry;
  depth: number;
  relativePath: string;
}

export function flattenComposerWorkspaceTree({
  workspaceRoot,
  entriesByDirectory,
  expandedPaths,
  selectedFiles,
  query = '',
}: {
  workspaceRoot: string;
  entriesByDirectory: Record<string, readonly WorkspaceEntry[]>;
  expandedPaths: ReadonlySet<string>;
  selectedFiles: readonly string[];
  query?: string;
}): ComposerWorkspaceTreeRow[] {
  const selected = new Set(selectedFiles.map(normalizePath));
  const rows: ComposerWorkspaceTreeRow[] = [];

  const visit = (directory: string, depth: number) => {
    const entries = [...(entriesByDirectory[directory] ?? [])].sort(compareEntries);
    for (const entry of entries) {
      const relativePath = relativeWorkspacePath(workspaceRoot, entry.path);
      if (
        entry.isDirectory ||
        (!selected.has(normalizePath(entry.path)) && !selected.has(normalizePath(relativePath)))
      ) {
        rows.push({ entry, depth, relativePath });
      }
      if (entry.isDirectory && expandedPaths.has(entry.path)) visit(entry.path, depth + 1);
    }
  };

  visit(workspaceRoot, 0);
  const normalizedQuery = normalizePath(query).toLowerCase();
  if (!normalizedQuery) return rows;
  return rows.filter((row) =>
    normalizePath(`${row.entry.name} ${row.relativePath}`).toLowerCase().includes(normalizedQuery)
  );
}

export function relativeWorkspacePath(workspaceRoot: string, path: string): string {
  const root = normalizePath(workspaceRoot).replace(/\/$/, '');
  const normalized = normalizePath(path);
  return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function compareEntries(left: WorkspaceEntry, right: WorkspaceEntry): number {
  if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1;
  return left.name.localeCompare(right.name, 'zh-CN', { numeric: true, sensitivity: 'base' });
}
