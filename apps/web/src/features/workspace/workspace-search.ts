import type { WorkspaceSearchFile, WorkspaceSearchMatch } from '../../types/api';

const SEARCH_MATCH_LEADING_CONTEXT_UNITS = 48;
const SEARCH_MATCH_TRAILING_CONTEXT_UNITS = 160;
export const WORKSPACE_SEARCH_RESULT_LIMIT = 300;

const defaultExcludedDirectories = [
  '.git/',
  '.a3s/',
  'node_modules/',
  'target/',
  'dist/',
  'build/',
  'coverage/',
  '.next/',
  '.venv/',
  'venv/',
];

export const DEFAULT_WORKSPACE_SEARCH_EXCLUDE_PATTERN = defaultExcludedDirectories
  .flatMap((directory) => [`${directory}*`, `*/${directory}*`])
  .join(',');

export type WorkspaceSearchScope = 'source' | 'all';

export interface WorkspaceSearchOptions {
  scope: WorkspaceSearchScope;
}

export interface WorkspaceSearchMatchPreview {
  before: string;
  match: string;
  after: string;
}

export function limitWorkspaceSearchResults(
  files: WorkspaceSearchFile[],
  limit = WORKSPACE_SEARCH_RESULT_LIMIT
): { results: WorkspaceSearchFile[]; truncated: boolean } {
  const boundedLimit = Math.max(0, Math.trunc(limit));
  const truncated = files.reduce((total, file) => total + file.matches.length, 0) > boundedLimit;
  const results: WorkspaceSearchFile[] = [];
  let remaining = boundedLimit;
  for (const file of files) {
    if (remaining === 0) break;
    const matches = file.matches.slice(0, remaining);
    if (matches.length) results.push({ ...file, matches });
    remaining -= matches.length;
  }
  return { results, truncated };
}

export function workspaceSearchMatchPreview(match: WorkspaceSearchMatch, query: string): WorkspaceSearchMatchPreview {
  const text = match.text;
  let start = utf16Boundary(text, clampOffset(match.matchStart, text.length), 'backward');
  let end = utf16Boundary(text, clampOffset(match.matchEnd, text.length), 'forward');
  if (end < start) end = start;

  if (query && text.slice(start, end).toLowerCase() !== query.toLowerCase()) {
    const recovered = closestCaseInsensitiveMatch(text, query, start);
    if (recovered) [start, end] = recovered;
  }

  const previewStart = retreatCodePoints(text, start, SEARCH_MATCH_LEADING_CONTEXT_UNITS);
  const previewEnd = advanceCodePoints(text, end, SEARCH_MATCH_TRAILING_CONTEXT_UNITS);
  return {
    before: `${previewStart > 0 ? '…' : ''}${text.slice(previewStart, start)}`,
    match: text.slice(start, end),
    after: `${text.slice(end, previewEnd)}${previewEnd < text.length ? '…' : ''}`,
  };
}

function closestCaseInsensitiveMatch(text: string, query: string, approximateStart: number): [number, number] | null {
  const pattern = new RegExp(escapeRegExp(query), 'giu');
  let closest: [number, number] | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of text.matchAll(pattern)) {
    const start = candidate.index;
    const distance = Math.abs(start - approximateStart);
    if (distance < closestDistance) {
      closest = [start, start + candidate[0].length];
      closestDistance = distance;
    }
  }
  return closest;
}

function retreatCodePoints(text: string, index: number, count: number): number {
  let cursor = index;
  for (let remaining = count; remaining > 0 && cursor > 0; remaining -= 1) {
    cursor -= 1;
    if (cursor > 0 && isLowSurrogate(text.charCodeAt(cursor)) && isHighSurrogate(text.charCodeAt(cursor - 1))) {
      cursor -= 1;
    }
  }
  return cursor;
}

function advanceCodePoints(text: string, index: number, count: number): number {
  let cursor = index;
  for (let remaining = count; remaining > 0 && cursor < text.length; remaining -= 1) {
    const width =
      isHighSurrogate(text.charCodeAt(cursor)) &&
      cursor + 1 < text.length &&
      isLowSurrogate(text.charCodeAt(cursor + 1))
        ? 2
        : 1;
    cursor += width;
  }
  return cursor;
}

function utf16Boundary(text: string, index: number, direction: 'backward' | 'forward'): number {
  if (
    index > 0 &&
    index < text.length &&
    isHighSurrogate(text.charCodeAt(index - 1)) &&
    isLowSurrogate(text.charCodeAt(index))
  ) {
    return direction === 'backward' ? index - 1 : index + 1;
  }
  return index;
}

function clampOffset(value: number, length: number): number {
  return Math.min(length, Math.max(0, Number.isFinite(value) ? Math.trunc(value) : 0));
}

function isHighSurrogate(value: number): boolean {
  return value >= 0xd800 && value <= 0xdbff;
}

function isLowSurrogate(value: number): boolean {
  return value >= 0xdc00 && value <= 0xdfff;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
