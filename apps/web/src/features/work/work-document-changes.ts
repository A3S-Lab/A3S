import { type Editor, Mark, mergeAttributes } from '@tiptap/core';
import { Fragment, type Mark as ProseMirrorMark, type Node as ProseMirrorNode, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state';

export type WorkDocumentChangeKind = 'insertion' | 'deletion';

export interface WorkDocumentChangeIdentity {
  id: string;
  author: string;
  date: string;
}

export interface WorkDocumentChange extends WorkDocumentChangeIdentity {
  kind: WorkDocumentChangeKind;
  from: number;
  to: number;
  text: string;
}

interface DocumentChangeOptions {
  isTracking: () => boolean;
  createChange: (kind: WorkDocumentChangeKind) => WorkDocumentChangeIdentity;
}

interface ChangeSegment {
  id: string;
  kind: WorkDocumentChangeKind;
  from: number;
  to: number;
}

const documentChangePluginKey = new PluginKey('documentChangeTracking');
const CONTINUOUS_INSERTION_WINDOW_MS = 30_000;

export const DocumentChange = Mark.create<DocumentChangeOptions>({
  name: 'documentChange',
  priority: 1100,
  inclusive: false,
  keepOnSplit: false,

  addOptions() {
    return {
      isTracking: () => false,
      createChange: () => ({
        id: createDocumentChangeId(),
        author: 'A3S Work',
        date: new Date().toISOString(),
      }),
    };
  },

  addAttributes() {
    return {
      kind: {
        default: 'insertion',
        parseHTML: (element) => (element.tagName.toLowerCase() === 'del' ? 'deletion' : 'insertion'),
        renderHTML: (attributes) => ({ 'data-change-kind': attributes.kind }),
      },
      id: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-change-id') ?? '',
        renderHTML: (attributes) => ({ 'data-change-id': attributes.id }),
      },
      author: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-change-author') ?? '',
        renderHTML: (attributes) => ({ 'data-change-author': attributes.author }),
      },
      date: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-change-date') ?? '',
        renderHTML: (attributes) => ({ 'data-change-date': attributes.date }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'ins[data-document-change]' }, { tag: 'del[data-document-change]' }];
  },

  renderHTML({ mark, HTMLAttributes }) {
    return [
      mark.attrs.kind === 'deletion' ? 'del' : 'ins',
      mergeAttributes(HTMLAttributes, { 'data-document-change': 'true' }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    const changeType = this.type;
    const options = this.options;
    return [
      new Plugin({
        key: documentChangePluginKey,
        props: {
          handleTextInput: (view, from, to, text) => {
            if (!options.isTracking()) return false;
            const transaction = trackedReplacement(
              view.state.tr,
              view.state.doc,
              changeType,
              from,
              to,
              text,
              options.createChange
            );
            view.dispatch(transaction);
            return true;
          },
          handleKeyDown: (view, event) => {
            if (
              !options.isTracking() ||
              event.isComposing ||
              event.metaKey ||
              event.ctrlKey ||
              (event.key !== 'Backspace' && event.key !== 'Delete')
            ) {
              return false;
            }
            const selection = view.state.selection;
            const range =
              selection.from !== selection.to
                ? { from: selection.from, to: selection.to }
                : adjacentTextRange(view.state.doc, selection.from, event.key === 'Backspace' ? -1 : 1);
            if (!range) return false;
            const transaction = view.state.tr;
            const changed = trackDeletion(
              transaction,
              view.state.doc,
              changeType,
              range.from,
              range.to,
              changeMark(changeType, 'deletion', options.createChange)
            );
            if (!changed) return false;
            const cursor = Math.min(transaction.doc.content.size, transaction.mapping.map(range.from));
            transaction.setSelection(TextSelection.near(transaction.doc.resolve(cursor)));
            view.dispatch(transaction);
            return true;
          },
          handlePaste: (view, _event, slice) => {
            if (!options.isTracking()) return false;
            const insertion = changeMark(changeType, 'insertion', options.createChange);
            const markedSlice = new Slice(
              markFragment(slice.content, insertion, changeType),
              slice.openStart,
              slice.openEnd
            );
            const { from, to } = view.state.selection;
            const transaction = view.state.tr;
            if (from !== to) {
              trackDeletion(
                transaction,
                view.state.doc,
                changeType,
                from,
                to,
                changeMark(changeType, 'deletion', options.createChange)
              );
            }
            const position = transaction.mapping.map(to, -1);
            transaction.replace(position, position, markedSlice);
            const cursor = Math.min(transaction.doc.content.size, position + markedSlice.size);
            transaction.setSelection(TextSelection.near(transaction.doc.resolve(cursor)));
            view.dispatch(transaction);
            return true;
          },
        },
      }),
    ];
  },
});

export function collectDocumentChanges(document: ProseMirrorNode): WorkDocumentChange[] {
  const changes = new Map<string, WorkDocumentChange>();
  document.descendants((node, position) => {
    if (!node.isText || !node.text) return;
    const mark = documentChangeMark(node.marks);
    if (!mark) return;
    const kind = changeKind(mark.attrs.kind);
    const id = stringAttribute(mark.attrs.id) || `change-at-${position}`;
    const key = `${kind}:${id}`;
    const current = changes.get(key);
    if (current) {
      current.from = Math.min(current.from, position);
      current.to = Math.max(current.to, position + node.nodeSize);
      current.text += node.text;
      return;
    }
    changes.set(key, {
      id,
      kind,
      author: stringAttribute(mark.attrs.author) || '未知审阅者',
      date: stringAttribute(mark.attrs.date),
      from: position,
      to: position + node.nodeSize,
      text: node.text,
    });
  });
  return Array.from(changes.values()).sort((left, right) => left.from - right.from);
}

export function acceptDocumentChange(editor: Editor, id: string): boolean {
  return resolveDocumentChanges(editor, 'accept', new Set([id])) > 0;
}

export function rejectDocumentChange(editor: Editor, id: string): boolean {
  return resolveDocumentChanges(editor, 'reject', new Set([id])) > 0;
}

export function acceptAllDocumentChanges(editor: Editor): number {
  return resolveDocumentChanges(editor, 'accept');
}

export function rejectAllDocumentChanges(editor: Editor): number {
  return resolveDocumentChanges(editor, 'reject');
}

export function replaceDocumentTextWithTrackedChange(
  editor: Editor,
  from: number,
  to: number,
  text: string,
  createChange: (kind: WorkDocumentChangeKind) => WorkDocumentChangeIdentity
): boolean {
  const type = editor.schema.marks.documentChange;
  if (!type || from < 0 || to < from || to > editor.state.doc.content.size) return false;
  editor.view.dispatch(trackedReplacement(editor.state.tr, editor.state.doc, type, from, to, text, createChange));
  return true;
}

function resolveDocumentChanges(editor: Editor, decision: 'accept' | 'reject', ids?: Set<string>): number {
  const type = editor.schema.marks.documentChange;
  if (!type) return 0;
  const segments = documentChangeSegments(editor.state.doc, type).filter((segment) => !ids || ids.has(segment.id));
  if (!segments.length) return 0;
  const transaction = editor.state.tr;
  const removals: ChangeSegment[] = [];
  const deletions: ChangeSegment[] = [];
  for (const segment of segments) {
    const remove =
      (decision === 'accept' && segment.kind === 'insertion') || (decision === 'reject' && segment.kind === 'deletion');
    (remove ? removals : deletions).push(segment);
  }
  for (const segment of removals) transaction.removeMark(segment.from, segment.to, type);
  for (const segment of deletions.sort((left, right) => right.from - left.from)) {
    transaction.delete(segment.from, segment.to);
  }
  if (!transaction.docChanged) return 0;
  editor.view.dispatch(transaction);
  return new Set(segments.map((segment) => segment.id)).size;
}

function trackedReplacement(
  transaction: Transaction,
  document: ProseMirrorNode,
  type: ProseMirrorMark['type'],
  from: number,
  to: number,
  text: string,
  createChange: (kind: WorkDocumentChangeKind) => WorkDocumentChangeIdentity
): Transaction {
  if (from !== to) {
    trackDeletion(transaction, document, type, from, to, changeMark(type, 'deletion', createChange));
  }
  const position = transaction.mapping.map(to, -1);
  if (text) {
    const insertion =
      from === to
        ? continuousInsertionMark(document, type, position, createChange)
        : changeMark(type, 'insertion', createChange);
    transaction.insertText(text, position);
    transaction.addMark(position, position + text.length, insertion);
  }
  const cursor = Math.min(transaction.doc.content.size, position + text.length);
  transaction.setSelection(TextSelection.near(transaction.doc.resolve(cursor)));
  return transaction;
}

function trackDeletion(
  transaction: Transaction,
  document: ProseMirrorNode,
  type: ProseMirrorMark['type'],
  from: number,
  to: number,
  deletion: ProseMirrorMark
): boolean {
  const segments = textSegments(document, type, from, to);
  if (!segments.length) return false;
  for (const segment of segments) {
    if (!segment.kind) transaction.addMark(segment.from, segment.to, deletion);
  }
  for (const segment of segments
    .filter((segment) => segment.kind === 'insertion')
    .sort((left, right) => right.from - left.from)) {
    transaction.delete(segment.from, segment.to);
  }
  return true;
}

function textSegments(
  document: ProseMirrorNode,
  type: ProseMirrorMark['type'],
  from: number,
  to: number
): Array<{ from: number; to: number; kind: WorkDocumentChangeKind | null }> {
  const segments: Array<{ from: number; to: number; kind: WorkDocumentChangeKind | null }> = [];
  document.nodesBetween(from, to, (node, position) => {
    if (!node.isText) return;
    const start = Math.max(from, position);
    const end = Math.min(to, position + node.nodeSize);
    if (start >= end) return;
    const mark = node.marks.find((candidate) => candidate.type === type);
    segments.push({ from: start, to: end, kind: mark ? changeKind(mark.attrs.kind) : null });
  });
  return segments;
}

function documentChangeSegments(document: ProseMirrorNode, type: ProseMirrorMark['type']): ChangeSegment[] {
  const segments: ChangeSegment[] = [];
  document.descendants((node, position) => {
    if (!node.isText) return;
    const mark = node.marks.find((candidate) => candidate.type === type);
    if (!mark) return;
    segments.push({
      id: stringAttribute(mark.attrs.id) || `change-at-${position}`,
      kind: changeKind(mark.attrs.kind),
      from: position,
      to: position + node.nodeSize,
    });
  });
  return segments;
}

function markFragment(fragment: Fragment, insertion: ProseMirrorMark, type: ProseMirrorMark['type']): Fragment {
  const nodes: ProseMirrorNode[] = [];
  fragment.forEach((node) => {
    if (node.isText) {
      nodes.push(node.mark([...node.marks.filter((mark) => mark.type !== type), insertion]));
    } else if (node.content.size) {
      nodes.push(node.copy(markFragment(node.content, insertion, type)));
    } else {
      nodes.push(node);
    }
  });
  return Fragment.fromArray(nodes);
}

function adjacentTextRange(
  document: ProseMirrorNode,
  position: number,
  direction: -1 | 1
): { from: number; to: number } | null {
  const resolved = document.resolve(position);
  const node = direction < 0 ? resolved.nodeBefore : resolved.nodeAfter;
  if (!node?.isText || !node.text) return null;
  const character = direction < 0 ? Array.from(node.text).at(-1) : Array.from(node.text).at(0);
  if (!character) return null;
  return direction < 0
    ? { from: position - character.length, to: position }
    : { from: position, to: position + character.length };
}

function changeMark(
  type: ProseMirrorMark['type'],
  kind: WorkDocumentChangeKind,
  createChange: (kind: WorkDocumentChangeKind) => WorkDocumentChangeIdentity
): ProseMirrorMark {
  const identity = createChange(kind);
  return type.create({
    kind,
    id: identity.id || createDocumentChangeId(),
    author: identity.author || 'A3S Work',
    date: identity.date || new Date().toISOString(),
  });
}

function continuousInsertionMark(
  document: ProseMirrorNode,
  type: ProseMirrorMark['type'],
  position: number,
  createChange: (kind: WorkDocumentChangeKind) => WorkDocumentChangeIdentity
): ProseMirrorMark {
  const next = changeMark(type, 'insertion', createChange);
  const previousNode = document.resolve(position).nodeBefore;
  const previous = previousNode?.marks.find(
    (mark) => mark.type === type && changeKind(mark.attrs.kind) === 'insertion'
  );
  if (!previous) return next;
  if (stringAttribute(previous.attrs.author) !== stringAttribute(next.attrs.author)) return next;
  const previousTime = Date.parse(stringAttribute(previous.attrs.date));
  const nextTime = Date.parse(stringAttribute(next.attrs.date));
  if (
    !Number.isFinite(previousTime) ||
    !Number.isFinite(nextTime) ||
    Math.abs(nextTime - previousTime) > CONTINUOUS_INSERTION_WINDOW_MS
  ) {
    return next;
  }
  return previous;
}

function documentChangeMark(marks: readonly ProseMirrorMark[]): ProseMirrorMark | undefined {
  return marks.find((mark) => mark.type.name === 'documentChange');
}

function changeKind(value: unknown): WorkDocumentChangeKind {
  return value === 'deletion' ? 'deletion' : 'insertion';
}

function stringAttribute(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function createDocumentChangeId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `change-${random}`;
}
