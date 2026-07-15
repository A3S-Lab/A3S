import { useMemoizedFn } from 'ahooks';
import { codeApi } from '../../lib/api';
import { appState, formatApiError, showToast } from '../../state/app-state';

export function useRunsController() {
  const openSessionOutput = useMemoizedFn(async () => {
    const sessionId = appState.activeSessionId;
    if (!sessionId) {
      showToast('请先开始一个任务', 'info');
      return;
    }
    appState.commandPaletteOpen = false;
    if (appState.sessionOutputSessionId !== sessionId) appState.sessionOutput = null;
    appState.sessionOutputSessionId = null;
    appState.sessionOutputError = null;
    appState.sessionOutputErrorSessionId = null;
    appState.sessionOutputLoading = true;
    try {
      appState.sessionOutput = await codeApi.sessionOutput(sessionId);
      appState.sessionOutputSessionId = sessionId;
    } catch (error) {
      const message = formatApiError(error);
      appState.sessionOutputError = message;
      appState.sessionOutputErrorSessionId = sessionId;
      showToast(message, 'error');
    } finally {
      appState.sessionOutputLoading = false;
    }
  });
  return { openSessionOutput };
}
