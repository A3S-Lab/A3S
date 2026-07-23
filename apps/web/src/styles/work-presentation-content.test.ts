import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles/work-presentation-content.css'), 'utf8');

describe('Presentation editing handles', () => {
  it('does not apply slide text sizing to the move and resize handles', () => {
    expect(styles).not.toMatch(/\.work-slide-element\s*>\s*span\s*\{/);
  });
});
