import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles/evolution-detail.css'), 'utf8');
const mobileStyles = styles.slice(
  styles.indexOf('@media (max-width: 720px)'),
  styles.indexOf('@media (prefers-reduced-motion: reduce)')
);

describe('evolution responsive styles', () => {
  it('uses a single-column workbench with a horizontal candidate list on narrow screens', () => {
    expect(mobileStyles).toMatch(
      /\.evolution-workbench\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);/s
    );
    expect(mobileStyles).toMatch(/\.evolution-candidate-list\s*\{[^}]*flex-direction:\s*row;[^}]*overflow-x:\s*auto;/s);
    expect(mobileStyles).toMatch(/\.evolution-candidate-browser\s*\{[^}]*border-bottom:/s);
  });

  it('keeps detail actions and version rows usable without horizontal overflow', () => {
    expect(mobileStyles).toMatch(/\.evolution-detail-actions\s*\{[^}]*flex-wrap:\s*wrap;/s);
    expect(mobileStyles).toMatch(/\.evolution-version-list > article\s*\{[^}]*flex-wrap:\s*wrap;/s);
    expect(mobileStyles).toMatch(/\.evolution-detail-header h2\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  });

  it('compacts the page header while preserving icon actions', () => {
    expect(mobileStyles).toMatch(
      /\.memory-page-header \.ds-page-header-actions \.ds-button\s*\{[^}]*min-height:\s*32px;/s
    );
    expect(mobileStyles).toMatch(/\.memory-page-header \.memory-settings-action\s*\{[^}]*font-size:\s*0;/s);
  });
});
