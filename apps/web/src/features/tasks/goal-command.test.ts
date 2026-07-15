import { describe, expect, it } from 'vitest';
import { parseGoalCommand } from './goal-command';

describe('/goal command', () => {
  it('parses a persistent target without changing its wording', () => {
    expect(parseGoalCommand('/goal  Ship only after focused tests pass  ')).toEqual({
      kind: 'set',
      goal: 'Ship only after focused tests pass',
    });
  });

  it('supports clearing and reports a missing target', () => {
    expect(parseGoalCommand('/goal clear')).toEqual({ kind: 'clear' });
    expect(parseGoalCommand('/goal')).toEqual({ kind: 'missing' });
  });

  it('does not intercept ordinary instructions or similar commands', () => {
    expect(parseGoalCommand('Explain /goal behavior')).toBeNull();
    expect(parseGoalCommand('/goals are useful')).toBeNull();
  });
});
