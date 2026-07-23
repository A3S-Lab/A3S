import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../lib/api';
import { useWorkCodeController } from './use-work-code-controller';

describe('Work code file controller', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens, edits, and safely saves arbitrary text code files', async () => {
    const readFile = vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: 'export const value = 1;\n' });
    const writeFile = vi.spyOn(codeApi, 'writeFile').mockResolvedValue({ success: true });
    const { result } = renderHook(() => useWorkCodeController('/repo'));

    await act(() => result.current.openFile({ path: '/repo/src/value.ts', isBinary: false }));
    expect(result.current.activeTab?.draft).toBe('export const value = 1;\n');

    act(() => result.current.updateDraft('/repo/src/value.ts', 'export const value = 2;\n'));
    await act(() => result.current.saveFile('/repo/src/value.ts'));

    expect(readFile).toHaveBeenLastCalledWith('/repo/src/value.ts');
    expect(writeFile).toHaveBeenCalledWith('/repo/src/value.ts', 'export const value = 2;\n');
    expect(result.current.activeTab?.content).toBe('export const value = 2;\n');
  });

  it('does not overwrite an externally changed file without an explicit conflict decision', async () => {
    vi.spyOn(codeApi, 'readFile')
      .mockResolvedValueOnce({ content: '# Original\n' })
      .mockResolvedValueOnce({ content: '# Changed elsewhere\n' });
    const writeFile = vi.spyOn(codeApi, 'writeFile').mockResolvedValue({ success: true });
    const { result } = renderHook(() => useWorkCodeController('/repo'));

    await act(() => result.current.openFile({ path: '/repo/README.md', isBinary: false }));
    act(() => result.current.updateDraft('/repo/README.md', '# Local draft\n'));
    await act(() => result.current.saveFile('/repo/README.md'));

    expect(writeFile).not.toHaveBeenCalled();
    expect(result.current.conflict).toMatchObject({ path: '/repo/README.md' });

    await act(() => result.current.resolveConflict('overwrite'));
    await waitFor(() => expect(result.current.conflict).toBeNull());
    expect(writeFile).toHaveBeenCalledWith('/repo/README.md', '# Local draft\n');
  });

  it('asks inside the product before closing unsaved files', async () => {
    vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: 'before\n' });
    const confirm = vi.spyOn(window, 'confirm');
    const { result } = renderHook(() => useWorkCodeController('/repo'));

    await act(() => result.current.openFile({ path: '/repo/notes.md', isBinary: false }));
    act(() => result.current.updateDraft('/repo/notes.md', 'after\n'));
    act(() => expect(result.current.closeTab('/repo/notes.md')).toBe(false));

    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.closeRequest).toMatchObject({ kind: 'tab', path: '/repo/notes.md' });
    expect(result.current.tabs).toHaveLength(1);

    act(() => result.current.confirmCloseRequest());
    expect(result.current.closeRequest).toBeNull();
    expect(result.current.tabs).toHaveLength(0);
  });
});
