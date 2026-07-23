import { useRef } from 'react';
import { presentationSlideView } from '../work-presentation-layouts';
import type { WorkPresentationContent, WorkSlide, WorkSlideElement } from '../work-types';
import { OfficeTextArea } from './office-controls';
import { SlideChart } from './presentation-chart-canvas';

export function SlideCanvas({
  content,
  slide,
  interactive,
  aspectRatio,
}: {
  content?: WorkPresentationContent;
  slide: WorkSlide;
  interactive: boolean;
  aspectRatio: string;
}) {
  const view = content ? presentationSlideView(content, slide) : undefined;
  const elements = [
    ...(view?.inheritedElements.map((element) => ({
      element,
      origin: 'inherited' as const,
    })) ?? []),
    ...slide.elements.map((element) => ({
      element,
      origin: 'slide' as const,
    })),
  ];
  return (
    <span
      className={`work-slide-canvas ${interactive ? 'interactive' : ''}`}
      style={{ background: view?.background ?? slide.background, aspectRatio }}
    >
      {elements.map(({ element, origin }) => (
        <SlideElementPreview element={element} key={`${origin}:${element.id}`} origin={origin} />
      ))}
    </span>
  );
}

export function SlideElementPreview({ element, origin }: { element: WorkSlideElement; origin: 'inherited' | 'slide' }) {
  return (
    <span
      className={`work-slide-element ${element.type} ${origin}`}
      data-slide-element-origin={origin}
      style={slideElementStyle(element)}
    >
      {element.type === 'image' && element.image ? (
        <img src={element.image.dataUrl} alt={element.altText ?? element.image.name} />
      ) : element.type === 'table' && element.table ? (
        <SlideTable element={element} />
      ) : element.type === 'chart' && element.chart ? (
        <SlideChart chart={element.chart} label={element.altText ?? element.chart.title ?? '图表'} />
      ) : element.textRuns?.length ? (
        <RichSlideText element={element} />
      ) : element.text ? (
        <span style={slideTextStyle(element)}>{element.text}</span>
      ) : null}
    </span>
  );
}

export function RichEditableText({
  element,
  onCommit,
}: {
  element: WorkSlideElement;
  onCommit: (text: string) => void;
}) {
  const dirtyRef = useRef(false);
  return (
    // biome-ignore lint/a11y/useSemanticElements: A contentEditable surface preserves imported rich-text runs until the user edits them.
    <div
      className='work-slide-rich-editor'
      data-slide-editor
      contentEditable
      suppressContentEditableWarning
      tabIndex={0}
      role='textbox'
      aria-label='幻灯片富文本'
      style={slideTextStyle(element)}
      onInput={() => {
        dirtyRef.current = true;
      }}
      onBlur={(event) => {
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        onCommit(event.currentTarget.innerText);
      }}
    >
      {element.textRuns?.map((run, index) => (
        <span
          key={`${index}-${run.text}`}
          style={{
            color: run.color,
            fontFamily: run.fontFamily,
            fontSize: run.fontSize ? `clamp(6px, ${run.fontSize / 10}cqw, ${run.fontSize}px)` : undefined,
            fontStyle: run.italic ? 'italic' : undefined,
            fontWeight: run.bold ? 700 : undefined,
            textDecoration: run.underline ? 'underline' : undefined,
          }}
        >
          {run.text}
        </span>
      ))}
    </div>
  );
}

export function EditableSlideTable({
  element,
  onChange,
}: {
  element: WorkSlideElement;
  onChange: (rows: string[][]) => void;
}) {
  const table = element.table;
  if (!table) return null;
  return (
    <table className='work-slide-table editable' aria-label={element.altText ?? '幻灯片表格'} data-slide-editor>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, columnIndex) => {
              const Cell = rowIndex < (table.headerRows ?? 0) ? 'th' : 'td';
              return (
                <Cell key={columnIndex}>
                  <OfficeTextArea
                    aria-label={`第 ${rowIndex + 1} 行第 ${columnIndex + 1} 列`}
                    value={cell}
                    onChange={(event) => {
                      const rows = table.rows.map((current) => [...current]);
                      rows[rowIndex][columnIndex] = event.target.value;
                      onChange(rows);
                    }}
                  />
                </Cell>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function slideElementStyle(element: WorkSlideElement): React.CSSProperties {
  const shapeClipPath =
    element.shapeType === 'triangle'
      ? 'polygon(50% 0, 100% 100%, 0 100%)'
      : element.shapeType === 'diamond'
        ? 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)'
        : undefined;
  return {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    background: element.type === 'line' ? 'transparent' : element.fill,
    border:
      element.type === 'line'
        ? undefined
        : element.borderWidth
          ? `${element.borderWidth}px solid ${element.borderColor ?? element.fill}`
          : undefined,
    borderRadius: element.shapeType === 'ellipse' ? '50%' : `${element.radius ?? 0}%`,
    clipPath: shapeClipPath,
    opacity: element.opacity,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: 'center',
    ...(element.type === 'line'
      ? {
          height: `${Math.max(0.5, element.borderWidth ?? 1)}px`,
          borderTop: `${Math.max(0.5, element.borderWidth ?? 1)}px solid ${element.borderColor ?? element.color}`,
        }
      : {}),
  };
}

export function slideTextStyle(element: WorkSlideElement): React.CSSProperties {
  return {
    color: element.color,
    fontFamily: element.fontFamily,
    fontSize: `clamp(6px, ${element.fontSize / 10}cqw, ${element.fontSize}px)`,
    fontWeight: element.bold ? 700 : 400,
    fontStyle: element.italic ? 'italic' : undefined,
    textDecoration: element.underline ? 'underline' : undefined,
    textAlign: element.align,
  };
}

function RichSlideText({ element }: { element: WorkSlideElement }) {
  const content = (
    <span className='work-slide-rich-text' style={slideTextStyle(element)}>
      {element.textRuns?.map((run, index) => {
        const style: React.CSSProperties = {
          color: run.color,
          fontFamily: run.fontFamily,
          fontSize: run.fontSize ? `clamp(6px, ${run.fontSize / 10}cqw, ${run.fontSize}px)` : undefined,
          fontStyle: run.italic ? 'italic' : undefined,
          fontWeight: run.bold ? 700 : undefined,
          textDecoration: run.underline ? 'underline' : undefined,
        };
        return run.href ? (
          <a href={run.href} target='_blank' rel='noreferrer' key={`${index}-${run.text}`} style={style}>
            {run.text}
          </a>
        ) : (
          <span key={`${index}-${run.text}`} style={style}>
            {run.text}
          </span>
        );
      })}
    </span>
  );
  return element.href ? (
    <a className='work-slide-element-link' href={element.href} target='_blank' rel='noreferrer'>
      {content}
    </a>
  ) : (
    content
  );
}

function SlideTable({ element }: { element: WorkSlideElement }) {
  const table = element.table;
  if (!table) return null;
  return (
    <table className='work-slide-table' aria-label={element.altText ?? '幻灯片表格'}>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={`${rowIndex}-${row.join('|')}`}>
            {row.map((cell, columnIndex) => {
              const Cell = rowIndex < (table.headerRows ?? 0) ? 'th' : 'td';
              return <Cell key={`${columnIndex}-${cell}`}>{cell}</Cell>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
