import type { CodeDiagnostic, CodeLocation, CodeNavigationKind, CodeRange } from '../../types/api';
import type { WorkspaceFileSelection } from './workspace-state';

export interface MonacoRangeData {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export function workspaceCodePath(path: string, workspaceRoot: string): string | null {
  const normalizedPath = normalizeSlashes(path);
  const normalizedWorkspaceRoot = normalizeSlashes(workspaceRoot);
  const normalizedRoot = normalizedWorkspaceRoot === '/' ? '/' : normalizedWorkspaceRoot.replace(/\/+$/, '');
  if (!normalizedPath || !normalizedRoot || normalizedPath.includes('\0')) return null;

  let relative = normalizedPath;
  if (isAbsolutePath(normalizedPath)) {
    if (normalizedRoot === '/') relative = normalizedPath.slice(1);
    else {
      const windows = /^[A-Za-z]:\//.test(normalizedRoot);
      const candidate = windows ? normalizedPath.toLowerCase() : normalizedPath;
      const root = windows ? normalizedRoot.toLowerCase() : normalizedRoot;
      if (!candidate.startsWith(`${root}/`)) return null;
      relative = normalizedPath.slice(normalizedRoot.length + 1);
    }
  }

  if (isAbsolutePath(relative)) return null;
  const segments = relative.split('/');
  if (!segments.length || segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return segments.join('/');
}

export function workspaceSelection(location: CodeLocation, workspaceRoot: string): WorkspaceFileSelection | null {
  const relativePath = workspaceCodePath(location.path, workspaceRoot);
  if (!relativePath || isAbsolutePath(location.path)) return null;
  const separator = workspaceRoot.includes('\\') && !workspaceRoot.includes('/') ? '\\' : '/';
  return {
    path: `${workspaceRoot.replace(/[\\/]$/, '')}${separator}${relativePath.replaceAll('/', separator)}`,
    isBinary: false,
    line: location.range.start.line + 1,
    column: location.range.start.character + 1,
  };
}

export function monacoRange(range: CodeRange): MonacoRangeData {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

export function diagnosticsForPath(
  diagnostics: readonly CodeDiagnostic[],
  path: string,
  workspaceRoot: string
): CodeDiagnostic[] {
  const currentPath = workspaceCodePath(path, workspaceRoot);
  if (!currentPath) return [];
  return diagnostics.filter((diagnostic) => workspaceCodePath(diagnostic.location.path, workspaceRoot) === currentPath);
}

export function navigationLabel(kind: CodeNavigationKind): string {
  const labels: Record<CodeNavigationKind, string> = {
    definition: '定义',
    declaration: '声明',
    references: '引用',
    implementations: '实现',
  };
  return labels[kind];
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:\//.test(path);
}

function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, '/');
}
