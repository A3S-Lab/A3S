import { ExternalLink, FileText, SearchCheck } from 'lucide-react';
import { Button } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import { workspaceAbsolutePath } from '../../workspace/workspace-state';
import type { TaskActions } from '../task-actions';
import type { ToolCallProjection } from './tool-call-projection';

interface DeepResearchReport {
  status: 'completed' | 'qualified' | 'degraded';
  htmlPath: string;
  markdownPath: string;
}

export function DeepResearchReportCard({
  calls,
  sessionId,
  actions,
}: {
  calls: readonly ToolCallProjection[];
  sessionId: string;
  actions: TaskActions;
}) {
  const report = calls
    .filter((call) => call.name === 'deep_research' && call.state === 'succeeded')
    .map(reportFromCall)
    .find((candidate): candidate is DeepResearchReport => Boolean(candidate));
  if (!report) return null;

  const sessionRoot = appState.sessions.find((session) => session.sessionId === sessionId)?.workspace;
  const href = `/api/v1/kernel/sessions/${encodeURIComponent(sessionId)}/research-report?path=${encodeURIComponent(
    report.htmlPath
  )}`;
  const status = reportStatus(report.status);

  return (
    <section className={`deep-research-report-card ${report.status}`} aria-label='DeepResearch 研究报告'>
      <span className='deep-research-report-icon' aria-hidden='true'>
        <SearchCheck size={18} />
      </span>
      <span className='deep-research-report-copy'>
        <strong>深度研究报告</strong>
        <small>{status}</small>
      </span>
      <span className='deep-research-report-actions'>
        <Button
          tone='quiet'
          aria-label='在工作区打开 Markdown 研究报告'
          onClick={() => {
            void actions.selectFile({
              path: workspaceAbsolutePath(report.markdownPath, sessionRoot || appState.workspaceRoot),
              isBinary: false,
            });
          }}
        >
          <FileText size={13} />
          Markdown
        </Button>
        <a href={href} target='_blank' rel='noopener noreferrer' aria-label='打开网页版研究报告'>
          <ExternalLink size={13} />
          打开网页
        </a>
      </span>
    </section>
  );
}

function reportFromCall(call: ToolCallProjection): DeepResearchReport | null {
  const report = recordValue(call.metadata?.report);
  const status = stringValue(report?.status);
  const htmlPath = stringValue(report?.htmlPath);
  const markdownPath = stringValue(report?.markdownPath);
  if (!['completed', 'qualified', 'degraded'].includes(status ?? '') || !htmlPath || !markdownPath) return null;
  if (!isResearchArtifact(htmlPath, 'index.html') || !isResearchArtifact(markdownPath, 'report.md')) return null;
  return { status: status as DeepResearchReport['status'], htmlPath, markdownPath };
}

function isResearchArtifact(path: string, fileName: string): boolean {
  return path.startsWith('.a3s/research/') && path.endsWith(`/${fileName}`) && !path.split('/').includes('..');
}

function reportStatus(status: DeepResearchReport['status']): string {
  if (status === 'completed') return '质量门槛已通过';
  if (status === 'qualified') return '证据充分，建议复核限定条件';
  return '来源快照已生成，结论仍需复核';
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
