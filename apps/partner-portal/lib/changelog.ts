import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lightweight parser for `content/changelog.md`. The format is a
 * Linear-style timeline:
 *
 *   ## YYYY-MM-DD — Heading
 *   - bullet
 *   - bullet
 *
 *   ## YYYY-MM-DD — Heading
 *   - bullet
 *
 * We intentionally do NOT pull in a markdown library — the schema is
 * narrow, the parsing is twelve lines, and adding a dependency for
 * three regex calls would be premature abstraction.
 */

export interface ChangelogEntry {
  /** ISO-format date string (YYYY-MM-DD). */
  date: string;
  /** Heading after the em-dash. */
  title: string;
  /** Anchor slug — same as `date` for stable in-page links. */
  slug: string;
  /** Bullet items, in source order. */
  items: string[];
}

const ENTRY_HEADER_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s+—\s+(.+?)\s*$/;
const BULLET_RE = /^-\s+(.+?)\s*$/;

export function parseChangelog(source: string): ChangelogEntry[] {
  const lines = source.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  for (const line of lines) {
    const header = ENTRY_HEADER_RE.exec(line);
    if (header) {
      if (current) entries.push(current);
      const date = header[1] ?? '';
      const title = header[2] ?? '';
      current = { date, title, slug: date, items: [] };
      continue;
    }
    const bullet = BULLET_RE.exec(line);
    if (bullet && current) {
      const item = bullet[1];
      if (item) current.items.push(item);
    }
  }
  if (current) entries.push(current);
  return entries;
}

/**
 * Read + parse the canonical changelog file. Server-only — runs at
 * request time on the changelog page (which is a server component).
 */
export function loadChangelog(): ChangelogEntry[] {
  const path = join(process.cwd(), 'content', 'changelog.md');
  const raw = readFileSync(path, 'utf-8');
  return parseChangelog(raw);
}
