import { Check, ChevronsUpDown, FolderOpen, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Button, Popover } from '../../../design-system/primitives';
import { localPathBasename, sameLocalPath } from '../work-local-files';
import { WorkFileIcon } from './work-file-icon';

export function WorkWorkspaceSwitcher({
  rootPath,
  recentPaths,
  variant = 'sidebar',
  onSelect,
  onPick,
}: {
  rootPath: string;
  recentPaths: readonly string[];
  variant?: 'sidebar' | 'compact';
  onSelect: (path: string) => Promise<string | null>;
  onPick: () => Promise<string | null>;
}) {
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const busy = picking || Boolean(pendingPath);
  const name = rootPath ? localPathBasename(rootPath) : '选择工作区';

  const select = async (path: string, close: () => void) => {
    if (busy) return;
    setPendingPath(path);
    try {
      if (await onSelect(path)) close();
    } finally {
      setPendingPath(null);
    }
  };
  const pick = async (close: () => void) => {
    if (busy) return;
    setPicking(true);
    try {
      if (await onPick()) close();
    } finally {
      setPicking(false);
    }
  };

  return (
    <Popover
      label={`切换工作区，当前 ${name}`}
      panelLabel='选择办公工作区'
      className={`work-workspace-switcher variant-${variant}`}
      panelClassName='work-workspace-popover'
      trigger={(triggerProps, { open }) => (
        <>
          {variant === 'sidebar' && <span className='work-workspace-label'>工作区</span>}
          <button {...triggerProps} className='work-workspace-trigger'>
            <WorkFileIcon path={rootPath || name} directory open={open} size={variant === 'sidebar' ? 30 : 19} />
            <span>
              <strong>{name}</strong>
              {variant === 'sidebar' && <small title={rootPath}>{rootPath || '打开一个本地文件夹'}</small>}
            </span>
            <ChevronsUpDown size={14} />
          </button>
        </>
      )}
    >
      {(close) => (
        <>
          {recentPaths.length > 0 && (
            <div className='work-workspace-recent' role='listbox' aria-label='最近工作区'>
              {recentPaths.map((path) => {
                const current = Boolean(rootPath && sameLocalPath(rootPath, path));
                const loading = Boolean(pendingPath && sameLocalPath(pendingPath, path));
                return (
                  <button
                    type='button'
                    role='option'
                    aria-selected={current}
                    disabled={busy}
                    title={path}
                    key={path}
                    onClick={() => void select(path, close)}
                  >
                    <WorkFileIcon path={path} directory open={current} size={22} />
                    <span>
                      <strong>{localPathBasename(path)}</strong>
                      <small>{path}</small>
                    </span>
                    {loading ? <LoaderCircle className='spin' size={14} /> : current ? <Check size={14} /> : null}
                  </button>
                );
              })}
            </div>
          )}
          <Button
            size='compact'
            tone='quiet'
            className='work-workspace-pick'
            disabled={busy}
            onClick={() => void pick(close)}
          >
            <FolderOpen size={16} />
            <span>打开其他文件夹</span>
            {picking && <LoaderCircle className='spin' size={14} />}
          </Button>
        </>
      )}
    </Popover>
  );
}
