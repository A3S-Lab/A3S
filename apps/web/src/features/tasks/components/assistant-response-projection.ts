import type { ChatMessage, ContentBlock } from '../../../types/api';
import type { ToolCallProjection } from './tool-call-projection';

export type AssistantResponseSegment =
  | { id: string; kind: 'text'; content: string }
  | { id: string; kind: 'tool'; call: ToolCallProjection };

export function projectAssistantResponseSegments(
  message: Pick<ChatMessage, 'content' | 'contentBlocks' | 'events' | 'pending'>,
  calls: readonly ToolCallProjection[]
): AssistantResponseSegment[] {
  let segments: AssistantResponseSegment[];
  if (!calls.length) {
    segments = message.content ? [{ id: 'text-0', kind: 'text', content: message.content }] : [];
  } else {
    const eventSegments = projectEventSegments(message, calls);
    if (eventSegments.length > 0) {
      segments = appendCanonicalRemainder(eventSegments, message.content);
    } else {
      const blockSegments = projectBlockSegments(message.contentBlocks ?? [], calls);
      segments =
        blockSegments.length > 0
          ? appendCanonicalRemainder(blockSegments, message.content)
          : [
              ...calls.map((call) => ({ id: `tool-${call.id}`, kind: 'tool' as const, call })),
              ...(message.content ? [{ id: 'text-0', kind: 'text' as const, content: message.content }] : []),
            ];
    }
  }
  return visibleSegments(segments, calls);
}

const TERMINAL_RESEARCH_VIEW_MARKER = /(?:^|\r?\n)[\t ]*A3S_RESEARCH_VIEW:[^\r\n]*(?:\r?\n[\t ]*)*$/;

export function visibleAssistantContent(content: string, calls: readonly ToolCallProjection[] = []): string {
  const marker = TERMINAL_RESEARCH_VIEW_MARKER.exec(content);
  const visible = marker?.index === undefined ? content : content.slice(0, marker.index).trimEnd();
  const normalized = visible.trim();
  const repeatsCancellation = calls.some((call) => {
    if (call.state !== 'interrupted' || call.metadata?.cancelled !== true) return false;
    const message = call.metadata.message;
    return typeof message === 'string' && normalized === message.trim();
  });
  return repeatsCancellation ? '' : visible;
}

function visibleSegments(
  segments: AssistantResponseSegment[],
  calls: readonly ToolCallProjection[]
): AssistantResponseSegment[] {
  const visible: AssistantResponseSegment[] = [];
  for (const segment of segments) {
    if (segment.kind === 'tool') {
      visible.push(segment);
      continue;
    }
    const content = visibleAssistantContent(segment.content, calls);
    if (content) visible.push({ ...segment, content });
  }
  return visible;
}

function projectEventSegments(
  message: Pick<ChatMessage, 'events'>,
  calls: readonly ToolCallProjection[]
): AssistantResponseSegment[] {
  const events = message.events ?? [];
  const callsAt = new Map<number, ToolCallProjection[]>();
  for (const call of calls) {
    if (call.firstEventIndex === undefined) continue;
    const positioned = callsAt.get(call.firstEventIndex) ?? [];
    positioned.push(call);
    callsAt.set(call.firstEventIndex, positioned);
  }
  if (!callsAt.size && !events.some((event) => event.type === 'text_delta' && typeof event.text === 'string')) {
    return [];
  }

  const segments: AssistantResponseSegment[] = [];
  events.forEach((event, index) => {
    for (const call of callsAt.get(index) ?? []) appendTool(segments, call);
    if (event.type === 'text_delta' && typeof event.text === 'string') appendText(segments, event.text);
  });
  appendUnpositionedTools(segments, calls);
  return segments;
}

function projectBlockSegments(
  blocks: readonly ContentBlock[],
  calls: readonly ToolCallProjection[]
): AssistantResponseSegment[] {
  const callsAt = new Map<number, ToolCallProjection[]>();
  for (const call of calls) {
    if (call.firstBlockIndex === undefined) continue;
    const positioned = callsAt.get(call.firstBlockIndex) ?? [];
    positioned.push(call);
    callsAt.set(call.firstBlockIndex, positioned);
  }
  if (!callsAt.size && !blocks.some((block) => blockText(block))) return [];

  const segments: AssistantResponseSegment[] = [];
  blocks.forEach((block, index) => {
    for (const call of callsAt.get(index) ?? []) appendTool(segments, call);
    appendText(segments, blockText(block));
  });
  appendUnpositionedTools(segments, calls);
  return segments;
}

function appendCanonicalRemainder(
  segments: AssistantResponseSegment[],
  canonicalContent: string
): AssistantResponseSegment[] {
  if (!canonicalContent) return segments;
  const observed = segments
    .filter((segment): segment is Extract<AssistantResponseSegment, { kind: 'text' }> => segment.kind === 'text')
    .map((segment) => segment.content)
    .join('');
  if (!observed) {
    appendText(segments, canonicalContent);
  } else if (canonicalContent.startsWith(observed)) {
    appendText(segments, canonicalContent.slice(observed.length));
  }
  return segments;
}

function appendUnpositionedTools(segments: AssistantResponseSegment[], calls: readonly ToolCallProjection[]): void {
  const positioned = new Set(
    segments
      .filter((segment): segment is Extract<AssistantResponseSegment, { kind: 'tool' }> => segment.kind === 'tool')
      .map((segment) => segment.call.id)
  );
  for (const call of calls) {
    if (!positioned.has(call.id)) appendTool(segments, call);
  }
}

function appendText(segments: AssistantResponseSegment[], content: string | undefined): void {
  if (!content) return;
  const previous = segments.at(-1);
  if (previous?.kind === 'text') {
    previous.content += content;
    return;
  }
  segments.push({ id: `text-${segments.length}`, kind: 'text', content });
}

function appendTool(segments: AssistantResponseSegment[], call: ToolCallProjection): void {
  if (segments.some((segment) => segment.kind === 'tool' && segment.call.id === call.id)) return;
  segments.push({ id: `tool-${call.id}`, kind: 'tool', call });
}

function blockText(block: ContentBlock): string | undefined {
  if (!['text', 'output_text', 'text_delta'].includes(block.type)) return undefined;
  return block.text ?? block.content;
}
