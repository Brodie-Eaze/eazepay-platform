/**
 * Saved views — localStorage-backed CRUD for snapshotted URL filter
 * states. A "view" is a (surface, search-params) pair the operator
 * names and pins so they can jump back to the same filtered list
 * without re-applying filters every morning.
 *
 * Why localStorage for now:
 *   - No backend table yet (Sprint G ships UI; persistence migration
 *     follows once we agree on a per-user vs per-org scope).
 *   - Per-browser is fine for the daily-driver use case: the operator
 *     who configures a "MID issued last 7d" view wants it on their
 *     own machine, not synced to the brand merchant.
 *   - When the BFF lands, swap the read/write surface for
 *     `/v1/saved-views` calls; callers (SavedViewsMenu, sidebar
 *     renderer) stay unchanged.
 *
 * Cap: 50 entries total. Hard upper bound so a runaway "save view"
 * click loop can't blow past the 5MB localStorage quota.
 */

const STORE_KEY = 'eazepay_saved_views_v1';
const MAX_VIEWS = 50;

export interface SavedView {
  id: string;
  name: string;
  /** Pathname this view belongs to, e.g. '/applications'. */
  surface: string;
  /** URL search params snapshot at save-time. */
  filters: Record<string, string>;
  /** When true, render in sidebar under PINNED. */
  pinnedToSidebar?: boolean;
  /** ISO timestamp. */
  createdAt: string;
}

function makeId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function readAll(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: SavedView[] = [];
    for (const v of parsed) {
      if (!v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      if (
        typeof o.id !== 'string' ||
        typeof o.name !== 'string' ||
        typeof o.surface !== 'string' ||
        typeof o.createdAt !== 'string'
      )
        continue;
      const filters: Record<string, string> = {};
      if (o.filters && typeof o.filters === 'object') {
        for (const [k, val] of Object.entries(o.filters as Record<string, unknown>)) {
          if (typeof val === 'string') filters[k] = val;
        }
      }
      out.push({
        id: o.id,
        name: o.name,
        surface: o.surface,
        filters,
        pinnedToSidebar: o.pinnedToSidebar === true,
        createdAt: o.createdAt,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function writeAll(views: SavedView[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(views.slice(0, MAX_VIEWS)));
    // Cross-tab + same-tab listeners (sidebar renderer) get a nudge.
    window.dispatchEvent(new StorageEvent('storage', { key: STORE_KEY }));
  } catch {
    /* swallow — quota or private mode */
  }
}

export function listViews(): SavedView[] {
  return readAll();
}

export function listViewsForSurface(surface: string): SavedView[] {
  return readAll().filter((v) => v.surface === surface);
}

export function listPinned(): SavedView[] {
  return readAll().filter((v) => v.pinnedToSidebar);
}

export function createView(input: Omit<SavedView, 'id' | 'createdAt'>): SavedView {
  const all = readAll();
  const entry: SavedView = {
    id: makeId(),
    name: input.name,
    surface: input.surface,
    filters: input.filters,
    pinnedToSidebar: input.pinnedToSidebar === true,
    createdAt: new Date().toISOString(),
  };
  all.unshift(entry);
  writeAll(all);
  return entry;
}

export function deleteView(id: string): void {
  const all = readAll().filter((v) => v.id !== id);
  writeAll(all);
}

export function pinView(id: string, pinned: boolean): void {
  const all = readAll().map((v) => (v.id === id ? { ...v, pinnedToSidebar: pinned } : v));
  writeAll(all);
}

/** Serialize a SavedView back to a URL ('/applications?status=funded'). */
export function viewToHref(view: SavedView): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(view.filters)) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${view.surface}?${qs}` : view.surface;
}

/** Test-only — wipes localStorage entries. */
export function _resetSavedViewsForTest(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORE_KEY);
}
