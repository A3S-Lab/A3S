import { describe, expect, it } from 'vitest';
import { formatTaskAge } from './task-library-time';

describe('task library relative time', () => {
  const now = new Date('2026-07-13T12:00:00Z').getTime();

  it('uses concise Chinese relative labels for recent tasks', () => {
    expect(formatTaskAge(now - 20_000, now)).toBe('刚刚');
    expect(formatTaskAge(now - 12 * 60_000, now)).toBe('12分钟前');
    expect(formatTaskAge(now - 7 * 60 * 60_000, now)).toBe('7小时前');
    expect(formatTaskAge(now - 3 * 24 * 60 * 60_000, now)).toBe('3天前');
  });

  it('falls back to a compact calendar date for older tasks', () => {
    expect(formatTaskAge(new Date('2026-06-01T12:00:00Z').getTime(), now)).toMatch(/6.*1/);
  });
});
