import { describe, expect, it } from 'vitest';
import { pluralize } from '../src/pluralize.js';

describe('pluralize', () => {
  it('singular for 1', () => {
    expect(pluralize(1, 'application')).toBe('1 application');
  });

  it('plural-s for 0', () => {
    expect(pluralize(0, 'application')).toBe('0 applications');
  });

  it('plural-s for 2+', () => {
    expect(pluralize(2, 'application')).toBe('2 applications');
    expect(pluralize(99, 'application')).toBe('99 applications');
  });

  it('honors explicit plural form', () => {
    expect(pluralize(3, 'child', 'children')).toBe('3 children');
    expect(pluralize(1, 'child', 'children')).toBe('1 child');
  });

  it('handles negatives as plural', () => {
    expect(pluralize(-1, 'application')).toBe('-1 applications');
  });
});
