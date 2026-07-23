import type { Editor } from '@tiptap/core';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  CheckCheck,
  Columns3,
  FileDiff,
  FilePlus2,
  FileText,
  Globe2,
  Hash,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  MessageSquarePlus,
  MessagesSquare,
  Redo2,
  RefreshCw,
  Replace,
  Search,
  Settings2,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import type { WorkDocumentCaptionKind } from '../work-document-captions';
import type { WorkDocumentFieldKind } from '../work-document-fields';
import type { WorkDocumentNoteKind } from '../work-document-notes';
import { OfficeColorPicker, OfficeSelect, useOfficeDialog } from './office-controls';
import { isOfficeShortcutBlocked } from './office-shortcuts';
import {
  type WorkOfficeFileAction,
  WorkOfficeRibbon,
  WorkOfficeRibbonButton,
  WorkOfficeRibbonGroup,
} from './work-office-chrome';

const documentRibbonTabs = [
  { id: 'home', label: '开始' },
  { id: 'insert', label: '插入' },
  { id: 'page', label: '页面布局' },
  { id: 'references', label: '引用' },
  { id: 'review', label: '审阅' },
  { id: 'view', label: '视图' },
] as const;

type DocumentRibbonTabId = (typeof documentRibbonTabs)[number]['id'];
export type DocumentViewMode = 'page' | 'web';

interface DocumentToolbarProps {
  editor: Editor;
  layoutOpen: boolean;
  showPageNumbers: boolean;
  spellcheckEnabled: boolean;
  viewMode: DocumentViewMode;
  zoom: number;
  onRequestImage: () => void;
  onToggleLayout: () => void;
  onTogglePageNumbers: () => void;
  onToggleSpellcheck: () => void;
  onViewModeChange: (mode: DocumentViewMode) => void;
  onZoomChange: (zoom: number) => void;
  onInsertSection: () => void;
  onInsertNote: (kind: WorkDocumentNoteKind) => void;
  onInsertCaption: (kind: WorkDocumentCaptionKind) => void;
  onInsertCrossReference: () => void;
  citationsOpen: boolean;
  citationSourceCount: number;
  onToggleCitations: () => void;
  onInsertField: (kind: WorkDocumentFieldKind) => void;
  onRefreshFields: () => void;
  onInsertComment: () => void;
  commentsOpen: boolean;
  commentCount: number;
  onToggleComments: () => void;
  trackChanges: boolean;
  changesOpen: boolean;
  changeCount: number;
  fileActions?: readonly WorkOfficeFileAction[];
  onRibbonTabChange?: (tab: DocumentRibbonTabId) => void;
  onToggleTrackChanges: () => void;
  onToggleChanges: () => void;
  onReplaceText: (from: number, to: number, replacement: string) => boolean;
}

export function DocumentToolbar({
  editor,
  layoutOpen,
  showPageNumbers,
  spellcheckEnabled,
  viewMode,
  zoom,
  onRequestImage,
  onToggleLayout,
  onTogglePageNumbers,
  onToggleSpellcheck,
  onViewModeChange,
  onZoomChange,
  onInsertSection,
  onInsertNote,
  onInsertCaption,
  onInsertCrossReference,
  citationsOpen,
  citationSourceCount,
  onToggleCitations,
  onInsertField,
  onRefreshFields,
  onInsertComment,
  commentsOpen,
  commentCount,
  onToggleComments,
  trackChanges,
  changesOpen,
  changeCount,
  fileActions,
  onRibbonTabChange,
  onToggleTrackChanges,
  onToggleChanges,
  onReplaceText,
}: DocumentToolbarProps) {
  const [activeTab, setActiveTab] = useState<DocumentRibbonTabId>('home');
  const officeDialog = useOfficeDialog();
  const prompt = officeDialog.prompt;
  const notice = officeDialog.notice;
  const toggleLink = useCallback(async () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = await prompt({
      title: '链接地址',
      initialValue: editor.getAttributes('link').href ?? 'https://',
      placeholder: 'https://',
      confirmLabel: '添加链接',
    });
    if (href?.trim()) editor.chain().focus().setLink({ href: href.trim() }).run();
  }, [editor, prompt]);
  const findText = useCallback(
    async (replace: boolean) => {
      const query = await prompt({ title: replace ? '查找要替换的文字' : '查找文字' });
      if (!query) return;
      const range = textRange(editor, query, editor.state.selection.to) ?? textRange(editor, query, 0);
      if (!range) {
        await notice({ title: '没有找到', description: `文档中没有“${query}”。` });
        return;
      }
      if (!replace) {
        editor.chain().focus().setTextSelection(range).run();
        return;
      }
      const replacement = await prompt({ title: '替换为', initialValue: query });
      if (replacement !== null) {
        if (onReplaceText) onReplaceText(range.from, range.to, replacement);
        else editor.chain().focus().setTextSelection(range).insertContent(replacement).run();
      }
    },
    [editor, notice, onReplaceText, prompt]
  );

  useEffect(() => {
    const root = editor.view.dom.closest<HTMLElement>('.work-document-editor');
    if (!root) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        isOfficeShortcutBlocked(event.target) ||
        !(event.metaKey || event.ctrlKey)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      const insideEditor = event.target instanceof Node && editor.view.dom.contains(event.target);
      if (insideEditor && key === 'z') {
        event.preventDefault();
        const command = event.shiftKey ? editor.chain().focus().redo() : editor.chain().focus().undo();
        command.run();
        return;
      }
      if (insideEditor && key === 'y' && !event.shiftKey) {
        event.preventDefault();
        editor.chain().focus().redo().run();
        return;
      }
      if (!event.shiftKey && insideEditor && (key === 'b' || key === 'i' || key === 'u')) {
        event.preventDefault();
        if (key === 'b') editor.chain().focus().toggleBold().run();
        else if (key === 'i') editor.chain().focus().toggleItalic().run();
        else editor.chain().focus().toggleUnderline().run();
        return;
      }
      if (key === 'k' && !event.shiftKey) {
        event.preventDefault();
        void toggleLink();
        return;
      }
      if ((key === 'f' || key === 'h') && !event.shiftKey) {
        event.preventDefault();
        void findText(key === 'h');
        return;
      }
      if (key !== 'enter' || event.shiftKey || !insideEditor) {
        return;
      }
      event.preventDefault();
      editor.chain().focus().insertContent({ type: 'pageBreak' }).run();
    };
    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [editor, findText, toggleLink]);

  return (
    <>
      <WorkOfficeRibbon
        ariaLabel='文字功能区'
        tabs={documentRibbonTabs}
        defaultTab='home'
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          onRibbonTabChange?.(tab);
        }}
        fileActions={fileActions}
        className='work-document-ribbon'
        toolbarClassName='document-toolbar'
        panels={{
          home: (
            <>
              <RibbonGroup label='撤销'>
                <ToolbarButton
                  label='撤销'
                  shortcut='Cmd/Ctrl+Z'
                  disabled={!editor.can().chain().focus().undo().run()}
                  onClick={() => editor.chain().focus().undo().run()}
                >
                  <Undo2 size={16} />
                </ToolbarButton>
                <ToolbarButton
                  label='重做'
                  shortcut='Cmd/Ctrl+Shift+Z'
                  disabled={!editor.can().chain().focus().redo().run()}
                  onClick={() => editor.chain().focus().redo().run()}
                >
                  <Redo2 size={16} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='样式'>
                <OfficeSelect
                  ariaLabel='段落样式'
                  value={
                    editor.isActive('heading', { level: 1 })
                      ? 'h1'
                      : editor.isActive('heading', { level: 2 })
                        ? 'h2'
                        : editor.isActive('heading', { level: 3 })
                          ? 'h3'
                          : 'paragraph'
                  }
                  options={[
                    { value: 'paragraph', label: '正文' },
                    { value: 'h1', label: '标题 1' },
                    { value: 'h2', label: '标题 2' },
                    { value: 'h3', label: '标题 3' },
                  ]}
                  onValueChange={(value) => {
                    if (value === 'paragraph') editor.chain().focus().setParagraph().run();
                    else
                      editor
                        .chain()
                        .focus()
                        .toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 })
                        .run();
                  }}
                />
              </RibbonGroup>
              <RibbonGroup label='字体'>
                <ToolbarButton
                  label='加粗'
                  shortcut='Cmd/Ctrl+B'
                  active={editor.isActive('bold')}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold size={16} />
                </ToolbarButton>
                <ToolbarButton
                  label='斜体'
                  shortcut='Cmd/Ctrl+I'
                  active={editor.isActive('italic')}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic size={16} />
                </ToolbarButton>
                <ToolbarButton
                  label='下划线'
                  shortcut='Cmd/Ctrl+U'
                  active={editor.isActive('underline')}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                  <UnderlineIcon size={16} />
                </ToolbarButton>
                <ToolbarButton
                  label='删除线'
                  active={editor.isActive('strike')}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough size={16} />
                </ToolbarButton>
                <OfficeColorPicker
                  compact
                  className='work-color-tool'
                  value={editor.getAttributes('textStyle').color ?? '#172033'}
                  ariaLabel='文字颜色'
                  onValueChange={(color) => editor.chain().focus().setColor(color).run()}
                />
                <ToolbarButton
                  label='突出显示'
                  active={editor.isActive('highlight')}
                  onClick={() => editor.chain().focus().toggleHighlight({ color: '#fff0a6' }).run()}
                >
                  <Highlighter size={16} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='段落'>
                <ToolbarButton
                  label='项目符号'
                  active={editor.isActive('bulletList')}
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                  <List size={16} />
                </ToolbarButton>
                <ToolbarButton
                  label='编号'
                  active={editor.isActive('orderedList')}
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                  <ListOrdered size={16} />
                </ToolbarButton>
                <ToolbarButton
                  label='左对齐'
                  active={editor.isActive({ textAlign: 'left' })}
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                >
                  <AlignLeft size={16} />
                </ToolbarButton>
                <ToolbarButton
                  label='居中'
                  active={editor.isActive({ textAlign: 'center' })}
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                >
                  <AlignCenter size={16} />
                </ToolbarButton>
                <ToolbarButton
                  label='右对齐'
                  active={editor.isActive({ textAlign: 'right' })}
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                >
                  <AlignRight size={16} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='编辑'>
                <ToolbarButton label='查找' shortcut='Cmd/Ctrl+F' onClick={() => void findText(false)}>
                  <Search size={16} />
                </ToolbarButton>
                <ToolbarButton label='替换' shortcut='Cmd/Ctrl+H' onClick={() => void findText(true)}>
                  <Replace size={16} />
                </ToolbarButton>
              </RibbonGroup>
              {editor.isActive('table') && (
                <RibbonGroup label='表格'>
                  <ToolbarButton label='添加行' onClick={() => editor.chain().focus().addRowAfter().run()}>
                    + 行
                  </ToolbarButton>
                  <ToolbarButton label='添加列' onClick={() => editor.chain().focus().addColumnAfter().run()}>
                    + 列
                  </ToolbarButton>
                  <ToolbarButton label='删除表格' onClick={() => editor.chain().focus().deleteTable().run()}>
                    × 表
                  </ToolbarButton>
                </RibbonGroup>
              )}
            </>
          ),
          insert: (
            <>
              <RibbonGroup label='插图与表格'>
                <ToolbarButton label='插入图片' displayLabel onClick={onRequestImage}>
                  <ImageIcon size={19} />
                </ToolbarButton>
                <ToolbarButton
                  label='插入表格'
                  displayLabel
                  onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                >
                  <Table2 size={19} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='页面'>
                <ToolbarButton
                  label='插入分页符'
                  shortcut='Cmd/Ctrl+Enter'
                  displayLabel
                  onClick={() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run()}
                >
                  <FilePlus2 size={19} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='链接'>
                <ToolbarButton
                  label={editor.isActive('link') ? '取消链接' : '添加链接'}
                  shortcut='Cmd/Ctrl+K'
                  displayLabel
                  active={editor.isActive('link')}
                  onClick={() => void toggleLink()}
                >
                  <Link2 size={19} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='页码和日期'>
                <DocumentFieldSelect onInsertField={onInsertField} />
              </RibbonGroup>
            </>
          ),
          page: (
            <>
              <RibbonGroup label='页面设置'>
                <ToolbarButton label='页面设置' displayLabel active={layoutOpen} onClick={onToggleLayout}>
                  <Settings2 size={19} />
                </ToolbarButton>
                <ToolbarButton label='显示页码' displayLabel active={showPageNumbers} onClick={onTogglePageNumbers}>
                  <Hash size={19} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='分隔符'>
                <ToolbarButton
                  label='插入分页符'
                  shortcut='Cmd/Ctrl+Enter'
                  displayLabel
                  onClick={() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run()}
                >
                  <FilePlus2 size={19} />
                </ToolbarButton>
                <ToolbarButton label='插入分节符' displayLabel onClick={onInsertSection}>
                  <Columns3 size={19} />
                </ToolbarButton>
              </RibbonGroup>
            </>
          ),
          references: (
            <>
              <RibbonGroup label='脚注与尾注'>
                <ToolbarButton label='插入脚注' displayLabel onClick={() => onInsertNote('footnote')}>
                  <span className='work-ribbon-glyph'>¹</span>
                </ToolbarButton>
                <ToolbarButton label='插入尾注' displayLabel onClick={() => onInsertNote('endnote')}>
                  <span className='work-ribbon-glyph'>ⅰ</span>
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='题注'>
                <ToolbarButton label='插入图片题注' displayLabel onClick={() => onInsertCaption('figure')}>
                  <ImageIcon size={19} />
                </ToolbarButton>
                <ToolbarButton label='插入表格题注' displayLabel onClick={() => onInsertCaption('table')}>
                  <Table2 size={19} />
                </ToolbarButton>
                <ToolbarButton label='插入交叉引用' displayLabel onClick={onInsertCrossReference}>
                  <Link2 size={19} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='引用来源'>
                <ToolbarButton
                  label={`引用来源${citationSourceCount ? `（${citationSourceCount}）` : ''}`}
                  displayLabel
                  active={citationsOpen}
                  onClick={onToggleCitations}
                >
                  <BookOpen size={19} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='更新'>
                <ToolbarButton label='更新页码和日期' displayLabel onClick={onRefreshFields}>
                  <RefreshCw size={19} />
                </ToolbarButton>
              </RibbonGroup>
            </>
          ),
          review: (
            <>
              <RibbonGroup label='校对'>
                <ToolbarButton label='拼写检查' displayLabel active={spellcheckEnabled} onClick={onToggleSpellcheck}>
                  <CheckCheck size={19} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='批注'>
                <ToolbarButton label='添加批注' displayLabel onClick={onInsertComment}>
                  <MessageSquarePlus size={19} />
                </ToolbarButton>
                <ToolbarButton
                  label={`查看批注${commentCount ? `（${commentCount}）` : ''}`}
                  displayLabel
                  active={commentsOpen}
                  onClick={onToggleComments}
                >
                  <MessagesSquare size={19} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label='修订'>
                <ToolbarButton label='修订模式' displayLabel active={trackChanges} onClick={onToggleTrackChanges}>
                  <FileDiff size={19} />
                </ToolbarButton>
                <ToolbarButton
                  label={`查看修订${changeCount ? `（${changeCount}）` : ''}`}
                  displayLabel
                  active={changesOpen}
                  onClick={onToggleChanges}
                >
                  <ListChecks size={19} />
                </ToolbarButton>
              </RibbonGroup>
            </>
          ),
          view: (
            <>
              <RibbonGroup label='文档视图'>
                <ToolbarButton
                  label='页面视图'
                  displayLabel
                  active={viewMode === 'page'}
                  onClick={() => onViewModeChange('page')}
                >
                  <FileText size={19} />
                </ToolbarButton>
                <ToolbarButton
                  label='网页视图'
                  displayLabel
                  active={viewMode === 'web'}
                  onClick={() => onViewModeChange('web')}
                >
                  <Globe2 size={19} />
                </ToolbarButton>
              </RibbonGroup>
              <RibbonGroup label={`缩放 ${zoom}%`}>
                <ToolbarButton label='缩小文档' onClick={() => onZoomChange(zoom - 10)}>
                  <ZoomOut size={17} />
                </ToolbarButton>
                {[75, 100, 125].map((value) => (
                  <ToolbarButton
                    key={value}
                    label={`缩放至 ${value}%`}
                    active={zoom === value}
                    onClick={() => onZoomChange(value)}
                  >
                    {value}%
                  </ToolbarButton>
                ))}
                <ToolbarButton label='放大文档' onClick={() => onZoomChange(zoom + 10)}>
                  <ZoomIn size={17} />
                </ToolbarButton>
              </RibbonGroup>
            </>
          ),
        }}
      />
      {officeDialog.dialog}
    </>
  );
}

function ToolbarButton({
  label,
  shortcut,
  active = false,
  disabled = false,
  displayLabel = false,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  displayLabel?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <WorkOfficeRibbonButton
      label={label}
      visibleLabel={label.replace(/（\d+）$/, '')}
      title={shortcut ? `${label}（${shortcut}）` : label}
      active={active}
      displayLabel={displayLabel}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </WorkOfficeRibbonButton>
  );
}

const RibbonGroup = WorkOfficeRibbonGroup;

function DocumentFieldSelect({ onInsertField }: { onInsertField: (kind: WorkDocumentFieldKind) => void }) {
  return (
    <OfficeSelect
      ariaLabel='插入页码或日期'
      value=''
      options={[
        { value: '', label: '页码或日期' },
        { value: 'page', label: '页码' },
        { value: 'numPages', label: '总页数' },
        { value: 'section', label: '当前节号' },
        { value: 'sectionPages', label: '本节页数' },
        { value: 'date', label: '当前日期' },
        { value: 'time', label: '当前时间' },
      ]}
      onValueChange={(kind) => {
        if (kind) onInsertField(kind);
      }}
    />
  );
}

function textRange(editor: Editor, query: string, from: number): { from: number; to: number } | null {
  let match: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, position) => {
    if (match || !node.isText || !node.text) return;
    const start = Math.max(0, from - position);
    const index = node.text.indexOf(query, start);
    if (index >= 0) match = { from: position + index, to: position + index + query.length };
  });
  return match;
}
