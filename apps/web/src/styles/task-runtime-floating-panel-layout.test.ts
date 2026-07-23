import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const runtimeStyles = readFileSync(resolve(process.cwd(), 'src/styles/task-runtime-floating-panel.css'), 'utf8');
const preparationStyles = readFileSync(resolve(process.cwd(), 'src/styles/new-task-preparation.css'), 'utf8');

describe('task runtime floating panel layout', () => {
  it('does not move centered conversation content to reserve a panel rail', () => {
    expect(runtimeStyles).not.toMatch(
      /\.task-conversation-pane\[data-task-runtime-layout=['"]wide['"]\][^{]*\.execution-column/
    );
    expect(runtimeStyles).not.toMatch(
      /\.task-conversation-pane\[data-task-runtime-layout=['"]wide['"]\][^{]*\.task-composer/
    );
  });

  it('does not move the preparation composer to reserve a panel rail', () => {
    expect(preparationStyles).not.toMatch(
      /\.new-task-product\[data-task-runtime-layout=['"]wide['"]\][^{]*\.new-task-preparation/
    );
  });
});
