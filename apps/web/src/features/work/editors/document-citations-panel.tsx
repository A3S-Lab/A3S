import type { Editor } from '@tiptap/core';
import { BookMarked, Plus, Quote, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, CollectionState, IconButton, InlineNotice } from '../../../design-system/primitives';
import {
  insertDocumentBibliography,
  insertDocumentCitation,
  refreshDocumentCitations,
  renameDocumentCitationTag,
} from '../work-document-citation-editor';
import {
  createDocumentBibliography,
  documentCitationStyle,
  documentCitationStyleDetails,
  isValidDocumentCitationTag,
} from '../work-document-citations';
import { createWorkId } from '../work-templates';
import type {
  WorkDocumentBibliography,
  WorkDocumentCitationPerson,
  WorkDocumentCitationSource,
  WorkDocumentCitationStyle,
  WorkDocumentContent,
} from '../work-types';
import { OfficeSelect, OfficeTextArea, OfficeTextField } from './office-controls';

interface CitationSourceDraft {
  id?: string;
  tag: string;
  sourceType: string;
  title: string;
  year: string;
  authors: string;
  corporateAuthor: string;
  publisher: string;
  city: string;
  journalName: string;
  volume: string;
  issue: string;
  pages: string;
  url: string;
  standardNumber: string;
  conferenceName: string;
  institution: string;
}

const SOURCE_TYPES = [
  ['Book', '书籍'],
  ['BookSection', '书籍章节'],
  ['JournalArticle', '期刊文章'],
  ['ArticleInAPeriodical', '报刊文章'],
  ['ConferenceProceedings', '会议论文'],
  ['Report', '报告'],
  ['InternetSite', '网站'],
  ['DocumentFromInternetSite', '网页文档'],
  ['ElectronicSource', '电子资源'],
  ['Misc', '其他'],
] as const;

export function DocumentCitationsPanel({
  editor,
  content,
  onChange,
  onClose,
}: {
  editor: Editor;
  content: WorkDocumentContent;
  onChange: (content: WorkDocumentContent) => void;
  onClose: () => void;
}) {
  const bibliography = content.bibliography ?? createDocumentBibliography();
  const [selectedId, setSelectedId] = useState<string | null>(bibliography.sources[0]?.id ?? null);
  const [draft, setDraft] = useState<CitationSourceDraft>(() => sourceDraft(bibliography.sources[0]));
  const [error, setError] = useState('');

  useEffect(() => {
    const selected = bibliography.sources.find((source) => source.id === selectedId);
    if (selected) setDraft(sourceDraft(selected));
    else if (selectedId) {
      setSelectedId(bibliography.sources[0]?.id ?? null);
      setDraft(sourceDraft(bibliography.sources[0]));
    }
  }, [bibliography.sources, selectedId]);

  const commitBibliography = (
    nextBibliography: WorkDocumentBibliography,
    renamedTag?: { previous: string; next: string }
  ) => {
    const next = { ...content, bibliography: nextBibliography };
    onChange(next);
    if (renamedTag) {
      renameDocumentCitationTag(editor, renamedTag.previous, renamedTag.next);
    }
    refreshDocumentCitations(editor, next);
  };
  const selectSource = (source: WorkDocumentCitationSource) => {
    setSelectedId(source.id);
    setDraft(sourceDraft(source));
    setError('');
  };
  const startNewSource = () => {
    setSelectedId(null);
    setDraft(sourceDraft());
    setError('');
  };
  const saveSource = () => {
    const tag = draft.tag.trim();
    if (!isValidDocumentCitationTag(tag)) {
      setError('引用标记只能使用字母、数字、下划线及 . : + -，长度不超过 80。');
      return;
    }
    if (!draft.title.trim()) {
      setError('请输入文献标题。');
      return;
    }
    if (
      bibliography.sources.some((source) => source.id !== draft.id && source.tag.toLowerCase() === tag.toLowerCase())
    ) {
      setError('已经存在相同的引用标记。');
      return;
    }
    const existing = bibliography.sources.find((source) => source.id === draft.id);
    const authorPeople = parseAuthors(draft.authors);
    const author =
      draft.corporateAuthor.trim() || authorPeople.length
        ? {
            corporate: draft.corporateAuthor.trim() || undefined,
            people: draft.corporateAuthor.trim() ? undefined : authorPeople,
          }
        : undefined;
    const contributors = { ...(existing?.contributors ?? {}) };
    if (author) contributors.Author = author;
    else delete contributors.Author;
    const saved: WorkDocumentCitationSource = {
      id: draft.id ?? createWorkId('source'),
      tag,
      sourceType: draft.sourceType || 'Misc',
      guid: existing?.guid,
      title: draft.title.trim(),
      year: optionalValue(draft.year),
      contributors: Object.keys(contributors).length ? contributors : undefined,
      publisher: optionalValue(draft.publisher),
      city: optionalValue(draft.city),
      journalName: optionalValue(draft.journalName),
      volume: optionalValue(draft.volume),
      issue: optionalValue(draft.issue),
      pages: optionalValue(draft.pages),
      url: optionalValue(draft.url),
      standardNumber: optionalValue(draft.standardNumber),
      conferenceName: optionalValue(draft.conferenceName),
      institution: optionalValue(draft.institution),
      additionalFields: existing?.additionalFields,
    };
    const sources = draft.id
      ? bibliography.sources.map((source) => (source.id === draft.id ? saved : source))
      : [...bibliography.sources, saved];
    commitBibliography(
      { ...bibliography, sources },
      existing && existing.tag !== saved.tag ? { previous: existing.tag, next: saved.tag } : undefined
    );
    setSelectedId(saved.id);
    setDraft(sourceDraft(saved));
    setError('');
  };
  const deleteSource = () => {
    if (!draft.id) {
      startNewSource();
      return;
    }
    const sources = bibliography.sources.filter((source) => source.id !== draft.id);
    commitBibliography({ ...bibliography, sources });
    const next = sources[0];
    setSelectedId(next?.id ?? null);
    setDraft(sourceDraft(next));
    setError('');
  };
  const changeStyle = (style: WorkDocumentCitationStyle) => {
    const details = documentCitationStyleDetails(style);
    commitBibliography({
      ...bibliography,
      style,
      styleName: details.name,
      selectedStyle: details.selectedStyle,
    });
  };
  const selectedSource = bibliography.sources.find((source) => source.id === draft.id);
  const knownSourceType = SOURCE_TYPES.some(([value]) => value === draft.sourceType);

  return (
    <section className='work-document-citations-panel' aria-label='文献库'>
      <header>
        <div>
          <strong>文献库</strong>
          <span>{bibliography.sources.length} 条文献源 · 正文引文与参考文献同步更新</span>
        </div>
        <div className='work-office-field'>
          <span>样式</span>
          <OfficeSelect
            ariaLabel='引文样式'
            value={documentCitationStyle(bibliography.style)}
            options={[
              { value: 'apa', label: 'APA' },
              { value: 'mla', label: 'MLA' },
              { value: 'chicago', label: 'Chicago' },
              { value: 'ieee', label: 'IEEE' },
            ]}
            onValueChange={changeStyle}
          />
        </div>
        <Button
          tone='secondary'
          aria-label='插入参考文献'
          onClick={() => insertDocumentBibliography(editor, bibliography)}
        >
          <BookMarked size={13} />
          插入参考文献
        </Button>
        <IconButton className='close' label='关闭文献库' onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>
      <div className='work-document-citation-manager'>
        <aside aria-label='文献源列表'>
          <Button className='create' tone='secondary' onClick={startNewSource}>
            <Plus size={13} />
            新建文献源
          </Button>
          <div>
            {bibliography.sources.map((source) => (
              <button
                type='button'
                className={source.id === selectedId ? 'active' : ''}
                key={source.id}
                onClick={() => selectSource(source)}
              >
                <strong>{source.title || '未命名文献'}</strong>
                <span>
                  {source.tag} · {source.year || '无年份'}
                </span>
              </button>
            ))}
            {!bibliography.sources.length && (
              <CollectionState className='work-office-collection-empty' role='status'>
                还没有文献源。
              </CollectionState>
            )}
          </div>
        </aside>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveSource();
          }}
        >
          <div className='work-office-field'>
            <span>引用标记</span>
            <OfficeTextField
              aria-label='引用标记'
              value={draft.tag}
              maxLength={80}
              placeholder='例如 Smith2026'
              onChange={(event) => setDraft({ ...draft, tag: event.target.value })}
            />
          </div>
          <div className='work-office-field'>
            <span>来源类型</span>
            <OfficeSelect
              ariaLabel='文献来源类型'
              value={draft.sourceType}
              options={[
                ...(!knownSourceType && draft.sourceType
                  ? [{ value: draft.sourceType, label: `${draft.sourceType}（原始类型）` }]
                  : []),
                ...SOURCE_TYPES.map(([value, label]) => ({ value, label })),
              ]}
              onValueChange={(sourceType) => setDraft({ ...draft, sourceType })}
            />
          </div>
          <div className='work-office-field wide'>
            <span>标题</span>
            <OfficeTextField
              aria-label='文献标题'
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </div>
          <div className='work-office-field'>
            <span>年份</span>
            <OfficeTextField
              aria-label='文献年份'
              value={draft.year}
              inputMode='numeric'
              placeholder='2026'
              onChange={(event) => setDraft({ ...draft, year: event.target.value })}
            />
          </div>
          <div className='work-office-field'>
            <span>机构作者</span>
            <OfficeTextField
              aria-label='机构作者'
              value={draft.corporateAuthor}
              placeholder='与个人作者二选一'
              onChange={(event) => setDraft({ ...draft, corporateAuthor: event.target.value })}
            />
          </div>
          <div className='work-office-field wide'>
            <span>个人作者</span>
            <OfficeTextArea
              aria-label='个人作者'
              value={draft.authors}
              placeholder={'每行一位，例如：\nSmith, Jane\nLi, Ming'}
              onChange={(event) => setDraft({ ...draft, authors: event.target.value })}
            />
          </div>
          <div className='work-office-field'>
            <span>出版者</span>
            <OfficeTextField
              aria-label='出版者'
              value={draft.publisher}
              onChange={(event) => setDraft({ ...draft, publisher: event.target.value })}
            />
          </div>
          <div className='work-office-field'>
            <span>出版城市</span>
            <OfficeTextField
              aria-label='出版城市'
              value={draft.city}
              onChange={(event) => setDraft({ ...draft, city: event.target.value })}
            />
          </div>
          <div className='work-office-field'>
            <span>期刊名</span>
            <OfficeTextField
              aria-label='期刊名'
              value={draft.journalName}
              onChange={(event) => setDraft({ ...draft, journalName: event.target.value })}
            />
          </div>
          <div className='work-office-field'>
            <span>卷 / 期</span>
            <span className='paired'>
              <OfficeTextField
                aria-label='卷'
                value={draft.volume}
                placeholder='卷'
                onChange={(event) => setDraft({ ...draft, volume: event.target.value })}
              />
              <OfficeTextField
                aria-label='期'
                value={draft.issue}
                placeholder='期'
                onChange={(event) => setDraft({ ...draft, issue: event.target.value })}
              />
            </span>
          </div>
          <div className='work-office-field'>
            <span>页码</span>
            <OfficeTextField
              aria-label='文献页码'
              value={draft.pages}
              placeholder='12–28'
              onChange={(event) => setDraft({ ...draft, pages: event.target.value })}
            />
          </div>
          <div className='work-office-field'>
            <span>ISBN / DOI</span>
            <OfficeTextField
              aria-label='标准编号'
              value={draft.standardNumber}
              onChange={(event) => setDraft({ ...draft, standardNumber: event.target.value })}
            />
          </div>
          <div className='work-office-field'>
            <span>会议名称</span>
            <OfficeTextField
              aria-label='会议名称'
              value={draft.conferenceName}
              onChange={(event) => setDraft({ ...draft, conferenceName: event.target.value })}
            />
          </div>
          <div className='work-office-field'>
            <span>报告机构</span>
            <OfficeTextField
              aria-label='报告机构'
              value={draft.institution}
              onChange={(event) => setDraft({ ...draft, institution: event.target.value })}
            />
          </div>
          <div className='work-office-field wide'>
            <span>网址</span>
            <OfficeTextField
              aria-label='文献网址'
              value={draft.url}
              inputMode='url'
              placeholder='https://'
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            />
          </div>
          <div className='actions wide'>
            {error && (
              <InlineNotice className='work-office-form-error' tone='danger' role='alert'>
                {error}
              </InlineNotice>
            )}
            <Button
              tone='secondary'
              disabled={!selectedSource}
              onClick={() => selectedSource && insertDocumentCitation(editor, selectedSource, bibliography)}
            >
              <Quote size={13} />
              插入引文
            </Button>
            <Button tone='danger' disabled={!draft.id} onClick={deleteSource}>
              <Trash2 size={13} />
              删除
            </Button>
            <Button type='submit' tone='primary'>
              保存文献源
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function sourceDraft(source?: WorkDocumentCitationSource): CitationSourceDraft {
  const author = source?.contributors?.Author;
  return {
    id: source?.id,
    tag: source?.tag ?? '',
    sourceType: source?.sourceType ?? 'Book',
    title: source?.title ?? '',
    year: source?.year ?? '',
    authors: formatAuthors(author?.people ?? []),
    corporateAuthor: author?.corporate ?? '',
    publisher: source?.publisher ?? '',
    city: source?.city ?? '',
    journalName: source?.journalName ?? '',
    volume: source?.volume ?? '',
    issue: source?.issue ?? '',
    pages: source?.pages ?? '',
    url: source?.url ?? '',
    standardNumber: source?.standardNumber ?? '',
    conferenceName: source?.conferenceName ?? '',
    institution: source?.institution ?? '',
  };
}

function formatAuthors(people: WorkDocumentCitationPerson[]): string {
  return people
    .map((person) => {
      const given = [person.first, person.middle].filter(Boolean).join(' ');
      return [person.last, given].filter(Boolean).join(', ');
    })
    .join('\n');
}

function parseAuthors(value: string): WorkDocumentCitationPerson[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [lastPart, givenPart] = line.split(',', 2);
      if (givenPart !== undefined) {
        const given = givenPart.trim().split(/\s+/).filter(Boolean);
        return {
          first: given.shift() ?? '',
          middle: given.join(' ') || undefined,
          last: lastPart.trim(),
        };
      }
      const parts = line.split(/\s+/);
      const last = parts.pop() ?? '';
      return { first: parts.shift() ?? '', middle: parts.join(' ') || undefined, last };
    });
}

function optionalValue(value: string): string | undefined {
  return value.trim() || undefined;
}
