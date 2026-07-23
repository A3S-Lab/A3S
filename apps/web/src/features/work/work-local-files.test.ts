import { describe, expect, it } from 'vitest';
import type { WorkspaceEntry } from '../../types/api';
import {
  canMoveLocalPaths,
  formatWorkFileSize,
  isWorkImportablePath,
  isWorkOfficePath,
  isWorkTextEditorEntry,
  localPathInside,
  localPathParent,
  readWorkLocalFileDragData,
  rebaseLocalPath,
  relativeLocalPath,
  sortWorkFileEntries,
  workBreadcrumbs,
  workDuplicateName,
} from './work-local-files';

const file = (name: string, overrides: Partial<WorkspaceEntry> = {}): WorkspaceEntry => ({
  name,
  path: `/docs/${name}`,
  isDirectory: false,
  isFile: true,
  size: 10,
  mtimeMs: 100,
  extension: name.split('.').pop(),
  isBinary: false,
  ...overrides,
});

describe('Work local file model', () => {
  it('keeps POSIX and Windows navigation inside the selected root', () => {
    expect(localPathInside('/Users/a/Documents', '/Users/a/Documents/Reports/Q2')).toBe(true);
    expect(localPathInside('/Users/a/Documents', '/Users/a/Desktop')).toBe(false);
    expect(localPathInside('C:\\Users\\A\\Documents', 'c:\\users\\a\\documents\\Report.docx')).toBe(true);
    expect(localPathParent('C:\\Reports')).toBe('C:\\');
    expect(relativeLocalPath('/Users/a/Documents/Reports/Q2', '/Users/a/Documents')).toBe('Reports/Q2');
    expect(workBreadcrumbs('/Users/a/Documents', '/Users/a/Documents/Reports/Q2')).toEqual([
      { label: 'Documents', path: '/Users/a/Documents' },
      { label: 'Reports', path: '/Users/a/Documents/Reports' },
      { label: 'Q2', path: '/Users/a/Documents/Reports/Q2' },
    ]);
  });

  it('keeps folders first while sorting file metadata deterministically', () => {
    const entries = [
      file('Old.docx', { mtimeMs: 10 }),
      file('Folder', { isDirectory: true, isFile: false, size: 0, mtimeMs: 1 }),
      file('New.docx', { mtimeMs: 30 }),
    ];
    expect(
      sortWorkFileEntries(entries, { key: 'modified', direction: 'descending' }).map((entry) => entry.name)
    ).toEqual(['Folder', 'New.docx', 'Old.docx']);
  });

  it('recognizes editable copies and produces Finder-like duplicate names', () => {
    expect(isWorkImportablePath('/docs/Plan.DOCX')).toBe(true);
    expect(isWorkImportablePath('/docs/photo.png')).toBe(false);
    expect(workDuplicateName('Plan.docx', false)).toBe('Plan 副本.docx');
    expect(workDuplicateName('Archive', true)).toBe('Archive 副本');
    expect(formatWorkFileSize(1536)).toBe('1.5 KB');
  });

  it('routes Office files to native editors and text or code files to the Monaco detail editor', () => {
    expect(isWorkOfficePath('/docs/Plan.docx')).toBe(true);
    expect(isWorkOfficePath('/repo/src/app.tsx')).toBe(false);
    expect(isWorkTextEditorEntry(file('README.md'))).toBe(true);
    expect(isWorkTextEditorEntry(file('main.rs'))).toBe(true);
    expect(isWorkTextEditorEntry(file('archive.bin', { isBinary: true }))).toBe(false);
  });

  it('validates Finder moves, rebases descendants, and rejects malformed drag payloads', () => {
    expect(canMoveLocalPaths(['/docs/Plan.docx'], '/docs/Archive')).toBe(true);
    expect(canMoveLocalPaths(['/docs/Archive'], '/docs/Archive/Nested')).toBe(false);
    expect(canMoveLocalPaths(['/docs/Plan.docx'], '/docs')).toBe(false);
    expect(rebaseLocalPath('/docs/Reports/2026/Plan.docx', '/docs/Reports', '/docs/Archive/Reports')).toBe(
      '/docs/Archive/Reports/2026/Plan.docx'
    );
    expect(rebaseLocalPath('C:\\Docs\\Reports\\Plan.docx', 'C:\\Docs\\Reports', 'C:\\Docs\\Archive\\Reports')).toBe(
      'C:\\Docs\\Archive\\Reports\\Plan.docx'
    );
    expect(readWorkLocalFileDragData({ getData: () => '{bad-json' })).toEqual([]);
  });
});
