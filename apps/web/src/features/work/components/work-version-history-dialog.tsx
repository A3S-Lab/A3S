import { History, LoaderCircle, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Dialog, StateView } from '../../../design-system/primitives';
import type { WorkActions } from '../use-work-controller';
import type { WorkArtifactVersion } from '../work-types';

export function WorkVersionHistoryDialog({ actions, onClose }: { actions: WorkActions; onClose: () => void }) {
  const [versions, setVersions] = useState<WorkArtifactVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void actions
      .artifactVersions()
      .then((items) => {
        if (current) setVersions(items);
      })
      .catch((reason: unknown) => {
        if (current) setError(reason instanceof Error ? reason.message : '无法读取版本历史');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [actions]);

  return (
    <Dialog
      title='版本历史'
      description={
        actions.storageMode === 'server' ? '每次成功保存都会生成可恢复的服务器版本。' : '本地模式仅保留当前版本。'
      }
      onClose={onClose}
      closeDisabled={restoring !== null}
    >
      <section className='work-version-history' aria-live='polite'>
        {loading ? (
          <StateView
            className='work-version-state'
            size='compact'
            role='status'
            icon={<LoaderCircle className='spin' size={18} />}
            title='正在读取版本…'
          />
        ) : error ? (
          <StateView
            className='work-version-state'
            size='compact'
            tone='danger'
            role='alert'
            icon={<History size={20} />}
            title='无法读取版本历史'
            description={error}
          />
        ) : versions.length === 0 ? (
          <StateView
            className='work-version-state'
            size='compact'
            icon={<History size={20} />}
            title='还没有历史版本'
            description='成功保存后，版本会显示在这里。'
          />
        ) : (
          <ol>
            {versions.map((version) => (
              <li key={`${version.revision}-${version.updatedAt}`}>
                <span className='work-version-icon'>
                  <History size={15} />
                </span>
                <span>
                  <strong>第 {version.revision} 版</strong>
                  <small>{formatVersionTime(version.updatedAt)}</small>
                </span>
                {version.current ? (
                  <em>当前版本</em>
                ) : (
                  <Button
                    tone='quiet'
                    disabled={restoring !== null}
                    onClick={async () => {
                      setRestoring(version.revision);
                      if (await actions.restoreVersion(version.revision)) onClose();
                      else setRestoring(null);
                    }}
                  >
                    <RotateCcw size={13} />
                    {restoring === version.revision ? '正在恢复…' : '恢复'}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </Dialog>
  );
}

function formatVersionTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}
