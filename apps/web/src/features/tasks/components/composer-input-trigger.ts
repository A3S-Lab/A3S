export type ComposerInputTrigger = {
  kind: 'file' | 'skill';
  query: string;
  from: number;
  to: number;
};

export function findComposerInputTrigger(textBeforeCursor: string, cursor: number): ComposerInputTrigger | null {
  const match = textBeforeCursor.match(/(?:^|\s)(?:@([^\s@]*)|\/([^\s/]*))$/);
  if (!match) return null;
  const marker = match[1] === undefined ? '/' : '@';
  const query = match[1] ?? match[2] ?? '';
  const tokenLength = marker.length + query.length;
  return {
    kind: marker === '@' ? 'file' : 'skill',
    query,
    from: cursor - tokenLength,
    to: cursor,
  };
}

export function composerInputTriggerKey(trigger: ComposerInputTrigger): string {
  return `${trigger.kind}:${trigger.from}:${trigger.to}:${trigger.query}`;
}
