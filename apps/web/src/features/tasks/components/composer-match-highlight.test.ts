import { describe, expect, it } from 'vitest';
import { splitComposerMatchText } from './composer-match-highlight';

describe('Composer match highlighting', () => {
  it('highlights every case-insensitive query match without changing text', () => {
    expect(splitComposerMatchText('Report Master report workflow', 'report')).toEqual([
      { text: 'Report', highlighted: true },
      { text: ' Master ', highlighted: false },
      { text: 'report', highlighted: true },
      { text: ' workflow', highlighted: false },
    ]);
  });

  it('leaves text untouched when there is no query', () => {
    expect(splitComposerMatchText('/goal', '')).toEqual([{ text: '/goal', highlighted: false }]);
  });
});
