import { MapPin, Trash2, X } from 'lucide-react';
import { Button, CollectionState, IconButton } from '../../../design-system/primitives';
import type { WorkSlide } from '../work-types';
import { OfficeTextArea } from './office-controls';

interface PresentationCommentView {
  slideId: string;
  slideName: string;
  slideNumber: number;
  commentIndex: number;
  id: string;
  author: string;
  date: string;
  text: string;
}

export function PresentationCommentsPanel({
  slides,
  activeCommentId,
  onLocate,
  onChange,
  onDelete,
  onClose,
}: {
  slides: WorkSlide[];
  activeCommentId: string | null;
  onLocate: (slideId: string, commentId: string) => void;
  onChange: (slideId: string, commentId: string, text: string) => void;
  onDelete: (slideId: string, commentId: string) => void;
  onClose: () => void;
}) {
  const comments = presentationCommentViews(slides);
  return (
    <section className='work-presentation-comments-panel' aria-label='演示批注审阅'>
      <header>
        <div>
          <strong>演示批注</strong>
          <span>{comments.length ? `${comments.length} 条传统 PPTX 批注` : '没有批注'}</span>
        </div>
        <IconButton className='close' label='关闭演示批注审阅' onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>
      <div className='work-presentation-comment-list'>
        {comments.map((comment, index) => (
          <article className={comment.id === activeCommentId ? 'active' : ''} key={`${comment.slideId}:${comment.id}`}>
            <button
              type='button'
              className='work-presentation-comment-location'
              aria-label={`定位演示批注 ${index + 1}`}
              onClick={() => onLocate(comment.slideId, comment.id)}
            >
              <MapPin size={12} />
              <span>
                幻灯片 {comment.slideNumber} · {comment.slideName}
              </span>
            </button>
            <header>
              <strong>{comment.author}</strong>
              <time dateTime={comment.date}>{formatCommentDate(comment.date)}</time>
            </header>
            <OfficeTextArea
              aria-label={`编辑演示批注 ${index + 1}`}
              value={comment.text}
              onFocus={() => onLocate(comment.slideId, comment.id)}
              onChange={(event) => onChange(comment.slideId, comment.id, event.target.value)}
            />
            <footer>
              <span>批注 {comment.commentIndex + 1}</span>
              <Button
                tone='quiet'
                aria-label={`删除演示批注 ${index + 1}`}
                onClick={() => onDelete(comment.slideId, comment.id)}
              >
                <Trash2 size={12} />
                删除
              </Button>
            </footer>
          </article>
        ))}
        {!comments.length && (
          <CollectionState className='work-presentation-comments-empty' role='status'>
            在当前幻灯片或选中元素上添加批注后，可以在这里定位、编辑或删除。
          </CollectionState>
        )}
      </div>
    </section>
  );
}

export function presentationCommentCount(slides: readonly WorkSlide[]): number {
  return slides.reduce((total, slide) => total + (slide.comments?.length ?? 0), 0);
}

function presentationCommentViews(slides: readonly WorkSlide[]): PresentationCommentView[] {
  return slides.flatMap((slide, slideIndex) =>
    (slide.comments ?? []).map((comment, commentIndex) => ({
      slideId: slide.id,
      slideName: slide.name,
      slideNumber: slideIndex + 1,
      commentIndex,
      id: comment.id,
      author: comment.author || '未知审阅者',
      date: comment.date,
      text: comment.text,
    }))
  );
}

function formatCommentDate(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(time);
}
