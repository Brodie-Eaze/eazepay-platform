import { describe, expect, it } from 'vitest';
import { formatTime } from '../src/format-time.js';

const FIXED_NOW = new Date('2026-05-26T20:50:18.000Z');

describe('formatTime / iso', () => {
  it('renders ISO 8601 UTC', () => {
    expect(formatTime(FIXED_NOW, { mode: 'iso' })).toBe('2026-05-26T20:50:18.000Z');
  });
});

describe('formatTime / date', () => {
  it('renders Month Day, Year in UTC', () => {
    expect(formatTime(FIXED_NOW, { mode: 'date', timeZone: 'UTC' })).toBe('May 26, 2026');
  });
});

describe('formatTime / datetime', () => {
  it('renders date + lowercase ampm time in UTC', () => {
    expect(formatTime(FIXED_NOW, { mode: 'datetime', timeZone: 'UTC' })).toBe(
      'May 26, 2026, 8:50pm',
    );
  });
});

describe('formatTime / precise', () => {
  it('renders Month Day, ampm without year', () => {
    expect(formatTime(FIXED_NOW, { mode: 'precise', timeZone: 'UTC' })).toBe('May 26, 8:50pm');
  });
});

describe('formatTime / relative', () => {
  const opts = { mode: 'relative' as const, now: FIXED_NOW };

  it('returns "just now" within 5s', () => {
    const t = new Date(FIXED_NOW.getTime() - 3_000);
    expect(formatTime(t, opts)).toBe('just now');
  });

  it('returns Ns ago for sub-minute past', () => {
    const t = new Date(FIXED_NOW.getTime() - 30_000);
    expect(formatTime(t, opts)).toBe('30s ago');
  });

  it('handles the 59s boundary', () => {
    const t = new Date(FIXED_NOW.getTime() - 59_000);
    expect(formatTime(t, opts)).toBe('59s ago');
  });

  it('crosses to minutes at 60s', () => {
    const t = new Date(FIXED_NOW.getTime() - 60_000);
    const out = formatTime(t, opts);
    expect(out).toMatch(/^1 min\.? ago$/);
  });

  it('renders hours past', () => {
    const t = new Date(FIXED_NOW.getTime() - 2 * 3_600_000);
    const out = formatTime(t, opts);
    expect(out).toMatch(/^2 hr\.? ago$/);
  });

  it('renders a day at 24h', () => {
    const t = new Date(FIXED_NOW.getTime() - 24 * 3_600_000);
    const out = formatTime(t, opts);
    // Intl-locale-aware: "yesterday" or "1 day ago" depending on ICU.
    expect(out.toLowerCase()).toMatch(/yesterday|1 day ago/);
  });

  it('renders 7d as a week', () => {
    const t = new Date(FIXED_NOW.getTime() - 7 * 86_400_000);
    const out = formatTime(t, opts);
    expect(out).toMatch(/wk|week/);
  });

  it('renders 45d as a month', () => {
    // The month bucket uses 30.4375 d (average Gregorian month) as its
    // floor, so we step beyond that to guarantee the month branch.
    const t = new Date(FIXED_NOW.getTime() - 45 * 86_400_000);
    const out = formatTime(t, opts);
    expect(out).toMatch(/mo|month/);
  });

  it('renders future relative', () => {
    const t = new Date(FIXED_NOW.getTime() + 2 * 3_600_000);
    const out = formatTime(t, opts);
    expect(out).toMatch(/in 2 hr/);
  });
});

describe('formatTime / errors', () => {
  it('throws on invalid date string', () => {
    expect(() => formatTime('not-a-date', { mode: 'iso' })).toThrow(/invalid date/);
  });
});
