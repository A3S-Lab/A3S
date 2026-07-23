import { LoaderCircle, RefreshCw, ServerOff } from 'lucide-react';
import { Button, StateView } from '../../../design-system/primitives';

interface CodeBootScreenProps {
  phase: 'loading' | 'error';
  error?: string | null;
  onRetry?: () => void;
}

export function CodeBootScreen({ phase, error, onRetry }: CodeBootScreenProps) {
  const failure = phase === 'error' ? bootFailurePresentation(error) : null;

  return (
    <main
      className={`code-boot-screen ${phase}`}
      aria-busy={phase === 'loading' || undefined}
      aria-label={phase === 'loading' ? '正在准备 A3S Code' : undefined}
    >
      <section className='code-boot-card'>
        <header className='code-boot-brand'>
          <span>
            <img src='/logo.png' alt='' />
          </span>
          <div>
            <strong>A3S Code</strong>
            <small>Local coding workspace</small>
          </div>
        </header>

        <StateView
          className='code-boot-state'
          tone={phase === 'error' ? 'warning' : 'neutral'}
          role={phase === 'error' ? 'alert' : 'status'}
          icon={phase === 'loading' ? <LoaderCircle className='spin' size={18} /> : <ServerOff size={18} />}
          title={phase === 'loading' ? '正在准备编码工作区' : failure?.title}
          description={phase === 'loading' ? '连接本地服务，恢复任务与模型配置。' : failure?.description}
          actions={
            phase === 'error' && (
              <Button tone='primary' onClick={onRetry}>
                <RefreshCw size={14} />
                重新连接
              </Button>
            )
          }
        >
          {phase === 'loading' ? (
            <div className='code-boot-progress' aria-hidden='true'>
              <span />
            </div>
          ) : (
            <div className='code-boot-recovery'>
              <p>
                确认本地服务仍在运行：<code>a3s web</code>
              </p>
              {error && (
                <details>
                  <summary>查看技术详情</summary>
                  <pre>{error}</pre>
                </details>
              )}
            </div>
          )}
        </StateView>
      </section>
      <small className='code-boot-assurance'>本地运行 · 工作区数据保留在当前设备</small>
    </main>
  );
}

export function bootFailurePresentation(error?: string | null) {
  const detail = error?.trim() ?? '';
  if (/GET\s+\/api\/|HTTP\s+404|not found/i.test(detail)) {
    return {
      title: '服务与页面版本不一致',
      description: '当前 Web 资源需要更新后的 A3S Code 服务，请重新构建并启动本地服务。',
    };
  }
  if (/无法访问本地|failed to fetch|networkerror|connection refused/i.test(detail)) {
    return {
      title: '本地服务尚未就绪',
      description: '页面已经打开，但暂时无法连接当前工作区的 A3S Code 服务。',
    };
  }
  return {
    title: '工作区初始化未完成',
    description: '本地服务返回了异常结果。可以重试连接，技术详情已收起保留。',
  };
}
