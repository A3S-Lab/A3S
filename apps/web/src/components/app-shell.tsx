import { RefreshCw, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { Button } from '../design-system/primitives';
import type { CodeActions } from '../features/code/use-code-controller';
import { KnowledgePage } from '../features/knowledge/pages/knowledge-page';
import type { KnowledgeActions } from '../features/knowledge/use-knowledge-controller';
import { MemoryPage } from '../features/memory/pages/memory-page';
import { PluginHostPage } from '../features/plugins/pages/plugin-host-page';
import { PluginMarketplacePage } from '../features/plugins/pages/plugin-marketplace-page';
import type { PluginActions } from '../features/plugins/use-plugin-controller';
import { SettingsDialog } from '../features/settings/components/settings-dialog';
import { TaskLibrary } from '../features/tasks/components/task-library';
import { TasksPage } from '../features/tasks/pages/tasks-page';
import type { WeixinRemoteActions } from '../features/weixin-remote/use-weixin-remote-controller';
import { WorkProduct } from '../features/work/pages/work-product';
import { WorkspaceQuickOpen } from '../features/workspace/components/workspace-quick-open';
import { appState } from '../state/app-state';
import { ActivityBar } from './activity-bar';
import { CommandPalette } from './shell/command-palette';

export function AppShell({
  actions,
  pluginActions,
  knowledgeActions,
  weixinActions,
}: {
  actions: CodeActions;
  pluginActions?: PluginActions;
  knowledgeActions?: KnowledgeActions;
  weixinActions?: WeixinRemoteActions;
}) {
  const state = useSnapshot(appState);

  useEffect(() => {
    let compact = isCompactViewport();
    if (compact) appState.sidebarOpen = false;
    const handleResize = () => {
      const nextCompact = isCompactViewport();
      if (nextCompact && !compact) appState.sidebarOpen = false;
      compact = nextCompact;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <main className='app-shell'>
      <ActivityBar />
      {state.activeProduct === 'code' && state.codeSurface === 'tasks' && state.sidebarOpen && (
        <TaskLibrary actions={actions} />
      )}
      <section className='product-workspace'>
        {state.activeProduct === 'plugin' ? (
          pluginActions ? (
            <PluginHostPage actions={pluginActions} />
          ) : null
        ) : state.activeProduct === 'plugins' ? (
          pluginActions ? (
            <PluginMarketplacePage actions={pluginActions} />
          ) : null
        ) : state.activeProduct === 'knowledge' ? (
          knowledgeActions ? (
            <KnowledgePage actions={knowledgeActions} />
          ) : null
        ) : state.activeProduct === 'work' ? (
          <WorkProduct actions={actions} />
        ) : state.codeSurface === 'memory' ? (
          <MemoryPage actions={actions} />
        ) : (
          <TasksPage actions={actions} />
        )}
      </section>
      {state.settingsOpen && <SettingsDialog actions={actions} weixinActions={weixinActions} />}
      {state.serviceStatus !== 'connected' && (
        <output className='service-connection-banner' aria-live='polite'>
          <WifiOff size={16} />
          <div>
            <strong>{state.serviceStatus === 'checking' ? '正在重新连接…' : '本地服务连接已中断'}</strong>
            <span>
              {state.serviceError ? `${state.serviceError} ` : ''}当前页面内容可能已过期；未保存的编辑仍保留在浏览器中。
            </span>
          </div>
          <Button
            loading={state.serviceStatus === 'checking'}
            disabled={state.serviceStatus === 'checking'}
            onClick={() => {
              void actions.retryConnection();
            }}
          >
            <RefreshCw size={13} />
            重新连接
          </Button>
        </output>
      )}
      {state.activeProduct === 'code' && state.commandPaletteOpen && <CommandPalette actions={actions} />}
      {state.activeProduct === 'code' && state.fileQuickOpenOpen && <WorkspaceQuickOpen actions={actions} />}
    </main>
  );
}

function isCompactViewport(): boolean {
  return window.innerWidth <= 620;
}
