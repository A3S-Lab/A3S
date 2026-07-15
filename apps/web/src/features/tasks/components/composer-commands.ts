import type { ComposerSuggestionItem } from './composer-suggestion-menu';

export function matchingComposerCommands(query: string): ComposerSuggestionItem[] {
  if (!'goal'.includes(query.trim().toLowerCase())) return [];
  return [
    {
      id: 'goal',
      kind: 'command',
      label: '/goal',
      description: '设置持续目标；输入 /goal clear 清除',
      meta: 'Command',
    },
  ];
}
