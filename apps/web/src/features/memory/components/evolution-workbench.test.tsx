import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { CodeActions } from '../../code/use-code-controller';
import { evolutionTestData } from '../evolution-test-data';
import { createMemoryState } from '../memory-state';
import { EvolutionWorkbench } from './evolution-workbench';

describe('EvolutionWorkbench', () => {
  beforeEach(() => {
    Object.assign(appState, createMemoryState(), {
      evolutionPhase: 'ready',
      evolutionData: evolutionTestData(),
      evolutionSelectedId: 'preference-concise-evidence',
    });
  });

  afterEach(() => {
    cleanup();
    Object.assign(appState, createMemoryState());
  });

  it('shows review content first and keeps history and technical details collapsed', async () => {
    render(<EvolutionWorkbench actions={actions()} />);

    expect(screen.queryByRole('region', { name: '学习概览' })).not.toBeInTheDocument();
    expect(screen.getByRole('main', { name: '学习详情' })).toHaveTextContent('Lead with the result.');
    expect(screen.getByText('Keep answers concise and evidence-backed.')).toBeInTheDocument();
    expect(screen.queryByText('Repeated behavior changed future task execution.')).not.toBeInTheDocument();
    expect(screen.queryByText('判断把握')).not.toBeInTheDocument();
    expect(screen.getByText('历史记录').closest('details')).not.toHaveAttribute('open');
    expect(screen.queryByText('更多信息')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /查看全部/ }));
    fireEvent.click(screen.getByRole('button', { name: /Focused verification/ }));
    await screen.findByRole('heading', { name: 'Focused verification' });
    expect(screen.getByRole('heading', { name: '为什么学到它' }).parentElement).not.toHaveTextContent('4 条');
    expect(screen.getByText('第 2 版')).not.toBeVisible();
    fireEvent.click(screen.getByText('历史记录'));
    expect(screen.getByText('第 2 版')).toBeInTheDocument();
    expect(screen.getByText('第 1 版')).toBeInTheDocument();
    expect(screen.getByText('已在对话中使用 · 第 2 版')).toBeInTheDocument();
    expect(screen.queryByText('.a3s/skills/focused-verification')).not.toBeInTheDocument();
  });

  it('materializes a ready candidate directly after review', () => {
    const materializeEvolution = vi.fn().mockResolvedValue(undefined);
    render(<EvolutionWorkbench actions={actions({ materializeEvolution })} />);

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(materializeEvolution).toHaveBeenCalledWith('preference-concise-evidence');
  });

  it('requires confirmation and records an optional reason before rejection', async () => {
    const rejectEvolution = vi.fn().mockResolvedValue(undefined);
    render(<EvolutionWorkbench actions={actions({ rejectEvolution })} />);

    fireEvent.click(screen.getByRole('button', { name: '忽略' }));
    const dialog = screen.getByRole('dialog', { name: '忽略这项内容？' });
    expect(rejectEvolution).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'This preference is project-specific.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '确认忽略' }));

    await waitFor(() =>
      expect(rejectEvolution).toHaveBeenCalledWith(
        'preference-concise-evidence',
        'This preference is project-specific.'
      )
    );
  });

  it('requires confirmation before restoring an immutable version snapshot', async () => {
    const rollbackEvolution = vi.fn().mockResolvedValue(undefined);
    render(<EvolutionWorkbench actions={actions({ rollbackEvolution })} />);
    fireEvent.click(screen.getByRole('button', { name: /查看全部/ }));
    fireEvent.click(screen.getByRole('button', { name: /Focused verification/ }));
    await screen.findByRole('heading', { name: 'Focused verification' });

    fireEvent.click(screen.getByText('历史记录'));
    fireEvent.click(screen.getByRole('button', { name: '恢复这一版' }));
    const dialog = screen.getByRole('dialog', { name: '恢复第 1 版？' });
    expect(rollbackEvolution).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '确认恢复' }));

    await waitFor(() => expect(rollbackEvolution).toHaveBeenCalledWith('skill-focused-verification', 1));
  });

  it('requires confirmation before undoing the first saved asset', async () => {
    const rollbackEvolution = vi.fn().mockResolvedValue(undefined);
    const data = evolutionTestData();
    const skill = data.candidates[1];
    skill.currentVersion = 1;
    skill.versions = skill.versions.slice(0, 1);
    appState.evolutionData = data;
    appState.evolutionSelectedId = skill.id;
    render(<EvolutionWorkbench actions={actions({ rollbackEvolution })} />);
    fireEvent.click(screen.getByRole('button', { name: /查看全部/ }));
    fireEvent.click(screen.getByRole('button', { name: /Focused verification/ }));
    await screen.findByRole('heading', { name: 'Focused verification' });

    fireEvent.click(screen.getByText('历史记录'));
    fireEvent.click(screen.getByRole('button', { name: '撤销保存' }));
    const dialog = screen.getByRole('dialog', { name: '撤销保存？' });
    expect(rollbackEvolution).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent('这项内容会取消保存');
    fireEvent.click(within(dialog).getByRole('button', { name: '确认撤销' }));

    await waitFor(() => expect(rollbackEvolution).toHaveBeenCalledWith('skill-focused-verification', 0));
  });

  it('lets a rejected candidate return to observation', async () => {
    const reopenEvolution = vi.fn().mockResolvedValue(undefined);
    render(<EvolutionWorkbench actions={actions({ reopenEvolution })} />);
    fireEvent.click(screen.getByRole('button', { name: /查看全部/ }));
    fireEvent.click(screen.getByRole('button', { name: /Obsolete library notes/ }));
    await screen.findByRole('heading', { name: 'Obsolete library notes' });

    fireEvent.click(screen.getByRole('button', { name: '重新考虑' }));

    expect(reopenEvolution).toHaveBeenCalledWith('okf-obsolete-library');
  });

  it('shows only content that needs attention until the user asks for everything', () => {
    const data = evolutionTestData();
    data.candidates[1].updateAvailable = true;
    data.stats.updateAvailable = 1;
    appState.evolutionData = data;

    render(<EvolutionWorkbench actions={actions()} />);

    expect(screen.getByLabelText('学习内容')).toHaveTextContent('待处理2 项');
    expect(screen.getByRole('button', { name: '查看全部' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Focused verification/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Obsolete library notes/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看全部' }));

    expect(screen.getByLabelText('学习内容')).toHaveTextContent('全部内容3 项');
    expect(screen.getByRole('button', { name: /Obsolete library notes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '只看待处理' })).toBeInTheDocument();
  });

  it('keeps the visible selection when switching from pending content to all content', () => {
    const data = evolutionTestData();
    data.candidates[0].state = 'materialized';
    data.candidates[1].updateAvailable = true;
    appState.evolutionData = data;
    appState.evolutionSelectedId = data.candidates[0].id;

    render(<EvolutionWorkbench actions={actions()} />);

    expect(screen.getByRole('heading', { name: 'Focused verification' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /查看全部/ }));

    expect(screen.getByRole('heading', { name: 'Focused verification' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Focused verification/ })).toHaveClass('selected');
  });

  it('uses shared collection and detail states when no content needs attention', () => {
    const data = evolutionTestData();
    for (const candidate of data.candidates) {
      candidate.state = 'materialized';
      candidate.updateAvailable = false;
    }
    appState.evolutionData = data;

    render(<EvolutionWorkbench actions={actions()} />);

    expect(screen.getByText('当前没有待处理内容').closest('.ds-collection-state')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '目前没有需要处理的内容' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看全部' })).toBeInTheDocument();
  });

  it('uses plain-language labels for internal source names', () => {
    const data = evolutionTestData();
    data.candidates[0].evidence[0].source = 'workflow';
    appState.evolutionData = data;

    render(<EvolutionWorkbench actions={actions()} />);

    expect(screen.getByText('任务记录')).toBeInTheDocument();
    expect(screen.queryByText('workflow')).not.toBeInTheDocument();
  });

  it('keeps technical load errors out of the visible message', () => {
    Object.assign(appState, {
      evolutionPhase: 'error',
      evolutionData: null,
      evolutionError: 'GET /api/v1/evolution',
    });

    render(<EvolutionWorkbench actions={actions()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('暂时无法读取，请稍后重试。');
    expect(screen.getByText('暂时无法读取，请稍后重试。')).toHaveAttribute('title', 'GET /api/v1/evolution');
  });
});

function actions(overrides: Partial<CodeActions> = {}) {
  return {
    loadEvolution: vi.fn(),
    materializeEvolution: vi.fn().mockResolvedValue(undefined),
    rejectEvolution: vi.fn().mockResolvedValue(undefined),
    reopenEvolution: vi.fn().mockResolvedValue(undefined),
    rollbackEvolution: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as CodeActions;
}
