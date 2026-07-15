import { describe, expect, it } from 'vitest';
import { findComposerInputTrigger } from './composer-input-trigger';

describe('composer input triggers', () => {
  it('opens workspace-file search for a path query after @', () => {
    expect(findComposerInputTrigger('Review @src/app', 15)).toEqual({
      kind: 'file',
      query: 'src/app',
      from: 7,
      to: 15,
    });
  });

  it('opens Skill search for a slash token without exposing terminal commands', () => {
    expect(findComposerInputTrigger('/report', 7)).toEqual({
      kind: 'skill',
      query: 'report',
      from: 0,
      to: 7,
    });
  });

  it('does not treat email addresses or URL paths as resource triggers', () => {
    expect(findComposerInputTrigger('mail dev@example', 16)).toBeNull();
    expect(findComposerInputTrigger('open https://a3s.site', 21)).toBeNull();
  });
});
