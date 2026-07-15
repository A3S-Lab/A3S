import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeApi, consumeEventStream, streamSessionMessage, unwrapApiResponse } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('unwrapApiResponse', () => {
  it('accepts the repository API envelope', () => {
    expect(unwrapApiResponse<{ ok: boolean }>({ code: 200, data: { ok: true } })).toEqual({
      ok: true,
    });
  });

  it('preserves raw Boot controller payloads', () => {
    expect(unwrapApiResponse<{ ok: boolean }>({ ok: true })).toEqual({ ok: true });
  });
});

describe('consumeEventStream', () => {
  it('joins split chunks and decodes AgentEvent JSON', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: agent.event\ndata: {"type":"text_'));
        controller.enqueue(encoder.encode('delta","text":"Hello"}\n\n'));
        controller.close();
      },
    });
    const events: unknown[] = [];
    await consumeEventStream(stream, (event) => events.push(event));
    expect(events).toEqual([{ type: 'text_delta', text: 'Hello' }]);
  });

  it('replays task events returned by the non-streaming compatibility endpoint', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            data: {
              accepted: true,
              events: [{ type: 'task_updated', tasks: [{ id: 'one', content: '实现面板', status: 'pending' }] }],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetch);
    const events: unknown[] = [];

    await streamSessionMessage('task/a', '继续', { onEvent: (event) => events.push(event) });

    expect(events).toEqual([{ type: 'task_updated', tasks: [{ id: 'one', content: '实现面板', status: 'pending' }] }]);
  });

  it('surfaces a terminal agent error after rendering the streamed event', async () => {
    const encoder = new TextEncoder();
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode('data: {"type":"error","message":"模型不可用"}\n\n'));
              controller.close();
            },
          }),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
    );
    vi.stubGlobal('fetch', fetch);
    const events: unknown[] = [];

    await expect(streamSessionMessage('task-a', '继续', { onEvent: (event) => events.push(event) })).rejects.toThrow(
      '模型不可用'
    );
    expect(events).toEqual([{ type: 'error', message: '模型不可用' }]);
  });
});

describe('codeApi session maintenance', () => {
  it('requests manual context compaction for one encoded session', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 200,
            data: {
              sessionId: 'task/a',
              compacted: true,
              summary: 'Earlier work',
              historyMessages: 8,
              completedAt: '2026-07-13T00:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );
    vi.stubGlobal('fetch', fetch);

    await expect(codeApi.compactSession('task/a')).resolves.toMatchObject({ compacted: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/kernel/sessions/task%2Fa/actions/compact',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('codeApi workspace code intelligence', () => {
  it('uses fixed-workspace routes with relative paths and UTF-16 positions', async () => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ code: 200, data: { items: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    vi.stubGlobal('fetch', fetch);

    await codeApi.codeIntelligenceStatus({ sessionId: 'task/a' });
    await codeApi.codeOutline('src/app name.ts', { sessionId: 'task/a' });
    await codeApi.codeSymbols('App model', 25, { sessionId: 'task/a' });
    await codeApi.codeNavigation('src/app.ts', 3, 5, 'definition', { sessionId: 'task/a' });
    await codeApi.codeDiagnostics('src/app.ts', { sessionId: 'task/a' });
    await codeApi.codeDiagnostics();

    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/workspace/code-intelligence/status?sessionId=task%2Fa',
      '/api/v1/workspace/code-intelligence/outline?path=src%2Fapp%20name.ts&sessionId=task%2Fa',
      '/api/v1/workspace/code-intelligence/symbols?query=App%20model&limit=25&sessionId=task%2Fa',
      '/api/v1/workspace/code-intelligence/navigation?path=src%2Fapp.ts&line=3&character=5&kind=definition&sessionId=task%2Fa',
      '/api/v1/workspace/code-intelligence/diagnostics?path=src%2Fapp.ts&sessionId=task%2Fa',
      '/api/v1/workspace/code-intelligence/diagnostics',
    ]);
  });
});
