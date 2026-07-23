import { FolderInput, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import { SidebarProductOpenButton } from '../../../components/sidebar-product-header';
import { Button, SearchField } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { PersonalKnowledgeBase } from '../../../types/api';
import { KnowledgeSidebar } from '../components/knowledge-sidebar';
import type { KnowledgeActions } from '../use-knowledge-controller';
import { CreateKnowledgeBaseDialog, ImportKnowledgeBaseDialog, KnowledgeDirectory } from './knowledge-directory';
import { KnowledgeEditor } from './knowledge-editor';

export function KnowledgePage({ actions }: { actions: KnowledgeActions }) {
  const state = useSnapshot(appState);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const knowledgeCount = state.personalKnowledgeBases?.total ?? 0;
  const selectedBase =
    (state.personalKnowledgeBases?.items.find((item) => item.id === selectedBaseId) as
      | PersonalKnowledgeBase
      | undefined) ?? null;

  useEffect(() => {
    if (appState.knowledgeStatus === 'idle') void actions.refreshKnowledge();
  }, [actions.refreshKnowledge]);

  useEffect(() => {
    if (selectedBaseId && state.personalKnowledgeBases && !selectedBase) setSelectedBaseId(null);
  }, [selectedBase, selectedBaseId, state.personalKnowledgeBases]);

  const showLibrary = () => {
    setSelectedBaseId(null);
    setQuery('');
  };

  return (
    <section className='knowledge-product' aria-label='知识'>
      {state.sidebarOpen && (
        <KnowledgeSidebar
          count={knowledgeCount}
          libraryActive={!selectedBase}
          refreshing={state.knowledgeStatus === 'loading'}
          onShowLibrary={showLibrary}
          onCollapse={() => {
            appState.sidebarOpen = false;
          }}
          onCreate={() => setCreateOpen(true)}
          onImport={() => setImportOpen(true)}
          onRefresh={() => void actions.refreshKnowledge()}
        />
      )}

      {selectedBase ? (
        <KnowledgeEditor
          knowledgeBase={selectedBase}
          onBack={showLibrary}
          onRefreshKnowledge={() => void actions.refreshKnowledge(true)}
        />
      ) : (
        <section className='work-home knowledge-home'>
          <header className='work-home-header'>
            <div className='work-home-title'>
              {!state.sidebarOpen && (
                <SidebarProductOpenButton
                  title='知识'
                  className='work-sidebar-open-button'
                  onOpen={() => {
                    appState.sidebarOpen = true;
                  }}
                />
              )}
              <h1>我的知识库</h1>
            </div>
            <div className='work-home-header-actions'>
              <SearchField
                className='work-search'
                label='搜索知识库'
                value={query}
                placeholder='搜索知识库'
                onValueChange={setQuery}
              />
              <Button tone='secondary' onClick={() => setImportOpen(true)}>
                <FolderInput size={15} />
                导入知识库
              </Button>
              <Button tone='secondary' onClick={() => setCreateOpen(true)}>
                <Plus size={15} />
                新建知识库
              </Button>
            </div>
          </header>

          <KnowledgeDirectory
            actions={actions}
            query={query}
            onCreate={() => setCreateOpen(true)}
            onImport={() => setImportOpen(true)}
            onOpen={(item) => setSelectedBaseId(item.id)}
          />
        </section>
      )}

      {createOpen && (
        <CreateKnowledgeBaseDialog
          actions={actions}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            showLibrary();
          }}
        />
      )}
      {importOpen && (
        <ImportKnowledgeBaseDialog
          actions={actions}
          onClose={() => setImportOpen(false)}
          onImported={(item) => {
            setImportOpen(false);
            setQuery('');
            setSelectedBaseId(item.id);
          }}
        />
      )}
    </section>
  );
}
