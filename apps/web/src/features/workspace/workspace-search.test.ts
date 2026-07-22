import { describe, expect, it } from 'vitest';
import { limitWorkspaceSearchResults, workspaceSearchMatchPreview } from './workspace-search';

describe('workspace search match previews', () => {
  it('bounds legacy full-line results around the selected match', () => {
    const line = `${'a'.repeat(1_000)}target${'b'.repeat(1_000)}`;
    const preview = workspaceSearchMatchPreview(
      { line: 1, column: 1_001, text: line, matchStart: 1_000, matchEnd: 1_006 },
      'target'
    );

    expect(preview.match).toBe('target');
    expect(preview.before.startsWith('…')).toBe(true);
    expect(preview.before.length).toBeLessThanOrEqual(49);
    expect(preview.after.endsWith('…')).toBe(true);
    expect(`${preview.before}${preview.match}${preview.after}`.length).toBeLessThanOrEqual(328);
  });

  it('recovers a legacy byte offset that is not a valid UTF-16 match', () => {
    const preview = workspaceSearchMatchPreview(
      { line: 1, column: 4, text: 'İTARGET', matchStart: 3, matchEnd: 9 },
      'target'
    );

    expect(preview).toEqual({ before: 'İ', match: 'TARGET', after: '' });
  });
});

describe('workspace search result limit', () => {
  it('preserves file grouping while reserving one match as an overflow signal', () => {
    const bounded = limitWorkspaceSearchResults(
      [
        {
          path: '/repo/first.ts',
          matches: Array.from({ length: 2 }, (_, index) => ({
            line: index + 1,
            column: 1,
            text: 'target',
            matchStart: 0,
            matchEnd: 6,
          })),
        },
        {
          path: '/repo/second.ts',
          matches: Array.from({ length: 2 }, (_, index) => ({
            line: index + 1,
            column: 1,
            text: 'target',
            matchStart: 0,
            matchEnd: 6,
          })),
        },
      ],
      3
    );

    expect(bounded.truncated).toBe(true);
    expect(bounded.results.map((file) => [file.path, file.matches.length])).toEqual([
      ['/repo/first.ts', 2],
      ['/repo/second.ts', 1],
    ]);
  });
});
