import { X } from 'lucide-react';
import { useRef } from 'react';
import { IconButton, useDialogFocusScope } from '../../../design-system/primitives';
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
  const focusScope = useDialogFocusScope<HTMLElement>({
    onEscape: onClose,
    initialFocus: () => firstChoiceRef.current,
  });

  return (
    <section
      ref={focusScope.scopeRef}
      className='code-navigation-picker'
      role='dialog'
      aria-modal='true'
      aria-label={`${state.label}导航结果`}
      onKeyDown={focusScope.handleKeyDown}
    >
      <header>
        <strong>{state.label}导航结果</strong>
        <span>{state.candidates.length} 处</span>
        <IconButton label='关闭导航结果' onClick={onClose}>
          <X size={14} />
        </IconButton>
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
