import { describe, expect, it } from 'vitest';
import { formatSubagentOutput } from './task-runtime-subagent-evidence';

describe('formatSubagentOutput', () => {
  it('turns structured JSON evidence into a readable copyable code block', () => {
    expect(formatSubagentOutput('{"status":"passed","checks":["typecheck","test"]}')).toBe(
      '```json\n{\n  "status": "passed",\n  "checks": [\n    "typecheck",\n    "test"\n  ]\n}\n```'
    );
  });

  it('preserves prose and malformed structured output verbatim', () => {
    expect(formatSubagentOutput('Completed the accessibility review.')).toBe('Completed the accessibility review.');
    expect(formatSubagentOutput('{not-json')).toBe('{not-json');
  });

  it('uses a longer fence when the payload contains a markdown fence', () => {
    expect(formatSubagentOutput('{"result":"```text\\nok\\n```"}')).toMatch(/^````json\n/);
  });
});
