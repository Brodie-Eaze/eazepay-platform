/**
 * Recent items — surfaces the last N things the operator opened so
 * cmd-K can render a "Recent" section at the top of the empty-query
 * state. Linear / Superhuman-style muscle memory.
 *
 * Storage: localStorage, capped at 20. We dedupe on `id` so reopening
 * an item bumps it to the front rather than creating a second row.
 *
 * Posture: per-browser, per-device. When the BFF lands the same
 * surface (track / list) can swap to `/v1/recent-items` without
 * callers changing.
 */

import { STORAGE_KEYS } from './storage-keys';

const STORE_KEY = STORAGE_KEYS.recentItems;
const MAX_ITEMS = 20;

export interface RecentItem {
  /** Stable id, matches the originating CommandPaletteCommand.id. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional supporting copy (one-line). */
  description?: string;
  /** Section the source command lives in (e.g. 'Master', 'Lenders'). */
  section: string;
  /** Navigation target. */
  href: string;
  /** ISO timestamp of most-recent open. */
  openedAt: string;
}

function readAll(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RecentItem[] = [];
    for (const v of parsed) {
      if (!v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      if (
        typeof o.id !== 'string' ||
        typeof o.label !== 'string' ||
        typeof o.section !== 'string' ||
        typeof o.href !== 'string' ||
        typeof o.openedAt !== 'string'
      )
        continue;
      out.push({
        id: o.id,
        label: o.label,
        description: typeof o.description === 'string' ? o.description : undefined,
        section: o.section,
        href: o.href,
        openedAt: o.openedAt,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function writeAll(items: RecentItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* swallow */
  }
}

/** Push (or bump) an item to the front of the recents list. */
export function trackItem(input: Omit<RecentItem, 'openedAt'>): void {
  const all = readAll();
  const next = [
    {
      ...input,
      openedAt: new Date().toISOString(),
    },
    ...all.filter((i) => i.id !== input.id),
  ];
  writeAll(next.slice(0, MAX_ITEMS));
}

export function listRecent(limit = 10): RecentItem[] {
  return readAll().slice(0, limit);
}

export function clearRecent(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORE_KEY);
}

/** Test-only. */
export function _resetRecentItemsForTest(): void {
  clearRecent();
}
