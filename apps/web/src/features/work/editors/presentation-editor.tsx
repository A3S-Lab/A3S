import { Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WorkspaceContextMenu } from '../../workspace/components/workspace-context-menu';
import { presentationAgentMenuItems } from '../components/work-editor-agent-menus';
import { applyPresentationAgentProposalChanges } from '../work-agent-proposal-apply';
import type { WorkEditorAgentRequest } from '../work-agent-request';
import {
  presentationAgentProposalTargets,
  presentationAgentSelection,
  presentationNotesProposalTarget,
} from '../work-presentation-agent-context';
import { createPresentationChartElement } from '../work-presentation-charts';
import { applyPresentationLayout, presentationSlideView, withPresentationDesign } from '../work-presentation-layouts';
import { createWorkId } from '../work-templates';
import type {
  WorkPresentationContent,
  WorkPresentationLayout,
  WorkPresentationMaster,
  WorkSlide,
  WorkSlideElement,
} from '../work-types';
import { OfficeFileInput, OfficeTextArea, useOfficeDialog } from './office-controls';
import { SlideChart } from './presentation-chart-canvas';
import { PresentationChartPanel } from './presentation-chart-panel';
import { PresentationCommentsPanel, presentationCommentCount } from './presentation-comments-panel';
import { type PresentationDesignMode, PresentationDesignPanel } from './presentation-design-panel';
import {
  clamp,
  fileToDataUrl,
  newSlide,
  structuredCopy,
  updatePresentationElements,
  updateSlide,
} from './presentation-editor-operations';
import { PresentationPlayer } from './presentation-player';
import {
  EditableSlideTable,
  RichEditableText,
  SlideElementPreview,
  slideElementStyle,
  slideTextStyle,
} from './presentation-slide-canvas';
import { PresentationSlideThumbnail } from './presentation-slide-thumbnail';
import { PresentationStatusBar } from './presentation-status-bar';
import {
  applyPresentationElementFormattingPatch,
  presentationElementToolbarState,
} from './presentation-text-formatting';
import { PresentationToolbar } from './presentation-toolbar';
import { usePresentationClipboard } from './use-presentation-clipboard';
import { usePresentationHistory } from './use-presentation-history';
import { type WorkOfficeFileAction, WorkOfficePreviewBar } from './work-office-chrome';

interface PresentationEditorProps {
  content: WorkPresentationContent;
  preview: boolean;
  saveStatus?: string;
  fileActions?: readonly WorkOfficeFileAction[];
  onChange: (content: WorkPresentationContent) => void;
  onAgentRequest?: (request: WorkEditorAgentRequest) => void | Promise<void>;
  onStartSlideshow?: () => void;
}

interface DragState {
  elementId: string;
  mode: 'move' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
}

interface PresentationAgentMenuState {
  x: number;
  y: number;
  selection: string;
  target: 'slide' | 'element';
  slideId: string;
  elementId: string | null;
}

export function PresentationEditor({
  content,
  preview,
  saveStatus = '已自动保存',
  fileActions,
  onChange,
  onAgentRequest,
  onStartSlideshow,
}: PresentationEditorProps) {
  const contentRef = useRef(content);
  const [selectedSlideId, setSelectedSlideId] = useState(content.slides[0]?.id ?? '');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [designMode, setDesignMode] = useState<PresentationDesignMode>('slide');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [agentMenu, setAgentMenu] = useState<PresentationAgentMenuState | null>(null);
  const [viewMode, setViewMode] = useState<'normal' | 'sorter'>('normal');
  const [zoom, setZoom] = useState(90);
  const officeDialog = useOfficeDialog();
  const canvasRef = useRef<HTMLElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const designContent = withPresentationDesign(content);
  const selectedSlide = designContent.slides.find((slide) => slide.id === selectedSlideId) ?? designContent.slides[0];
  const selectedLayout =
    designContent.layouts?.find((layout) => layout.id === selectedSlide?.layoutId) ?? designContent.layouts?.[0];
  const selectedMaster =
    designContent.masters?.find((master) => master.id === selectedLayout?.masterId) ?? designContent.masters?.[0];
  const activeElements =
    designMode === 'layout'
      ? (selectedLayout?.elements ?? [])
      : designMode === 'master'
        ? (selectedMaster?.elements ?? [])
        : (selectedSlide?.elements ?? []);
  const selectedElement = activeElements.find((element) => element.id === selectedElementId) ?? null;
  const toolbarSelectedElement = selectedElement ? presentationElementToolbarState(selectedElement) : null;
  const slideView = selectedSlide ? presentationSlideView(designContent, selectedSlide) : undefined;
  const activeBackground =
    designMode === 'layout'
      ? (selectedLayout?.background ?? selectedMaster?.background ?? '#ffffff')
      : designMode === 'master'
        ? (selectedMaster?.background ?? '#ffffff')
        : (slideView?.background ?? selectedSlide?.background ?? '#ffffff');
  const inheritedElements =
    designMode === 'slide'
      ? (slideView?.inheritedElements ?? [])
      : designMode === 'layout'
        ? (selectedMaster?.elements.filter((element) => !element.placeholder) ?? [])
        : [];
  const placeholderGuides =
    designMode === 'slide'
      ? (slideView?.placeholderElements.filter(
          (definition) => !activeElements.some((element) => element.placeholder?.key === definition.placeholder?.key)
        ) ?? [])
      : [];
  const canvasName =
    designMode === 'layout'
      ? `${selectedLayout?.name ?? '布局'}布局编辑画布`
      : designMode === 'master'
        ? `${selectedMaster?.name ?? '母版'}母版编辑画布`
        : `${selectedSlide?.name ?? '幻灯片'}编辑画布`;
  const activeTargetId =
    designMode === 'layout' ? selectedLayout?.id : designMode === 'master' ? selectedMaster?.id : selectedSlide?.id;
  const agentMenuSlide = agentMenu ? (content.slides.find((slide) => slide.id === agentMenu.slideId) ?? null) : null;
  const agentMenuElement =
    agentMenuSlide && agentMenu?.elementId
      ? (agentMenuSlide.elements.find((element) => element.id === agentMenu.elementId) ?? null)
      : null;
  const aspectRatio = `${content.width ?? 13.333} / ${content.height ?? 7.5}`;
  contentRef.current = content;
  const openAgentMenu = (
    event: React.MouseEvent,
    slide: WorkSlide,
    slideIndex: number,
    element?: WorkSlideElement | null
  ) => {
    if (!onAgentRequest) return;
    event.preventDefault();
    event.stopPropagation();
    setAgentMenu({
      x: event.clientX,
      y: event.clientY,
      selection: presentationAgentSelection(slide, slideIndex, content.slides.length, element),
      target: element ? 'element' : 'slide',
      slideId: slide.id,
      elementId: element?.id ?? null,
    });
  };

  useEffect(() => {
    if (!content.slides.some((slide) => slide.id === selectedSlideId)) {
      setSelectedSlideId(content.slides[0]?.id ?? '');
      setSelectedElementId(null);
    }
  }, [content.slides, selectedSlideId]);

  const addSlide = useCallback(() => {
    const slide = newSlide(content.slides.length + 1);
    onChange({ ...content, slides: [...content.slides, slide] });
    setSelectedSlideId(slide.id);
    setSelectedElementId(null);
  }, [content, onChange]);

  const history = usePresentationHistory({
    content,
    onChange,
    selectedSlideId,
    onSelectSlide: (slideId) => {
      setSelectedSlideId(slideId);
      setSelectedElementId(null);
    },
  });

  const clipboard = usePresentationClipboard({
    content,
    preview,
    mode: designMode,
    targetId: activeTargetId,
    selectedSlide,
    selectedElement,
    onChange,
    onSelectSlide: setSelectedSlideId,
    onSelectElement: setSelectedElementId,
    onUndo: history.undo,
    onRedo: history.redo,
    onAddSlide: addSlide,
    onStartSlideshow,
  });

  if (preview) {
    const player = <PresentationPlayer content={content} />;
    if (!fileActions?.length) return player;
    return (
      <section className='work-presentation-editor preview'>
        <WorkOfficePreviewBar
          ariaLabel='演示预览工具'
          label='只读预览'
          detail={`${content.slides.length} 张幻灯片`}
          fileActions={fileActions}
          className='work-presentation-ribbon'
        />
        {player}
      </section>
    );
  }
  if (!selectedSlide) return null;

  const updateElement = (patch: Partial<WorkSlideElement>) => {
    if (!selectedElementId || !activeTargetId) return;
    updatePresentationElements(
      content,
      designMode,
      activeTargetId,
      (elements) =>
        elements.map((element) =>
          element.id === selectedElementId ? applyPresentationElementFormattingPatch(element, patch) : element
        ),
      onChange
    );
  };

  const addElement = (type: WorkSlideElement['type']) => {
    const element: WorkSlideElement = {
      id: createWorkId('element'),
      type,
      x: 30,
      y: 34,
      width: 40,
      height: type === 'text' ? 14 : 20,
      text: type === 'text' ? '输入文字' : '',
      fontSize: type === 'text' ? 24 : 14,
      color: '#172033',
      fill: type === 'text' ? 'transparent' : '#dce6fb',
      bold: false,
      align: 'center',
      radius: type === 'shape' ? 3 : 0,
    };
    if (!activeTargetId) return;
    updatePresentationElements(content, designMode, activeTargetId, (elements) => [...elements, element], onChange);
    setSelectedElementId(element.id);
  };

  const addTable = () => {
    const element: WorkSlideElement = {
      id: createWorkId('element'),
      type: 'table',
      x: 15,
      y: 24,
      width: 70,
      height: 42,
      text: '',
      fontSize: 14,
      color: '#172033',
      fill: '#ffffff',
      bold: false,
      align: 'left',
      borderColor: '#cbd2de',
      borderWidth: 1,
      table: {
        headerRows: 1,
        rows: [
          ['标题 1', '标题 2', '标题 3'],
          ['内容', '内容', '内容'],
          ['内容', '内容', '内容'],
        ],
      },
    };
    updatePresentationElements(
      content,
      designMode,
      activeTargetId ?? selectedSlide.id,
      (elements) => [...elements, element],
      onChange
    );
    setSelectedElementId(element.id);
  };

  const addChart = () => {
    const element = createPresentationChartElement();
    updatePresentationElements(content, 'slide', selectedSlide.id, (elements) => [...elements, element], onChange);
    setSelectedElementId(element.id);
  };

  const addImage = async (file: File) => {
    const element: WorkSlideElement = {
      id: createWorkId('element'),
      type: 'image',
      x: 20,
      y: 20,
      width: 60,
      height: 55,
      text: '',
      fontSize: 12,
      color: '#172033',
      fill: 'transparent',
      bold: false,
      align: 'center',
      altText: file.name,
      image: {
        dataUrl: await fileToDataUrl(file),
        contentType: file.type || 'application/octet-stream',
        name: file.name,
      },
    };
    if (!activeTargetId) return;
    updatePresentationElements(content, designMode, activeTargetId, (elements) => [...elements, element], onChange);
    setSelectedElementId(element.id);
  };

  const reorderElement = (direction: -1 | 1) => {
    if (!selectedElementId || !activeTargetId) return;
    updatePresentationElements(
      content,
      designMode,
      activeTargetId,
      (current) => {
        const elements = [...current];
        const index = elements.findIndex((element) => element.id === selectedElementId);
        const target = clamp(index + direction, 0, elements.length - 1);
        if (index < 0 || index === target) return current;
        [elements[index], elements[target]] = [elements[target], elements[index]];
        return elements;
      },
      onChange
    );
  };

  const addComment = () => {
    void officeDialog.prompt({ title: '批注内容', multiline: true, confirmLabel: '添加批注' }).then((text) => {
      if (!text?.trim()) return;
      const comment = {
        id: createWorkId('slide-comment'),
        author: 'A3S Work 用户',
        initials: 'AW',
        date: new Date().toISOString(),
        text: text.trim(),
        x: clamp(selectedElement ? selectedElement.x + selectedElement.width : 50, 2, 98),
        y: clamp(selectedElement ? selectedElement.y : 50, 2, 98),
      };
      updateSlide(
        content,
        selectedSlide.id,
        (slide) => ({ ...slide, comments: [...(slide.comments ?? []), comment] }),
        onChange
      );
      setActiveCommentId(comment.id);
      setCommentsOpen(true);
    });
  };

  const duplicateSlide = () => {
    const copy: WorkSlide = {
      ...structuredCopy(selectedSlide),
      id: createWorkId('slide'),
      name: `${selectedSlide.name} 副本`,
      elements: selectedSlide.elements.map((element) => ({ ...structuredCopy(element), id: createWorkId('element') })),
    };
    const index = content.slides.findIndex((slide) => slide.id === selectedSlide.id);
    const slides = [...content.slides];
    slides.splice(index + 1, 0, copy);
    onChange({ ...content, slides });
    setSelectedSlideId(copy.id);
    setSelectedElementId(null);
  };

  const deleteSlideById = (slideId: string): boolean => {
    if (content.slides.length === 1) return false;
    const index = content.slides.findIndex((slide) => slide.id === slideId);
    if (index < 0) return false;
    const slides = content.slides.filter((slide) => slide.id !== slideId);
    onChange({ ...content, slides });
    setSelectedSlideId(slides[Math.min(index, slides.length - 1)].id);
    setSelectedElementId(null);
    return true;
  };
  const deleteSlide = () => deleteSlideById(selectedSlide.id);

  const beginDrag = (event: React.PointerEvent, element: WorkSlideElement, mode: DragState['mode']) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedElementId(element.id);
    dragRef.current = {
      elementId: element.id,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
      originWidth: element.width,
      originHeight: element.height,
    };
  };

  const continueDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!drag || !bounds || drag.pointerId !== event.pointerId) return;
    const dx = ((event.clientX - drag.startX) / bounds.width) * 100;
    const dy = ((event.clientY - drag.startY) / bounds.height) * 100;
    const patch =
      drag.mode === 'move'
        ? {
            x: clamp(drag.originX + dx, 0, 100 - drag.originWidth),
            y: clamp(drag.originY + dy, 0, 100 - drag.originHeight),
          }
        : {
            width: clamp(drag.originWidth + dx, 4, 100 - drag.originX),
            height: clamp(drag.originHeight + dy, 4, 100 - drag.originY),
          };
    if (!activeTargetId) return;
    updatePresentationElements(
      content,
      designMode,
      activeTargetId,
      (elements) => elements.map((element) => (element.id === drag.elementId ? { ...element, ...patch } : element)),
      onChange
    );
  };

  const toggleDesignPanel = () => {
    if (designOpen) {
      setDesignOpen(false);
      setDesignMode('slide');
      setSelectedElementId(null);
      return;
    }
    onChange(designContent);
    setDesignOpen(true);
    setCommentsOpen(false);
  };

  const updateLayout = (layoutId: string, update: (layout: WorkPresentationLayout) => WorkPresentationLayout) => {
    onChange({
      ...designContent,
      layouts: designContent.layouts?.map((layout) =>
        layout.id === layoutId ? update(structuredCopy(layout)) : layout
      ),
    });
  };

  const updateMaster = (masterId: string, update: (master: WorkPresentationMaster) => WorkPresentationMaster) => {
    onChange({
      ...designContent,
      masters: designContent.masters?.map((master) =>
        master.id === masterId ? update(structuredCopy(master)) : master
      ),
    });
  };

  const setActiveBackground = (background: string) => {
    if (designMode === 'layout' && selectedLayout) {
      updateLayout(selectedLayout.id, (layout) => ({ ...layout, background }));
      return;
    }
    if (designMode === 'master' && selectedMaster) {
      updateMaster(selectedMaster.id, (master) => ({ ...master, background }));
      return;
    }
    updateSlide(
      designContent,
      selectedSlide.id,
      (slide) => ({ ...slide, background, useLayoutBackground: false }),
      onChange
    );
  };

  const createLayout = (copyCurrent: boolean) => {
    if (!selectedMaster || !selectedLayout) return;
    const id = createWorkId('layout');
    const layout: WorkPresentationLayout = copyCurrent
      ? {
          ...structuredCopy(selectedLayout),
          id,
          name: `${selectedLayout.name} 副本`,
          elements: selectedLayout.elements.map((element) => ({
            ...structuredCopy(element),
            id: createWorkId('element'),
          })),
        }
      : {
          id,
          name: `自定义布局 ${(designContent.layouts?.length ?? 0) + 1}`,
          masterId: selectedMaster.id,
          elements: [],
        };
    const next = applyPresentationLayout(
      {
        ...designContent,
        layouts: [...(designContent.layouts ?? []), layout],
      },
      selectedSlide.id,
      id
    );
    onChange(next);
    setDesignMode('layout');
    setSelectedElementId(null);
  };

  const deleteLayout = () => {
    if (!selectedLayout || (designContent.layouts?.length ?? 0) < 2) return;
    const fallback = designContent.layouts?.find((layout) => layout.id !== selectedLayout.id);
    if (!fallback) return;
    onChange({
      ...designContent,
      layouts: designContent.layouts?.filter((layout) => layout.id !== selectedLayout.id),
      slides: designContent.slides.map((slide) =>
        slide.layoutId === selectedLayout.id ? { ...slide, layoutId: fallback.id } : slide
      ),
    });
    setDesignMode('slide');
    setSelectedElementId(null);
  };

  const addPlaceholder = (type: 'title' | 'body') => {
    if (designMode === 'slide' || !activeTargetId) return;
    const count = activeElements.filter((element) => element.placeholder?.type === type).length;
    const prompt = type === 'title' ? '单击添加标题' : '单击添加内容';
    const element: WorkSlideElement = {
      id: createWorkId('element'),
      type: 'text',
      x: type === 'title' ? 8 : 10,
      y: type === 'title' ? 9 : 24,
      width: type === 'title' ? 84 : 80,
      height: type === 'title' ? 12 : 58,
      text: prompt,
      fontSize: type === 'title' ? 30 : 20,
      color: '#172033',
      fill: 'transparent',
      bold: type === 'title',
      align: 'left',
      placeholder: {
        key: count ? `type:${type}:${count + 1}` : `type:${type}`,
        type,
        prompt,
      },
    };
    updatePresentationElements(
      designContent,
      designMode,
      activeTargetId,
      (elements) => [...elements, element],
      onChange
    );
    setSelectedElementId(element.id);
  };

  return (
    <section className='work-presentation-editor'>
      <OfficeFileInput
        ref={imageInputRef}
        accept='image/*'
        aria-label='插入图片'
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void addImage(file);
        }}
      />
      <PresentationToolbar
        selectedSlide={selectedSlide}
        fileActions={fileActions}
        selectedElement={toolbarSelectedElement}
        slideCount={content.slides.length}
        onAddSlide={addSlide}
        onDuplicateSlide={duplicateSlide}
        onDeleteSlide={deleteSlide}
        onCopySelection={clipboard.copySelection}
        onCutSelection={clipboard.cutSelection}
        onPasteSelection={clipboard.pasteSelection}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        onAddElement={addElement}
        onRequestImage={() => imageInputRef.current?.click()}
        onAddTable={addTable}
        onAddChart={addChart}
        onAddComment={addComment}
        commentsOpen={commentsOpen}
        commentCount={presentationCommentCount(content.slides)}
        onToggleComments={() => setCommentsOpen((value) => !value)}
        onUpdateElement={updateElement}
        onReorderElement={reorderElement}
        onSetBackground={setActiveBackground}
        designOpen={designOpen}
        editingDesign={designMode !== 'slide'}
        onToggleDesign={toggleDesignPanel}
        background={activeBackground}
        transition={selectedSlide.transition}
        onTransitionChange={(transition) =>
          updateSlide(content, selectedSlide.id, (slide) => ({ ...slide, transition }), onChange)
        }
        onApplyTransitionToAll={() =>
          onChange({
            ...content,
            slides: content.slides.map((slide) => ({
              ...slide,
              transition: selectedSlide.transition ? structuredCopy(selectedSlide.transition) : undefined,
            })),
          })
        }
        onStartSlideshow={onStartSlideshow}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      {designOpen && selectedLayout && selectedMaster && (
        <PresentationDesignPanel
          content={designContent}
          slide={selectedSlide}
          layout={selectedLayout}
          master={selectedMaster}
          mode={designMode}
          onApplyLayout={(layoutId) => {
            onChange(applyPresentationLayout(designContent, selectedSlide.id, layoutId));
            setDesignMode('slide');
            setSelectedElementId(null);
          }}
          onToggleLayoutBackground={(enabled) =>
            updateSlide(
              designContent,
              selectedSlide.id,
              (slide) => ({ ...slide, useLayoutBackground: enabled }),
              onChange
            )
          }
          onEditLayout={() => {
            setDesignMode('layout');
            setSelectedElementId(null);
          }}
          onEditMaster={() => {
            setDesignMode('master');
            setSelectedElementId(null);
          }}
          onCreateLayout={() => createLayout(false)}
          onDuplicateLayout={() => createLayout(true)}
          onDeleteLayout={deleteLayout}
          onRenameLayout={(name) => updateLayout(selectedLayout.id, (layout) => ({ ...layout, name }))}
          onRenameMaster={(name) => updateMaster(selectedMaster.id, (master) => ({ ...master, name }))}
          onSetLayoutBackground={(background) =>
            updateLayout(selectedLayout.id, (layout) => ({ ...layout, background }))
          }
          onSetMasterBackground={(background) =>
            updateMaster(selectedMaster.id, (master) => ({ ...master, background }))
          }
          onAddPlaceholder={addPlaceholder}
          onReturnToSlide={() => {
            setDesignMode('slide');
            setSelectedElementId(null);
          }}
          onClose={() => {
            setDesignOpen(false);
            setDesignMode('slide');
            setSelectedElementId(null);
          }}
        />
      )}
      {commentsOpen && designMode === 'slide' && (
        <PresentationCommentsPanel
          slides={content.slides}
          activeCommentId={activeCommentId}
          onLocate={(slideId, commentId) => {
            setSelectedSlideId(slideId);
            setSelectedElementId(null);
            setActiveCommentId(commentId);
          }}
          onChange={(slideId, commentId, text) =>
            updateSlide(
              content,
              slideId,
              (slide) => ({
                ...slide,
                comments: slide.comments?.map((comment) => (comment.id === commentId ? { ...comment, text } : comment)),
              }),
              onChange
            )
          }
          onDelete={(slideId, commentId) => {
            updateSlide(
              content,
              slideId,
              (slide) => ({
                ...slide,
                comments: slide.comments?.filter((comment) => comment.id !== commentId),
              }),
              onChange
            );
            if (activeCommentId === commentId) setActiveCommentId(null);
          }}
          onClose={() => setCommentsOpen(false)}
        />
      )}
      {designMode === 'slide' && selectedElement?.type === 'chart' && selectedElement.chart && (
        <PresentationChartPanel
          chart={selectedElement.chart}
          onChange={(chart) => updateElement({ chart, altText: chart.title || '演示图表' })}
          onDelete={() => {
            updatePresentationElements(
              content,
              'slide',
              selectedSlide.id,
              (elements) => elements.filter((element) => element.id !== selectedElement.id),
              onChange
            );
            setSelectedElementId(null);
          }}
          onClose={() => setSelectedElementId(null)}
        />
      )}
      {viewMode === 'normal' ? (
        <div className='work-presentation-layout'>
          <aside className='work-slide-strip' aria-label='幻灯片'>
            {content.slides.map((slide, index) => (
              <PresentationSlideThumbnail
                key={slide.id}
                content={designContent}
                slide={slide}
                index={index}
                selected={slide.id === selectedSlide.id}
                aspectRatio={aspectRatio}
                variant='strip'
                onSelect={() => {
                  setSelectedSlideId(slide.id);
                  setSelectedElementId(null);
                  setDesignMode('slide');
                }}
                onDelete={() => deleteSlideById(slide.id)}
                onContextMenu={(event) => {
                  setSelectedSlideId(slide.id);
                  setSelectedElementId(null);
                  openAgentMenu(event, slide, index);
                }}
              />
            ))}
            <button type='button' className='work-slide-add' onClick={addSlide}>
              <Plus size={15} />
              添加幻灯片
            </button>
          </aside>

          <div className='work-slide-stage' onPointerMove={continueDrag} onPointerUp={() => (dragRef.current = null)}>
            <section
              ref={canvasRef}
              className='work-slide-canvas interactive'
              aria-label={canvasName}
              style={{
                background: activeBackground,
                aspectRatio,
                width: `${zoom}%`,
                maxWidth: `${(1050 * zoom) / 100}px`,
              }}
              onPointerDown={() => setSelectedElementId(null)}
              onContextMenu={(event) => {
                if (designMode !== 'slide') return;
                openAgentMenu(
                  event,
                  selectedSlide,
                  content.slides.findIndex((slide) => slide.id === selectedSlide.id)
                );
              }}
            >
              {inheritedElements.map((element) => (
                <SlideElementPreview element={element} key={`inherited:${element.id}`} origin='inherited' />
              ))}
              {placeholderGuides.map((definition) => (
                <button
                  type='button'
                  className='work-slide-placeholder-guide'
                  key={`placeholder:${definition.placeholder?.key ?? definition.id}`}
                  style={slideElementStyle(definition)}
                  aria-label={`添加${definition.placeholder?.type === 'title' ? '标题' : '内容'}占位符`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    const element: WorkSlideElement = {
                      ...structuredCopy(definition),
                      id: createWorkId('element'),
                      text: '',
                      textRuns: undefined,
                    };
                    updatePresentationElements(
                      designContent,
                      'slide',
                      selectedSlide.id,
                      (elements) => [...elements, element],
                      onChange
                    );
                    setSelectedElementId(element.id);
                  }}
                >
                  {definition.placeholder?.prompt ?? '单击添加内容'}
                </button>
              ))}
              {activeElements.map((element) => {
                return (
                  <fieldset
                    key={element.id}
                    className={`work-slide-element ${element.type} ${element.placeholder ? 'placeholder' : ''} ${
                      element.id === selectedElementId ? 'selected' : ''
                    }`}
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: Slide objects are keyboard-selectable and support editing shortcuts.
                    tabIndex={0}
                    data-slide-element-origin={designMode}
                    style={slideElementStyle(element)}
                    onFocus={() => setSelectedElementId(element.id)}
                    onContextMenu={(event) => {
                      setSelectedElementId(element.id);
                      if (designMode !== 'slide') return;
                      openAgentMenu(
                        event,
                        selectedSlide,
                        content.slides.findIndex((slide) => slide.id === selectedSlide.id),
                        element
                      );
                    }}
                    onPointerDown={(event) => {
                      if (
                        event.target instanceof HTMLTextAreaElement ||
                        (event.target instanceof HTMLElement && event.target.closest('[data-slide-editor]'))
                      ) {
                        setSelectedElementId(element.id);
                        event.stopPropagation();
                        return;
                      }
                      beginDrag(event, element, 'move');
                    }}
                  >
                    <legend className='sr-only'>
                      {element.altText?.trim() || element.text?.trim() || '幻灯片元素'}
                    </legend>
                    {element.type === 'image' && element.image ? (
                      <img src={element.image.dataUrl} alt={element.altText ?? element.image.name} draggable={false} />
                    ) : element.type === 'table' && element.table ? (
                      <EditableSlideTable
                        element={element}
                        onChange={(rows) => updateElement({ table: { ...element.table, rows } })}
                      />
                    ) : element.type === 'chart' && element.chart ? (
                      <SlideChart chart={element.chart} label={element.altText ?? element.chart.title ?? '图表'} />
                    ) : element.textRuns?.length ? (
                      <RichEditableText
                        element={element}
                        onCommit={(text) => updateElement({ text, textRuns: undefined })}
                      />
                    ) : element.text || element.type === 'text' || element.type === 'shape' ? (
                      <OfficeTextArea
                        value={element.text}
                        aria-label='幻灯片文本'
                        placeholder={element.placeholder?.prompt}
                        spellCheck
                        style={slideTextStyle(element)}
                        onFocus={() => setSelectedElementId(element.id)}
                        onChange={(event) => {
                          setSelectedElementId(element.id);
                          updateElement({ text: event.target.value, textRuns: undefined });
                        }}
                      />
                    ) : null}
                    {element.id === selectedElementId && (
                      <>
                        <span
                          className='work-slide-move-handle'
                          aria-hidden='true'
                          onPointerDown={(event) => beginDrag(event, element, 'move')}
                        />
                        <span
                          className='work-slide-resize-handle'
                          aria-hidden='true'
                          onPointerDown={(event) => beginDrag(event, element, 'resize')}
                        />
                      </>
                    )}
                  </fieldset>
                );
              })}
              {designMode === 'slide' &&
                (selectedSlide.comments ?? []).map((comment, index) => (
                  <button
                    type='button'
                    className={`work-presentation-comment-pin ${comment.id === activeCommentId ? 'active' : ''}`}
                    key={comment.id}
                    aria-label={`打开演示批注 ${index + 1}`}
                    style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveCommentId(comment.id);
                      setCommentsOpen(true);
                    }}
                  >
                    {index + 1}
                  </button>
                ))}
            </section>
            <footer>
              <span>
                {designMode === 'layout'
                  ? `布局：${selectedLayout?.name ?? ''}`
                  : designMode === 'master'
                    ? `母版：${selectedMaster?.name ?? ''}`
                    : `幻灯片 ${
                        content.slides.findIndex((slide) => slide.id === selectedSlide.id) + 1
                      } / ${content.slides.length}`}
              </span>
              <span>
                {(content.width ?? 13.333).toFixed(2)} × {(content.height ?? 7.5).toFixed(2)}
              </span>
            </footer>
            {designMode === 'slide' && (
              <div className='work-slide-notes'>
                <span>演讲者备注</span>
                <OfficeTextArea
                  aria-label='演讲者备注'
                  value={selectedSlide.notes ?? ''}
                  placeholder='添加演讲者备注'
                  onChange={(event) =>
                    updateSlide(
                      content,
                      selectedSlide.id,
                      (slide) => ({ ...slide, notes: event.target.value }),
                      onChange
                    )
                  }
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <section
          className='work-presentation-sorter'
          aria-label='幻灯片浏览视图'
          style={{ '--work-presentation-sorter-width': `${Math.round(220 * (zoom / 100))}px` } as React.CSSProperties}
        >
          {content.slides.map((slide, index) => (
            <PresentationSlideThumbnail
              key={slide.id}
              content={designContent}
              slide={slide}
              index={index}
              selected={slide.id === selectedSlide.id}
              aspectRatio={aspectRatio}
              variant='sorter'
              onSelect={() => {
                setSelectedSlideId(slide.id);
                setSelectedElementId(null);
              }}
              onDelete={() => deleteSlideById(slide.id)}
              onDoubleClick={() => setViewMode('normal')}
            />
          ))}
        </section>
      )}
      <PresentationStatusBar
        content={content}
        selectedSlide={selectedSlide}
        viewMode={viewMode}
        zoom={zoom}
        saveStatus={saveStatus}
        onViewModeChange={setViewMode}
        onZoomChange={setZoom}
      />
      {designMode === 'slide' && agentMenu && onAgentRequest && (
        <WorkspaceContextMenu
          label={agentMenu.target === 'element' ? '演示元素 AI 操作' : '幻灯片 AI 操作'}
          x={agentMenu.x}
          y={agentMenu.y}
          items={presentationAgentMenuItems(
            agentMenu.selection,
            agentMenu.target,
            onAgentRequest,
            agentMenuSlide
              ? {
                  rewriteTargets: presentationAgentProposalTargets(agentMenuSlide, agentMenuElement),
                  notesTarget: presentationNotesProposalTarget(agentMenuSlide),
                  apply: (changes) => {
                    const outcome = applyPresentationAgentProposalChanges(
                      contentRef.current,
                      agentMenu.slideId,
                      changes
                    );
                    if (outcome.result.appliedTargetIds.length) onChange(outcome.content);
                    return outcome.result;
                  },
                }
              : undefined
          )}
          onClose={() => setAgentMenu(null)}
        />
      )}
      {officeDialog.dialog}
    </section>
  );
}
