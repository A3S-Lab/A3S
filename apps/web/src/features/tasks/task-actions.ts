export interface TaskActions {
  selectSession(sessionId: string): Promise<void>;
  selectNewTaskWorkspace(workspace: string): Promise<void>;
  pickNewTaskWorkspace(): Promise<string | null>;
  reloadActiveTask(): Promise<void>;
  newConversation(): void;
  sendMessage(): Promise<void>;
  cancelMessage(): Promise<void>;
  compactSession(): Promise<void>;
  resumeQueue(sessionId: string): Promise<void>;
  confirmToolUse(sessionId: string, toolId: string, approved: boolean): Promise<void>;
  removeSession(sessionId: string): Promise<void>;
  renameSession(sessionId: string, title: string): Promise<void>;
  updateSessionModel(model: string): Promise<void>;
  updateEffort(effort: string): Promise<void>;
  updatePermissionMode(permissionMode: string): Promise<void>;
}
