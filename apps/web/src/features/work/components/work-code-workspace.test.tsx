import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../../lib/api';
import { appState } from '../../../state/app-state';
import type { WorkCodeActions } from '../use-work-code-controller';
import { WorkCodeWorkspace } from './work-code-workspace';

vi.mock('../../workspace/components/monaco-code-editor', () => ({
  MonacoCodeEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label='模拟 Monaco 编辑器' value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

describe('Work WebIDE workspace', () => {
  beforeEach(() => {
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([]);
    appState.theme = 'light';
    appState.activeSessionId = 'work-assistant';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps Markdown source on the left and renders a live preview on the right', async () => {
    const updateDraft = vi.fn();
    const tab = {
      path: '/repo/README.md',
      content: '# Project\n',
      draft: '# Project\n\n**Ready**',
      location: null,
      loading: false,
      loadError: null,
      saving: false,
    };
    const actions = {
      tabs: [tab],
      activePath: tab.path,
      activeTab: tab,
      conflict: null,
      activateTab: vi.fn(),
      closeTab: vi.fn(),
      closeWorkspace: vi.fn(),
      openFile: vi.fn(async () => true),
      updateDraft,
      saveFile: vi.fn(async () => true),
      resolveConflict: vi.fn(),
      dismissConflict: vi.fn(),
    } as unknown as WorkCodeActions;

    render(
      <WorkCodeWorkspace
        actions={actions}
        rootPath='/repo'
        assistantOpen={false}
        onBack={vi.fn()}
        onOpenEntry={vi.fn()}
        onToggleAssistant={vi.fn()}
        onAgentRequest={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Markdown 编辑区')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Markdown 实时预览' })).toHaveTextContent('Project');
    expect(screen.getByRole('region', { name: 'Markdown 实时预览' })).toHaveTextContent('Ready');
    expect(screen.getByRole('status', { name: '编辑器状态' })).toHaveTextContent('Markdown');
    expect(screen.getByRole('status', { name: '编辑器状态' })).toHaveTextContent('3 行');
    expect(screen.getByRole('status', { name: '编辑器状态' })).toHaveTextContent('左侧编辑 · 右侧实时预览');

    fireEvent.change(screen.getByRole('textbox', { name: '模拟 Monaco 编辑器' }), {
      target: { value: '# Updated' },
    });
    expect(updateDraft).toHaveBeenCalledWith('/repo/README.md', '# Updated');
    await waitFor(() => expect(codeApi.readDir).toHaveBeenCalledWith('/repo'));
  });
});
