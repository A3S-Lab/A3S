import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkPresentationContent, WorkSlideElement } from '../work-types';
import { RichEditableText, SlideCanvas } from './presentation-slide-canvas';

describe('Work presentation slide canvas inheritance', () => {
  it('renders master and layout artwork behind slide content', () => {
    const content: WorkPresentationContent = {
      type: 'presentation',
      masters: [
        {
          id: 'master-1',
          name: 'Brand master',
          background: '#16213d',
          elements: [
            {
              id: 'master-brand',
              type: 'text',
              x: 4,
              y: 92,
              width: 20,
              height: 5,
              text: 'A3S master',
              fontSize: 10,
              color: '#ffffff',
              fill: 'transparent',
              bold: true,
              align: 'left',
            },
          ],
        },
      ],
      layouts: [
        {
          id: 'layout-1',
          name: 'Title',
          masterId: 'master-1',
          background: '#f7f4ee',
          elements: [
            {
              id: 'layout-rule',
              type: 'shape',
              x: 8,
              y: 22,
              width: 84,
              height: 2,
              text: '',
              fontSize: 10,
              color: '#ffffff',
              fill: '#ffb15a',
              bold: false,
              align: 'left',
            },
          ],
        },
      ],
      slides: [
        {
          id: 'slide-1',
          name: 'Review',
          background: '#ffffff',
          layoutId: 'layout-1',
          useLayoutBackground: true,
          elements: [
            {
              id: 'slide-title',
              type: 'text',
              x: 8,
              y: 10,
              width: 84,
              height: 10,
              text: 'Quarterly Review',
              fontSize: 30,
              color: '#172033',
              fill: 'transparent',
              bold: true,
              align: 'left',
            },
          ],
        },
      ],
    };

    const { container } = render(
      <SlideCanvas content={content} slide={content.slides[0]} interactive={false} aspectRatio='16 / 9' />
    );

    expect(screen.getByText('A3S master')).toBeInTheDocument();
    expect(screen.getByText('Quarterly Review')).toBeInTheDocument();
    expect(container.querySelector('.work-slide-canvas')).toHaveStyle({
      background: '#f7f4ee',
    });
    expect(container.querySelectorAll('[data-slide-element-origin="inherited"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-slide-element-origin="slide"]')).toHaveLength(1);
  });

  it('preserves imported rich-text runs when toolbar focus only blurs the editor', () => {
    const element: WorkSlideElement = {
      id: 'rich-title',
      type: 'text',
      x: 8,
      y: 10,
      width: 84,
      height: 10,
      text: 'Quarterly Review',
      textRuns: [
        { text: 'Quarterly ', bold: true, color: '#2563eb' },
        { text: 'Review', italic: true, color: '#dc2626' },
      ],
      fontSize: 30,
      color: '#172033',
      fill: 'transparent',
      bold: true,
      align: 'left',
    };
    const onCommit = vi.fn();
    render(<RichEditableText element={element} onCommit={onCommit} />);

    const editor = screen.getByRole('textbox', { name: '幻灯片富文本' });
    fireEvent.focus(editor);
    fireEvent.blur(editor);

    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.input(editor, { target: { innerText: 'Quarterly Review updated' } });
    fireEvent.blur(editor);
    expect(onCommit).toHaveBeenCalledWith('Quarterly Review updated');
  });
});
