import { describe, expect, it } from 'vitest';
import { currentMonthlyPeriodId, parseMonthlyPeriod } from '../src/internal/period.js';

describe('parseMonthlyPeriod', () => {
  it('builds a UTC-aligned period from a YYYY-MM id', () => {
    const p = parseMonthlyPeriod('2026-05');
    expect(p.id).toBe('2026-05');
    expect(p.label).toBe('May 2026');
    expect(p.start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-05-31T00:00:00.000Z');
    expect(p.defaultDue).toEqual(p.end);
  });

  it('handles February of a non-leap year', () => {
    const p = parseMonthlyPeriod('2025-02');
    expect(p.end.toISOString()).toBe('2025-02-28T00:00:00.000Z');
  });

  it('handles February of a leap year', () => {
    const p = parseMonthlyPeriod('2024-02');
    expect(p.end.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('rejects malformed ids', () => {
    expect(() => parseMonthlyPeriod('2026/05')).toThrow();
    expect(() => parseMonthlyPeriod('26-05')).toThrow();
    expect(() => parseMonthlyPeriod('2026-13')).toThrow();
  });
});

describe('currentMonthlyPeriodId', () => {
  it('returns YYYY-MM for the given date', () => {
    expect(currentMonthlyPeriodId(new Date('2026-05-17T10:00:00Z'))).toBe('2026-05');
    expect(currentMonthlyPeriodId(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
    expect(currentMonthlyPeriodId(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
  });
});
