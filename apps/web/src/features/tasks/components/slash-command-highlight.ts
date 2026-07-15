import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const slashCommandHighlightKey = new PluginKey('slashCommandHighlight');
const knownCommands = new Set(['goal']);

export const SlashCommandHighlight = Extension.create({
  name: 'slashCommandHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: slashCommandHighlightKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, position) => {
              if (!node.isText || !node.text || node.marks.some((mark) => mark.type.name === 'code')) return;
              for (const range of slashCommandRanges(node.text)) {
                decorations.push(
                  Decoration.inline(position + range.from, position + range.to, {
                    class: 'composer-slash-command',
                  })
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export function slashCommandRanges(text: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const pattern = /(^|\s)\/([A-Za-z][\w.-]*)/g;
  for (const match of text.matchAll(pattern)) {
    const command = match[2].toLowerCase();
    if (!knownCommands.has(command) || match.index === undefined) continue;
    const from = match.index + match[1].length;
    ranges.push({ from, to: from + command.length + 1 });
  }
  return ranges;
}
