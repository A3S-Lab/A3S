import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskPromptEditor, type TaskPromptEditorHandle } from './task-prompt-editor';

afterEach(cleanup);

describe('TaskPromptEditor', () => {
  it('keeps a disabled editor aligned with an externally cleared submitted value', async () => {
    const onChange = vi.fn();
    const ref = createRef<TaskPromptEditorHandle>();
    const view = render(
      <TaskPromptEditor
        ref={ref}
        value='Submitted instruction'
        disabled
        onChange={onChange}
        onSubmit={() => undefined}
      />
    );

    expect(screen.getByRole('textbox', { name: '任务指令' })).toHaveTextContent('Submitted instruction');

    view.rerender(<TaskPromptEditor ref={ref} value='' disabled onChange={onChange} onSubmit={() => undefined} />);

    await waitFor(() => expect(screen.getByRole('textbox', { name: '任务指令' })).toHaveTextContent(/^$/));
    act(() => ref.current?.focus());
    expect(onChange).not.toHaveBeenCalled();
  });
});
