import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkFileIcon } from './work-file-icon';

describe('Work file icon', () => {
  it.each([
    ['Plan.docx', 'document', 'W'],
    ['Budget.xlsx', 'spreadsheet', 'X'],
    ['Review.pptx', 'presentation', 'P'],
    ['Contract.pdf', 'pdf', 'PDF'],
  ])('renders %s as a recognizable Office file', (path, kind, monogram) => {
    const { container } = render(<WorkFileIcon path={path} size={48} />);

    expect(container.firstElementChild).toHaveClass('work-local-file-icon', kind);
    expect(container.querySelector('.work-file-monogram')).toHaveTextContent(monogram);
    expect(container.querySelector('small')).toBeNull();
  });

  it('uses the unified filled folder glyph in closed and open states', () => {
    const { container, rerender } = render(<WorkFileIcon path='/docs' directory size={48} />);
    expect(container.firstElementChild).toHaveClass('folder');
    expect(container.querySelector('.work-folder-front')).toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveAttribute('data-open');

    rerender(<WorkFileIcon path='/docs' directory open size={48} />);
    expect(container.firstElementChild).toHaveAttribute('data-open', 'true');
  });

  it('keeps code, images, archives, and plain files visually distinct', () => {
    const { container, rerender } = render(<WorkFileIcon path='main.ts' size={48} />);
    expect(container.firstElementChild).toHaveClass('code');
    expect(container.querySelector('.work-file-code-symbol')).toBeInTheDocument();

    rerender(<WorkFileIcon path='photo.png' size={48} />);
    expect(container.firstElementChild).toHaveClass('image');
    rerender(<WorkFileIcon path='bundle.zip' size={48} />);
    expect(container.firstElementChild).toHaveClass('archive');
    rerender(<WorkFileIcon path='LICENSE' size={48} />);
    expect(container.firstElementChild).toHaveClass('default');
  });
});
