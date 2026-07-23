import type { MouseEventHandler } from 'react';
import type { WorkPresentationContent, WorkSlide } from '../work-types';
import { SlideCanvas } from './presentation-slide-canvas';

export function PresentationSlideThumbnail({
  content,
  slide,
  index,
  selected,
  aspectRatio,
  variant,
  onSelect,
  onDelete,
  onContextMenu,
  onDoubleClick,
}: {
  content: WorkPresentationContent;
  slide: WorkSlide;
  index: number;
  selected: boolean;
  aspectRatio: string;
  variant: 'strip' | 'sorter';
  onSelect: () => void;
  onDelete: () => boolean;
  onContextMenu?: MouseEventHandler<HTMLButtonElement>;
  onDoubleClick?: () => void;
}) {
  return (
    <button
      type='button'
      className={selected ? 'active' : ''}
      aria-label={`幻灯片 ${index + 1}：${slide.name}`}
      data-slide-thumbnail
      data-slide-id={slide.id}
      onFocus={onSelect}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => handleThumbnailKey(event, onDelete)}
    >
      {variant === 'strip' && <span>{index + 1}</span>}
      <SlideCanvas content={content} slide={slide} interactive={false} aspectRatio={aspectRatio} />
      {variant === 'sorter' && (
        <>
          <span>{index + 1}</span>
          <strong>{slide.name}</strong>
        </>
      )}
    </button>
  );
}

function handleThumbnailKey(event: React.KeyboardEvent<HTMLButtonElement>, onDelete: () => boolean): void {
  const parent = event.currentTarget.parentElement;
  const buttons = [...(parent?.querySelectorAll<HTMLButtonElement>('[data-slide-thumbnail]') ?? [])];
  const index = buttons.indexOf(event.currentTarget);
  if (index < 0) return;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    event.stopPropagation();
    const focusId = (buttons[index + 1] ?? buttons[index - 1])?.dataset.slideId;
    if (!onDelete() || !focusId) return;
    requestAnimationFrame(() =>
      [...(parent?.querySelectorAll<HTMLButtonElement>('[data-slide-thumbnail]') ?? [])]
        .find((button) => button.dataset.slideId === focusId)
        ?.focus()
    );
    return;
  }
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  const nextIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? Math.max(0, index - 1)
          : Math.min(buttons.length - 1, index + 1);
  buttons[nextIndex]?.focus();
}
