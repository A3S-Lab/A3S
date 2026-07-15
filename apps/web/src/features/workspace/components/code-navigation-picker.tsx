import { useEffect, useRef } from 'react';
import type { CodeLocation } from '../../../types/api';
import type { WorkspaceFileSelection } from '../workspace-state';

export interface NavigationCandidate {
  location: CodeLocation;
  selection: WorkspaceFileSelection;
}

export interface NavigationPickerState {
  label: string;
  candidates: NavigationCandidate[];
  resultSuffix: string;
}

export function NavigationResultPicker({
  state,
  onChoose,
  onClose,
}: {
  state: NavigationPickerState;
  onChoose: (candidate: NavigationCandidate) => void;
  onClose: () => void;
}) {
  const firstChoiceRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    firstChoiceRef.current?.focus();
  }, []);

  return (
    <section
      className='code-navigation-picker'
      role='dialog'
      aria-modal='true'
      aria-label={`${state.label}导航结果`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const activeIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const nextIndex = event.shiftKey
            ? activeIndex <= 0
              ? buttons.length - 1
              : activeIndex - 1
            : activeIndex >= buttons.length - 1
              ? 0
              : activeIndex + 1;
          event.preventDefault();
          buttons[nextIndex]?.focus();
        }
      }}
    >
      <header>
        <strong>{state.label}导航结果</strong>
        <span>{state.candidates.length} 处</span>
        <button type='button' aria-label='关闭导航结果' onClick={onClose}>
          ×
        </button>
      </header>
      <ol>
        {state.candidates.map((candidate, index) => (
          <li
            key={`${candidate.location.path}:${candidate.location.range.start.line}:${candidate.location.range.start.character}:${index}`}
          >
            <button ref={index === 0 ? firstChoiceRef : undefined} type='button' onClick={() => onChoose(candidate)}>
              <span>{candidate.location.path}</span>
              <small>
                第 {candidate.location.range.start.line + 1} 行，第 {candidate.location.range.start.character + 1} 列
              </small>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
