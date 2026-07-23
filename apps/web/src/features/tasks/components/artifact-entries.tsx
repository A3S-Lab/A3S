import { ArrowUpRight } from 'lucide-react';
import { appState } from '../../../state/app-state';
import { workspaceAbsolutePath } from '../../workspace/workspace-state';
import type { TaskActions } from '../task-actions';
import { isFileEditCall, toolFilePath, type ToolCallProjection } from './tool-call-projection';
import { WorkspaceEntryIcon } from './workspace-entry-icon';

export function ArtifactEntries({
  calls,
  sessionId,
  actions,
}: {
  calls: ToolCallProjection[];
  sessionId: string;
  actions: TaskActions;
}) {
  const paths = [
    ...new Set(
      calls
        .filter((call) => call.state === 'succeeded' && isFileEditCall(call))
        .map(toolFilePath)
        .filter((path): path is string => Boolean(path))
    ),
  ];
  if (!paths.length) return null;

  const openReview = async (path: string) => {
    appState.reviewSourceTaskId = sessionId;
    appState.reviewIntent = 'review';
    appState.gitStatus = null;
    const sessionRoot = appState.sessions.find((session) => session.sessionId === sessionId)?.workspace;
    await actions.selectFile({
      path: workspaceAbsolutePath(path, sessionRoot || appState.workspaceRoot),
      isBinary: false,
    });
  };

  return (
    <section className='artifact-entries' aria-label='任务产物'>
      <header>
        <span>本轮产物</span>
        <small>{paths.length} 个文件变更</small>
      </header>
      <div>
        {paths.map((path) => {
          const presentation = artifactPathPresentation(path);
          return (
            <button
              key={path}
              type='button'
              aria-label={`打开产物 ${path}`}
              onClick={() => {
                void openReview(path);
              }}
            >
              <span className='artifact-entry-icon'>
                <WorkspaceEntryIcon name={presentation.name} isDirectory={false} size={16} />
              </span>
              <span>
                <strong>{presentation.name}</strong>
                <small>{presentation.parent}</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function artifactPathPresentation(path: string): { name: string; parent: string } {
  const normalized = path.replaceAll('\\', '/').replace(/\/$/, '');
  const parts = normalized.split('/').filter(Boolean);
  const name = parts.pop() ?? path;
  return { name, parent: parts.join('/') || '工作区根目录' };
}
