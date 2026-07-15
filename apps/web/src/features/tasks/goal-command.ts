export type GoalCommand = { kind: 'set'; goal: string } | { kind: 'clear' } | { kind: 'missing' };

export function parseGoalCommand(content: string): GoalCommand | null {
  const match = content.trim().match(/^\/goal(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const target = match[1]?.trim() ?? '';
  if (!target) return { kind: 'missing' };
  if (target.toLowerCase() === 'clear') return { kind: 'clear' };
  return { kind: 'set', goal: target };
}
