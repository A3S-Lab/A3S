import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsDisclosure } from './settings-disclosure';
import { SettingsSwitch } from './settings-switch';

describe('SettingsDisclosure', () => {
  it('does not expand advanced fields when its enable switch is used', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SettingsDisclosure
        title='OCR 与视觉识别'
        badge={<SettingsSwitch label='配置文档 OCR' checked={false} onChange={onChange} />}
      >
        <span>高级字段</span>
      </SettingsDisclosure>
    );

    fireEvent.click(screen.getByRole('switch', { name: '配置文档 OCR' }));

    expect(onChange).toHaveBeenCalledWith(true);
    expect(container.querySelector('details')).not.toHaveAttribute('open');
  });
});
