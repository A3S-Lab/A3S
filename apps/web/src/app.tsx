import { useSnapshot } from 'valtio';
import { AppShell } from './components/app-shell';
import { ToastRegion } from './components/toast-region';
import { CodeBootScreen } from './features/code/components/code-boot-screen';
import { useCodeController } from './features/code/use-code-controller';
import { useKnowledgeController } from './features/knowledge/use-knowledge-controller';
import { usePluginController } from './features/plugins/use-plugin-controller';
import { useWeixinRemoteController } from './features/weixin-remote/use-weixin-remote-controller';
import { appState } from './state/app-state';

export function App() {
  const actions = useCodeController();
  const pluginActions = usePluginController();
  const knowledgeActions = useKnowledgeController();
  const weixinActions = useWeixinRemoteController();
  const state = useSnapshot(appState);

  if (state.bootPhase === 'loading') {
    return <CodeBootScreen phase='loading' />;
  }

  if (state.bootPhase === 'error') {
    return <CodeBootScreen phase='error' error={state.bootError} onRetry={actions.retryBootstrap} />;
  }

  return (
    <>
      <AppShell
        actions={actions}
        pluginActions={pluginActions}
        knowledgeActions={knowledgeActions}
        weixinActions={weixinActions}
      />
      <ToastRegion />
    </>
  );
}
