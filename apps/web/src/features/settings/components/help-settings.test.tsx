import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HelpSettings } from './help-settings';

describe('HelpSettings', () => {
  afterEach(cleanup);

  it('makes the editor focus shortcut searchable', () => {
    render(<HelpSettings />);

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索帮助' }), {
      target: { value: 'Ctrl B' },
    });

    expect(screen.getByText('专注编辑')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('makes file quick open discoverable by its shortcut', () => {
    render(<HelpSettings />);

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索帮助' }), {
      target: { value: 'Ctrl P' },
    });

    expect(screen.getByText('快速打开文件')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  it('makes the full-screen workspace action searchable', () => {
    render(<HelpSettings />);

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索帮助' }), {
      target: { value: '全屏工作区' },
    });

    expect(screen.getByText('全屏工作区')).toBeInTheDocument();
  });
});
