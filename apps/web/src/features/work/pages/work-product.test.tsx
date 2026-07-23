import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { CodeActions } from '../../code/use-code-controller';
import { WorkProduct } from './work-product';

const mocks = vi.hoisted(() => ({
  createArtifact: vi.fn(),
  pickRoot: vi.fn(async () => null as string | null),
}));

vi.mock('../use-work-controller', () => ({
  useWorkController: () => ({
    activeArtifact: null,
    pendingImport: null,
    artifacts: [],
    folders: [],
    libraryView: 'all',
    activeFolderId: null,
    loading: false,
    loadError: null,
    createArtifact: mocks.createArtifact,
  }),
}));

vi.mock('../use-work-files-controller', () => ({
  useWorkFilesController: () => ({
    rootPath: '/docs',
    currentPath: '/docs',
    pickRoot: mocks.pickRoot,
  }),
}));

vi.mock('../use-work-code-controller', () => ({
  useWorkCodeController: () => ({ tabs: [] }),
}));

vi.mock('../components/work-home', () => ({
  WorkHome: () => (
    <main>
      <div data-office-shortcuts='ignore'>
        <input aria-label='AI 指令' />
      </div>
    </main>
  ),
}));

describe('Work product shortcuts', () => {
  beforeEach(() => {
    localStorage.setItem('a3s-work.surface', 'library');
    localStorage.setItem('a3s-work.copilot-open', 'false');
    appState.sidebarOpen = false;
    appState.workspaceRoot = '/docs';
    appState.health = null;
    appState.newTaskConfig.workspace = '/docs';
    mocks.createArtifact.mockReset();
    mocks.pickRoot.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('runs only plain Work commands and leaves excluded editors alone', () => {
    render(<WorkProduct actions={{} as CodeActions} />);
    const prompt = screen.getByRole('textbox', { name: 'AI 指令' });

    expect(fireEvent.keyDown(prompt, { key: 'n', metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(prompt, { key: 'o', metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(window, { key: 'n', metaKey: true, shiftKey: true })).toBe(true);
    expect(mocks.createArtifact).not.toHaveBeenCalled();
    expect(mocks.pickRoot).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(window, { key: 'n', metaKey: true })).toBe(false);
    expect(fireEvent.keyDown(window, { key: 'o', metaKey: true })).toBe(false);
    expect(mocks.createArtifact).toHaveBeenCalledWith('blank-document');
    expect(mocks.pickRoot).toHaveBeenCalledOnce();
  });
});
