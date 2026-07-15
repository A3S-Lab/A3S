import { describe, expect, it } from 'vitest';
import { slashCommandRanges } from './slash-command-highlight';

describe('slash command highlighting', () => {
  it('highlights a known command without including its argument', () => {
    expect(slashCommandRanges('请执行 /goal 所有测试通过')).toEqual([{ from: 4, to: 9 }]);
  });

  it('does not style URL paths or unknown slash tokens as commands', () => {
    expect(slashCommandRanges('https://streamdown.ai/ /unknown')).toEqual([]);
  });
});
