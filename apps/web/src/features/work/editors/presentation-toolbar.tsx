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
  Image,
  LayoutTemplate,
  Link2,
  MessageSquarePlus,
  MessagesSquare,
  Play,
  Plus,
  Scissors,
  Square,
  Table2,
  Trash2,
  Type,
} from 'lucide-react';
import type { WorkSlide, WorkSlideElement, WorkSlideTextAlign, WorkSlideTransition } from '../work-types';
import { PresentationTransitionPanel } from './presentation-transition-panel';
import { WorkOfficeRibbon, WorkOfficeRibbonButton, WorkOfficeRibbonGroup } from './work-office-chrome';

const presentationRibbonTabs = [
  { id: 'home', label: '首页' },
  { id: 'insert', label: '插入' },
  { id: 'design', label: '设计' },
  { id: 'transitions', label: '切换' },
  { id: 'animations', label: '动画' },
  { id: 'slideshow', label: '放映' },
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
}) {
  return (
    <WorkOfficeRibbon
      ariaLabel='演示功能区'
      tabs={presentationRibbonTabs}
      defaultTab='home'
      className='work-presentation-ribbon'
      toolbarClassName='presentation-toolbar'
      panels={{
        home: (
          <>
            <WorkOfficeRibbonGroup label='幻灯片'>
              <WorkOfficeRibbonButton label='新建幻灯片' onClick={onAddSlide}>
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
              <WorkOfficeRibbonButton label='复制所选元素或幻灯片' title='复制（⌘/Ctrl+C）' onClick={onCopySelection}>
                <Copy size={19} />
              </WorkOfficeRibbonButton>
              <WorkOfficeRibbonButton label='剪切所选元素或幻灯片' title='剪切（⌘/Ctrl+X）' onClick={onCutSelection}>
                <Scissors size={19} />
              </WorkOfficeRibbonButton>
              <WorkOfficeRibbonButton label='粘贴演示内容' title='粘贴（⌘/Ctrl+V）' onClick={onPasteSelection}>
                <ClipboardPaste size={19} />
              </WorkOfficeRibbonButton>
            </WorkOfficeRibbonGroup>
            {selectedElement && (
              <>
                <WorkOfficeRibbonGroup label='字体'>
                  <label className='presentation-number-field'>
                    <span>字号</span>
                    <input
                      type='number'
                      min={8}
                      max={96}
                      value={selectedElement.fontSize}
                      onChange={(event) => onUpdateElement({ fontSize: Number(event.target.value) || 8 })}
                    />
                  </label>
                  <WorkOfficeRibbonButton
                    label='加粗'
                    displayLabel={false}
                    active={Boolean(selectedElement.bold)}
                    onClick={() => onUpdateElement({ bold: !selectedElement.bold })}
                  >
                    <Bold size={15} />
                  </WorkOfficeRibbonButton>
                  {(['left', 'center', 'right'] as WorkSlideTextAlign[]).map((align) => (
                    <WorkOfficeRibbonButton
                      label={`${align} 对齐`}
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
                  <label className='work-color-tool' title='文字颜色'>
                    <span style={{ background: selectedElement.color }} />
                    <input
                      type='color'
                      value={selectedElement.color}
                      aria-label='演示文字颜色'
                      onInput={(event) => onUpdateElement({ color: event.currentTarget.value })}
                    />
                  </label>
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
                  label='设置链接'
                  active={Boolean(selectedElement.href)}
                  onClick={() => {
                    const href = window.prompt('链接地址', selectedElement.href ?? 'https://');
                    if (href !== null) onUpdateElement({ href: href.trim() || undefined });
                  }}
                >
                  <Link2 size={19} />
                </WorkOfficeRibbonButton>
              </WorkOfficeRibbonGroup>
            )}
          </>
        ),
        design: (
          <>
            <WorkOfficeRibbonGroup label='母版与布局'>
              <WorkOfficeRibbonButton label='母版与布局' active={designOpen} onClick={onToggleDesign}>
                <LayoutTemplate size={19} />
              </WorkOfficeRibbonButton>
            </WorkOfficeRibbonGroup>
            <WorkOfficeRibbonGroup label='背景'>
              <label className='work-color-tool slide-background-tool' title='幻灯片背景'>
                <span style={{ background: background ?? selectedSlide.background }} />
                <input
                  type='color'
                  value={background ?? selectedSlide.background}
                  aria-label={editingDesign ? '设计背景颜色' : '幻灯片背景颜色'}
                  onInput={(event) => onSetBackground(event.currentTarget.value)}
                />
              </label>
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
        animations: (
          <output className='work-office-ribbon-message'>
            对象动画暂不在 Work 原生模型中编辑；导入时会保留原始文件并显示兼容性提示。
          </output>
        ),
        slideshow: (
          <WorkOfficeRibbonGroup label='开始放映'>
            <WorkOfficeRibbonButton label='从头开始放映' disabled={!onStartSlideshow} onClick={onStartSlideshow}>
              <Play size={19} />
            </WorkOfficeRibbonButton>
          </WorkOfficeRibbonGroup>
        ),
        review: (
          <WorkOfficeRibbonGroup label='批注'>
            <WorkOfficeRibbonButton label='添加演示批注' disabled={editingDesign} onClick={onAddComment}>
              <MessageSquarePlus size={19} />
            </WorkOfficeRibbonButton>
            <WorkOfficeRibbonButton
              label={`审阅演示批注${commentCount ? `（${commentCount}）` : ''}`}
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
            <WorkOfficeRibbonGroup label='母版视图'>
              <WorkOfficeRibbonButton label='母版与布局' active={designOpen} onClick={onToggleDesign}>
                <LayoutTemplate size={19} />
              </WorkOfficeRibbonButton>
            </WorkOfficeRibbonGroup>
            <output className='work-office-ribbon-message'>可在底部状态栏切换普通视图与幻灯片浏览视图。</output>
          </>
        ),
      }}
    />
  );
}
