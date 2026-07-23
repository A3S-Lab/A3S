import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  BarChart3,
  Bold,
  ClipboardPaste,
  Copy,
  Grid2X2,
  Image,
  LayoutTemplate,
  Link2,
  MessageSquarePlus,
  MessagesSquare,
  PanelsTopLeft,
  Play,
  Plus,
  Redo2,
  Scissors,
  Square,
  Table2,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import type { WorkSlide, WorkSlideElement, WorkSlideTextAlign, WorkSlideTransition } from '../work-types';
import { OfficeColorPicker, OfficeNumberField, useOfficeDialog } from './office-controls';
import { PresentationTransitionPanel } from './presentation-transition-panel';
import {
  type WorkOfficeFileAction,
  WorkOfficeRibbon,
  WorkOfficeRibbonButton,
  WorkOfficeRibbonGroup,
} from './work-office-chrome';

const presentationRibbonTabs = [
  { id: 'home', label: '开始' },
  { id: 'insert', label: '插入' },
  { id: 'design', label: '设计' },
  { id: 'transitions', label: '切换' },
  { id: 'slideshow', label: '幻灯片放映' },
  { id: 'review', label: '审阅' },
  { id: 'view', label: '视图' },
] as const;

export function PresentationToolbar({
  selectedSlide,
  selectedElement,
  slideCount,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onCopySelection,
  onCutSelection,
  onPasteSelection,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddElement,
  onRequestImage,
  onAddTable,
  onAddChart,
  onAddComment,
  commentsOpen,
  commentCount,
  onToggleComments,
  onUpdateElement,
  onReorderElement,
  onSetBackground,
  designOpen,
  editingDesign,
  onToggleDesign,
  background,
  transition,
  onTransitionChange,
  onApplyTransitionToAll,
  onStartSlideshow,
  fileActions,
  viewMode = 'normal',
  onViewModeChange,
}: {
  selectedSlide: WorkSlide;
  selectedElement: WorkSlideElement | null;
  slideCount: number;
  onAddSlide: () => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
  onCopySelection: () => void;
  onCutSelection: () => void;
  onPasteSelection: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => boolean;
  onRedo: () => boolean;
  onAddElement: (type: 'text' | 'shape') => void;
  onRequestImage: () => void;
  onAddTable: () => void;
  onAddChart: () => void;
  onAddComment: () => void;
  commentsOpen: boolean;
  commentCount: number;
  onToggleComments: () => void;
  onUpdateElement: (patch: Partial<WorkSlideElement>) => void;
  onReorderElement: (direction: -1 | 1) => void;
  onSetBackground: (color: string) => void;
  designOpen: boolean;
  editingDesign: boolean;
  onToggleDesign: () => void;
  background?: string;
  transition: WorkSlideTransition | undefined;
  onTransitionChange: (transition: WorkSlideTransition | undefined) => void;
  onApplyTransitionToAll: () => void;
  onStartSlideshow?: () => void;
  fileActions?: readonly WorkOfficeFileAction[];
  viewMode?: 'normal' | 'sorter';
  onViewModeChange?: (mode: 'normal' | 'sorter') => void;
}) {
  const officeDialog = useOfficeDialog();
  return (
    <>
      <WorkOfficeRibbon
        ariaLabel='演示功能区'
        tabs={presentationRibbonTabs}
        defaultTab='home'
        fileActions={fileActions}
        className='work-presentation-ribbon'
        toolbarClassName='presentation-toolbar'
        panels={{
          home: (
            <>
              <WorkOfficeRibbonGroup label='撤销与恢复'>
                <WorkOfficeRibbonButton label='撤销' title='撤销（Cmd/Ctrl+Z）' disabled={!canUndo} onClick={onUndo}>
                  <Undo2 size={19} />
                </WorkOfficeRibbonButton>
                <WorkOfficeRibbonButton
                  label='重做'
                  title='重做（Cmd/Ctrl+Shift+Z）'
                  disabled={!canRedo}
                  onClick={onRedo}
                >
                  <Redo2 size={19} />
                </WorkOfficeRibbonButton>
              </WorkOfficeRibbonGroup>
              <WorkOfficeRibbonGroup label='幻灯片'>
                <WorkOfficeRibbonButton
                  label='新建幻灯片'
                  title='新建幻灯片（Ctrl+M / ⌘⇧N）'
                  aria-keyshortcuts='Control+M Meta+Shift+N'
                  onClick={onAddSlide}
                >
                  <Plus size={19} />
                </WorkOfficeRibbonButton>
                <WorkOfficeRibbonButton label='复制幻灯片' onClick={onDuplicateSlide}>
                  <Copy size={19} />
                </WorkOfficeRibbonButton>
                <WorkOfficeRibbonButton label='删除幻灯片' disabled={slideCount === 1} onClick={onDeleteSlide}>
                  <Trash2 size={19} />
                </WorkOfficeRibbonButton>
              </WorkOfficeRibbonGroup>
              <WorkOfficeRibbonGroup label='剪贴板'>
                <WorkOfficeRibbonButton label='复制' title='复制（⌘/Ctrl+C）' onClick={onCopySelection}>
                  <Copy size={19} />
                </WorkOfficeRibbonButton>
                <WorkOfficeRibbonButton label='剪切' title='剪切（⌘/Ctrl+X）' onClick={onCutSelection}>
                  <Scissors size={19} />
                </WorkOfficeRibbonButton>
                <WorkOfficeRibbonButton label='粘贴' title='粘贴（⌘/Ctrl+V）' onClick={onPasteSelection}>
                  <ClipboardPaste size={19} />
                </WorkOfficeRibbonButton>
              </WorkOfficeRibbonGroup>
              {selectedElement && (
                <>
                  <WorkOfficeRibbonGroup label='字体'>
                    <div className='presentation-number-field work-office-field'>
                      <span>字号</span>
                      <OfficeNumberField
                        ariaLabel='演示字号'
                        min={8}
                        max={96}
                        value={selectedElement.fontSize}
                        onValueChange={(value) => onUpdateElement({ fontSize: Number(value) || 8 })}
                      />
                    </div>
                    <WorkOfficeRibbonButton
                      label='加粗'
                      title='加粗（Cmd/Ctrl+B）'
                      aria-keyshortcuts='Control+B Meta+B'
                      displayLabel={false}
                      active={Boolean(selectedElement.bold)}
                      onClick={() => onUpdateElement({ bold: !selectedElement.bold })}
                    >
                      <Bold size={15} />
                    </WorkOfficeRibbonButton>
                    {(['left', 'center', 'right'] as WorkSlideTextAlign[]).map((align) => (
                      <WorkOfficeRibbonButton
                        label={align === 'left' ? '左对齐' : align === 'center' ? '居中' : '右对齐'}
                        displayLabel={false}
                        active={selectedElement.align === align}
                        key={align}
                        onClick={() => onUpdateElement({ align })}
                      >
                        {align === 'left' ? (
                          <AlignLeft size={15} />
                        ) : align === 'center' ? (
                          <AlignCenter size={15} />
                        ) : (
                          <AlignRight size={15} />
                        )}
                      </WorkOfficeRibbonButton>
                    ))}
                    <OfficeColorPicker
                      compact
                      className='work-color-tool'
                      value={selectedElement.color}
                      ariaLabel='演示文字颜色'
                      onValueChange={(color) => onUpdateElement({ color })}
                    />
                  </WorkOfficeRibbonGroup>
                  <WorkOfficeRibbonGroup label='排列'>
                    <WorkOfficeRibbonButton label='下移一层' onClick={() => onReorderElement(-1)}>
                      <ArrowDownToLine size={19} />
                    </WorkOfficeRibbonButton>
                    <WorkOfficeRibbonButton label='上移一层' onClick={() => onReorderElement(1)}>
                      <ArrowUpToLine size={19} />
                    </WorkOfficeRibbonButton>
                  </WorkOfficeRibbonGroup>
                </>
              )}
            </>
          ),
          insert: (
            <>
              <WorkOfficeRibbonGroup label='文本与形状'>
                <WorkOfficeRibbonButton label='文本框' onClick={() => onAddElement('text')}>
                  <Type size={19} />
                </WorkOfficeRibbonButton>
                <WorkOfficeRibbonButton label='形状' onClick={() => onAddElement('shape')}>
                  <Square size={19} />
                </WorkOfficeRibbonButton>
              </WorkOfficeRibbonGroup>
              <WorkOfficeRibbonGroup label='内容'>
                <WorkOfficeRibbonButton label='图片' onClick={onRequestImage}>
                  <Image size={19} />
                </WorkOfficeRibbonButton>
                {!editingDesign && (
                  <>
                    <WorkOfficeRibbonButton label='表格' onClick={onAddTable}>
                      <Table2 size={19} />
                    </WorkOfficeRibbonButton>
                    <WorkOfficeRibbonButton label='图表' onClick={onAddChart}>
                      <BarChart3 size={19} />
                    </WorkOfficeRibbonButton>
                  </>
                )}
              </WorkOfficeRibbonGroup>
              {selectedElement && (selectedElement.type === 'text' || selectedElement.type === 'shape') && (
                <WorkOfficeRibbonGroup label='链接'>
                  <WorkOfficeRibbonButton
                    label='链接'
                    active={Boolean(selectedElement.href)}
                    onClick={() =>
                      void officeDialog
                        .prompt({
                          title: '链接地址',
                          initialValue: selectedElement.href ?? 'https://',
                          placeholder: 'https://',
                          confirmLabel: '应用链接',
                        })
                        .then((href) => {
                          if (href !== null) onUpdateElement({ href: href.trim() || undefined });
                        })
                    }
                  >
                    <Link2 size={19} />
                  </WorkOfficeRibbonButton>
                </WorkOfficeRibbonGroup>
              )}
            </>
          ),
          design: (
            <>
              <WorkOfficeRibbonGroup label='母版'>
                <WorkOfficeRibbonButton label='母版和版式' active={designOpen} onClick={onToggleDesign}>
                  <LayoutTemplate size={19} />
                </WorkOfficeRibbonButton>
              </WorkOfficeRibbonGroup>
              <WorkOfficeRibbonGroup label='背景'>
                <OfficeColorPicker
                  compact
                  className='work-color-tool slide-background-tool'
                  value={background ?? selectedSlide.background}
                  ariaLabel={editingDesign ? '设计背景颜色' : '幻灯片背景颜色'}
                  onValueChange={onSetBackground}
                />
              </WorkOfficeRibbonGroup>
            </>
          ),
          transitions: (
            <PresentationTransitionPanel
              transition={transition}
              onChange={onTransitionChange}
              onApplyToAll={onApplyTransitionToAll}
            />
          ),
          slideshow: (
            <WorkOfficeRibbonGroup label='开始放映'>
              <WorkOfficeRibbonButton
                label='从头开始放映'
                title='从头开始放映（F5）'
                aria-keyshortcuts='F5'
                disabled={!onStartSlideshow}
                onClick={onStartSlideshow}
              >
                <Play size={19} />
              </WorkOfficeRibbonButton>
            </WorkOfficeRibbonGroup>
          ),
          review: (
            <WorkOfficeRibbonGroup label='批注'>
              <WorkOfficeRibbonButton label='新建批注' disabled={editingDesign} onClick={onAddComment}>
                <MessageSquarePlus size={19} />
              </WorkOfficeRibbonButton>
              <WorkOfficeRibbonButton
                label={`查看批注${commentCount ? `（${commentCount}）` : ''}`}
                disabled={editingDesign}
                active={commentsOpen}
                onClick={onToggleComments}
              >
                <MessagesSquare size={19} />
              </WorkOfficeRibbonButton>
            </WorkOfficeRibbonGroup>
          ),
          view: (
            <>
              <WorkOfficeRibbonGroup label='演示文稿视图'>
                <WorkOfficeRibbonButton
                  label='普通视图'
                  active={viewMode === 'normal'}
                  disabled={!onViewModeChange}
                  onClick={() => onViewModeChange?.('normal')}
                >
                  <PanelsTopLeft size={19} />
                </WorkOfficeRibbonButton>
                <WorkOfficeRibbonButton
                  label='幻灯片浏览'
                  active={viewMode === 'sorter'}
                  disabled={!onViewModeChange}
                  onClick={() => onViewModeChange?.('sorter')}
                >
                  <Grid2X2 size={19} />
                </WorkOfficeRibbonButton>
              </WorkOfficeRibbonGroup>
              <WorkOfficeRibbonGroup label='母版'>
                <WorkOfficeRibbonButton label='母版视图' active={designOpen} onClick={onToggleDesign}>
                  <LayoutTemplate size={19} />
                </WorkOfficeRibbonButton>
              </WorkOfficeRibbonGroup>
            </>
          ),
        }}
      />
      {officeDialog.dialog}
    </>
  );
}
