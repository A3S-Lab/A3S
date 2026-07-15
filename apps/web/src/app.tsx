import { useSnapshot } from 'valtio';
import { AppShell } from './components/app-shell';
import { ToastRegion } from './components/toast-region';
import { CodeBootScreen } from './features/code/components/code-boot-screen';
import { useCodeController } from './features/code/use-code-controller';
import { appState } from './state/app-state';

export function App() {
  const actions = useCodeController();
  const state = useSnapshot(appState);

  if (state.bootPhase === 'loading') {
    return <CodeBootScreen phase='loading' />;
  }

  if (state.bootPhase === 'error') {
    return <CodeBootScreen phase='error' error={state.bootError} onRetry={actions.retryBootstrap} />;
  }

  return (
    <>
      <AppShell actions={actions} />
      <ToastRegion />
    </>
  );
}
