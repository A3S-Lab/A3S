import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../../types/api';
import { projectConversation } from './conversation-projection';

function message(
  id: string,
  role: ChatMessage['role'],
  content: string,
  overrides: Partial<ChatMessage> = {}
): ChatMessage {
  return {
    id,
    sessionId: 'task-1',
    role,
    content,
    createdAt: '2026-07-14T08:00:00.000Z',
    ...overrides,
  };
}

describe('projectConversation', () => {
  it('keeps planner and synthesis prompts out of the visible transcript', () => {
    const turns = projectConversation([
      message('user-1', 'user', '修改第2首诗歌的风格'),
      message('assistant-1', 'assistant', '已经完成修改。'),
      message(
        'internal-synthesis',
        'user',
        '[synthesis]\nThe previous turn stopped without a final answer.\n\nOriginal user task:\n修改第2首诗歌的风格\n\nWrite the final answer now.'
      ),
      message('assistant-2', 'assistant', '第2首诗歌已改为婉约风格。'),
      message('user-2', 'user', '工作区有哪些文件？'),
      message(
        'internal-planner',
        'user',
        'Original user request:\n工作区有哪些文件？\n\nPlanner-optimized request:\n列出工作区根目录文件。'
      ),
      message('assistant-3', 'assistant', '根目录包含 README.md。'),
    ]);

    expect(turns).toHaveLength(2);
    expect(turns[0].instruction?.content).toBe('修改第2首诗歌的风格');
    expect(turns[0].responses).toHaveLength(1);
    expect(turns[0].responses[0].content).toBe('第2首诗歌已改为婉约风格。');
    expect(turns[1].instruction?.content).toBe('工作区有哪些文件？');
    expect(turns[1].responses[0].content).toBe('根目录包含 README.md。');
  });

  it('projects Skill and workspace transport wrappers as visible instruction resources', () => {
    const turns = projectConversation([
      message(
        'user-1',
        'user',
        '[Selected skills]\n- Use your `review-master` skill.\n[/Selected skills]\n\n[Workspace context files]\n- src/app.ts\n[/Workspace context files]\n\n审阅这次修改'
      ),
      message('assistant-1', 'assistant', '审阅完成。'),
    ]);

    expect(turns[0].instruction?.content).toBe('审阅这次修改');
    expect(turns[0].instructionResources).toEqual({
      contextFiles: ['src/app.ts'],
      skillNames: ['review-master'],
    });
  });

  it('does not render restored tool results as user instructions', () => {
    const turns = projectConversation([
      message('user-1', 'user', '运行测试'),
      message('tool-result', 'user', 'all tests passed', {
        contentBlocks: [
          {
            type: 'tool_result',
            toolUseId: 'tool-1',
            name: 'bash',
            content: 'all tests passed',
          },
        ],
      }),
      message('assistant-1', 'assistant', '测试通过。'),
    ]);

    expect(turns).toHaveLength(1);
    expect(turns[0].instruction?.content).toBe('运行测试');
    expect(turns[0].responses[0].content).toBe('测试通过。');
  });

  it('marks an unanswered persisted instruction as interrupted only when the task is idle', () => {
    const messages = [message('user-1', 'user', '修复测试')];

    expect(projectConversation(messages, { running: false })[0].interrupted).toBe(true);
    expect(projectConversation(messages, { running: true })[0].interrupted).toBe(false);
  });

  it('keeps system messages and empty assistant shells out of the document', () => {
    const turns = projectConversation([
      message('system-1', 'system', 'Internal context'),
      message('user-1', 'user', '你好'),
      message('assistant-empty', 'assistant', ''),
    ]);

    expect(turns).toHaveLength(1);
    expect(turns[0].responses).toHaveLength(0);
    expect(turns[0].interrupted).toBe(true);
  });

  it('keeps canonical subagent lifecycle evidence visible without requiring answer text', () => {
    const turns = projectConversation([
      message('user-1', 'user', '并行检查实现'),
      message('assistant-subagents', 'assistant', '', {
        events: [
          {
            type: 'subagent_start',
            task_id: 'audit',
            session_id: 'child-audit',
            agent: 'explore',
            description: '检查消息投影',
          },
          {
            type: 'subagent_end',
            task_id: 'audit',
            session_id: 'child-audit',
            agent: 'explore',
            success: true,
          },
        ],
      }),
    ]);

    expect(turns).toHaveLength(1);
    expect(turns[0].responses).toHaveLength(1);
    expect(turns[0].interrupted).toBe(false);
  });
});
