import { describe, expect, it } from 'vitest';
import { parseChangelog, loadChangelog } from './changelog';

describe('parseChangelog', () => {
  it('parses a single entry with multiple bullets', () => {
    const src = `## 2026-05-26 — Foundations\n- one\n- two\n- three\n`;
    const out = parseChangelog(src);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      date: '2026-05-26',
      title: 'Foundations',
      slug: '2026-05-26',
      items: ['one', 'two', 'three'],
    });
  });

  it('parses multiple entries in source order', () => {
    const src = `## 2026-05-26 — A\n- alpha\n\n## 2026-04-15 — B\n- beta\n- gamma\n`;
    const out = parseChangelog(src);
    expect(out.map((e) => e.date)).toEqual(['2026-05-26', '2026-04-15']);
    expect(out[1]?.items).toEqual(['beta', 'gamma']);
  });

  it('ignores stray lines between entries', () => {
    const src = `random preamble\n## 2026-05-26 — A\n- one\nsome non-bullet\n- two\n`;
    const out = parseChangelog(src);
    expect(out[0]?.items).toEqual(['one', 'two']);
  });

  it('returns [] for empty input', () => {
    expect(parseChangelog('')).toEqual([]);
  });

  it('returns [] when there are bullets but no header', () => {
    expect(parseChangelog('- orphan\n- bullets\n')).toEqual([]);
  });

  it('handles entries with trailing whitespace on the header line', () => {
    const src = `## 2026-05-26 — Title with trailing space   \n- item\n`;
    const out = parseChangelog(src);
    expect(out[0]?.title).toBe('Title with trailing space');
  });
});

describe('loadChangelog (filesystem)', () => {
  it('reads content/changelog.md and returns at least one entry with the expected shape', () => {
    const entries = loadChangelog();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.slug).toBe(entry.date);
      expect(entry.items.length).toBeGreaterThan(0);
    }
  });
});
