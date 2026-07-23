import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Field } from './field';

afterEach(cleanup);

describe('Field', () => {
  it('associates persistent copy and errors with a simple control', () => {
    render(
      <Field label='名称' description='最多 80 个字符' error='名称不能为空' required>
        <input />
      </Field>
    );

    const input = screen.getByRole('textbox', { name: /名称/ });
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByText('最多 80 个字符').id);
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
  });

  it('provides the same accessibility contract to composite controls', () => {
    render(
      <Field label='本地文件夹'>
        {(controlProps) => (
          <div>
            <input {...controlProps} />
            <button type='button'>选择</button>
          </div>
        )}
      </Field>
    );

    expect(screen.getByRole('textbox', { name: '本地文件夹' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择' })).toBeInTheDocument();
  });
});
