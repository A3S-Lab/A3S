import type { FileChild, ICommentOptions, IRunOptions, ISectionOptions, ParagraphChild } from 'docx';
import {
  collectDocumentNotes,
  documentNoteKey,
  documentNoteKind,
  type WorkDocumentNote,
  type WorkDocumentNoteKind,
} from './work-document-notes';
import { patchDocxBibliography } from './work-docx-bibliography';
import { docxCaptionParagraph, docxCrossReferenceRuns } from './work-docx-caption-export';
import { docxBibliographyParagraph, docxCitationRun } from './work-docx-citation-export';
import { docxSectionColumns } from './work-docx-column-export';
import { docxDocumentFieldRun } from './work-docx-field-export';
import { normalizeDocumentPageChrome } from './work-document-page-chrome';
import { documentSections } from './work-document-section';
import type {
  WorkDocumentComment,
  WorkDocumentContent,
  WorkDocumentSectionBreakType,
  WorkDocumentSectionLayout,
} from './work-types';

interface DocxNoteContext {
  ids: Map<string, number>;
  changeIds: Map<string, number>;
  nextChangeId: number;
  commentIds: Map<string, number>;
  commentRangeCounts: Map<string, number>;
  commentRangeSeen: Map<string, number>;
}

interface DocxTextRevision {
  kind: 'insertion' | 'deletion';
  id: number;
  author: string;
  date: string;
}

export async function createDocxBlob(content: WorkDocumentContent): Promise<Blob> {
  const docx = await import('docx');
  const noteCollection = collectDocumentNotes(content.html);
  const comments = anchoredDocumentComments(content);
  const noteContext: DocxNoteContext = {
    ids: new Map(noteCollection.notes.map((note) => [documentNoteKey(note.kind, note.id), note.number] as const)),
    changeIds: new Map(),
    nextChangeId: 1,
    commentIds: new Map(),
    commentRangeCounts: documentCommentRangeCounts(content.html),
    commentRangeSeen: new Map(),
  };
  const commentRecords = createDocxCommentRecords(comments, docx, noteContext);
  const sections: ISectionOptions[] = [];
  let usesOddEvenPageChrome = false;
  for (const section of documentSections({ ...content, html: noteCollection.html })) {
    const parsed = new DOMParser().parseFromString(section.html, 'text/html');
    const children: FileChild[] = [];
    for (const node of parsed.body.children) {
      const element = node as HTMLElement;
      if (element.hasAttribute('data-document-note')) continue;
      children.push(await blockToFileChild(element, docx, noteContext));
    }
    if (!children.length) children.push(new docx.Paragraph(''));
    const pageChrome = normalizeDocumentPageChrome(section.layout.pageChrome, section.layout);
    usesOddEvenPageChrome ||= pageChrome.differentOddEvenPages;
    const headers = await sectionHeaders(pageChrome, docx, noteContext);
    const footers = await sectionFooters(pageChrome, docx, noteContext);
    sections.push({
      properties: sectionProperties(section.layout, docx),
      headers,
      footers,
      children,
    });
  }
  const footnotes = await createNoteRecords(noteCollection.notes, 'footnote', docx, noteContext);
  const endnotes = await createNoteRecords(noteCollection.notes, 'endnote', docx, noteContext);
  const document = new docx.Document({
    sections,
    footnotes: Object.keys(footnotes).length ? footnotes : undefined,
    endnotes: Object.keys(endnotes).length ? endnotes : undefined,
    comments: commentRecords.length ? { children: commentRecords } : undefined,
    evenAndOddHeaderAndFooters: usesOddEvenPageChrome,
    features: {
      trackRevisions: Boolean(content.trackChanges || documentHasTrackedChanges(content.html)),
      updateFields: true,
    },
  });
  const packed = await docx.Packer.toBlob(document);
  const patched = await patchDocxBibliography(await packed.arrayBuffer(), content.bibliography);
  return new Blob([patched], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function sectionProperties(
  layout: WorkDocumentSectionLayout,
  docx: typeof import('docx')
): NonNullable<ISectionOptions['properties']> {
  const landscape = layout.orientation === 'landscape';
  const dimensions =
    layout.pageSize === 'letter'
      ? { width: landscape ? 15_840 : 12_240, height: landscape ? 12_240 : 15_840 }
      : { width: landscape ? 16_838 : 11_906, height: landscape ? 11_906 : 16_838 };
  return {
    type: docxSectionType(layout.breakAfter, docx),
    titlePage: normalizeDocumentPageChrome(layout.pageChrome, layout).differentFirstPage,
    page: {
      size: {
        ...dimensions,
        orientation: landscape ? docx.PageOrientation.LANDSCAPE : docx.PageOrientation.PORTRAIT,
      },
      margin: {
        top: millimetersToTwips(layout.margins.top),
        right: millimetersToTwips(layout.margins.right),
        bottom: millimetersToTwips(layout.margins.bottom),
        left: millimetersToTwips(layout.margins.left),
      },
      pageNumbers: layout.pageNumberStart ? { start: layout.pageNumberStart } : undefined,
    },
    column: docxSectionColumns(layout, dimensions.width, docx),
  };
}

async function sectionHeaders(
  chrome: ReturnType<typeof normalizeDocumentPageChrome>,
  docx: typeof import('docx'),
  noteContext: DocxNoteContext
): Promise<ISectionOptions['headers']> {
  const headers: {
    default?: InstanceType<typeof docx.Header>;
    first?: InstanceType<typeof docx.Header>;
    even?: InstanceType<typeof docx.Header>;
  } = {};
  const defaultHeader = await headerFromHtml(chrome.default.headerHtml, docx, noteContext);
  if (defaultHeader) headers.default = defaultHeader;
  if (chrome.differentFirstPage) {
    const firstHeader = await headerFromHtml(chrome.first.headerHtml, docx, noteContext);
    if (firstHeader) headers.first = firstHeader;
  }
  if (chrome.differentOddEvenPages) {
    const evenHeader = await headerFromHtml(chrome.even.headerHtml, docx, noteContext);
    if (evenHeader) headers.even = evenHeader;
  }
  return Object.keys(headers).length ? headers : undefined;
}

async function sectionFooters(
  chrome: ReturnType<typeof normalizeDocumentPageChrome>,
  docx: typeof import('docx'),
  noteContext: DocxNoteContext
): Promise<ISectionOptions['footers']> {
  const footers: {
    default?: InstanceType<typeof docx.Footer>;
    first?: InstanceType<typeof docx.Footer>;
    even?: InstanceType<typeof docx.Footer>;
  } = {};
  const defaultFooter = await footerFromContent(chrome.default, docx, noteContext);
  if (defaultFooter) footers.default = defaultFooter;
  if (chrome.differentFirstPage) {
    const firstFooter = await footerFromContent(chrome.first, docx, noteContext);
    if (firstFooter) footers.first = firstFooter;
  }
  if (chrome.differentOddEvenPages) {
    const evenFooter = await footerFromContent(chrome.even, docx, noteContext);
    if (evenFooter) footers.even = evenFooter;
  }
  return Object.keys(footers).length ? footers : undefined;
}

async function headerFromHtml(
  html: string,
  docx: typeof import('docx'),
  noteContext: DocxNoteContext
): Promise<InstanceType<typeof docx.Header> | undefined> {
  const children = await pageChromeBlocks(html, docx, noteContext);
  return children.length ? new docx.Header({ children }) : undefined;
}

async function footerFromContent(
  content: ReturnType<typeof normalizeDocumentPageChrome>['default'],
  docx: typeof import('docx'),
  noteContext: DocxNoteContext
): Promise<InstanceType<typeof docx.Footer> | undefined> {
  const children = await pageChromeBlocks(content.footerHtml, docx, noteContext);
  if (content.showPageNumber) {
    children.push(
      new docx.Paragraph({
        alignment: docx.AlignmentType.CENTER,
        children: [new docx.TextRun({ children: [docx.PageNumber.CURRENT] })],
      })
    );
  }
  return children.length ? new docx.Footer({ children }) : undefined;
}

function docxSectionType(
  type: WorkDocumentSectionBreakType,
  docx: typeof import('docx')
): (typeof docx.SectionType)[keyof typeof docx.SectionType] {
  if (type === 'continuous') return docx.SectionType.CONTINUOUS;
  if (type === 'evenPage') return docx.SectionType.EVEN_PAGE;
  if (type === 'oddPage') return docx.SectionType.ODD_PAGE;
  if (type === 'nextColumn') return docx.SectionType.NEXT_COLUMN;
  return docx.SectionType.NEXT_PAGE;
}

async function blockToFileChild(
  element: HTMLElement,
  docx: typeof import('docx'),
  noteContext: DocxNoteContext
): Promise<FileChild> {
  const tag = element.tagName.toLowerCase();
  if (element.hasAttribute('data-page-break')) {
    return new docx.Paragraph({ children: [new docx.PageBreak()] });
  }
  if (element.hasAttribute('data-document-bibliography')) {
    return docxBibliographyParagraph(element, docx);
  }
  if (element.hasAttribute('data-document-caption')) {
    return docxCaptionParagraph(element, await inlineRuns(element, docx, noteContext), docx);
  }
  if (tag === 'table') return tableToDocx(element as HTMLTableElement, docx, noteContext);
  if (tag === 'ul' || tag === 'ol') {
    const children: ParagraphChild[] = [];
    for (const [index, item] of Array.from(element.querySelectorAll(':scope > li')).entries()) {
      if (index > 0) children.push(new docx.TextRun({ break: 1 }));
      children.push(...(await inlineRuns(item as HTMLElement, docx, noteContext)));
    }
    return new docx.Paragraph({
      children: children.length ? children : [new docx.TextRun('')],
      bullet: tag === 'ul' ? { level: 0 } : undefined,
      alignment: paragraphAlignment(element, docx),
    });
  }
  const runs = await inlineRuns(element, docx, noteContext);
  const heading =
    tag === 'h1'
      ? docx.HeadingLevel.HEADING_1
      : tag === 'h2'
        ? docx.HeadingLevel.HEADING_2
        : tag === 'h3'
          ? docx.HeadingLevel.HEADING_3
          : undefined;
  return new docx.Paragraph({
    children: runs.length ? runs : [new docx.TextRun('')],
    heading,
    alignment: paragraphAlignment(element, docx),
    spacing: { after: heading ? 180 : 120, line: 320 },
    indent: tag === 'blockquote' ? { left: 540 } : undefined,
  });
}

function millimetersToTwips(value: number): number {
  return Math.round((value * 1440) / 25.4);
}

async function pageChromeBlocks(
  html: string,
  docx: typeof import('docx'),
  noteContext: DocxNoteContext
): Promise<Array<InstanceType<typeof docx.Paragraph> | InstanceType<typeof docx.Table>>> {
  if (!html.trim()) return [];
  const document = new DOMParser().parseFromString(html, 'text/html');
  const children: Array<InstanceType<typeof docx.Paragraph> | InstanceType<typeof docx.Table>> = [];
  for (const element of Array.from(document.body.children)) {
    const block = await blockToFileChild(element as HTMLElement, docx, noteContext);
    if (block instanceof docx.Paragraph || block instanceof docx.Table) children.push(block);
  }
  if (!children.length && document.body.textContent?.trim()) {
    children.push(new docx.Paragraph({ children: await inlineRuns(document.body, docx, noteContext) }));
  }
  return children;
}

async function inlineRuns(
  root: HTMLElement,
  docx: typeof import('docx'),
  noteContext: DocxNoteContext
): Promise<ParagraphChild[]> {
  const runs: ParagraphChild[] = [];
  const visit = async (
    node: Node,
    inherited: IRunOptions = {},
    revision?: DocxTextRevision
  ): Promise<ParagraphChild[]> => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent) return [];
      if (revision?.kind === 'insertion') {
        return [
          new docx.InsertedTextRun({
            ...inherited,
            id: revision.id,
            author: revision.author,
            date: revision.date,
            text: node.textContent,
          }),
        ];
      }
      if (revision?.kind === 'deletion') {
        return [
          new docx.DeletedTextRun({
            ...inherited,
            id: revision.id,
            author: revision.author,
            date: revision.date,
            text: node.textContent,
          }),
        ];
      }
      return [new docx.TextRun({ ...inherited, text: node.textContent })];
    }
    if (!(node instanceof HTMLElement)) return [];
    const tag = node.tagName.toLowerCase();
    if (node.hasAttribute('data-document-citation')) return [docxCitationRun(node, docx)];
    if (node.hasAttribute('data-document-field')) return [docxDocumentFieldRun(node, docx)];
    if (node.hasAttribute('data-document-cross-reference')) return docxCrossReferenceRuns(node, docx);
    if (node.hasAttribute('data-document-note-reference')) {
      const kind = documentNoteKind(node.dataset.noteKind);
      const id = node.dataset.noteId?.trim();
      const noteId = kind && id ? noteContext.ids.get(documentNoteKey(kind, id)) : undefined;
      if (!kind || !noteId) return [];
      return [
        kind === 'footnote'
          ? new docx.FootnoteReferenceRun(noteId)
          : (new docx.EndnoteReferenceRun(noteId) as ParagraphChild),
      ];
    }
    const change = node.hasAttribute('data-document-change')
      ? docxTextRevision(node, tag === 'del' ? 'deletion' : 'insertion', noteContext)
      : revision;
    const commentBoundary = node.hasAttribute('data-document-comment')
      ? nextDocxCommentBoundary(node.dataset.commentId, noteContext)
      : null;
    const style: IRunOptions = {
      ...inherited,
      bold: inherited.bold || tag === 'strong' || tag === 'b',
      italics: inherited.italics || tag === 'em' || tag === 'i',
      underline: inherited.underline || tag === 'u' ? {} : undefined,
      strike: inherited.strike || tag === 's' || tag === 'strike',
      subScript: inherited.subScript || tag === 'sub',
      superScript: inherited.superScript || tag === 'sup',
      color: cssColorToHex(node.style.color) ?? inherited.color,
    };
    if (tag === 'br') {
      return [new docx.TextRun({ ...style, break: 1 })];
    }
    if (tag === 'img') return [await imageToDocx(node as HTMLImageElement, docx)];
    const children: ParagraphChild[] = [];
    for (const child of node.childNodes) children.push(...(await visit(child, style, change)));
    const result =
      tag === 'a' && node.getAttribute('href')
        ? [new docx.ExternalHyperlink({ link: node.getAttribute('href') ?? '', children })]
        : children;
    if (!commentBoundary) return result;
    return [
      ...(commentBoundary.start ? [new docx.CommentRangeStart(commentBoundary.id)] : []),
      ...result,
      ...(commentBoundary.end
        ? [new docx.CommentRangeEnd(commentBoundary.id), new docx.CommentReference(commentBoundary.id)]
        : []),
    ];
  };
  for (const node of root.childNodes) runs.push(...(await visit(node)));
  return runs;
}

function docxTextRevision(
  element: HTMLElement,
  kind: DocxTextRevision['kind'],
  context: DocxNoteContext
): DocxTextRevision {
  const key = element.dataset.changeId?.trim() || `change-${context.nextChangeId}`;
  let id = context.changeIds.get(key);
  if (!id) {
    id = context.nextChangeId;
    context.nextChangeId += 1;
    context.changeIds.set(key, id);
  }
  const sourceDate = element.dataset.changeDate?.trim() ?? '';
  const time = Date.parse(sourceDate);
  return {
    kind,
    id,
    author: element.dataset.changeAuthor?.trim() || 'A3S Work',
    date: Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString(),
  };
}

function documentHasTrackedChanges(html: string): boolean {
  const document = new DOMParser().parseFromString(html, 'text/html');
  return Boolean(document.body.querySelector('ins[data-document-change], del[data-document-change]'));
}

function anchoredDocumentComments(content: WorkDocumentContent): WorkDocumentComment[] {
  const document = new DOMParser().parseFromString(content.html, 'text/html');
  const ids = Array.from(document.body.querySelectorAll<HTMLElement>('[data-document-comment][data-comment-id]'))
    .map((element) => element.dataset.commentId?.trim() ?? '')
    .filter(Boolean);
  const stored = new Map((content.comments ?? []).map((comment) => [comment.id, comment] as const));
  return Array.from(new Set(ids)).map(
    (id) =>
      stored.get(id) ?? {
        id,
        author: '未知审阅者',
        date: '',
        text: '此批注的内容不可用。',
        resolved: false,
      }
  );
}

function documentCommentRangeCounts(html: string): Map<string, number> {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const counts = new Map<string, number>();
  for (const element of Array.from(
    document.body.querySelectorAll<HTMLElement>('[data-document-comment][data-comment-id]')
  )) {
    const id = element.dataset.commentId?.trim();
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function createDocxCommentRecords(
  comments: WorkDocumentComment[],
  docx: typeof import('docx'),
  context: DocxNoteContext
): ICommentOptions[] {
  const records: ICommentOptions[] = [];
  let nextId = 0;
  for (const comment of comments) {
    const id = nextId;
    nextId += 1;
    context.commentIds.set(comment.id, id);
    records.push({
      id,
      author: comment.author || 'A3S Work',
      initials: commentInitials(comment.author),
      date: commentDate(comment.date),
      resolved: Boolean(comment.resolved),
      children: [new docx.Paragraph({ text: comment.text || '（空批注）' })],
    });
    for (const reply of comment.replies ?? []) {
      records.push({
        id: nextId,
        parentId: id,
        author: reply.author || 'A3S Work',
        initials: commentInitials(reply.author),
        date: commentDate(reply.date),
        children: [new docx.Paragraph({ text: reply.text || '（空回复）' })],
      });
      nextId += 1;
    }
  }
  return records;
}

function nextDocxCommentBoundary(
  sourceId: string | undefined,
  context: DocxNoteContext
): { id: number; start: boolean; end: boolean } | null {
  const key = sourceId?.trim() ?? '';
  const id = context.commentIds.get(key);
  const count = context.commentRangeCounts.get(key) ?? 0;
  if (id === undefined || !count) return null;
  const seen = (context.commentRangeSeen.get(key) ?? 0) + 1;
  context.commentRangeSeen.set(key, seen);
  return { id, start: seen === 1, end: seen === count };
}

function commentDate(value: string): Date {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : new Date();
}

function commentInitials(author: string): string {
  const parts = author.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'AW';
  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toUpperCase();
}

async function tableToDocx(
  element: HTMLTableElement,
  docx: typeof import('docx'),
  noteContext: DocxNoteContext
): Promise<InstanceType<typeof docx.Table>> {
  const rows: InstanceType<typeof docx.TableRow>[] = [];
  for (const row of Array.from(element.rows)) {
    const cells: InstanceType<typeof docx.TableCell>[] = [];
    for (const cell of Array.from(row.cells)) {
      const paragraphs: InstanceType<typeof docx.Paragraph>[] = [];
      const blocks = Array.from(cell.children).filter((child) => child.tagName.toLowerCase() !== 'table');
      if (blocks.length) {
        for (const block of blocks) {
          paragraphs.push(
            new docx.Paragraph({
              children: await inlineRuns(block as HTMLElement, docx, noteContext),
              alignment: paragraphAlignment(block as HTMLElement, docx),
              spacing: { after: 60 },
            })
          );
        }
      } else {
        paragraphs.push(
          new docx.Paragraph({
            children: await inlineRuns(cell, docx, noteContext),
          })
        );
      }
      cells.push(
        new docx.TableCell({
          children: paragraphs,
          columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
          rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
          shading: cell.tagName.toLowerCase() === 'th' ? { fill: 'EAF0F8' } : undefined,
          margins: { top: 80, right: 100, bottom: 80, left: 100 },
        })
      );
    }
    rows.push(new docx.TableRow({ children: cells }));
  }
  return new docx.Table({
    rows,
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
  });
}

async function createNoteRecords(
  notes: WorkDocumentNote[],
  kind: WorkDocumentNoteKind,
  docx: typeof import('docx'),
  noteContext: DocxNoteContext
): Promise<Record<string, { children: InstanceType<typeof docx.Paragraph>[] }>> {
  const records: Record<string, { children: InstanceType<typeof docx.Paragraph>[] }> = {};
  for (const note of notes) {
    if (note.kind !== kind) continue;
    records[String(note.number)] = {
      children: await noteParagraphs(note.html, docx, noteContext),
    };
  }
  return records;
}

async function noteParagraphs(
  html: string,
  docx: typeof import('docx'),
  noteContext: DocxNoteContext
): Promise<InstanceType<typeof docx.Paragraph>[]> {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const paragraphs: InstanceType<typeof docx.Paragraph>[] = [];
  for (const child of Array.from(document.body.children)) {
    const element = child as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      for (const item of Array.from(element.querySelectorAll(':scope > li'))) {
        paragraphs.push(
          new docx.Paragraph({
            children: await inlineRuns(item as HTMLElement, docx, noteContext),
            bullet: tag === 'ul' ? { level: 0 } : undefined,
          })
        );
      }
      continue;
    }
    if (tag === 'table') {
      for (const row of Array.from((element as HTMLTableElement).rows)) {
        paragraphs.push(
          new docx.Paragraph({
            text: Array.from(row.cells)
              .map((cell) => cell.textContent?.trim() ?? '')
              .join(' · '),
          })
        );
      }
      continue;
    }
    paragraphs.push(
      new docx.Paragraph({
        children: await inlineRuns(element, docx, noteContext),
      })
    );
  }
  return paragraphs.length ? paragraphs : [new docx.Paragraph('')];
}

async function imageToDocx(element: HTMLImageElement, docx: typeof import('docx')): Promise<ParagraphChild> {
  const source = element.getAttribute('src');
  const alt = element.getAttribute('alt') || element.getAttribute('title') || 'Image';
  if (!source) return new docx.TextRun(`[${alt}]`);
  try {
    const image = await loadImageSource(source);
    const type = docxImageType(image.contentType, source);
    if (!type) return new docx.TextRun(`[${alt}]`);
    const dimensions =
      element.width > 0 && element.height > 0
        ? { width: element.width, height: element.height }
        : await imageDimensions(new Blob([image.data], { type: image.contentType }));
    const maximumWidth = 520;
    const scale = Math.min(1, maximumWidth / Math.max(1, dimensions.width));
    return new docx.ImageRun({
      type,
      data: image.data,
      transformation: {
        width: Math.max(24, Math.round(dimensions.width * scale)),
        height: Math.max(24, Math.round(dimensions.height * scale)),
      },
      altText: { name: alt, description: alt, title: alt },
    });
  } catch {
    return new docx.TextRun(`[${alt}]`);
  }
}

async function loadImageSource(source: string): Promise<{ contentType: string; data: ArrayBuffer }> {
  if (!source.toLowerCase().startsWith('data:')) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Image request failed with HTTP ${response.status}`);
    return {
      contentType: response.headers.get('content-type') ?? '',
      data: await response.arrayBuffer(),
    };
  }

  const comma = source.indexOf(',');
  if (comma < 0) throw new Error('Image data URL has no payload');
  const metadata = source.slice(5, comma).split(';');
  const contentType = metadata[0] || 'application/octet-stream';
  const payload = decodeURIComponent(source.slice(comma + 1));
  const bytes = metadata.some((value) => value.toLowerCase() === 'base64')
    ? Uint8Array.from(atob(payload), (character) => character.charCodeAt(0))
    : new TextEncoder().encode(payload);
  return { contentType, data: bytes.buffer };
}

function docxImageType(contentType: string, source: string): 'jpg' | 'png' | 'gif' | 'bmp' | null {
  const value = `${contentType} ${source}`.toLowerCase();
  if (value.includes('png')) return 'png';
  if (value.includes('jpeg') || value.includes('jpg')) return 'jpg';
  if (value.includes('gif')) return 'gif';
  if (value.includes('bmp')) return 'bmp';
  return null;
}

function paragraphAlignment(element: HTMLElement, docx: typeof import('docx')) {
  const alignment = element.style.textAlign;
  if (alignment === 'center') return docx.AlignmentType.CENTER;
  if (alignment === 'right' || alignment === 'end') return docx.AlignmentType.RIGHT;
  if (alignment === 'justify') return docx.AlignmentType.JUSTIFIED;
  if (alignment === 'left' || alignment === 'start') return docx.AlignmentType.LEFT;
  return undefined;
}

function cssColorToHex(source: string): string | undefined {
  const value = source.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex) {
    return (hex.length === 3 ? [...hex].map((character) => character.repeat(2)).join('') : hex).toUpperCase();
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,[^)]*)?\)$/i.exec(value);
  if (!rgb) return undefined;
  return rgb
    .slice(1, 4)
    .map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function imageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new window.Image();
    image.addEventListener(
      'load',
      () => {
        URL.revokeObjectURL(url);
        resolve({ width: image.naturalWidth || 640, height: image.naturalHeight || 360 });
      },
      { once: true }
    );
    image.addEventListener(
      'error',
      () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image dimensions could not be read'));
      },
      { once: true }
    );
    image.src = url;
  });
}
