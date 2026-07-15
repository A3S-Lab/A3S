import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootFailurePresentation, CodeBootScreen } from './code-boot-screen';

describe('CodeBootScreen', () => {
  afterEach(cleanup);

  it('keeps raw route failures behind technical details', () => {
    render(<CodeBootScreen phase='error' error='GET /api/v1/config/llm/models' onRetry={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('服务与页面版本不一致');
    expect(screen.getByText('GET /api/v1/config/llm/models')).not.toBeVisible();
  });

  it('offers a retry action without losing the startup context', () => {
    const onRetry = vi.fn();
    render(<CodeBootScreen phase='error' error='Failed to fetch' onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: '重新连接' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(bootFailurePresentation('Failed to fetch').title).toBe('本地服务尚未就绪');
  });
});
