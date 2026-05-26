import { describe, expect, it } from 'vitest';
import { formatBps } from '../src/format-bps.js';

describe('formatBps', () => {
  it('renders default precision 2', () => {
    expect(formatBps(199)).toBe('1.99%');
    expect(formatBps(2500)).toBe('25.00%');
    expect(formatBps(0)).toBe('0.00%');
  });

  it('renders 100% from 10000 bps', () => {
    expect(formatBps(10_000)).toBe('100.00%');
  });

  it('honors precision=0', () => {
    expect(formatBps(1875, { precision: 0 })).toBe('19%');
  });

  it('honors precision=1', () => {
    expect(formatBps(1875, { precision: 1 })).toBe('18.8%');
  });

  it('honors precision=4', () => {
    expect(formatBps(1, { precision: 4 })).toBe('0.0100%');
  });

  it('handles negative bps', () => {
    expect(formatBps(-150)).toBe('-1.50%');
  });

  it('throws on non-finite', () => {
    expect(() => formatBps(Number.NaN)).toThrow(/non-finite/);
  });

  it('throws on bad precision', () => {
    expect(() => formatBps(100, { precision: -1 })).toThrow(/precision/);
    expect(() => formatBps(100, { precision: 1.5 })).toThrow(/precision/);
  });
});
