import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef, useState } from 'react';
import { codeApi } from '../../lib/api';
import { formatApiError, showToast } from '../../state/app-state';
import type { WorkspaceFileSelection } from '../workspace/workspace-state';
import { localPathInside } from './work-local-files';

export interface WorkCodeTab {
  path: string;
  content: string;
  draft: string;
  location: { line: number; column: number } | null;
  loading: boolean;
  loadError: string | null;
  saving: boolean;
}

export interface WorkCodeConflict {
  path: string;
  diskContent: string;
}

export type WorkCodeCloseRequest =
  | { kind: 'tab'; path: string; message: string }
  | { kind: 'workspace'; message: string };

export function useWorkCodeController(rootPath: string) {
  const [tabs, setTabs] = useState<WorkCodeTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [conflict, setConflict] = useState<WorkCodeConflict | null>(null);
  const [closeRequest, setCloseRequest] = useState<WorkCodeCloseRequest | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  useEffect(() => {
    setTabs((current) => current.filter((tab) => localPathInside(rootPath, tab.path)));
    setActivePath((current) => (current && localPathInside(rootPath, current) ? current : null));
    setConflict(null);
    setCloseRequest(null);
  }, [rootPath]);

  const updateTab = useMemoizedFn((path: string, update: (tab: WorkCodeTab) => WorkCodeTab) => {
    setTabs((current) => current.map((tab) => (tab.path === path ? update(tab) : tab)));
  });

  const openFile = useMemoizedFn(async (selection: WorkspaceFileSelection): Promise<boolean> => {
    if (!rootPath || !localPathInside(rootPath, selection.path) || selection.isBinary) return false;
    const existing = tabsRef.current.find((tab) => tab.path === selection.path);
    setActivePath(selection.path);
    if (existing && !existing.loadError) {
      updateTab(selection.path, (tab) => ({
        ...tab,
        location:
          selection.line == null ? tab.location : { line: selection.line, column: Math.max(1, selection.column ?? 1) },
      }));
      return true;
    }

    const location =
      selection.line == null ? null : { line: selection.line, column: Math.max(1, selection.column ?? 1) };
    if (!existing) {
      setTabs((current) => [
        ...current,
        {
          path: selection.path,
          content: '',
          draft: '',
          location,
          loading: true,
          loadError: null,
          saving: false,
        },
      ]);
    } else {
      updateTab(selection.path, (tab) => ({ ...tab, location, loading: true, loadError: null }));
    }
    try {
      const result = await codeApi.readFile(selection.path);
      updateTab(selection.path, (tab) => ({
        ...tab,
        content: result.content,
        draft: result.content,
        loading: false,
        loadError: null,
      }));
      return true;
    } catch (error) {
      const message = formatApiError(error);
      updateTab(selection.path, (tab) => ({ ...tab, loading: false, loadError: message }));
      showToast(message, 'error');
      return false;
    }
  });

  const updateDraft = useMemoizedFn((path: string, draft: string) => {
    updateTab(path, (tab) => ({ ...tab, draft, location: null }));
  });

  const saveFile = useMemoizedFn(async (path = activePath ?? ''): Promise<boolean> => {
    const tab = tabsRef.current.find((candidate) => candidate.path === path);
    if (!tab || tab.loading || tab.saving || tab.content === tab.draft) return Boolean(tab);
    const content = tab.content;
    const draft = tab.draft;
    updateTab(path, (current) => ({ ...current, saving: true }));
    try {
      const disk = await codeApi.readFile(path);
      if (disk.content !== content) {
        setConflict({ path, diskContent: disk.content });
        showToast('文件已在其他应用中修改，请选择保留版本', 'info');
        return false;
      }
      await codeApi.writeFile(path, draft);
      updateTab(path, (current) => ({ ...current, content: draft }));
      showToast('代码文件已保存', 'success');
      return true;
    } catch (error) {
      showToast(formatApiError(error), 'error');
      return false;
    } finally {
      updateTab(path, (current) => ({ ...current, saving: false }));
    }
  });

  const resolveConflict = useMemoizedFn(async (resolution: 'reload' | 'overwrite'): Promise<void> => {
    const current = conflict;
    if (!current) return;
    const tab = tabsRef.current.find((candidate) => candidate.path === current.path);
    if (!tab) {
      setConflict(null);
      return;
    }
    updateTab(current.path, (candidate) => ({ ...candidate, saving: true }));
    try {
      if (resolution === 'reload') {
        updateTab(current.path, (candidate) => ({
          ...candidate,
          content: current.diskContent,
          draft: current.diskContent,
        }));
        showToast('已载入磁盘上的最新版本', 'success');
      } else {
        await codeApi.writeFile(current.path, tab.draft);
        updateTab(current.path, (candidate) => ({ ...candidate, content: candidate.draft }));
        showToast('已用当前编辑覆盖磁盘版本', 'success');
      }
      setConflict(null);
    } catch (error) {
      showToast(formatApiError(error), 'error');
    } finally {
      updateTab(current.path, (candidate) => ({ ...candidate, saving: false }));
    }
  });

  const discardTab = useMemoizedFn((path: string): void => {
    const tab = tabsRef.current.find((candidate) => candidate.path === path);
    if (!tab) return;
    const index = tabsRef.current.findIndex((candidate) => candidate.path === path);
    const nextTabs = tabsRef.current.filter((candidate) => candidate.path !== path);
    setTabs(nextTabs);
    if (activePath === path) setActivePath(nextTabs[index]?.path ?? nextTabs[index - 1]?.path ?? null);
    if (conflict?.path === path) setConflict(null);
  });

  const closeTab = useMemoizedFn((path: string): boolean => {
    const tab = tabsRef.current.find((candidate) => candidate.path === path);
    if (!tab) return true;
    if (tab.content !== tab.draft) {
      setCloseRequest({ kind: 'tab', path, message: `“${fileName(path)}”有未保存的更改。` });
      return false;
    }
    discardTab(path);
    return true;
  });

  const closeWorkspace = useMemoizedFn((): boolean => {
    const dirty = tabsRef.current.filter((tab) => tab.content !== tab.draft);
    if (dirty.length) {
      setCloseRequest({ kind: 'workspace', message: `还有 ${dirty.length} 个文件未保存。` });
      return false;
    }
    setTabs([]);
    setActivePath(null);
    setConflict(null);
    return true;
  });

  const confirmCloseRequest = useMemoizedFn(() => {
    if (!closeRequest) return;
    if (closeRequest.kind === 'tab') discardTab(closeRequest.path);
    else {
      setTabs([]);
      setActivePath(null);
      setConflict(null);
    }
    setCloseRequest(null);
  });

  return {
    tabs,
    activePath,
    activeTab: tabs.find((tab) => tab.path === activePath) ?? null,
    conflict,
    closeRequest,
    openFile,
    activateTab: setActivePath,
    updateDraft,
    saveFile,
    resolveConflict,
    dismissConflict: () => setConflict(null),
    closeTab,
    closeWorkspace,
    confirmCloseRequest,
    dismissCloseRequest: () => setCloseRequest(null),
  };
}

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

export type WorkCodeActions = ReturnType<typeof useWorkCodeController>;
