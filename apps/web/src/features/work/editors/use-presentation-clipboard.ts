import { useCallback, useEffect } from 'react';
import { showToast } from '../../../state/app-state';
import {
  clonePresentationElementForPaste,
  clonePresentationSlideForPaste,
  copyPresentationElement,
  copyPresentationSlide,
  takePresentationClipboard,
} from '../work-presentation-clipboard';
import { withPresentationDesign } from '../work-presentation-layouts';
import type { WorkPresentationContent, WorkSlide, WorkSlideElement } from '../work-types';
import { isOfficeShortcutBlocked } from './office-shortcuts';
import type { PresentationDesignMode } from './presentation-design-panel';
import {
  applyPresentationElementFormattingPatch,
  presentationElementToolbarState,
} from './presentation-text-formatting';

export function usePresentationClipboard({
  content,
  preview,
  mode,
  targetId,
  selectedSlide,
  selectedElement,
  onChange,
  onSelectSlide,
  onSelectElement,
  onUndo,
  onRedo,
  onAddSlide,
  onStartSlideshow,
}: {
  content: WorkPresentationContent;
  preview: boolean;
  mode: PresentationDesignMode;
  targetId: string | undefined;
  selectedSlide: WorkSlide | undefined;
  selectedElement: WorkSlideElement | null;
  onChange: (content: WorkPresentationContent) => void;
  onSelectSlide: (id: string) => void;
  onSelectElement: (id: string | null) => void;
  onUndo: () => boolean;
  onRedo: () => boolean;
  onAddSlide: () => void;
  onStartSlideshow?: () => void;
}) {
  const copySelection = useCallback((): boolean => {
    if (selectedElement) {
      copyPresentationElement(selectedElement);
      showToast('已复制演示元素', 'success');
      return true;
    }
    if (mode !== 'slide' || !selectedSlide) return false;
    copyPresentationSlide(selectedSlide);
    showToast('已复制幻灯片', 'success');
    return true;
  }, [mode, selectedElement, selectedSlide]);

  const deleteSelectedElement = useCallback((): boolean => {
    if (!selectedElement || !targetId) return false;
    const next = updateTargetElements(content, mode, targetId, (elements) =>
      elements.filter((element) => element.id !== selectedElement.id)
    );
    if (!next) return false;
    onChange(next);
    onSelectElement(null);
    return true;
  }, [content, mode, onChange, onSelectElement, selectedElement, targetId]);

  const cutSelection = useCallback((): boolean => {
    if (selectedElement) {
      copyPresentationElement(selectedElement);
      if (!deleteSelectedElement()) return false;
      showToast('已剪切演示元素', 'success');
      return true;
    }
    if (mode !== 'slide' || !selectedSlide) return false;
    if (content.slides.length === 1) {
      showToast('演示文稿至少需要保留一张幻灯片。', 'info');
      return true;
    }
    copyPresentationSlide(selectedSlide);
    const index = content.slides.findIndex((slide) => slide.id === selectedSlide.id);
    const slides = content.slides.filter((slide) => slide.id !== selectedSlide.id);
    onChange({ ...content, slides });
    onSelectSlide(slides[Math.min(index, slides.length - 1)].id);
    onSelectElement(null);
    showToast('已剪切幻灯片', 'success');
    return true;
  }, [content, deleteSelectedElement, mode, onChange, onSelectElement, onSelectSlide, selectedElement, selectedSlide]);

  const pasteSelection = useCallback((): boolean => {
    const clipboard = takePresentationClipboard();
    if (!clipboard) {
      showToast('没有可粘贴的演示内容。', 'info');
      return true;
    }
    if (clipboard.payload.kind === 'element') {
      if (!targetId) return false;
      const pasted = clonePresentationElementForPaste(clipboard.payload.element, clipboard.offset);
      const next = updateTargetElements(content, mode, targetId, (elements) => [...elements, pasted]);
      if (!next) return false;
      onChange(next);
      onSelectElement(pasted.id);
      showToast('已粘贴演示元素', 'success');
      return true;
    }
    if (mode !== 'slide' || !selectedSlide) {
      showToast('请返回幻灯片编辑后粘贴整张幻灯片。', 'info');
      return true;
    }
    const pasted = clonePresentationSlideForPaste(clipboard.payload.slide);
    const index = content.slides.findIndex((slide) => slide.id === selectedSlide.id);
    const slides = [...content.slides];
    slides.splice(index + 1, 0, pasted);
    onChange({ ...content, slides });
    onSelectSlide(pasted.id);
    onSelectElement(null);
    showToast('已粘贴幻灯片', 'success');
    return true;
  }, [content, mode, onChange, onSelectElement, onSelectSlide, selectedSlide, targetId]);

  const duplicateSelection = useCallback((): boolean => {
    if (selectedElement && targetId) {
      const copy = clonePresentationElementForPaste(selectedElement, 2);
      const next = updateTargetElements(content, mode, targetId, (elements) => [...elements, copy]);
      if (!next) return false;
      onChange(next);
      onSelectElement(copy.id);
      showToast('已复制演示元素', 'success');
      return true;
    }
    if (mode !== 'slide' || !selectedSlide) return false;
    const copy = clonePresentationSlideForPaste(selectedSlide);
    const index = content.slides.findIndex((slide) => slide.id === selectedSlide.id);
    const slides = [...content.slides];
    slides.splice(index + 1, 0, copy);
    onChange({ ...content, slides });
    onSelectSlide(copy.id);
    onSelectElement(null);
    showToast('已复制幻灯片', 'success');
    return true;
  }, [content, mode, onChange, onSelectElement, onSelectSlide, selectedElement, selectedSlide, targetId]);

  const nudgeSelection = useCallback(
    (key: string, distance: number): boolean => {
      if (!selectedElement || !targetId) return false;
      const horizontal = key === 'ArrowLeft' ? -distance : key === 'ArrowRight' ? distance : 0;
      const vertical = key === 'ArrowUp' ? -distance : key === 'ArrowDown' ? distance : 0;
      if (!horizontal && !vertical) return false;
      const next = updateTargetElements(content, mode, targetId, (elements) =>
        elements.map((element) =>
          element.id === selectedElement.id
            ? {
                ...element,
                x: clampPresentationPosition(element.x + horizontal, element.width),
                y: clampPresentationPosition(element.y + vertical, element.height),
              }
            : element
        )
      );
      if (!next) return false;
      onChange(next);
      return true;
    },
    [content, mode, onChange, selectedElement, targetId]
  );

  const toggleBold = useCallback((): boolean => {
    if (!selectedElement || !targetId) return false;
    const bold = !presentationElementToolbarState(selectedElement).bold;
    const next = updateTargetElements(content, mode, targetId, (elements) =>
      elements.map((element) =>
        element.id === selectedElement.id ? applyPresentationElementFormattingPatch(element, { bold }) : element
      )
    );
    if (!next) return false;
    onChange(next);
    return true;
  }, [content, mode, onChange, selectedElement, targetId]);

  useEffect(() => {
    if (preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const commandKey = event.metaKey || event.ctrlKey;
      const key = event.key.toLocaleLowerCase();
      const addSlideShortcut =
        !event.repeat &&
        !event.altKey &&
        ((event.ctrlKey && !event.metaKey && !event.shiftKey && key === 'm') ||
          (event.metaKey && !event.ctrlKey && event.shiftKey && key === 'n'));
      if (isOfficeShortcutBlocked(event.target)) {
        if (!event.repeat && !commandKey && !event.altKey && !event.shiftKey && key === 'f5' && onStartSlideshow) {
          event.preventDefault();
        }
        return;
      }
      const historyEditingTarget = isPresentationHistoryEditingTarget(event.target);
      let handled = false;
      if (!event.repeat && !commandKey && !event.altKey && !event.shiftKey && key === 'f5' && onStartSlideshow) {
        onStartSlideshow();
        handled = true;
      } else if (addSlideShortcut) {
        onAddSlide();
        handled = true;
      } else if (
        !event.repeat &&
        commandKey &&
        !event.altKey &&
        !event.shiftKey &&
        key === 'b' &&
        selectedElement &&
        isPresentationObjectKeyboardTarget(event.target)
      ) {
        handled = toggleBold();
      } else if (historyEditingTarget && commandKey && !event.altKey && key === 'z') {
        handled = event.shiftKey ? onRedo() : onUndo();
      } else if (historyEditingTarget && commandKey && !event.altKey && !event.shiftKey && key === 'y') {
        handled = onRedo();
      } else if (isPresentationTextEditingTarget(event.target)) {
        return;
      } else if (commandKey && !event.altKey && key === 'z') handled = event.shiftKey ? onRedo() : onUndo();
      else if (commandKey && !event.altKey && !event.shiftKey && key === 'y') handled = onRedo();
      else if (commandKey && !event.altKey && !event.shiftKey && key === 'c') handled = copySelection();
      else if (commandKey && !event.altKey && !event.shiftKey && key === 'x') handled = cutSelection();
      else if (commandKey && !event.altKey && !event.shiftKey && key === 'v') handled = pasteSelection();
      else if (commandKey && !event.altKey && !event.shiftKey && key === 'd') handled = duplicateSelection();
      else if (
        !commandKey &&
        !event.altKey &&
        selectedElement &&
        event.key.startsWith('Arrow') &&
        isPresentationObjectKeyboardTarget(event.target)
      ) {
        handled = nudgeSelection(event.key, event.shiftKey ? 5 : 1);
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedElement &&
        isPresentationObjectKeyboardTarget(event.target)
      ) {
        handled = deleteSelectedElement();
      }
      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    copySelection,
    cutSelection,
    deleteSelectedElement,
    duplicateSelection,
    nudgeSelection,
    onAddSlide,
    onRedo,
    onStartSlideshow,
    onUndo,
    pasteSelection,
    preview,
    selectedElement,
    toggleBold,
  ]);

  return { copySelection, cutSelection, pasteSelection };
}

function clampPresentationPosition(value: number, size: number): number {
  return Math.min(Math.max(value, 0), Math.max(0, 100 - size));
}

function updateTargetElements(
  content: WorkPresentationContent,
  mode: PresentationDesignMode,
  targetId: string,
  update: (elements: WorkSlideElement[]) => WorkSlideElement[]
): WorkPresentationContent | null {
  if (mode === 'slide') {
    if (!content.slides.some((slide) => slide.id === targetId)) return null;
    return {
      ...content,
      slides: content.slides.map((slide) =>
        slide.id === targetId ? { ...slide, elements: update(structuredCopy(slide.elements)) } : slide
      ),
    };
  }
  const normalized = withPresentationDesign(content);
  if (mode === 'layout') {
    if (!normalized.layouts?.some((layout) => layout.id === targetId)) return null;
    return {
      ...normalized,
      layouts: normalized.layouts.map((layout) =>
        layout.id === targetId ? { ...layout, elements: update(structuredCopy(layout.elements)) } : layout
      ),
    };
  }
  if (!normalized.masters?.some((master) => master.id === targetId)) return null;
  return {
    ...normalized,
    masters: normalized.masters.map((master) =>
      master.id === targetId ? { ...master, elements: update(structuredCopy(master.elements)) } : master
    ),
  };
}

function isPresentationTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    Boolean(target.closest('[data-slide-editor]'))
  );
}

function isPresentationHistoryEditingTarget(target: EventTarget | null): boolean {
  if (
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    )
  ) {
    return false;
  }
  return Boolean(target.closest('.work-presentation-editor'));
}

function isPresentationObjectKeyboardTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-slide-element-origin]'));
}

function structuredCopy<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
