import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codeApi } from '../../../lib/api';
import { appState } from '../../../state/app-state';
import type { PersonalKnowledgeBase, WorkspaceEntry } from '../../../types/api';
import type { KnowledgeActions } from '../use-knowledge-controller';
import { KnowledgePage } from './knowledge-page';

const knowledgeBase: PersonalKnowledgeBase = {
  id: 'project-notes',
  name: 'Project Notes',
  description: 'Local project knowledge.',
  origin: 'created',
  marketplaceId: null,
  version: '1.0.0',
  pinned: true,
  createdAt: '2026-07-22T00:00:00Z',
  updatedAt: '2026-07-22T00:00:00Z',
  path: '/workspace/.a3s/kb/bases/project-notes',
  sourceCount: 1,
  conceptCount: 1,
  bytes: 1024,
};

const readme: WorkspaceEntry = {
  name: 'README.md',
  path: `${knowledgeBase.path}/README.md`,
  isDirectory: false,
  isFile: true,
  size: 32,
  extension: 'md',
  isBinary: false,
};

describe('standalone knowledge page', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#knowledge');
    appState.activeProduct = 'knowledge';
    appState.sidebarOpen = true;
    appState.knowledgeStatus = 'ready';
    appState.knowledgeError = null;
    appState.knowledgeOperationStatus = 'idle';
    appState.knowledgeOperationId = null;
    appState.knowledgeOperationError = null;
    appState.personalKnowledgeBases = {
      schemaVersion: 1,
      workspaceRoot: '/workspace',
      root: '/workspace/.a3s/kb/bases',
      total: 1,
      warnings: [],
      items: [knowledgeBase],
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('presents only the user local knowledge bases in the Work-style hierarchy', () => {
    const actions = createKnowledgeActions();
    const { container } = render(<KnowledgePage actions={actions} />);

    expect(screen.getByRole('region', { name: '知识' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '知识导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起知识侧边栏' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我的知识库 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: '我的知识库' })).toBeInTheDocument();
    expect(container.querySelector('.plugin-marketplace-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByText('知识库市场')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '安装' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '置顶知识库' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '全部知识库' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Project Notes' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '打开知识库 Project Notes' })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '新建知识库' }));
    expect(screen.getByRole('dialog', { name: '新建知识库' })).toBeInTheDocument();
  });

  it('opens a local knowledge base in a vault tree and saves Markdown edits', async () => {
    vi.spyOn(codeApi, 'readDir').mockResolvedValue([readme]);
    vi.spyOn(codeApi, 'readFile').mockResolvedValue({ content: '# Project Notes\n\nInitial note.' });
    const writeFile = vi.spyOn(codeApi, 'writeFile').mockResolvedValue({ success: true });
    render(<KnowledgePage actions={createKnowledgeActions()} />);

    fireEvent.click(screen.getAllByRole('button', { name: '打开知识库 Project Notes' })[0]);

    expect(await screen.findByRole('region', { name: 'Project Notes 知识库编辑器' })).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: '知识库文件' })).toBeInTheDocument();
    const editor = await screen.findByRole('textbox', { name: '编辑 README.md' });
    fireEvent.change(editor, { target: { value: '# Project Notes\n\nUpdated note.' } });
    fireEvent.click(screen.getByRole('button', { name: '保存笔记' }));

    await waitFor(() => expect(writeFile).toHaveBeenCalledWith(readme.path, '# Project Notes\n\nUpdated note.'));
  });

  it('imports an Obsidian vault or another local folder as a knowledge base', async () => {
    const imported = { ...knowledgeBase, id: 'research-vault', name: 'Research Vault', origin: 'imported' as const };
    const actions = createKnowledgeActions({
      pickKnowledgeBaseDirectory: vi.fn(async () => '/Users/me/Research Vault'),
      importKnowledgeBase: vi.fn(async () => imported),
    });
    render(<KnowledgePage actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: '导入知识库' }));
    expect(screen.getByRole('dialog', { name: '导入知识库' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '选择文件夹' }));
    expect(await screen.findByDisplayValue('/Users/me/Research Vault')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '开始导入' }));

    await waitFor(() =>
      expect(actions.importKnowledgeBase).toHaveBeenCalledWith({
        path: '/Users/me/Research Vault',
        name: undefined,
      })
    );
  });

  it('collapses and restores the Knowledge sidebar like Work', async () => {
    render(<KnowledgePage actions={createKnowledgeActions()} />);

    fireEvent.click(screen.getByRole('button', { name: '收起知识侧边栏' }));
    expect(appState.sidebarOpen).toBe(false);
    await waitFor(() => expect(screen.queryByRole('complementary', { name: '知识导航' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '展开知识侧边栏' }));
    expect(appState.sidebarOpen).toBe(true);
    await waitFor(() => expect(screen.getByRole('complementary', { name: '知识导航' })).toBeInTheDocument());
  });

  it('clears an active search after creating a personal knowledge base', async () => {
    const actions = createKnowledgeActions();
    render(<KnowledgePage actions={actions} />);

    fireEvent.change(screen.getByPlaceholderText('搜索知识库'), { target: { value: 'Research' } });
    fireEvent.click(screen.getByRole('button', { name: '新建知识库' }));
    fireEvent.change(screen.getByRole('textbox', { name: '名称' }), { target: { value: 'Project Atlas' } });
    fireEvent.click(screen.getByRole('button', { name: '创建知识库' }));

    await waitFor(() =>
      expect(actions.createKnowledgeBase).toHaveBeenCalledWith({
        name: 'Project Atlas',
        description: undefined,
      })
    );
    expect(screen.getByRole('heading', { name: '我的知识库' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索知识库')).toHaveValue('');
  });

  it('loads the local knowledge bases when the standalone page opens cold', () => {
    appState.knowledgeStatus = 'idle';
    appState.personalKnowledgeBases = null;
    const actions = createKnowledgeActions();

    render(<KnowledgePage actions={actions} />);

    expect(actions.refreshKnowledge).toHaveBeenCalledOnce();
  });
});

function createKnowledgeActions(overrides: Partial<KnowledgeActions> = {}): KnowledgeActions {
  return {
    refreshKnowledge: vi.fn(async () => undefined),
    createKnowledgeBase: vi.fn(async () => true),
    pickKnowledgeBaseDirectory: vi.fn(async () => null),
    importKnowledgeBase: vi.fn(async () => null),
    setPinned: vi.fn(async () => true),
    clearOperationError: vi.fn(),
    ...overrides,
  } as KnowledgeActions;
}
