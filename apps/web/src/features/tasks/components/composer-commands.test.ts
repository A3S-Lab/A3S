import { describe, expect, it } from 'vitest';
import { matchingComposerCommands } from './composer-commands';

describe('Composer commands', () => {
  it('pins /goal in matching slash suggestions', () => {
    expect(matchingComposerCommands('')).toMatchObject([{ id: 'goal', label: '/goal', kind: 'command' }]);
    expect(matchingComposerCommands('go')).toHaveLength(1);
    expect(matchingComposerCommands('skill')).toEqual([]);
  });
});
