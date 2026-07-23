import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OfficeCheckbox,
  OfficeColorPicker,
  OfficeNumberField,
  OfficeSelect,
  OfficeSlider,
  useOfficeDialog,
} from './office-controls';

afterEach(cleanup);

describe('Office controls', () => {
  it('uses a custom listbox instead of a native select', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <OfficeSelect
        ariaLabel='页面方向'
        value='portrait'
        options={[
          { value: 'portrait', label: '纵向' },
          { value: 'landscape', label: '横向' },
        ]}
        onValueChange={onValueChange}
      />
    );

    expect(container.querySelector('select')).toBeNull();
    const combobox = screen.getByRole('combobox', { name: '页面方向' });
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(combobox);
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('option', { name: '横向' }));
    expect(onValueChange).toHaveBeenCalledWith('landscape');
  });

  it('keeps native checkbox semantics with a custom visual treatment', () => {
    const onCheckedChange = vi.fn();
    render(
      <OfficeCheckbox ariaLabel='显示图例' checked={false} onCheckedChange={onCheckedChange}>
        显示图例
      </OfficeCheckbox>
    );

    const checkbox = screen.getByRole('checkbox', { name: '显示图例' });
    expect(checkbox).toHaveAttribute('type', 'checkbox');
    fireEvent.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('uses text and custom steppers instead of a native number field', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <OfficeNumberField ariaLabel='字号' value={12} min={8} max={72} step={2} onValueChange={onValueChange} />
    );

    expect(container.querySelector('input[type="number"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '增加字号' }));
    expect(onValueChange).toHaveBeenCalledWith('14');
  });

  it('uses a palette instead of the system color picker', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <OfficeColorPicker ariaLabel='文字颜色' value='#2563eb' onValueChange={onValueChange} />
    );

    expect(container.querySelector('input[type="color"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '文字颜色' }));
    fireEvent.click(screen.getByRole('option', { name: '颜色 #dc2626' }));
    expect(onValueChange).toHaveBeenCalledWith('#dc2626');
  });

  it('uses an accessible custom slider instead of a native range input', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <OfficeSlider ariaLabel='缩放' value={100} min={50} max={200} step={10} onValueChange={onValueChange} />
    );

    expect(container.querySelector('input[type="range"]')).toBeNull();
    fireEvent.keyDown(screen.getByRole('slider', { name: '缩放' }), { key: 'ArrowRight' });
    expect(onValueChange).toHaveBeenCalledWith(110);
  });

  it('uses an in-product dialog instead of a system prompt', async () => {
    const onResult = vi.fn();
    function Harness() {
      const officeDialog = useOfficeDialog();
      return (
        <>
          <button
            type='button'
            onClick={() => void officeDialog.prompt({ title: '链接地址', initialValue: 'https://' }).then(onResult)}
          >
            添加链接
          </button>
          {officeDialog.dialog}
        </>
      );
    }
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: '添加链接' });
    trigger.focus();
    fireEvent.click(trigger);
    const input = screen.getByRole('textbox', { name: '链接地址' });
    expect(input).toHaveFocus();
    expect(fireEvent.keyDown(input, { key: 'k', ctrlKey: true })).toBe(false);
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'https://a3s.dev' } });
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('https://a3s.dev'));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('moves focus into each prompt in a consecutive dialog flow and restores the original trigger', async () => {
    const onResult = vi.fn();
    function Harness() {
      const officeDialog = useOfficeDialog();
      const replace = async () => {
        const query = await officeDialog.prompt({ title: '查找要替换的文字' });
        if (!query) return;
        const replacement = await officeDialog.prompt({ title: '替换为', initialValue: query });
        onResult(replacement);
      };
      return (
        <>
          <button type='button' onClick={() => void replace()}>
            替换
          </button>
          {officeDialog.dialog}
        </>
      );
    }
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: '替换' });
    trigger.focus();
    fireEvent.click(trigger);
    const query = screen.getByRole('textbox', { name: '查找要替换的文字' });
    expect(query).toHaveFocus();
    fireEvent.change(query, { target: { value: '项目' } });
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    const replacement = await screen.findByRole('textbox', { name: '替换为' });
    await waitFor(() => expect(replacement).toHaveFocus());
    fireEvent.change(replacement, { target: { value: '计划' } });
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith('计划'));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
