import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../design-system/primitives';

export function SidebarProductHeader({
  title,
  children,
  onCollapse,
}: {
  title: string;
  children?: ReactNode;
  onCollapse: () => void;
}) {
  return (
    <header className='sidebar-product-header'>
      <strong>{title}</strong>
      <div className='sidebar-product-header-actions'>
        {children}
        <IconButton label={`收起${title}侧边栏`} onClick={onCollapse}>
          <PanelLeftClose size={16} />
        </IconButton>
      </div>
    </header>
  );
}

export function SidebarProductOpenButton({
  title,
  className,
  onOpen,
}: {
  title: string;
  className?: string;
  onOpen: () => void;
}) {
  return (
    <IconButton className={className} label={`展开${title}侧边栏`} onClick={onOpen}>
      <PanelLeftOpen size={16} />
    </IconButton>
  );
}
