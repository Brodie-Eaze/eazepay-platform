import { describe, it, expect, beforeEach } from 'vitest';
import { trackItem, listRecent, clearRecent, _resetRecentItemsForTest } from './recent-items';

function installWindowShim() {
  const store = new Map<string, string>();
  const localStorage: Storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  // @ts-expect-error - assigning a minimal stub for the test env
  globalThis.window = { localStorage };
}

describe('recent-items', () => {
  beforeEach(() => {
    installWindowShim();
    _resetRecentItemsForTest();
  });

  it('tracks a single item', () => {
    trackItem({ id: 'a', label: 'Applications', section: 'Master', href: '/applications' });
    const list = listRecent();
    expect(list).toHaveLength(1);
    expect(list[0]?.label).toBe('Applications');
  });

  it('bumps repeated items to the front without duplicating', () => {
    trackItem({ id: 'a', label: 'A', section: 'M', href: '/a' });
    trackItem({ id: 'b', label: 'B', section: 'M', href: '/b' });
    trackItem({ id: 'a', label: 'A', section: 'M', href: '/a' });
    const list = listRecent();
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe('a');
    expect(list[1]?.id).toBe('b');
  });

  it('caps at 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      trackItem({ id: `id-${i}`, label: `L${i}`, section: 'M', href: `/x/${i}` });
    }
    const list = listRecent(50);
    expect(list).toHaveLength(20);
    // Most recent first.
    expect(list[0]?.id).toBe('id-24');
  });

  it('respects the limit arg', () => {
    for (let i = 0; i < 8; i++) {
      trackItem({ id: `id-${i}`, label: `L${i}`, section: 'M', href: `/x/${i}` });
    }
    expect(listRecent(5)).toHaveLength(5);
  });

  it('clearRecent empties the store', () => {
    trackItem({ id: 'a', label: 'A', section: 'M', href: '/a' });
    clearRecent();
    expect(listRecent()).toHaveLength(0);
  });
});
