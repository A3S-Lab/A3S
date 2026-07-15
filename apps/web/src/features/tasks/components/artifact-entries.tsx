import { ArrowUpRight } from 'lucide-react';
import { appState, navigateTask } from '../../../state/app-state';
import { isFileEditCall, toolFilePath, type ToolCallProjection } from './tool-call-projection';
import { WorkspaceEntryIcon } from './workspace-entry-icon';

export function ArtifactEntries({ calls, sessionId }: { calls: ToolCallProjection[]; sessionId: string }) {
  const paths = [
    ...new Set(
      calls
        .filter((call) => call.state === 'succeeded' && isFileEditCall(call))
        .map(toolFilePath)
        .filter((path): path is string => Boolean(path))
    ),
  ];
  if (!paths.length) return null;

  const openReview = () => {
    appState.reviewSourceTaskId = sessionId;
    appState.reviewIntent = 'review';
    appState.gitStatus = null;
    navigateTask('review');
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
            <button key={path} type='button' aria-label={`查看 ${path} 的变更`} onClick={openReview}>
              <span className='artifact-entry-icon'>
                <WorkspaceEntryIcon name={presentation.name} isDirectory={false} size={16} />
              </span>
              <span>
                <strong>{presentation.name}</strong>
                <small>{presentation.parent} · 查看 Diff</small>
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
