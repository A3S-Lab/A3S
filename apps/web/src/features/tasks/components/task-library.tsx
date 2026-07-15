import { useDebounce } from 'ahooks';
import { ChevronDown, CirclePlus, PanelLeftClose, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { IconButton } from '../../../design-system/primitives';
import type { TaskActions } from '../task-actions';
import { appState, sessionTitle } from '../../../state/app-state';
import { TaskLibraryItem } from './task-library-item';

export function TaskLibrary({ actions }: { actions: TaskActions }) {
  const state = useSnapshot(appState);
  const [searchOpen, setSearchOpen] = useState(Boolean(state.searchQuery));
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const query = useDebounce(state.searchQuery.trim().toLowerCase(), { wait: 160 });
  const sessions = state.sessions.filter(
    (session) =>
      !query ||
      sessionTitle(session, state.sessionTitles).toLowerCase().includes(query) ||
      session.workspace.toLowerCase().includes(query)
  );
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);
  return (
    <aside className='task-library' aria-label='Code 任务'>
      <header>
        <div className='task-library-brand'>
          <span>A3S Code</span>
          {state.health?.version && <small>v{state.health.version}</small>}
        </div>
        <div className='task-library-header-actions'>
          <button
            ref={searchTriggerRef}
            type='button'
            className={`ds-icon-button ${searchOpen ? 'selected' : ''}`}
            aria-label={searchOpen ? '关闭任务搜索' : '搜索任务'}
            title={searchOpen ? '关闭任务搜索' : '搜索任务'}
            aria-expanded={searchOpen}
            onClick={() => {
              if (searchOpen) appState.searchQuery = '';
              else setTasksExpanded(true);
              setSearchOpen(!searchOpen);
            }}
          >
            <Search size={15} />
          </button>
          <IconButton
            label='收起任务列表'
            onClick={() => {
              appState.sidebarOpen = false;
            }}
          >
            <PanelLeftClose size={16} />
          </IconButton>
        </div>
      </header>
      <button
        type='button'
        className={`task-library-new ${state.activeSessionId ? '' : 'active'}`}
        aria-current={state.activeSessionId ? undefined : 'page'}
        onClick={actions.newConversation}
      >
        <CirclePlus size={16} />
        <span>新建任务</span>
      </button>
      {searchOpen && (
        <label className='task-library-search'>
          <Search size={14} />
          <input
            ref={searchInputRef}
            type='search'
            value={state.searchQuery}
            onChange={(event) => {
              appState.searchQuery = event.target.value;
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              appState.searchQuery = '';
              setSearchOpen(false);
              searchTriggerRef.current?.focus();
            }}
            placeholder='搜索任务'
            aria-label='搜索任务'
          />
        </label>
      )}
      <section className='task-list' aria-label='任务列表'>
        <button
          type='button'
          className='task-list-label'
          aria-expanded={tasksExpanded}
          onClick={() => setTasksExpanded(!tasksExpanded)}
        >
          <span>任务 ({sessions.length})</span>
          <ChevronDown size={13} />
        </button>
        {tasksExpanded && sessions.length ? (
          <div className='task-list-items'>
            {sessions.map((session) => {
              const title = sessionTitle(session, state.sessionTitles);
              return (
                <TaskLibraryItem
                  key={session.sessionId}
                  session={session}
                  title={title}
                  active={state.activeSessionId === session.sessionId}
                  running={state.streamingSessionId === session.sessionId}
                  onSelect={() => {
                    void actions.selectSession(session.sessionId);
                  }}
                  onRename={(name) => actions.renameSession(session.sessionId, name)}
                  onDelete={
                    state.streamingSessionId === session.sessionId
                      ? undefined
                      : () => actions.removeSession(session.sessionId)
                  }
                />
              );
            })}
          </div>
        ) : tasksExpanded ? (
          <div className='task-list-empty'>
            <span>{query ? '没有匹配的任务' : '暂无任务'}</span>
          </div>
        ) : null}
      </section>
    </aside>
  );
}
