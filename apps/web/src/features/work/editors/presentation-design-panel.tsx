import { Copy, LayoutTemplate, Plus, Trash2, X } from 'lucide-react';
import { Button, IconButton } from '../../../design-system/primitives';
import type { WorkPresentationContent, WorkPresentationLayout, WorkPresentationMaster, WorkSlide } from '../work-types';
import { OfficeCheckbox, OfficeColorPicker, OfficeSelect, OfficeTextField } from './office-controls';

export type PresentationDesignMode = 'slide' | 'layout' | 'master';

export function PresentationDesignPanel({
  content,
  slide,
  layout,
  master,
  mode,
  onApplyLayout,
  onToggleLayoutBackground,
  onEditLayout,
  onEditMaster,
  onCreateLayout,
  onDuplicateLayout,
  onDeleteLayout,
  onRenameLayout,
  onRenameMaster,
  onSetLayoutBackground,
  onSetMasterBackground,
  onAddPlaceholder,
  onReturnToSlide,
  onClose,
}: {
  content: WorkPresentationContent;
  slide: WorkSlide;
  layout: WorkPresentationLayout;
  master: WorkPresentationMaster;
  mode: PresentationDesignMode;
  onApplyLayout: (layoutId: string) => void;
  onToggleLayoutBackground: (enabled: boolean) => void;
  onEditLayout: () => void;
  onEditMaster: () => void;
  onCreateLayout: () => void;
  onDuplicateLayout: () => void;
  onDeleteLayout: () => void;
  onRenameLayout: (name: string) => void;
  onRenameMaster: (name: string) => void;
  onSetLayoutBackground: (color: string | undefined) => void;
  onSetMasterBackground: (color: string) => void;
  onAddPlaceholder: (type: 'title' | 'body') => void;
  onReturnToSlide: () => void;
  onClose: () => void;
}) {
  return (
    <section className='work-presentation-design-panel' aria-label='母版与布局'>
      <header>
        <div>
          <LayoutTemplate size={15} />
          <strong>母版与布局</strong>
          <span>
            {content.masters?.length ?? 0} 个母版 · {content.layouts?.length ?? 0} 个布局
          </span>
        </div>
        <IconButton className='close' label='关闭母版与布局' onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>

      <div className='work-presentation-design-controls'>
        <div className='work-office-field'>
          <span>当前布局</span>
          <OfficeSelect
            ariaLabel='幻灯片布局'
            value={layout.id}
            options={(content.layouts ?? []).map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            onValueChange={onApplyLayout}
          />
        </div>
        <OfficeCheckbox
          className='toggle'
          ariaLabel='使用布局背景'
          checked={slide.useLayoutBackground === true}
          onCheckedChange={onToggleLayoutBackground}
        >
          使用布局背景
        </OfficeCheckbox>
        <Button
          size='compact'
          tone={mode === 'layout' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'layout'}
          onClick={onEditLayout}
        >
          编辑当前布局
        </Button>
        <Button
          size='compact'
          tone={mode === 'master' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'master'}
          onClick={onEditMaster}
        >
          编辑当前母版
        </Button>
        <Button size='compact' aria-label='新建布局' onClick={onCreateLayout}>
          <Plus size={13} />
          新建布局
        </Button>
        <Button size='compact' aria-label='复制当前布局' onClick={onDuplicateLayout}>
          <Copy size={13} />
          复制布局
        </Button>
        <Button
          size='compact'
          tone='danger'
          aria-label='删除当前布局'
          disabled={(content.layouts?.length ?? 0) < 2}
          onClick={onDeleteLayout}
        >
          <Trash2 size={13} />
          删除布局
        </Button>
      </div>

      {mode === 'layout' && (
        <div className='work-presentation-design-editing' data-design-mode='layout'>
          <strong>正在编辑布局</strong>
          <div className='work-office-field'>
            <span>名称</span>
            <OfficeTextField
              aria-label='布局名称'
              value={layout.name}
              onChange={(event) => onRenameLayout(event.target.value)}
            />
          </div>
          <OfficeColorPicker
            compact
            className='work-color-tool'
            ariaLabel='布局背景颜色'
            value={layout.background ?? master.background}
            onValueChange={onSetLayoutBackground}
          />
          <OfficeCheckbox
            className='toggle'
            ariaLabel='布局使用母版背景'
            checked={!layout.background}
            onCheckedChange={(checked) => onSetLayoutBackground(checked ? undefined : master.background)}
          >
            使用母版背景
          </OfficeCheckbox>
          <PlaceholderButtons onAdd={onAddPlaceholder} />
          <Button size='compact' tone='quiet' onClick={onReturnToSlide}>
            返回幻灯片编辑
          </Button>
        </div>
      )}

      {mode === 'master' && (
        <div className='work-presentation-design-editing' data-design-mode='master'>
          <strong>正在编辑母版</strong>
          <div className='work-office-field'>
            <span>名称</span>
            <OfficeTextField
              aria-label='母版名称'
              value={master.name}
              onChange={(event) => onRenameMaster(event.target.value)}
            />
          </div>
          <OfficeColorPicker
            compact
            className='work-color-tool'
            ariaLabel='母版背景颜色'
            value={master.background}
            onValueChange={onSetMasterBackground}
          />
          <PlaceholderButtons onAdd={onAddPlaceholder} />
          <Button size='compact' tone='quiet' onClick={onReturnToSlide}>
            返回幻灯片编辑
          </Button>
        </div>
      )}
    </section>
  );
}

function PlaceholderButtons({ onAdd }: { onAdd: (type: 'title' | 'body') => void }) {
  return (
    <div className='work-presentation-placeholder-actions'>
      <Button size='compact' aria-label='添加标题占位符' onClick={() => onAdd('title')}>
        添加标题占位符
      </Button>
      <Button size='compact' aria-label='添加内容占位符' onClick={() => onAdd('body')}>
        添加内容占位符
      </Button>
    </div>
  );
}
