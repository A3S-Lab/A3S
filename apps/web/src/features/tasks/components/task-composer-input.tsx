import { Upload } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react';
import { codeApi } from '../../../lib/api';
import { appState, formatApiError, showToast } from '../../../state/app-state';
import type { SkillCatalogItem } from '../../../types/api';
import { composerInputTriggerKey, type ComposerInputTrigger } from './composer-input-trigger';
import { matchingComposerCommands } from './composer-commands';
import { ComposerSuggestionMenu, type ComposerSuggestionItem } from './composer-suggestion-menu';
import { matchingSkills } from './composer-suggestion-ranking';
import { ComposerWorkspaceTree, type ComposerWorkspaceTreeHandle } from './composer-workspace-tree';
import { TaskPromptEditor, type TaskPromptEditorHandle } from './task-prompt-editor';
import { importWorkspaceDrop } from './workspace-drop-import';

export function TaskComposerInput({
  value,
  disabled,
  workspaceRoot,
  selectedFiles,
  selectedSkills,
  onChange,
  onSubmit,
  onAddFile,
  onAddSkill,
  onImportingChange,
}: {
  value: string;
  disabled: boolean;
  workspaceRoot: string;
  selectedFiles: readonly string[];
  selectedSkills: readonly string[];
  onChange: (value: string) => void;
  onSubmit: () => void;
  onAddFile: (path: string) => void;
  onAddSkill: (name: string) => void;
  onImportingChange: (importing: boolean) => void;
}) {
  const editorRef = useRef<TaskPromptEditorHandle>(null);
  const workspaceTreeRef = useRef<ComposerWorkspaceTreeHandle>(null);
  const skillRequest = useRef(0);
  const skillRequestedFor = useRef<string | null>(null);
  const dragDepth = useRef(0);
  const listboxId = useId();
  const [trigger, setTrigger] = useState<ComposerInputTrigger | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [treeActiveDescendant, setTreeActiveDescendant] = useState<string>();
  const [skills, setSkills] = useState<SkillCatalogItem[] | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const triggerKey = trigger ? composerInputTriggerKey(trigger) : null;
  const open = Boolean(trigger && triggerKey !== dismissedFor);

  useEffect(() => {
    setSkills(null);
    setSkillsError(null);
    skillRequestedFor.current = null;
    skillRequest.current += 1;
  }, [workspaceRoot]);

  useEffect(() => {
    if (
      !open ||
      trigger?.kind !== 'skill' ||
      !workspaceRoot ||
      skills ||
      skillsLoading ||
      skillRequestedFor.current === workspaceRoot
    )
      return;
    const requestId = ++skillRequest.current;
    skillRequestedFor.current = workspaceRoot;
    setSkillsLoading(true);
    setSkillsError(null);
    void codeApi
      .skills(workspaceRoot)
      .then((result) => {
        if (skillRequest.current === requestId) setSkills(result.items.filter((item) => item.enabled));
      })
      .catch((error: unknown) => {
        if (skillRequest.current === requestId) setSkillsError(formatApiError(error));
      })
      .finally(() => {
        if (skillRequest.current === requestId) setSkillsLoading(false);
      });
  }, [open, skills, skillsLoading, trigger?.kind, workspaceRoot]);

  const items = useMemo(() => {
    if (!trigger || trigger.kind === 'file') return [];
    const skillItems = matchingSkills(
      (skills ?? []).filter((skill) => !selectedSkills.includes(skill.name)),
      trigger.query
    ).map(skillSuggestion);
    return [...matchingComposerCommands(trigger.query), ...skillItems];
  }, [selectedSkills, skills, trigger]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trigger?.kind, trigger?.query]);

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(Math.max(0, items.length - 1));
  }, [activeIndex, items.length]);

  const selectItem = (item: ComposerSuggestionItem) => {
    if (!trigger) return;
    if (item.kind === 'command') editorRef.current?.replaceTrigger(trigger, '/goal ');
    else {
      editorRef.current?.replaceTrigger(trigger);
      if (item.kind === 'file') onAddFile(item.id);
      else onAddSkill(item.id);
    }
    setTrigger(null);
    setDismissedFor(null);
  };

  const selectFile = (path: string) => {
    if (!trigger || trigger.kind !== 'file') return;
    editorRef.current?.replaceTrigger(trigger);
    onAddFile(path);
    setTrigger(null);
    setDismissedFor(null);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent) => {
    if (!open || !trigger) return false;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (trigger.kind === 'file') workspaceTreeRef.current?.moveActive(1);
      else setActiveIndex((index) => Math.min(index + 1, Math.max(0, items.length - 1)));
      return true;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (trigger.kind === 'file') workspaceTreeRef.current?.moveActive(-1);
      else setActiveIndex((index) => Math.max(0, index - 1));
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      if (trigger.kind === 'file') workspaceTreeRef.current?.activateActive();
      else if (items[activeIndex]) selectItem(items[activeIndex]);
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setDismissedFor(composerInputTriggerKey(trigger));
      return true;
    }
    return false;
  };

  const currentIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (disabled || importing) return;
    dragDepth.current += 1;
    setDropActive(true);
  };
  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = disabled || importing ? 'none' : 'copy';
  };
  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDropActive(false);
  };
  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDropActive(false);
    if (disabled || importing) return;
    setImporting(true);
    onImportingChange(true);
    try {
      const result = await importWorkspaceDrop(event.dataTransfer, workspaceRoot);
      for (const path of result.importedPaths) onAddFile(path);
      try {
        appState.filesByDirectory[workspaceRoot] = await codeApi.readDir(workspaceRoot);
      } catch {
        // Imported paths remain usable even if the explorer refresh fails.
      }
      showToast(
        `已将 ${result.fileCount} 个文件${result.directoryCount ? `、${result.directoryCount} 个文件夹` : ''}放入工作区`,
        'success'
      );
    } catch (error) {
      showToast(`拖入失败：${formatApiError(error)}`, 'error');
    } finally {
      setImporting(false);
      onImportingChange(false);
    }
  };
  return (
    <fieldset
      className={`task-composer-input ${dropActive ? 'drop-active' : ''} ${importing ? 'drop-importing' : ''}`}
      aria-label='任务输入与工作区文件拖入区域'
      aria-busy={importing}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(event) => void handleDrop(event)}
    >
      <TaskPromptEditor
        ref={editorRef}
        value={value}
        disabled={disabled}
        onChange={onChange}
        onSubmit={onSubmit}
        onTriggerChange={(next) => {
          setTrigger(next);
          if (!next) setDismissedFor(null);
        }}
        onTriggerKeyDown={handleTriggerKeyDown}
        suggestionsOpen={open}
        suggestionsId={open ? listboxId : undefined}
        activeSuggestionId={
          open && trigger?.kind === 'file'
            ? treeActiveDescendant
            : open && items[currentIndex]
              ? `${listboxId}-${currentIndex}`
              : undefined
        }
      />
      {open &&
        trigger &&
        (trigger.kind === 'file' ? (
          <ComposerWorkspaceTree
            ref={workspaceTreeRef}
            id={listboxId}
            workspaceRoot={workspaceRoot}
            query={trigger.query}
            selectedFiles={selectedFiles}
            onSelect={selectFile}
            onActiveDescendantChange={setTreeActiveDescendant}
          />
        ) : (
          <ComposerSuggestionMenu
            id={listboxId}
            kind='skill'
            query={trigger.query}
            items={items}
            activeIndex={currentIndex}
            loading={skillsLoading}
            error={skillsError}
            onActiveIndexChange={setActiveIndex}
            onSelect={selectItem}
          />
        ))}
      {(dropActive || importing) && (
        <output className='composer-drop-overlay' aria-live='polite'>
          <span>
            <Upload size={20} />
          </span>
          <strong>{importing ? '正在放入工作区…' : '松开放入工作区'}</strong>
          <small>{importing ? '正在安全复制文件，请不要关闭页面' : '文件和文件夹会复制到工作区并加入任务上下文'}</small>
        </output>
      )}
    </fieldset>
  );
}

function hasDraggedFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes('Files');
}

function skillSuggestion(skill: SkillCatalogItem): ComposerSuggestionItem {
  return {
    id: skill.name,
    kind: 'skill',
    label: `/${skill.name}`,
    description: skill.description || 'Skill',
    meta: 'Skill',
  };
}
