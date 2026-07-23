import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
import { DeepResearchReportCard } from './deep-research-report-card';

afterEach(() => {
  vi.restoreAllMocks();
  appState.sessions = [];
});

it('opens the generated HTML report safely and exposes the Markdown artifact in the workspace', () => {
  appState.sessions = [
    {
      sessionId: 'session/report',
      workspace: '/repo',
      cwd: '/repo',
      model: 'codex/gpt',
      followDefaultModel: false,
      permissionMode: 'default',
      state: 'idle',
      createdAt: 1,
    },
  ];
  const selectFile = vi.fn(async () => undefined);
  render(
    <DeepResearchReportCard
      sessionId='session/report'
      actions={{ selectFile } as unknown as TaskActions}
      calls={[
        {
          id: 'deep-research-1',
          name: 'deep_research',
          state: 'succeeded',
          inputText: '',
          output: 'published',
          metadata: {
            report: {
              status: 'completed',
              htmlPath: '.a3s/research/topic/index.html',
              markdownPath: '.a3s/research/topic/report.md',
            },
          },
        },
      ]}
    />
  );

  const report = screen.getByRole('link', { name: '打开网页版研究报告' });
  expect(report).toHaveAttribute(
    'href',
    '/api/v1/kernel/sessions/session%2Freport/research-report?path=.a3s%2Fresearch%2Ftopic%2Findex.html'
  );
  expect(report).toHaveAttribute('target', '_blank');
  expect(screen.getByText('质量门槛已通过')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '在工作区打开 Markdown 研究报告' }));
  expect(selectFile).toHaveBeenCalledWith({ path: '/repo/.a3s/research/topic/report.md', isBinary: false });
});
