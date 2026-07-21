import { withPresentationDesign } from '../work-presentation-layouts';
import { createWorkId } from '../work-templates';
import type { WorkPresentationContent, WorkSlide, WorkSlideElement } from '../work-types';
import type { PresentationDesignMode } from './presentation-design-panel';

export function updatePresentationElements(
  content: WorkPresentationContent,
  mode: PresentationDesignMode,
  targetId: string,
  update: (elements: WorkSlideElement[]) => WorkSlideElement[],
  onChange: (content: WorkPresentationContent) => void
) {
  if (mode === 'slide') {
    updateSlide(content, targetId, (slide) => ({ ...slide, elements: update(slide.elements) }), onChange);
    return;
  }
  const normalized = withPresentationDesign(content);
  if (mode === 'layout') {
    onChange({
      ...normalized,
      layouts: normalized.layouts?.map((layout) =>
        layout.id === targetId ? { ...layout, elements: update(structuredCopy(layout.elements)) } : layout
      ),
    });
    return;
  }
  onChange({
    ...normalized,
    masters: normalized.masters?.map((master) =>
      master.id === targetId ? { ...master, elements: update(structuredCopy(master.elements)) } : master
    ),
  });
}

export function updateSlide(
  content: WorkPresentationContent,
  slideId: string,
  update: (slide: WorkSlide) => WorkSlide,
  onChange: (content: WorkPresentationContent) => void
) {
  onChange({
    ...content,
    slides: content.slides.map((slide) => (slide.id === slideId ? update(structuredCopy(slide)) : slide)),
  });
}

export function newSlide(number: number): WorkSlide {
  return {
    id: createWorkId('slide'),
    name: `幻灯片 ${number}`,
    background: '#ffffff',
    elements: [
      {
        id: createWorkId('element'),
        type: 'text',
        x: 9,
        y: 12,
        width: 82,
        height: 16,
        text: '输入标题',
        fontSize: 30,
        color: '#172033',
        fill: 'transparent',
        bold: true,
        align: 'left',
      },
    ],
  };
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function structuredCopy<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Image could not be read')));
    reader.readAsDataURL(file);
  });
}
