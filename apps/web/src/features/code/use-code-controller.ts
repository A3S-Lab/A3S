import { useRunsController } from '../runs/use-runs-controller';
import { useSettingsController } from '../settings/use-settings-controller';
import { useTaskController } from '../tasks/use-task-controller';
import { useWorkspaceController } from '../workspace/use-workspace-controller';
import { useMemoryController } from '../memory/use-memory-controller';
import { useWorkspaceEditorModelLifecycle } from '../workspace/use-workspace-editor-model-lifecycle';
import { useWorkspacePersistence } from '../workspace/use-workspace-persistence';
import { useAppBootstrap } from './use-app-bootstrap';
import { useShellShortcuts } from './use-shell-shortcuts';

export function useCodeController() {
  const bootstrap = useAppBootstrap();
  const tasks = useTaskController();
  const settings = useSettingsController();
  const runs = useRunsController();
  const workspace = useWorkspaceController();
  const memory = useMemoryController();
  useWorkspaceEditorModelLifecycle();
  useWorkspacePersistence();
  useShellShortcuts(tasks.newConversation);
  return { ...bootstrap, ...tasks, ...settings, ...runs, ...workspace, ...memory };
}

export type CodeActions = ReturnType<typeof useCodeController>;
