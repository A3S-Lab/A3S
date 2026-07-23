import { useCallback, useRef } from 'react';
import type { WorkPresentationContent } from '../work-types';
import { useOfficeHistory } from './use-office-history';

export function usePresentationHistory({
  content,
  onChange,
  selectedSlideId,
  onSelectSlide,
}: {
  content: WorkPresentationContent;
  onChange: (content: WorkPresentationContent) => void;
  selectedSlideId: string;
  onSelectSlide: (slideId: string) => void;
}) {
  const contentRef = useRef(content);
  const selectedSlideIdRef = useRef(selectedSlideId);
  const onChangeRef = useRef(onChange);
  const onSelectSlideRef = useRef(onSelectSlide);
  const selectionByContentRef = useRef(new WeakMap<WorkPresentationContent, string>());

  contentRef.current = content;
  selectedSlideIdRef.current = selectedSlideId;
  onChangeRef.current = onChange;
  onSelectSlideRef.current = onSelectSlide;
  selectionByContentRef.current.set(content, selectedSlideId);

  const applyHistory = useCallback((nextContent: WorkPresentationContent) => {
    const currentContent = contentRef.current;
    const currentSlideId = selectedSlideIdRef.current;
    const rememberedSlideId = selectionByContentRef.current.get(nextContent);
    const nextSlideId = resolveHistorySlideSelection(currentContent, nextContent, currentSlideId, rememberedSlideId);

    contentRef.current = nextContent;
    selectedSlideIdRef.current = nextSlideId;
    selectionByContentRef.current.set(nextContent, nextSlideId);
    if (nextSlideId !== currentSlideId) onSelectSlideRef.current(nextSlideId);
    onChangeRef.current(nextContent);
  }, []);

  return useOfficeHistory({ content, onChange: applyHistory });
}

function resolveHistorySlideSelection(
  currentContent: WorkPresentationContent,
  nextContent: WorkPresentationContent,
  currentSlideId: string,
  rememberedSlideId: string | undefined
): string {
  if (rememberedSlideId && nextContent.slides.some((slide) => slide.id === rememberedSlideId)) {
    return rememberedSlideId;
  }
  if (nextContent.slides.some((slide) => slide.id === currentSlideId)) return currentSlideId;

  const currentIndex = Math.max(
    0,
    currentContent.slides.findIndex((slide) => slide.id === currentSlideId)
  );
  return nextContent.slides[Math.min(currentIndex, Math.max(0, nextContent.slides.length - 1))]?.id ?? '';
}
