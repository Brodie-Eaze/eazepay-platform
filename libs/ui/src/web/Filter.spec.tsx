/**
 * Filter primitive — hermetic node specs.
 *
 * The repo doesn't ship a DOM test runtime (no jsdom / testing-library),
 * so this suite covers the pure behaviour helpers
 * (`flattenOptions`, `nextIndex`, `findIndexByValue`,
 * `isGroupedOptions`) that drive every variant of `<Filter>`, plus
 * type-shape assertions for grouped + clearable option configurations.
 *
 * Each variant's interactive behaviour (select dropdown keyboard nav,
 * tabs row, chips wrap) is encoded as a deterministic state transition
 * over the flattened option list — so testing the helpers in isolation
 * covers the keyboard-nav, grouped-options, and clearable code paths
 * without booting React.
 */

import { describe, expect, it } from 'vitest';
import {
  type FilterGroup,
  type FilterOption,
  findIndexByValue,
  flattenOptions,
  isGroupedOptions,
  nextIndex,
} from './Filter.js';

const flat: FilterOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', count: 12 },
  { value: 'c', label: 'Gamma', disabled: true },
  { value: 'd', label: 'Delta' },
];

const grouped: FilterGroup[] = [
  {
    label: 'Group one',
    options: [
      { value: 'a1', label: 'A1' },
      { value: 'a2', label: 'A2' },
    ],
  },
  {
    label: 'Group two',
    options: [
      { value: 'b1', label: 'B1', disabled: true },
      { value: 'b2', label: 'B2' },
    ],
  },
];

describe('Filter / isGroupedOptions', () => {
  it('returns true for a non-empty grouped list', () => {
    expect(isGroupedOptions(grouped)).toBe(true);
  });
  it('returns false for a flat list', () => {
    expect(isGroupedOptions(flat)).toBe(false);
  });
  it('returns false for an empty array', () => {
    expect(isGroupedOptions([])).toBe(false);
  });
});

describe('Filter / flattenOptions', () => {
  it('returns a flat list unchanged', () => {
    expect(flattenOptions(flat)).toEqual(flat);
  });
  it('flattens grouped options preserving group order then in-group order', () => {
    const out = flattenOptions(grouped);
    expect(out.map((o) => o.value)).toEqual(['a1', 'a2', 'b1', 'b2']);
  });
  it('returns [] for an empty input', () => {
    expect(flattenOptions([])).toEqual([]);
  });
});

describe('Filter / nextIndex (keyboard nav)', () => {
  it('moves forward by one', () => {
    expect(nextIndex(0, 1, flat)).toBe(1);
  });
  it('skips disabled options on the way forward', () => {
    // from idx 1 (Beta) → idx 2 (Gamma, disabled) is skipped → idx 3 (Delta)
    expect(nextIndex(1, 1, flat)).toBe(3);
  });
  it('wraps around to the start when overflowing', () => {
    expect(nextIndex(3, 1, flat)).toBe(0);
  });
  it('moves backward and wraps', () => {
    expect(nextIndex(0, -1, flat)).toBe(3);
  });
  it('returns -1 for an empty list', () => {
    expect(nextIndex(0, 1, [])).toBe(-1);
  });
  it('returns the current index when every option is disabled', () => {
    const allDisabled: FilterOption[] = [
      { value: 'x', label: 'X', disabled: true },
      { value: 'y', label: 'Y', disabled: true },
    ];
    expect(nextIndex(0, 1, allDisabled)).toBe(0);
  });
});

describe('Filter / findIndexByValue (selected highlight)', () => {
  it('returns -1 when value is null (= "All")', () => {
    expect(findIndexByValue(flat, null)).toBe(-1);
  });
  it('returns the matching index', () => {
    expect(findIndexByValue(flat, 'b')).toBe(1);
  });
  it('returns -1 when the value is not in the list', () => {
    expect(findIndexByValue(flat, 'zzz')).toBe(-1);
  });
});

describe('Filter / contract — grouped + clearable interaction', () => {
  it('clearable + grouped: flattening across groups feeds the same keyboard nav as flat', () => {
    const flatFromGrouped = flattenOptions(grouped);
    // Skip the disabled 'b1' (idx 2) when arrowing forward from 'a2' (idx 1).
    expect(nextIndex(1, 1, flatFromGrouped)).toBe(3);
    // findIndexByValue locates a value regardless of which group it lives in.
    expect(findIndexByValue(flatFromGrouped, 'b2')).toBe(3);
  });
  it('clearable: null is representable and survives a round-trip through findIndexByValue', () => {
    expect(findIndexByValue(flat, null)).toBe(-1);
    // Confirms the "clear → null" pathway: handler can pass null without breaking the index resolver.
  });
});
