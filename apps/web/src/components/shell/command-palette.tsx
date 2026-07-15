import { CircleHelp, FileDiff, History, ListChecks, Search, Settings } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import type { CodeActions } from '../../features/code/use-code-controller';
import { appState, navigateSettings, navigateTask } from '../../state/app-state';

export function CommandPalette({ actions }: { actions: CodeActions }) {
  const state = useSnapshot(appState);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const resultId = useId();
  const commands = useMemo(
    () => [
      ...(state.activeSessionId
        ? [
            {
              label: '当前任务',
              description: '继续对话、计划和执行',
              icon: ListChecks,
              run: () => navigateTask('conversation'),
            },
          ]
        : []),
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
    [actions, state.activeSessionId]
  );
  const visible = useMemo(
    () =>
      commands.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())),
    [commands, query]
  );
  const close = () => {
    appState.commandPaletteOpen = false;
  };
  const run = (index: number) => {
    const command = visible[index];
    if (!command) return;
    command.run();
    close();
  };
  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => restoreFocusRef.current?.focus();
  }, []);
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
        ref={dialogRef}
        className='command-palette'
        role='dialog'
        aria-modal='true'
        aria-label='快速导航'
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
          if (event.key !== 'Tab') return;
          const focusable = [
            ...(dialogRef.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled), [tabindex="0"]') ?? []),
          ];
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <label>
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='搜索页面或操作'
            aria-label='搜索页面或操作'
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
        </label>
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
          {!visible.length && query && <p>没有匹配的操作</p>}
        </div>
        <footer>
          <kbd>Esc</kbd> 关闭
        </footer>
      </section>
    </dialog>
  );
}
