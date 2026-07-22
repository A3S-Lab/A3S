import { ArrowRight, ChevronDown, FileCode2, GitBranch, ListTree, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../../../design-system/primitives';
import type { CodeNavigationKind } from '../../../types/api';
import { WorkspaceContextMenu, type WorkspaceContextMenuItem } from './workspace-context-menu';

export type CodeEditorNavigationAction = CodeNavigationKind | 'outline';

export function CodeNavigationMenu({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (action: CodeEditorNavigationAction) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const items: readonly WorkspaceContextMenuItem[] = [
    {
      id: 'definition',
      label: '转到定义',
      shortcut: 'F12',
      icon: <ArrowRight size={14} />,
      onSelect: () => onSelect('definition'),
    },
    {
      id: 'declaration',
      label: '转到声明',
      icon: <FileCode2 size={14} />,
      onSelect: () => onSelect('declaration'),
    },
    {
      id: 'references',
      label: '查找引用',
      shortcut: 'Shift F12',
      icon: <Search size={14} />,
      onSelect: () => onSelect('references'),
    },
    {
      id: 'implementations',
      label: '转到实现',
      shortcut: 'Cmd/Ctrl F12',
      icon: <GitBranch size={14} />,
      onSelect: () => onSelect('implementations'),
    },
    {
      id: 'outline',
      label: '文件符号大纲',
      shortcut: 'Cmd/Ctrl Shift O',
      icon: <ListTree size={14} />,
      separatorBefore: true,
      onSelect: () => onSelect('outline'),
    },
  ];

  return (
    <>
      <Button
        ref={triggerRef}
        className='code-navigation-trigger'
        tone='quiet'
        disabled={disabled}
        aria-haspopup='menu'
        aria-expanded={anchor !== null}
        title={disabled ? '编辑器加载完成后可用' : '定义、引用、实现和文件大纲'}
        onClick={() => {
          if (anchor) {
            setAnchor(null);
            return;
          }
          const bounds = triggerRef.current?.getBoundingClientRect();
          setAnchor({ x: bounds?.left ?? 0, y: (bounds?.bottom ?? 0) + 4 });
        }}
      >
        <FileCode2 size={13} />
        <span>代码导航</span>
        <ChevronDown size={11} />
      </Button>
      {anchor && (
        <WorkspaceContextMenu
          label='代码导航'
          x={anchor.x}
          y={anchor.y}
          items={items}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
