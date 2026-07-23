import { useDebounce } from 'ahooks';
import { ChevronDown, CirclePlus, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { SidebarProductHeader } from '../../../components/sidebar-product-header';
import { CollectionState, IconButton, SearchField } from '../../../design-system/primitives';
import { appState, sessionTitle } from '../../../state/app-state';
import type { TaskActions } from '../task-actions';
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
      session.agentId !== 'work' &&
      (!query ||
        sessionTitle(session, state.sessionTitles).toLowerCase().includes(query) ||
        session.workspace.toLowerCase().includes(query))
  );
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);
  return (
    <aside className='task-library' aria-label='Code 任务'>
      <SidebarProductHeader
        title='编码'
        onCollapse={() => {
          appState.sidebarOpen = false;
        }}
      >
        <IconButton
          ref={searchTriggerRef}
          label={searchOpen ? '关闭任务搜索' : '搜索任务'}
          selected={searchOpen}
          aria-expanded={searchOpen}
          onClick={() => {
            if (searchOpen) appState.searchQuery = '';
            else setTasksExpanded(true);
            setSearchOpen(!searchOpen);
          }}
        >
          <Search size={15} />
        </IconButton>
      </SidebarProductHeader>
      <button
        type='button'
        className={`task-library-new ${state.activeSessionId ? '' : 'active'}`}
        aria-current={state.activeSessionId ? undefined : 'page'}
        onClick={() => {
          actions.newConversation();
          closeCompactTaskLibrary();
        }}
      >
        <CirclePlus size={16} />
        <span>新建任务</span>
      </button>
      {searchOpen && (
        <SearchField
          ref={searchInputRef}
          className='task-library-search'
          size='compact'
          label='搜索任务'
          clearLabel='清除任务搜索'
          value={state.searchQuery}
          placeholder='搜索任务'
          onValueChange={(value) => {
            appState.searchQuery = value;
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            appState.searchQuery = '';
            setSearchOpen(false);
            searchTriggerRef.current?.focus();
          }}
        />
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
                    closeCompactTaskLibrary();
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
          <CollectionState className='task-list-empty' role='status'>
            {query ? '没有匹配的任务' : '暂无任务'}
          </CollectionState>
        ) : null}
      </section>
    </aside>
  );
}

function closeCompactTaskLibrary(): void {
  if (window.innerWidth <= 620) appState.sidebarOpen = false;
}
