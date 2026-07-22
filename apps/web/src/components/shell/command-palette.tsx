import {
  BrainCircuit,
  CircleHelp,
  FileDiff,
  FileSearch,
  History,
  ListChecks,
  Maximize2,
  Minimize2,
  Settings,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { CollectionState, SearchField, useDialogFocusScope } from '../../design-system/primitives';
import type { CodeActions } from '../../features/code/use-code-controller';
import { appState, navigateMemory, navigateSettings, navigateTask } from '../../state/app-state';

export function CommandPalette({ actions }: { actions: CodeActions }) {
  const state = useSnapshot(appState);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultId = useId();
  const commands = useMemo(
    () => [
      ...(state.activeSessionId && state.workspaceRoot
        ? [
            {
              label: '当前任务',
              description: '继续对话、计划和执行',
              icon: ListChecks,
              run: () => navigateTask('conversation'),
            },
            {
              label: '快速打开文件',
              description: '按文件名或路径查找工作区文件',
              icon: FileSearch,
              run: () => {
                appState.fileQuickOpenOpen = true;
              },
            },
          ]
        : []),
      ...(state.activeSessionId && state.taskView !== 'conversation'
        ? [
            {
              label: state.workspacePresentation === 'fullscreen' ? '退出工作区全屏' : '全屏显示工作区',
              description:
                state.workspacePresentation === 'fullscreen'
                  ? '恢复对话与任务上下文的并排布局'
                  : '让当前任务工作区占满可用内容区域',
              icon: state.workspacePresentation === 'fullscreen' ? Minimize2 : Maximize2,
              run: () => {
                appState.workspacePresentation =
                  appState.workspacePresentation === 'fullscreen' ? 'docked' : 'fullscreen';
              },
            },
          ]
        : []),
      {
        label: '记忆图谱',
        description: '浏览长期记忆、实体关系和保留状态',
        icon: BrainCircuit,
        run: navigateMemory,
      },
      {
        label: '新建任务',
        description: '创建一个新的独立 Code 任务',
        icon: ListChecks,
        run: () => {
          actions.newConversation();
          navigateTask('conversation');
        },
      },
      {
        label: '审阅工作区',
        description: '检查文件、差异、配置验证和 Git',
        icon: FileDiff,
        run: () => {
          appState.reviewIntent = 'review';
          appState.reviewSourceTaskId = appState.activeSessionId;
          navigateTask('review');
        },
      },
      ...(state.activeSessionId
        ? [
            {
              label: '任务活动',
              description: '查看当前任务的工具执行记录',
              icon: History,
              run: () => navigateTask('activity'),
            },
          ]
        : []),
      {
        label: '设置',
        description: '模型、账户、外观和更新',
        icon: Settings,
        run: () => navigateSettings('general'),
      },
      {
        label: '帮助与快捷键',
        description: '查看 Web 工作流、安全说明和快捷键',
        icon: CircleHelp,
        run: () => navigateSettings('help'),
      },
    ],
    [actions, state.activeSessionId, state.taskView, state.workspacePresentation, state.workspaceRoot]
  );
  const visible = useMemo(
    () =>
      commands.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())),
    [commands, query]
  );
  const close = () => {
    appState.commandPaletteOpen = false;
  };
  const focusScope = useDialogFocusScope<HTMLElement>({
    onEscape: close,
    initialFocus: () => inputRef.current,
  });
  const run = (index: number) => {
    const command = visible[index];
    if (!command) return;
    command.run();
    close();
  };
  useEffect(() => setSelectedIndex(0), [query]);
  return (
    <dialog
      open
      className='palette-overlay'
      role='presentation'
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <section
        ref={focusScope.scopeRef}
        className='command-palette'
        role='dialog'
        aria-modal='true'
        aria-label='快速导航'
        onKeyDown={focusScope.handleKeyDown}
      >
        <SearchField
          ref={inputRef}
          className='palette-search'
          label='搜索页面或操作'
          value={query}
          onValueChange={setQuery}
          placeholder='搜索页面或操作'
          role='combobox'
          aria-controls={resultId}
          aria-expanded='true'
          aria-activedescendant={visible[selectedIndex] ? `${resultId}-${selectedIndex}` : undefined}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSelectedIndex((index) => Math.min(index + 1, visible.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSelectedIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              run(selectedIndex);
            }
          }}
        />
        <div className='palette-results' id={resultId} role='listbox' aria-label='可用操作'>
          <span>CODE</span>
          {visible.map(({ label, description, icon: Icon, run }) => (
            <button
              type='button'
              role='option'
              aria-selected={visible[selectedIndex]?.label === label}
              className={visible[selectedIndex]?.label === label ? 'active' : ''}
              id={`${resultId}-${visible.findIndex((item) => item.label === label)}`}
              key={label}
              onClick={() => {
                run();
                close();
              }}
              onMouseEnter={() => setSelectedIndex(visible.findIndex((item) => item.label === label))}
            >
              <Icon size={17} />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </button>
          ))}
          {!visible.length && query && <CollectionState role='status'>没有匹配的操作</CollectionState>}
        </div>
        <footer>
          <kbd>Esc</kbd> 关闭
        </footer>
      </section>
    </dialog>
  );
}
