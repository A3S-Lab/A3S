import { BrainCircuit, ChevronDown, LoaderCircle } from 'lucide-react';
import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';

const StreamingMarkdown = lazy(() => import('./streaming-markdown'));

export function ReasoningDisclosure({ content, pending }: { content: string; pending: boolean }) {
  const [open, setOpen] = useState(pending);
  const contentId = useId();
  const previousPending = useRef(pending);

  useEffect(() => {
    if (previousPending.current !== pending) setOpen(pending);
    previousPending.current = pending;
  }, [pending]);

  return (
    <section className={`execution-reasoning ${open ? 'open' : ''}`}>
      <button
        type='button'
        className='execution-reasoning-trigger'
        aria-label={`${open ? '收起' : '展开'}思考过程，${pending ? '实时更新' : '已完成'}`}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className='execution-reasoning-icon'>
          {pending ? <LoaderCircle className='spin' size={14} /> : <BrainCircuit size={14} />}
        </span>
        <span className='execution-reasoning-title'>
          <span className='execution-reasoning-label'>{pending ? '正在思考' : '查看思考过程'}</span>
          <small className={`execution-reasoning-status ${pending ? 'live' : 'completed'}`}>
            {pending ? '实时更新' : '已完成'}
          </small>
        </span>
        <ChevronDown className='execution-reasoning-chevron' size={13} />
      </button>
      <div id={contentId} className='execution-reasoning-content execution-markdown' hidden={!open}>
        <Suspense fallback={<p className='execution-markdown-fallback'>{content}</p>}>
          <StreamingMarkdown content={content} streaming={pending} />
        </Suspense>
      </div>
    </section>
  );
}
