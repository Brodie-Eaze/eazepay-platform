import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createView,
  deleteView,
  listViews,
  listViewsForSurface,
  listPinned,
  pinView,
  viewToHref,
  _resetSavedViewsForTest,
} from './saved-views';

/* Minimal localStorage shim + window stub so the lib's
 * `typeof window === 'undefined'` guards fall through and we exercise
 * the real read/write paths. */
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
  const win = {
    localStorage,
    dispatchEvent: vi.fn(),
  };
  // @ts-expect-error - assigning a minimal stub for the test env
  globalThis.window = win;
  // StorageEvent constructor needed by writeAll's nudge
  // @ts-expect-error - test stub
  globalThis.StorageEvent = class StorageEvent {
    type: string;
    key: string | null;
    constructor(type: string, init: { key?: string }) {
      this.type = type;
      this.key = init.key ?? null;
    }
  };
}

describe('saved-views', () => {
  beforeEach(() => {
    installWindowShim();
    _resetSavedViewsForTest();
  });

  it('createView returns an entry with id + createdAt', () => {
    const v = createView({
      name: 'Funded last 7d',
      surface: '/applications',
      filters: { status: 'funded', range: '7d' },
    });
    expect(v.id).toMatch(/^v_/);
    expect(v.createdAt).toBeTruthy();
    expect(v.pinnedToSidebar).toBe(false);
  });

  it('listViews returns most-recent first', () => {
    const a = createView({ name: 'A', surface: '/applications', filters: {} });
    const b = createView({ name: 'B', surface: '/applications', filters: {} });
    const list = listViews();
    expect(list[0]?.id).toBe(b.id);
    expect(list[1]?.id).toBe(a.id);
  });

  it('listViewsForSurface filters by pathname', () => {
    createView({ name: 'A', surface: '/applications', filters: {} });
    createView({ name: 'B', surface: '/admin/audit', filters: {} });
    expect(listViewsForSurface('/applications')).toHaveLength(1);
    expect(listViewsForSurface('/admin/audit')).toHaveLength(1);
    expect(listViewsForSurface('/nope')).toHaveLength(0);
  });

  it('pinView toggles pinnedToSidebar', () => {
    const v = createView({ name: 'A', surface: '/applications', filters: {} });
    pinView(v.id, true);
    expect(listPinned()).toHaveLength(1);
    pinView(v.id, false);
    expect(listPinned()).toHaveLength(0);
  });

  it('deleteView removes the entry', () => {
    const v = createView({ name: 'A', surface: '/applications', filters: {} });
    deleteView(v.id);
    expect(listViews()).toHaveLength(0);
  });

  it('viewToHref encodes filters as search params', () => {
    const v = createView({
      name: 'Funded',
      surface: '/applications',
      filters: { status: 'funded', range: '7d' },
    });
    expect(viewToHref(v)).toBe('/applications?status=funded&range=7d');
  });

  it('viewToHref returns bare surface when filters are empty', () => {
    const v = createView({ name: 'All', surface: '/applications', filters: {} });
    expect(viewToHref(v)).toBe('/applications');
  });
});
