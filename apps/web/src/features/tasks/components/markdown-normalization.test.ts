import { describe, expect, it } from 'vitest';
import { normalizeCollapsedMarkdownTables } from './markdown-normalization';

describe('Markdown normalization', () => {
  it('restores row boundaries for a collapsed GFM table', () => {
    expect(
      normalizeCollapsedMarkdownTables(
        '| # | 任务 | 验收 | 估时 | | --- | --- | --- | --- | | 0.1 | workspace | CI 通过 | 1d | | 0.2 | 日志 | 可检索 | 2d |'
      )
    ).toBe(
      [
        '| # | 任务 | 验收 | 估时 |',
        '| --- | --- | --- | --- |',
        '| 0.1 | workspace | CI 通过 | 1d |',
        '| 0.2 | 日志 | 可检索 | 2d |',
      ].join('\n')
    );
  });

  it('leaves valid tables, prose, and fenced examples unchanged', () => {
    const valid = ['| 项目 | 状态 |', '| --- | --- |', '| 构建 | 通过 |'].join('\n');
    const prose = '使用 alpha | beta 表示二选一。';
    const fenced = ['```md', '| A | B | | --- | --- | | 1 | 2 |', '```'].join('\n');

    expect(normalizeCollapsedMarkdownTables(valid)).toBe(valid);
    expect(normalizeCollapsedMarkdownTables(prose)).toBe(prose);
    expect(normalizeCollapsedMarkdownTables(fenced)).toBe(fenced);
  });

  it('does not mistake an empty cell for a row boundary', () => {
    const collapsed = '| A |  | C | | --- | --- | --- | | 1 |  | 3 |';

    expect(normalizeCollapsedMarkdownTables(collapsed)).toBe(
      ['| A |  | C |', '| --- | --- | --- |', '| 1 |  | 3 |'].join('\n')
    );
  });
});
