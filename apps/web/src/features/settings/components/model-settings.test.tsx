import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { LlmSettings } from '../../../types/api';
import type { SettingsActions } from '../settings-actions';
import { ModelSettings } from './model-settings';

const source: LlmSettings = {
  category: 'llm',
  effect: { scope: 'newTasks', label: 'New tasks', description: 'Applies to new tasks' },
  configPath: '/repo/.a3s/config.acl',
  defaultModel: 'openai/model-a',
  providers: [
    {
      name: 'openai',
      apiKey: null,
      baseUrl: null,
      headers: {},
      sessionIdHeader: null,
      models: [{ id: 'model-a', name: 'Model A' }],
    },
  ],
};

describe('ModelSettings editing continuity', () => {
  const actions = {
    loadSettingsCategory: vi.fn(async () => undefined),
    saveLlmSettings: vi.fn(async (draft) => ({ ...structuredClone(source), ...draft })),
  } as unknown as SettingsActions;

  beforeEach(() => {
    vi.clearAllMocks();
    appState.llm = structuredClone(source);
    appState.settingsCategoryLoading.llm = false;
    appState.settingsCategorySaving.llm = false;
    appState.settingsCategoryErrors.llm = null;
    appState.settingsCategorySavedAt.llm = null;
  });

  afterEach(() => cleanup());

  it('keeps focus while the Provider name changes', () => {
    render(<ModelSettings actions={actions} />);
    const input = screen.getByRole('textbox', { name: 'openai 名称' });
    input.focus();

    fireEvent.change(input, { target: { value: 'renamed-provider' } });

    expect(screen.getByRole('textbox', { name: 'renamed-provider 名称' })).toHaveFocus();
  });

  it('keeps focus while the model id changes', () => {
    render(<ModelSettings actions={actions} />);
    fireEvent.click(screen.getByRole('tab', { name: '模型目录 1' }));
    const input = screen.getByRole('textbox', { name: 'openai/model-a 模型标识' });
    input.focus();

    fireEvent.change(input, { target: { value: 'model-b' } });

    const updatedInput = screen.getByRole('textbox', { name: 'openai/model-b 模型标识' });
    expect(updatedInput).toHaveFocus();
    expect(screen.getByRole('option', { name: /Model A/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('groups the default-model picker by Provider', () => {
    render(<ModelSettings actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: '设置默认模型' }));

    expect(screen.getByRole('tab', { name: '全部' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'openai' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Model A/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('selects a newly added Provider for immediate editing', () => {
    render(<ModelSettings actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: '添加 Provider' }));

    expect(screen.getByRole('button', { name: '编辑 Provider new-provider' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'new-provider 名称' })).toHaveValue('new-provider');
  });

  it('selects a newly added model and shows its editor', () => {
    render(<ModelSettings actions={actions} />);
    fireEvent.click(screen.getByRole('tab', { name: '模型目录 1' }));

    fireEvent.click(screen.getByRole('button', { name: '添加模型' }));

    expect(screen.getByRole('option', { name: /new-model/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: 'openai/new-model 模型标识' })).toHaveValue('new-model');
  });

  it('lets the user undo an unsaved category draft', () => {
    render(<ModelSettings actions={actions} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'openai 名称' }), {
      target: { value: 'renamed-provider' },
    });

    fireEvent.click(screen.getByRole('button', { name: '撤销' }));

    expect(screen.getByRole('textbox', { name: 'openai 名称' })).toHaveValue('openai');
    expect(screen.queryByRole('button', { name: '撤销' })).not.toBeInTheDocument();
  });
});
