import { useRunsController } from '../runs/use-runs-controller';
import { useSettingsController } from '../settings/use-settings-controller';
import { useTaskController } from '../tasks/use-task-controller';
import { useWorkspaceController } from '../workspace/use-workspace-controller';
import { useAppBootstrap } from './use-app-bootstrap';
import { useShellShortcuts } from './use-shell-shortcuts';

export function useCodeController() {
  const bootstrap = useAppBootstrap();
  const tasks = useTaskController();
  const settings = useSettingsController();
  const runs = useRunsController();
  const workspace = useWorkspaceController();
  useShellShortcuts(tasks.newConversation);
  return { ...bootstrap, ...tasks, ...settings, ...runs, ...workspace };
}

export type CodeActions = ReturnType<typeof useCodeController>;
