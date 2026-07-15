import type { WorkspaceActions } from '../../workspace/workspace-actions';
import { WorkspaceExplorer } from '../../workspace/components/workspace-explorer';
import { WorkspaceEditor } from '../../workspace/components/workspace-editor';
import { ChangesInspector } from '../../workspace/components/changes-inspector';
import { WorkspaceSearchPanel } from '../../workspace/components/workspace-search-panel';
import { useSnapshot } from 'valtio';
import { useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { appState } from '../../../state/app-state';
import { Button, Dialog } from '../../../design-system/primitives';

type WorkspacePageProps = {
  actions: WorkspaceActions;
  changesOpen?: boolean;
  onChangesOpenChange?: (open: boolean) => void;
  showChangesTrigger?: boolean;
};

export function WorkspacePage({
  actions,
  changesOpen: controlledChangesOpen,
  onChangesOpenChange,
  showChangesTrigger = true,
}: WorkspacePageProps) {
  const state = useSnapshot(appState);
  const [searchOpen, setSearchOpen] = useState(false);
  const [localChangesOpen, setLocalChangesOpen] = useState(false);
  const changesOpen = controlledChangesOpen ?? localChangesOpen;
  const setChangesOpen = onChangesOpenChange ?? setLocalChangesOpen;
  const pendingCloseTab = state.editorTabs.find((tab) => tab.id === state.pendingEditorTabCloseId);
  const pendingCloseSaving = pendingCloseTab?.kind === 'file' && pendingCloseTab.saving;
  const conflictTab = state.editorTabs.find((tab) => tab.id === state.fileConflict?.tabId);
  const conflictSaving = conflictTab?.kind === 'file' && conflictTab.saving;
  useEffect(() => {
    if (changesOpen) setSearchOpen(false);
  }, [changesOpen]);
  return (
    <section className={`code-page workspace-page ${changesOpen ? 'changes-open' : ''}`}>
      <WorkspaceExplorer
        actions={actions}
        onOpenSearch={() => {
          setChangesOpen(false);
          setSearchOpen(true);
        }}
      />
      <WorkspaceEditor actions={actions} />
      <ChangesInspector actions={actions} compactOpen={changesOpen} onCompactClose={() => setChangesOpen(false)} />
      {showChangesTrigger && !searchOpen && !changesOpen && (
        <Button className='review-compact-changes-button' onClick={() => setChangesOpen(true)}>
          <GitBranch size={14} />
          工作区变更
        </Button>
      )}
      {searchOpen && <WorkspaceSearchPanel actions={actions} onClose={() => setSearchOpen(false)} />}
      {state.pendingEditorTabCloseId && (
        <Dialog
          title='保存文件更改？'
          description='关闭标签前，请决定是否保留未保存的内容。'
          closeDisabled={pendingCloseSaving}
          onClose={actions.cancelEditorTabClose}
          footer={
            <>
              <Button tone='quiet' onClick={actions.cancelEditorTabClose}>
                取消
              </Button>
              <Button tone='danger' onClick={actions.confirmEditorTabClose}>
                不保存
              </Button>
              <Button
                tone='primary'
                loading={pendingCloseSaving}
                onClick={() => {
                  const tabId = appState.pendingEditorTabCloseId;
                  if (!tabId) return;
                  void actions.saveEditorTab(tabId).then((saved) => {
                    if (saved) actions.confirmEditorTabClose();
                  });
                }}
              >
                保存并关闭
              </Button>
            </>
          }
        >
          <p>
            <strong>{basename(pendingCloseTab?.path || '')}</strong> 包含尚未写入磁盘的更改。
          </p>
        </Dialog>
      )}
      {!state.pendingEditorTabCloseId && state.fileConflict && (
        <Dialog
          title='文件已在外部修改'
          description='磁盘内容在此文件打开后发生了变化。请选择要保留的版本。'
          closeDisabled={conflictSaving}
          onClose={actions.cancelFileConflict}
          footer={
            <>
              <Button tone='quiet' disabled={conflictSaving} onClick={actions.cancelFileConflict}>
                返回编辑
              </Button>
              <Button
                disabled={conflictSaving}
                onClick={() => {
                  void actions.resolveFileConflict('reload');
                }}
              >
                使用磁盘版本
              </Button>
              <Button
                tone='danger'
                loading={conflictSaving}
                onClick={() => {
                  void actions.resolveFileConflict('overwrite');
                }}
              >
                覆盖磁盘版本
              </Button>
            </>
          }
        >
          <p>
            当前未保存编辑仍保留。覆盖将写入 <strong>{basename(state.fileConflict.path)}</strong>
            ，使用磁盘版本则会放弃当前编辑。
          </p>
        </Dialog>
      )}
    </section>
  );
}

function basename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}
