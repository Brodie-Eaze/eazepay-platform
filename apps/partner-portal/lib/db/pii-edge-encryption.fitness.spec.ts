/**
 * PRIV-002 fitness function — prevent regression of the edge-PII-at-rest
 * fix.
 *
 * The class of issue: a new (or refactored) read path selects the
 * PLAINTEXT `applications.consumerFirst/Last/Email/Phone` Drizzle columns
 * instead of decrypting the `*_enc` columns at the data-access boundary.
 * Those plaintext columns exist only during the expand/contract window
 * (migration 0020 → 0021) and the write path no longer populates them, so
 * any such read would surface empty/stale PII AND signal that someone is
 * leaning on the soon-to-be-dropped cleartext.
 *
 * This spec walks the partner-portal source and fails if any file OTHER
 * than the sanctioned crypto-boundary modules references those plaintext
 * Drizzle columns. New PII reads MUST go through
 * `lib/db/applications-pii.ts`.
 *
 * (Filesystem-walking fitness specs are an established convention in this
 * package — see lib/silent-failures.spec.ts.)
 */
import { describe, expect, it } from 'vitest';
import { promises as fs, type Dirent } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// partner-portal root (this file lives at <root>/lib/db/).
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCAN_DIRS = ['app', 'lib'];

// Files allowed to mention the plaintext columns: the schema definition,
// the data-access boundary, the backfill (which reads plaintext to seal
// it), and PRIV-002 specs/docs.
const ALLOWLIST = new Set([
  'lib/db/schema.ts',
  'lib/db/applications-pii.ts',
  'lib/db/pii-crypto.ts',
  'lib/db/pii-crypto.spec.ts',
  'lib/db/pii-edge-encryption.fitness.spec.ts',
  'scripts/backfill-priv002.ts',
]);

// The risky pattern: a Drizzle column accessor on the plaintext columns.
// Matches `applications.consumerFirst` (and Last/Email/Phone) but NOT the
// `*Enc` variants and NOT `consumerFirstName` (invite-store field).
const FORBIDDEN = /\bapplications\.consumer(?:First|Last|Email|Phone)\b(?!Enc)/;

async function walk(dir: string, acc: string[]): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      await walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('PRIV-002 fitness: no plaintext edge-PII column reads', () => {
  it('only the sanctioned boundary modules reference plaintext consumer columns', async () => {
    const files: string[] = [];
    for (const d of SCAN_DIRS) {
      await walk(join(ROOT, d), files);
    }
    const offenders: string[] = [];
    for (const f of files) {
      const rel = f.slice(ROOT.length);
      if (ALLOWLIST.has(rel)) continue;
      const src = await fs.readFile(f, 'utf8');
      if (FORBIDDEN.test(src)) offenders.push(rel);
    }
    expect(
      offenders,
      `These files read the PLAINTEXT applications.consumer* columns (PRIV-002 regression). ` +
        `Decrypt via lib/db/applications-pii.ts instead:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
