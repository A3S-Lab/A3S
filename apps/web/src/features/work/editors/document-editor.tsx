import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  CheckCheck,
  Cloud,
  Copy,
  FileText,
  Globe2,
  Languages,
  MessageSquareText,
  Minus,
  Plus,
  Sparkles,
  TextQuote,
} from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../../../state/app-state';
import { WorkspaceContextMenu, type WorkspaceContextMenuItem } from '../../workspace/components/workspace-context-menu';
import { WorkDocumentPreview } from '../components/work-document-pages';
import { WorkEditorLoadingState } from '../components/work-editor-loading-state';
import {
  createWorkAgentProposalRequest,
  type WorkAgentProposalRequest,
  type WorkAgentProposalTarget,
} from '../work-agent-proposal';
import type { WorkEditorAgentRequest } from '../work-agent-request';
import {
  editorDocumentCaptionTargets,
  insertDocumentCaption,
  insertDocumentCrossReference,
} from '../work-document-caption-editor';
import { DocumentCaption, DocumentCrossReference } from '../work-document-caption-nodes';
import {
  collectDocumentChanges,
  DocumentChange,
  replaceDocumentTextWithTrackedChange,
  type WorkDocumentChangeKind,
} from '../work-document-changes';
import { documentCitationCount } from '../work-document-citation-editor';
import { DocumentBibliography, DocumentCitation } from '../work-document-citation-nodes';
import {
  collectDocumentCommentAnchors,
  DocumentComment,
  documentCommentViews,
  insertDocumentComment,
  removeDocumentComment,
  retainAnchoredDocumentComments,
} from '../work-document-comments';
import { insertDocumentField, refreshDocumentFields } from '../work-document-field-editor';
import { DocumentField } from '../work-document-field-node';
import { documentMargins, millimetersToPixels } from '../work-document-layout';
import { insertDocumentNote } from '../work-document-note-editor';
import { DocumentNote, DocumentNoteReference } from '../work-document-note-nodes';
import { DocumentPageBreak } from '../work-document-page-break';
import {
  documentPageChromeLegacyFields,
  normalizeDocumentPageChrome,
  updateDocumentPageChromeVariant,
} from '../work-document-page-chrome';
import {
  documentInitialSectionLayout,
  normalizeDocumentHtml,
  syncDocumentContentFromHtml,
} from '../work-document-section';
import {
  activeDocumentSection,
  insertDocumentSection,
  mergeDocumentSectionWithPrevious,
  updateActiveDocumentSection,
} from '../work-document-section-editor';
import { DocumentSection } from '../work-document-section-node';
import { createWorkId } from '../work-templates';
import type { WorkDocumentContent } from '../work-types';
import { DocumentChangesPanel } from './document-changes-panel';
import { DocumentCitationsPanel } from './document-citations-panel';
import { DocumentCommentsPanel } from './document-comments-panel';
import { DocumentLayoutPanel } from './document-layout-panel';
import { DocumentToolbar, type DocumentViewMode } from './document-toolbar';
import { OfficeFileInput, OfficeSlider, useOfficeDialog } from './office-controls';
import { type WorkOfficeFileAction, WorkOfficePreviewBar } from './work-office-chrome';

interface DocumentEditorProps {
  content: WorkDocumentContent;
  preview: boolean;
  saveStatus?: string;
  fileActions?: readonly WorkOfficeFileAction[];
  onChange: (content: WorkDocumentContent) => void;
  onAgentRequest?: (request: WorkEditorAgentRequest) => void | Promise<void>;
}

const MIN_DOCUMENT_ZOOM = 50;
const MAX_DOCUMENT_ZOOM = 200;

function createTrackedDocumentChange(_kind: WorkDocumentChangeKind) {
  return {
    id: createWorkId('change'),
    author: 'A3S Work 用户',
    date: new Date().toISOString(),
  };
}

export function DocumentEditor({
  content,
  preview,
  saveStatus = '已自动保存',
  fileActions,
  onChange,
  onAgentRequest,
}: DocumentEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef(content);
  const trackChangesRef = useRef(Boolean(content.trackChanges));
  const normalizedContent = useMemo(() => normalizeDocumentHtml(content), [content]);
  const initialContentRef = useRef(normalizedContent);
  const appliedContentRef = useRef(normalizedContent);
  const receivedContentRef = useRef(content);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(true);
  const [viewMode, setViewMode] = useState<DocumentViewMode>('page');
  const [zoom, setZoom] = useState(90);
  const officeDialog = useOfficeDialog();
  const [agentMenu, setAgentMenu] = useState<{
    x: number;
    y: number;
    selection: string;
    rawSelection: string;
    from: number;
    to: number;
  } | null>(null);
  const [, setSelectionVersion] = useState(0);
  contentRef.current = content;
  trackChangesRef.current = Boolean(content.trackChanges);
  const editorExtensions = useMemo(
    () => [
      StarterKit.configure({
        link: {
          autolink: true,
          defaultProtocol: 'https',
          openOnClick: false,
        },
        underline: false,
      }),
      DocumentSection,
      DocumentCaption,
      DocumentCrossReference,
      DocumentCitation,
      DocumentBibliography,
      DocumentField,
      DocumentComment,
      DocumentNoteReference,
      DocumentNote,
      Underline,
      Image.configure({
        allowBase64: true,
        resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 60, minHeight: 40 },
      }),
      TableKit.configure({
        table: { resizable: true, allowTableNodeSelection: true },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: '在这里开始输入…' }),
      DocumentPageBreak,
      DocumentChange.configure({
        isTracking: () => trackChangesRef.current,
        createChange: createTrackedDocumentChange,
      }),
    ],
    []
  );
  const editorProps = useMemo(
    () => ({
      attributes: {
        'aria-label': '文档正文',
        'aria-multiline': 'true',
        role: 'textbox',
        spellcheck: 'true',
      },
    }),
    []
  );
  const editor = useEditor({
    extensions: editorExtensions,
    content: initialContentRef.current,
    editable: !preview,
    editorProps,
    onUpdate: ({ editor: current }) => {
      const anchors = collectDocumentCommentAnchors(current.state.doc);
      const next = {
        ...syncDocumentContentFromHtml(contentRef.current, current.getHTML()),
        comments: retainAnchoredDocumentComments(contentRef.current.comments ?? [], anchors),
      };
      appliedContentRef.current = next.html;
      contentRef.current = next;
      onChange(next);
    },
    onSelectionUpdate: () => setSelectionVersion((value) => value + 1),
  });

  useEffect(() => {
    editor?.setEditable(!preview);
  }, [editor, preview]);

  useEffect(() => {
    editor?.view.dom.setAttribute('spellcheck', String(spellcheckEnabled));
  }, [editor, spellcheckEnabled]);

  useEffect(() => {
    if (!editor || receivedContentRef.current === content) return;
    receivedContentRef.current = content;
    const currentContent = normalizeDocumentHtml({ ...content, html: editor.getHTML() });
    if (currentContent === normalizedContent) {
      appliedContentRef.current = normalizedContent;
      return;
    }
    appliedContentRef.current = normalizedContent;
    editor.commands.setContent(normalizedContent, { emitUpdate: false });
  }, [content, editor, normalizedContent]);

  if (!editor) {
    return <WorkEditorLoadingState title='正在准备文字编辑器' />;
  }

  const section = activeDocumentSection(editor);
  const layout = section?.layout ?? documentInitialSectionLayout(content);
  const margins = documentMargins({
    ...content,
    pageSize: layout.pageSize,
    margins: layout.margins,
  });
  const pageCount = documentPageCount(editor);
  const currentPage = Math.min(pageCount, documentCurrentPage(editor));
  const pageStart = Math.max(1, layout.pageNumberStart ?? 1);
  const pageChrome = normalizeDocumentPageChrome(layout.pageChrome, layout);
  const defaultChrome = pageChrome.default;
  const changes = collectDocumentChanges(editor.state.doc);
  const commentAnchors = collectDocumentCommentAnchors(editor.state.doc);
  const comments = documentCommentViews(content.comments ?? [], commentAnchors);
  const citationCount = documentCitationCount(editor);
  const updateLayout = (next: typeof layout) => {
    updateActiveDocumentSection(editor, next);
  };
  const addSection = () => {
    insertDocumentSection(editor, layout.breakAfter);
  };

  if (preview) {
    return (
      <section className='work-document-editor preview'>
        <WorkOfficePreviewBar
          ariaLabel='文字预览工具'
          label='只读预览'
          detail={`${pageCount} 页`}
          fileActions={fileActions}
          className='work-document-ribbon'
        />
        <WorkDocumentPreview content={content} />
        <footer className='work-document-status'>
          <span>{pageCount} 页</span>
          <span>{section?.count ?? 1} 节</span>
        </footer>
      </section>
    );
  }

  return (
    <section className='work-document-editor'>
      <OfficeFileInput
        ref={imageInputRef}
        accept='image/*'
        aria-label='插入文档图片'
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (file.size > 8 * 1024 * 1024) {
            void officeDialog.notice({ title: '图片过大', description: '单张图片不能超过 8 MiB。' });
            return;
          }
          void fileToDataUrl(file).then((src) =>
            editor.chain().focus().setImage({ src, alt: file.name, title: file.name }).run()
          );
        }}
      />
      <DocumentToolbar
        editor={editor}
        fileActions={fileActions}
        layoutOpen={layoutOpen}
        showPageNumbers={defaultChrome.showPageNumber}
        spellcheckEnabled={spellcheckEnabled}
        viewMode={viewMode}
        zoom={zoom}
        onRequestImage={() => imageInputRef.current?.click()}
        onToggleLayout={() => setLayoutOpen((value) => !value)}
        onToggleSpellcheck={() => setSpellcheckEnabled((value) => !value)}
        onViewModeChange={setViewMode}
        onZoomChange={(nextZoom) => setZoom(clampDocumentZoom(nextZoom))}
        onTogglePageNumbers={() => {
          const nextPageChrome = updateDocumentPageChromeVariant(pageChrome, 'default', {
            showPageNumber: !defaultChrome.showPageNumber,
          });
          updateLayout({ ...layout, pageChrome: nextPageChrome, ...documentPageChromeLegacyFields(nextPageChrome) });
        }}
        onInsertSection={addSection}
        onInsertNote={(kind) => insertDocumentNote(editor, kind)}
        onInsertCaption={(kind) =>
          void officeDialog
            .prompt({ title: kind === 'figure' ? '图片题注文字' : '表格题注文字', confirmLabel: '插入题注' })
            .then((title) => {
              if (title !== null) insertDocumentCaption(editor, kind, title);
            })
        }
        onInsertCrossReference={() =>
          void (async () => {
            const targets = editorDocumentCaptionTargets(editor);
            if (!targets.length) {
              await officeDialog.notice({ title: '还没有题注', description: '请先插入图片或表格题注。' });
              return;
            }
            const choice = await officeDialog.prompt({
              title: '引用题注',
              description: targets.map((target) => `${target.display} ${target.title}`.trim()).join('；'),
              initialValue: targets[0].display,
              confirmLabel: '插入引用',
            });
            if (choice === null) return;
            const target = targets.find(
              (item) => item.display === choice.trim() || `${item.display} ${item.title}`.trim() === choice.trim()
            );
            if (!target) {
              await officeDialog.notice({ title: '没有找到题注', description: '请选择现有的图片或表格题注。' });
              return;
            }
            insertDocumentCrossReference(editor, target);
          })()
        }
        citationsOpen={citationsOpen}
        citationSourceCount={content.bibliography?.sources.length ?? 0}
        onToggleCitations={() => setCitationsOpen((value) => !value)}
        onInsertField={(kind) => insertDocumentField(editor, kind, contentRef.current)}
        onRefreshFields={() => {
          refreshDocumentFields(editor, contentRef.current);
        }}
        onInsertComment={() =>
          void (async () => {
            if (editor.state.selection.empty) {
              await officeDialog.notice({ title: '无法添加批注', description: '请先选择要批注的文字。' });
              return;
            }
            const text = await officeDialog.prompt({ title: '批注内容', multiline: true, confirmLabel: '添加批注' });
            if (!text?.trim()) return;
            const comment = {
              id: createWorkId('comment'),
              author: 'A3S Work 用户',
              date: new Date().toISOString(),
              text: text.trim(),
              resolved: false,
            };
            const previous = contentRef.current;
            contentRef.current = {
              ...previous,
              comments: [...(previous.comments ?? []), comment],
            };
            if (!insertDocumentComment(editor, comment.id)) {
              contentRef.current = previous;
              await officeDialog.notice({
                title: '无法添加批注',
                description: '所选文字已经包含批注，请选择其他文字。',
              });
              return;
            }
            setCommentsOpen(true);
          })()
        }
        commentsOpen={commentsOpen}
        commentCount={comments.length}
        onToggleComments={() => setCommentsOpen((value) => !value)}
        trackChanges={Boolean(content.trackChanges)}
        changesOpen={changesOpen}
        changeCount={changes.length}
        onRibbonTabChange={(tab) => {
          if (tab !== 'page') setLayoutOpen(false);
          if (tab !== 'references') setCitationsOpen(false);
          if (tab !== 'review') {
            setCommentsOpen(false);
            setChangesOpen(false);
          }
        }}
        onToggleTrackChanges={() => {
          const trackChanges = !trackChangesRef.current;
          trackChangesRef.current = trackChanges;
          onChange({ ...contentRef.current, trackChanges });
        }}
        onToggleChanges={() => setChangesOpen((value) => !value)}
        onReplaceText={(from, to, replacement) => {
          editor.commands.focus();
          if (trackChangesRef.current) {
            return replaceDocumentTextWithTrackedChange(editor, from, to, replacement, createTrackedDocumentChange);
          }
          return editor
            .chain()
            .focus()
            .setTextSelection({ from, to })
            .insertContent(plainTextAsHtml(replacement))
            .run();
        }}
      />
      {citationsOpen && (
        <DocumentCitationsPanel
          editor={editor}
          content={content}
          onChange={(next) => {
            contentRef.current = next;
            onChange(next);
          }}
          onClose={() => setCitationsOpen(false)}
        />
      )}
      {commentsOpen && (
        <DocumentCommentsPanel
          editor={editor}
          comments={comments}
          onReply={(id, text) => {
            const next = {
              ...contentRef.current,
              comments: (contentRef.current.comments ?? []).map((comment) =>
                comment.id === id
                  ? {
                      ...comment,
                      replies: [
                        ...(comment.replies ?? []),
                        {
                          id: createWorkId('comment-reply'),
                          author: 'A3S Work 用户',
                          date: new Date().toISOString(),
                          text,
                        },
                      ],
                    }
                  : comment
              ),
            };
            contentRef.current = next;
            onChange(next);
          }}
          onToggleResolved={(id) => {
            const next = {
              ...contentRef.current,
              comments: (contentRef.current.comments ?? []).map((comment) =>
                comment.id === id ? { ...comment, resolved: !comment.resolved } : comment
              ),
            };
            contentRef.current = next;
            onChange(next);
          }}
          onDelete={(id) => {
            const next = {
              ...contentRef.current,
              comments: (contentRef.current.comments ?? []).filter((comment) => comment.id !== id),
            };
            contentRef.current = next;
            if (!removeDocumentComment(editor, id)) onChange(next);
          }}
          onClose={() => setCommentsOpen(false)}
        />
      )}
      {changesOpen && <DocumentChangesPanel editor={editor} changes={changes} onClose={() => setChangesOpen(false)} />}
      {layoutOpen && section && (
        <DocumentLayoutPanel
          layout={layout}
          sectionIndex={section.index}
          sectionCount={section.count}
          onChange={updateLayout}
          onInsertSection={addSection}
          onMergeSection={() => mergeDocumentSectionWithPrevious(editor)}
        />
      )}
      <div className={`work-document-scroll ${viewMode}`}>
        <div
          className={`work-document-page-stage ${layout.pageSize} ${layout.orientation} ${viewMode}`}
          data-testid='document-page-stage'
          style={{ '--work-document-zoom': String(zoom / 100) } as CSSProperties}
        >
          <article
            className={`work-document-page ${layout.pageSize} ${layout.orientation}`}
            aria-label={preview ? '文字预览' : '文字页面'}
            style={{
              padding: `${millimetersToPixels(margins.top)}px ${millimetersToPixels(
                margins.right
              )}px ${millimetersToPixels(margins.bottom)}px ${millimetersToPixels(margins.left)}px`,
            }}
          >
            {(defaultChrome.headerHtml || layoutOpen) && (
              <header className='work-document-page-header'>
                {defaultChrome.headerHtml ? (
                  <div
                    className='work-document-page-chrome-html'
                    dangerouslySetInnerHTML={{ __html: defaultChrome.headerHtml }}
                  />
                ) : (
                  '页眉'
                )}
              </header>
            )}
            <section
              className={`work-document-editable ${viewMode}`}
              aria-label='文档内容编辑区域'
              onContextMenu={(event) => {
                if (!onAgentRequest) return;
                const { from, to, empty } = editor.state.selection;
                if (empty) return;
                const rawSelection = editor.state.doc.textBetween(from, to, '\n');
                const selection = rawSelection.trim();
                if (!selection) return;
                event.preventDefault();
                setAgentMenu({ x: event.clientX, y: event.clientY, selection, rawSelection, from, to });
              }}
            >
              <EditorContent editor={editor} />
            </section>
            {(defaultChrome.footerHtml || defaultChrome.showPageNumber || layoutOpen) && (
              <footer className='work-document-page-footer'>
                {defaultChrome.footerHtml ? (
                  <div
                    className='work-document-page-chrome-html'
                    dangerouslySetInnerHTML={{ __html: defaultChrome.footerHtml }}
                  />
                ) : (
                  <span>{layoutOpen ? '页脚' : ''}</span>
                )}
                {defaultChrome.showPageNumber && (
                  <span>
                    {pageStart} / {pageStart + pageCount - 1}
                  </span>
                )}
              </footer>
            )}
          </article>
        </div>
      </div>
      <footer className='work-document-status'>
        <div className='work-document-status-info'>
          <output aria-label='页码状态'>
            第 {currentPage} 页，共 {pageCount} 页
          </output>
          <output aria-label='分节状态'>
            第 {(section?.index ?? 0) + 1} 节，共 {section?.count ?? 1} 节
          </output>
          <output aria-label='字数统计'>字数：{documentWordCount(editor.getText())}</output>
          <button
            type='button'
            aria-label={`校对：${spellcheckEnabled ? '已开启' : '已关闭'}`}
            aria-pressed={spellcheckEnabled}
            onClick={() => setSpellcheckEnabled((value) => !value)}
          >
            <CheckCheck size={12} />
            校对：{spellcheckEnabled ? '已开启' : '已关闭'}
          </button>
          <output aria-label='引用状态' className='work-document-status-detail'>
            {content.bibliography?.sources.length ?? 0} 条文献 · {citationCount} 处引文
          </output>
          <output aria-label='文档保存状态' className='work-document-save-status'>
            <Cloud size={12} />
            {saveStatus}
          </output>
        </div>
        <div className='work-document-status-view'>
          <button
            type='button'
            aria-label='页面视图'
            title='页面视图'
            aria-pressed={viewMode === 'page'}
            onClick={() => setViewMode('page')}
          >
            <FileText size={13} />
          </button>
          <button
            type='button'
            aria-label='网页视图'
            title='网页视图'
            aria-pressed={viewMode === 'web'}
            onClick={() => setViewMode('web')}
          >
            <Globe2 size={13} />
          </button>
          <span className='work-document-status-divider' />
          <button
            type='button'
            aria-label='缩小文档'
            title='缩小文档'
            disabled={zoom <= MIN_DOCUMENT_ZOOM}
            onClick={() => setZoom((value) => clampDocumentZoom(value - 10))}
          >
            <Minus size={13} />
          </button>
          <output aria-label='文档缩放比例'>{zoom}%</output>
          <OfficeSlider
            min={MIN_DOCUMENT_ZOOM}
            max={MAX_DOCUMENT_ZOOM}
            step={5}
            value={zoom}
            ariaLabel='文档缩放'
            onValueChange={(value) => setZoom(clampDocumentZoom(value))}
          />
          <button
            type='button'
            aria-label='放大文档'
            title='放大文档'
            disabled={zoom >= MAX_DOCUMENT_ZOOM}
            onClick={() => setZoom((value) => clampDocumentZoom(value + 10))}
          >
            <Plus size={13} />
          </button>
        </div>
      </footer>
      {agentMenu && onAgentRequest && (
        <WorkspaceContextMenu
          label='选中文本 AI 操作'
          x={agentMenu.x}
          y={agentMenu.y}
          items={documentAgentMenuItems(agentMenu.selection, onAgentRequest, {
            target: {
              id: 'document-selection',
              label: '选中文本',
              before: agentMenu.rawSelection,
            },
            apply: (changes) => {
              const change = changes.find((candidate) => candidate.id === 'document-selection');
              if (!change) return { appliedTargetIds: [], conflicts: [] };
              const current = editor.state.doc.textBetween(agentMenu.from, agentMenu.to, '\n');
              if (current !== agentMenu.rawSelection) {
                return {
                  appliedTargetIds: [],
                  conflicts: [
                    {
                      targetId: change.id,
                      label: change.label,
                      message: '选中文本在建议生成后已发生变化。',
                    },
                  ],
                };
              }
              const applied = trackChangesRef.current
                ? replaceDocumentTextWithTrackedChange(
                    editor,
                    agentMenu.from,
                    agentMenu.to,
                    change.after,
                    createTrackedDocumentChange
                  )
                : editor
                    .chain()
                    .focus()
                    .setTextSelection({ from: agentMenu.from, to: agentMenu.to })
                    .insertContent(plainTextAsHtml(change.after))
                    .run();
              return applied
                ? { appliedTargetIds: [change.id], conflicts: [] }
                : {
                    appliedTargetIds: [],
                    conflicts: [
                      {
                        targetId: change.id,
                        label: change.label,
                        message: '编辑器无法替换当前选区。',
                      },
                    ],
                  };
            },
          })}
          onClose={() => setAgentMenu(null)}
        />
      )}
      {officeDialog.dialog}
    </section>
  );
}

export function documentEditorSelectionText(editor: Pick<NonNullable<ReturnType<typeof useEditor>>, 'state'>): string {
  const { from, to, empty } = editor.state.selection;
  if (empty) return '';
  return editor.state.doc.textBetween(from, to, '\n').trim();
}

export function documentAgentMenuItems(
  selection: string,
  onAgentRequest: (request: WorkEditorAgentRequest) => void | Promise<void>,
  proposalOptions?: {
    target: WorkAgentProposalTarget;
    apply: WorkAgentProposalRequest['apply'];
  }
): WorkspaceContextMenuItem[] {
  return [
    {
      id: 'copy',
      label: '复制',
      icon: <Copy size={14} />,
      onSelect: () => {
        void copyDocumentSelection(selection);
      },
    },
    {
      id: 'ask',
      label: '询问 AI 助手',
      icon: <MessageSquareText size={14} />,
      separatorBefore: true,
      onSelect: () =>
        void onAgentRequest({
          instruction: '请围绕这段选中文本回答我的问题：\n\n问题：',
          selection,
        }),
    },
    {
      id: 'summarize',
      label: '总结选中内容',
      icon: <TextQuote size={14} />,
      onSelect: () =>
        void onAgentRequest({
          instruction: '请用简洁、准确的语言总结这段选中文本，保留关键事实和结论。',
          selection,
        }),
    },
    {
      id: 'rewrite',
      label: '改写得更清晰',
      icon: <Sparkles size={14} />,
      onSelect: () =>
        void onAgentRequest({
          instruction: '请改写这段选中文本，使表达更清晰、自然、专业，并说明主要改动。先提供建议稿，不要直接修改文档。',
          selection,
          proposal: proposalOptions
            ? createWorkAgentProposalRequest({
                title: '审阅文字改写',
                description: `选中文本 · ${selection.length} 个字符`,
                targets: [proposalOptions.target],
                apply: proposalOptions.apply,
              })
            : undefined,
        }),
    },
    {
      id: 'translate',
      label: '翻译选中内容',
      icon: <Languages size={14} />,
      onSelect: () =>
        void onAgentRequest({
          instruction:
            '请翻译这段选中文本。请先判断原语言，并询问或根据上下文确定目标语言；先提供译文，不要直接修改文档。',
          selection,
          proposal: proposalOptions
            ? createWorkAgentProposalRequest({
                title: '审阅翻译建议',
                description: `选中文本 · ${selection.length} 个字符`,
                targets: [proposalOptions.target],
                apply: proposalOptions.apply,
              })
            : undefined,
        }),
    },
  ];
}

function plainTextAsHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replace(/\r?\n/g, '<br>');
}

async function copyDocumentSelection(selection: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is unavailable');
    await navigator.clipboard.writeText(selection);
    showToast('选中文本已复制', 'success');
  } catch {
    showToast('无法访问剪贴板，请使用系统复制快捷键。', 'error');
  }
}

function documentPageCount(editor: NonNullable<ReturnType<typeof useEditor>>): number {
  let pages = 1;
  const sections: Array<{ breakAfter?: string }> = [];
  editor.state.doc.forEach((node) => {
    if (node.type.name !== 'documentSection') return;
    sections.push(node.attrs);
    node.descendants((child) => {
      if (child.type.name === 'documentNote') return false;
      if (child.type.name === 'pageBreak') pages += 1;
    });
  });
  for (let index = 0; index < sections.length - 1; index += 1) {
    if (sections[index].breakAfter !== 'continuous' && sections[index].breakAfter !== 'nextColumn') pages += 1;
  }
  return pages;
}

function documentCurrentPage(editor: NonNullable<ReturnType<typeof useEditor>>): number {
  const selectionPosition = editor.state.selection.from;
  let page = 1;
  let previousBreakAfter: string | undefined;
  let sectionIndex = 0;
  editor.state.doc.forEach((node, position) => {
    if (node.type.name !== 'documentSection') return;
    if (
      sectionIndex > 0 &&
      position < selectionPosition &&
      previousBreakAfter !== 'continuous' &&
      previousBreakAfter !== 'nextColumn'
    ) {
      page += 1;
    }
    if (position < selectionPosition) {
      node.descendants((child, childPosition) => {
        if (child.type.name === 'documentNote') return false;
        if (child.type.name === 'pageBreak' && position + childPosition + 1 < selectionPosition) page += 1;
      });
    }
    previousBreakAfter = node.attrs.breakAfter;
    sectionIndex += 1;
  });
  return page;
}

export function documentWordCount(value: string): number {
  return Array.from(
    value.matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[\p{L}\p{N}]+/gu)
  ).length;
}

function clampDocumentZoom(zoom: number): number {
  return Math.min(MAX_DOCUMENT_ZOOM, Math.max(MIN_DOCUMENT_ZOOM, Math.round(zoom)));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Image could not be read')));
    reader.readAsDataURL(file);
  });
}
