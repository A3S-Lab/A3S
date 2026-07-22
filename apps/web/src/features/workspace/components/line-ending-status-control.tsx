import { Check } from 'lucide-react';
import { useRef, useState } from 'react';
import type { MonacoLineEnding } from './monaco-editor-status';
import { WorkspaceContextMenu, type WorkspaceContextMenuItem } from './workspace-context-menu';

export function LineEndingStatusControl({
  value,
  disabled,
  onChange,
}: {
  value: MonacoLineEnding;
  disabled: boolean;
  onChange: (value: MonacoLineEnding) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const item = (lineEnding: MonacoLineEnding, platform: string): WorkspaceContextMenuItem => ({
    id: lineEnding.toLowerCase(),
    label: lineEnding,
    ariaLabel: `${lineEnding}，${platform}`,
    shortcut: platform,
    checked: value === lineEnding,
    icon: (
      <Check
        className={`line-ending-menu-check ${value === lineEnding ? 'selected' : ''}`}
        size={13}
        aria-hidden='true'
      />
    ),
    onSelect: () => onChange(lineEnding),
  });
  const items = [item('LF', 'Unix / macOS'), item('CRLF', 'Windows')];

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        className='workspace-editor-status-action'
        aria-label={`换行符 ${value}`}
        aria-haspopup='menu'
        aria-expanded={anchor !== null}
        disabled={disabled}
        title={disabled ? '只读模式下不能更改换行符' : '选择换行符序列'}
        onClick={() => {
          if (anchor) {
            setAnchor(null);
            return;
          }
          const bounds = triggerRef.current?.getBoundingClientRect();
          setAnchor({ x: bounds?.left ?? 0, y: (bounds?.bottom ?? 0) + 4 });
        }}
      >
        {value}
      </button>
      {anchor && (
        <WorkspaceContextMenu
          label='选择换行符序列'
          x={anchor.x}
          y={anchor.y}
          items={items}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
