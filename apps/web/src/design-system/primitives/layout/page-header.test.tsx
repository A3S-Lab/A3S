import { cleanup, render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';

afterEach(cleanup);

describe('PageHeader', () => {
  it('keeps title, description, navigation, status, and actions in one shared hierarchy', () => {
    render(
      <PageHeader
        icon={<Circle />}
        title='市场'
        description='发现可信扩展'
        status={<span>本机</span>}
        navigation={<div>页面导航</div>}
        actions={<button type='button'>刷新</button>}
      />
    );

    expect(screen.getByRole('heading', { name: '市场', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('发现可信扩展')).toBeInTheDocument();
    expect(screen.getByText('本机').closest('.ds-page-header-status')).toBeInTheDocument();
    expect(screen.getByText('页面导航').closest('.ds-page-header-navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument();
  });
});
