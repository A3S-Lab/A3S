export interface ComposerMatchSegment {
  text: string;
  highlighted: boolean;
}

export function splitComposerMatchText(text: string, rawQuery: string): ComposerMatchSegment[] {
  const query = rawQuery.trim();
  if (!query) return [{ text, highlighted: false }];
  const normalizedText = text.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  const segments: ComposerMatchSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
    if (matchIndex < 0) {
      segments.push({ text: text.slice(cursor), highlighted: false });
      break;
    }
    if (matchIndex > cursor) segments.push({ text: text.slice(cursor, matchIndex), highlighted: false });
    segments.push({ text: text.slice(matchIndex, matchIndex + query.length), highlighted: true });
    cursor = matchIndex + query.length;
  }

  return segments.length ? segments : [{ text, highlighted: false }];
}
