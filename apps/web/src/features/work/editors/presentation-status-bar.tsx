import { Cloud, Grid2X2, PanelsTopLeft } from 'lucide-react';
import { presentationCommentCount } from './presentation-comments-panel';
import type { WorkPresentationContent, WorkSlide } from '../work-types';
import { WorkOfficeStatusBar, WorkOfficeZoomControls } from './work-office-chrome';

export function PresentationStatusBar({
  content,
  selectedSlide,
  viewMode,
  zoom,
  saveStatus,
  onViewModeChange,
  onZoomChange,
}: {
  content: WorkPresentationContent;
  selectedSlide: WorkSlide;
  viewMode: 'normal' | 'sorter';
  zoom: number;
  saveStatus: string;
  onViewModeChange: (mode: 'normal' | 'sorter') => void;
  onZoomChange: (zoom: number) => void;
}) {
  const slideNumber = content.slides.findIndex((slide) => slide.id === selectedSlide.id) + 1;

  return (
    <WorkOfficeStatusBar
      className='work-presentation-status'
      controls={
        <>
          <button
            type='button'
            aria-label='普通演示视图'
            title='普通演示视图'
            aria-pressed={viewMode === 'normal'}
            onClick={() => onViewModeChange('normal')}
          >
            <PanelsTopLeft size={13} />
          </button>
          <button
            type='button'
            aria-label='幻灯片浏览视图'
            title='幻灯片浏览视图'
            aria-pressed={viewMode === 'sorter'}
            onClick={() => onViewModeChange('sorter')}
          >
            <Grid2X2 size={13} />
          </button>
          <span className='work-office-status-divider' />
          <WorkOfficeZoomControls
            zoom={zoom}
            decreaseLabel='缩小演示文稿'
            increaseLabel='放大演示文稿'
            outputLabel='演示缩放比例'
            sliderLabel='演示缩放'
            onChange={onZoomChange}
          />
        </>
      }
    >
      <output aria-label='幻灯片状态'>
        幻灯片 {slideNumber} / {content.slides.length}
      </output>
      <output aria-label='演示备注状态'>{selectedSlide.notes?.trim() ? '已添加演讲者备注' : '无演讲者备注'}</output>
      <output aria-label='演示批注状态'>批注：{presentationCommentCount(content.slides)}</output>
      <output aria-label='演示保存状态' className='work-office-save-status'>
        <Cloud size={12} />
        {saveStatus}
      </output>
    </WorkOfficeStatusBar>
  );
}
