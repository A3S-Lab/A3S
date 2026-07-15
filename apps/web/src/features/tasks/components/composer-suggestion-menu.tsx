import { FileCode2, LoaderCircle, Sparkles, Target } from 'lucide-react';
import { Fragment } from 'react';
import { splitComposerMatchText } from './composer-match-highlight';

export interface ComposerSuggestionItem {
  id: string;
  label: string;
  description: string;
  meta?: string;
  kind: 'file' | 'skill' | 'command';
}

export function ComposerSuggestionMenu({
  id,
  kind,
  query,
  items,
  activeIndex,
  loading,
  error,
  onActiveIndexChange,
  onSelect,
}: {
  id: string;
  kind: 'file' | 'skill';
  query: string;
  items: ComposerSuggestionItem[];
  activeIndex: number;
  loading: boolean;
  error: string | null;
  onActiveIndexChange: (index: number) => void;
  onSelect: (item: ComposerSuggestionItem) => void;
}) {
  const Icon = kind === 'file' ? FileCode2 : Sparkles;
  const title = kind === 'file' ? '添加工作区文件' : '使用 Skill';
  const empty = kind === 'file' ? '没有匹配的工作区文件' : '没有匹配的已启用 Skill';
  return (
    <section className='composer-suggestion-menu' aria-label={title}>
      <header>
        <span>
          <Icon size={15} />
          <strong>{title}</strong>
        </span>
        <kbd>{kind === 'file' ? '@' : '/'}</kbd>
      </header>
      {query && <p className='composer-suggestion-query'>搜索“{query}”</p>}
      <div id={id} role='listbox' aria-label={title}>
        {items.map((item, index) => {
          const ItemIcon = item.kind === 'command' ? Target : Icon;
          return (
            <button
              id={`${id}-${index}`}
              type='button'
              role='option'
              aria-selected={index === activeIndex}
              className={index === activeIndex ? 'active' : ''}
              key={item.id}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => onActiveIndexChange(index)}
              onClick={() => onSelect(item)}
            >
              <span className='composer-suggestion-icon'>
                <ItemIcon size={15} />
              </span>
              <span className='composer-suggestion-copy'>
                <strong>
                  <ComposerMatchText text={item.label} query={query} />
                </strong>
                <small>
                  <ComposerMatchText text={item.description} query={query} />
                </small>
              </span>
              {item.meta && <em>{item.meta}</em>}
            </button>
          );
        })}
        {loading && (
          <output className='composer-suggestion-state'>
            <LoaderCircle className='spin' size={14} /> 正在加载…
          </output>
        )}
        {!loading && error && (
          <p className='composer-suggestion-state error' role='alert'>
            {error}
          </p>
        )}
        {!loading && !error && !items.length && <p className='composer-suggestion-state'>{empty}</p>}
      </div>
      <footer>
        <span>↑↓ 选择</span>
        <span>Enter 添加</span>
        <span>Esc 关闭</span>
      </footer>
    </section>
  );
}

function ComposerMatchText({ text, query }: { text: string; query: string }) {
  return splitComposerMatchText(text, query).map((segment, index) => (
    <Fragment key={`${segment.text}-${index}`}>
      {segment.highlighted ? <mark>{segment.text}</mark> : segment.text}
    </Fragment>
  ));
}
