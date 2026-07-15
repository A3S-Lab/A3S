import { describe, expect, it } from 'vitest';
import { workspaceEntryIconTone } from './workspace-entry-icon';

describe('workspace entry icon tones', () => {
  it('assigns distinct tones to folders and common source files', () => {
    expect(workspaceEntryIconTone('src', null, true)).toBe('folder');
    expect(workspaceEntryIconTone('app.tsx', 'tsx', false)).toBe('typescript');
    expect(workspaceEntryIconTone('package.json', 'json', false)).toBe('json');
    expect(workspaceEntryIconTone('styles.css', 'css', false)).toBe('style');
    expect(workspaceEntryIconTone('main.rs', 'rs', false)).toBe('rust');
  });
});
