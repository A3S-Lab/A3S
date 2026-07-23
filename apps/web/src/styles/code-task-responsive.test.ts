import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const codeProductStyles = readFileSync(resolve(process.cwd(), 'src/styles/code-product.css'), 'utf8');
const taskSurfaceStyles = readFileSync(resolve(process.cwd(), 'src/styles/task-surface.css'), 'utf8');

describe('Code task responsive styles', () => {
  it('uses an overlay task library instead of squeezing the mobile conversation', () => {
    expect(codeProductStyles).toMatch(
      /@media \(max-width: 620px\)[\s\S]*?\.task-library\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?left:\s*52px;/
    );
  });

  it('stacks and compacts composer controls when its container is narrow', () => {
    expect(taskSurfaceStyles).toMatch(
      /@container \(max-width: 420px\)[\s\S]*?\.task-composer > footer\s*\{[\s\S]*?flex-direction:\s*column;/
    );
    expect(taskSurfaceStyles).toMatch(
      /@container \(max-width: 420px\)[\s\S]*?\.composer-trailing-controls[\s\S]*?\.composer-quick-trigger > span[\s\S]*?display:\s*none;/
    );
  });
});
