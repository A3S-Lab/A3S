import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  configuredSecret,
  SettingsNumberField,
  SettingsSecretField,
  SettingsSegmentedControl,
  SettingsSliderField,
} from './settings-fields';

describe('SettingsNumberField', () => {
  it('formats floating-point transport noise using the configured step precision', () => {
    render(
      <SettingsNumberField label='最低置信度' value={0.7200000286102295} step={0.01} onChange={() => undefined} />
    );

    expect(screen.getByRole('spinbutton', { name: '最低置信度' })).toHaveValue(0.72);
  });

  it('keeps numeric changes typed and preserves the empty state', () => {
    const onChange = vi.fn();
    render(<SettingsNumberField label='权重' value={0.5} step={0.1} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: '权重' });

    fireEvent.change(input, { target: { value: '0.8' } });
    fireEvent.change(input, { target: { value: '' } });

    expect(onChange).toHaveBeenNthCalledWith(1, 0.8);
    expect(onChange).toHaveBeenNthCalledWith(2, null);
  });

  it('explains an out-of-range value next to the field', () => {
    render(<SettingsNumberField label='最大并行任务' value={0} min={1} onChange={() => undefined} />);

    expect(screen.getByRole('spinbutton', { name: '最大并行任务' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('不能小于 1');
  });
});

describe('bounded settings choices', () => {
  it('renders a compact segmented choice with explicit selection semantics', () => {
    const onChange = vi.fn();
    render(
      <SettingsSegmentedControl
        label='会话存储后端'
        value='file'
        options={[
          { value: 'file', label: '本地文件' },
          { value: 'memory', label: '仅内存' },
        ]}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('radio', { name: '本地文件' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '仅内存' }));
    expect(onChange).toHaveBeenCalledWith('memory');
  });

  it('shows a formatted slider value while preserving the numeric change', () => {
    const onChange = vi.fn();
    render(
      <SettingsSliderField
        label='最低置信度'
        value={0.72}
        min={0}
        max={1}
        step={0.01}
        formatValue={(value) => `${Math.round(value * 100)}%`}
        onChange={onChange}
      />
    );

    expect(screen.getByText('72%')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: '最低置信度' }), { target: { value: '0.8' } });
    expect(onChange).toHaveBeenCalledWith(0.8);
  });
});

describe('SettingsSecretField', () => {
  it('does not offer to reveal a secret that the browser never receives', () => {
    render(<SettingsSecretField label='API Key' value={configuredSecret} onChange={() => undefined} />);

    expect(screen.getByText('已配置')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '显示API Key' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除API Key' })).toBeInTheDocument();
  });
});
