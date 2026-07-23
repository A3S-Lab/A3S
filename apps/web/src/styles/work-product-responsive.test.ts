import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const productStyles = readFileSync(resolve(process.cwd(), 'src/styles/work-product.css'), 'utf8');
const libraryStyles = readFileSync(resolve(process.cwd(), 'src/styles/work-library.css'), 'utf8');

describe('Work product responsive styles', () => {
  it('responds to the available Work pane instead of only the browser viewport', () => {
    expect(productStyles).toMatch(
      /\.work-home\s*\{[^}]*container-name:\s*work-home;[^}]*container-type:\s*inline-size;/s
    );
    expect(productStyles).toMatch(
      /@container work-home \(max-width:\s*760px\)[\s\S]*?\.work-home-header\s*\{[^}]*flex-direction:\s*column;/
    );
  });

  it('reduces library grids before cards can overflow beneath the assistant', () => {
    expect(productStyles).toMatch(
      /@container work-home \(max-width:\s*620px\)[\s\S]*?\.work-template-grid,[\s\S]*?\.work-artifact-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
    );
    expect(libraryStyles).toMatch(
      /@container work-home \(max-width:\s*620px\)[\s\S]*?\.work-folder-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
    );
  });
});
