import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../../types/api';
import { projectAssistantResponseSegments, visibleAssistantContent } from './assistant-response-projection';
import { projectToolCalls } from './tool-call-projection';

describe('assistant response projection', () => {
  it('keeps tool calls between the text deltas that surrounded them', () => {
    const message: ChatMessage = {
      id: 'assistant-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '先检查文件。检查完成，开始修改。修改完成。',
      createdAt: '2026-07-22T00:00:00Z',
      events: [
        { type: 'text_delta', text: '先检查文件。' },
        { type: 'tool_start', tool_id: 'read-1', tool_name: 'read' },
        { type: 'tool_end', tool_id: 'read-1', tool_name: 'read', output: 'source', exit_code: 0 },
        { type: 'text_delta', text: '检查完成，开始修改。' },
        { type: 'tool_start', tool_id: 'edit-1', tool_name: 'edit' },
        { type: 'tool_end', tool_id: 'edit-1', tool_name: 'edit', output: 'done', exit_code: 0 },
        { type: 'text_delta', text: '修改完成。' },
      ],
    };
    const calls = projectToolCalls(message.events ?? [], [], { settleOpen: true });

    expect(projectAssistantResponseSegments(message, calls).map(segmentValue)).toEqual([
      'text:先检查文件。',
      'tool:read-1',
      'text:检查完成，开始修改。',
      'tool:edit-1',
      'text:修改完成。',
    ]);
  });

  it('uses persisted content block order when stream events are unavailable', () => {
    const message: ChatMessage = {
      id: 'assistant-2',
      sessionId: 'session-2',
      role: 'assistant',
      content: '准备读取。读取完毕。',
      createdAt: '2026-07-22T00:00:00Z',
      contentBlocks: [
        { type: 'text', text: '准备读取。' },
        { type: 'tool_use', id: 'read-2', name: 'read', input: { path: 'README.md' } },
        { type: 'tool_result', toolUseId: 'read-2', content: '# A3S' },
        { type: 'text', text: '读取完毕。' },
      ],
    };
    const calls = projectToolCalls([], message.contentBlocks, { settleOpen: true });

    expect(projectAssistantResponseSegments(message, calls).map(segmentValue)).toEqual([
      'text:准备读取。',
      'tool:read-2',
      'text:读取完毕。',
    ]);
  });

  it('removes the terminal research-view protocol marker from visible and copied content', () => {
    const report = '# 研究结论\n\n证据支持该结论。';
    const content = `${report}\n\nA3S_RESEARCH_VIEW: .a3s/research/topic/index.html`;
    const message: ChatMessage = {
      id: 'assistant-research',
      sessionId: 'session-research',
      role: 'assistant',
      content,
      createdAt: '2026-07-23T00:00:00Z',
    };

    expect(projectAssistantResponseSegments(message, []).map(segmentValue)).toEqual([`text:${report}`]);
    expect(visibleAssistantContent(content)).toBe(report);
    expect(visibleAssistantContent('`A3S_RESEARCH_VIEW: example`')).toBe('`A3S_RESEARCH_VIEW: example`');
  });

  it('does not repeat an internal DeepResearch cancellation result as assistant prose', () => {
    const content = 'DeepResearch was cancelled by the user.';
    const message: ChatMessage = {
      id: 'assistant-research-cancelled',
      sessionId: 'session-research-cancelled',
      role: 'assistant',
      content,
      createdAt: '2026-07-23T00:00:00Z',
      events: [
        { type: 'tool_start', id: 'research-cancelled', name: 'deep_research' },
        {
          type: 'tool_end',
          id: 'research-cancelled',
          name: 'deep_research',
          output: content,
          exit_code: 1,
          metadata: { cancelled: true, message: content },
        },
      ],
    };
    const calls = projectToolCalls(message.events ?? []);

    expect(projectAssistantResponseSegments(message, calls).map(segmentValue)).toEqual(['tool:research-cancelled']);
    expect(visibleAssistantContent(content, calls)).toBe('');
  });
});

function segmentValue(segment: ReturnType<typeof projectAssistantResponseSegments>[number]): string {
  return segment.kind === 'text' ? `text:${segment.content}` : `tool:${segment.call.id}`;
}
