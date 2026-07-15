import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../../lib/api';
import type { WorkspaceEntry } from '../../../types/api';
import { ComposerWorkspaceTree, type ComposerWorkspaceTreeHandle } from './composer-workspace-tree';

function entry(path: string, isDirectory = false): WorkspaceEntry {
  return {
    name: path.split('/').pop() ?? path,
    path,
    isDirectory,
    isFile: !isDirectory,
    size: 0,
    isBinary: false,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ComposerWorkspaceTree', () => {
  it('loads directories lazily and selects a file from the expanded tree', async () => {
    const readDir = vi.spyOn(codeApi, 'readDir').mockImplementation(async (path) => {
      if (path === '/repo') return [entry('/repo/README.md'), entry('/repo/src', true)];
      if (path === '/repo/src') return [entry('/repo/src/app.ts')];
      return [];
    });
    const onSelect = vi.fn();
    render(
      <ComposerWorkspaceTree
        id='workspace-tree'
        workspaceRoot='/repo'
        query=''
        selectedFiles={[]}
        onSelect={onSelect}
        onActiveDescendantChange={vi.fn()}
      />
    );

    const sourceDirectory = await screen.findByRole('treeitem', { name: /src/ });
    expect(readDir).toHaveBeenCalledTimes(1);
    fireEvent.click(sourceDirectory);

    const appFile = await screen.findByRole('treeitem', { name: /app\.ts/ });
    expect(readDir).toHaveBeenLastCalledWith('/repo/src');
    fireEvent.click(appFile);
    expect(onSelect).toHaveBeenCalledWith('/repo/src/app.ts');
  });

  it('supports keyboard-style movement and directory activation through its handle', async () => {
    vi.spyOn(codeApi, 'readDir').mockImplementation(async (path) => {
      if (path === '/repo') return [entry('/repo/src', true), entry('/repo/README.md')];
      if (path === '/repo/src') return [entry('/repo/src/app.ts')];
      return [];
    });
    const ref = createRef<ComposerWorkspaceTreeHandle>();
    const onSelect = vi.fn();
    render(
      <ComposerWorkspaceTree
        ref={ref}
        id='workspace-tree'
        workspaceRoot='/repo'
        query=''
        selectedFiles={[]}
        onSelect={onSelect}
        onActiveDescendantChange={vi.fn()}
      />
    );
    await screen.findByRole('treeitem', { name: /src/ });

    ref.current?.activateActive();
    await screen.findByRole('treeitem', { name: /app\.ts/ });
    ref.current?.moveActive(1);
    await waitFor(() => expect(screen.getByRole('treeitem', { name: /app\.ts/ })).toHaveClass('active'));
    ref.current?.activateActive();
    expect(onSelect).toHaveBeenCalledWith('/repo/src/app.ts');
  });
});
