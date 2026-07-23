import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editorStyles = readFileSync(resolve(process.cwd(), 'src/styles/work-editor.css'), 'utf8');
const copilotStyles = readFileSync(resolve(process.cwd(), 'src/styles/work-copilot.css'), 'utf8');
const officeStyles = readFileSync(resolve(process.cwd(), 'src/styles/work-office-chrome.css'), 'utf8');

describe('Work editor responsive chrome', () => {
  it('keeps the ribbon toolbar scrollable while floating popovers escape its clipping boundary', () => {
    expect(officeStyles).not.toMatch(
      /\.work-office-ribbon \.work-office-toolbar:has\(\.ds-popover\.open\)\s*\{[\s\S]*?overflow:\s*visible;/
    );
  });

  it('does not hide the custom text input inside shared color pickers', () => {
    expect(editorStyles).toContain('.work-color-tool > input');
    expect(editorStyles).not.toMatch(/\.work-color-tool input\s*\{/);
  });

  it('keeps common laptop widths split and reserves the Copilot overlay for compact screens', () => {
    expect(copilotStyles).toMatch(
      /@media \(max-width: 960px\)[\s\S]*?\.work-copilot\s*\{[\s\S]*?position:\s*absolute;/
    );
    expect(copilotStyles).not.toContain('@media (max-width: 1120px)');
    expect(editorStyles).toMatch(
      /@media \(max-width: 1120px\)[\s\S]*?\.work-local-save-button,\s*\.work-editor-ai-button\s*\{[\s\S]*?width:\s*32px;[\s\S]*?font-size:\s*0;/
    );
    expect(editorStyles).toMatch(
      /@media \(max-width: 1120px\)[\s\S]*?\.work-preview-switch \.ds-segmented-control-content\s*\{[\s\S]*?width:\s*29px;/
    );
    expect(editorStyles).toMatch(
      /@media \(max-width: 1120px\)[\s\S]*?\.work-preview-switch \.ds-segmented-control-label\s*\{[\s\S]*?display:\s*none;/
    );
    expect(editorStyles).not.toContain('.work-product.copilot-open .work-editor-header');
    expect(officeStyles).toMatch(
      /@media \(max-width: 1120px\)[\s\S]*?\.work-office-ribbon \.work-office-toolbar\s*\{[\s\S]*?padding-inline:\s*5px;/
    );
    expect(officeStyles).toMatch(
      /@media \(max-width: 1120px\)[\s\S]*?\.work-office-ribbon-group\s*\{[\s\S]*?padding-right:\s*4px;[\s\S]*?padding-left:\s*4px;/
    );
    expect(officeStyles).toMatch(
      /@media \(max-width: 1120px\)[\s\S]*?\.work-office-ribbon-group:first-child\s*\{[\s\S]*?padding-left:\s*0;/
    );
    expect(officeStyles).toMatch(
      /@media \(max-width: 1120px\)[\s\S]*?\.work-office-ribbon-group > span\s*\{[\s\S]*?right:\s*4px;[\s\S]*?left:\s*4px;/
    );
  });
});
