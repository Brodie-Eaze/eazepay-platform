import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const HERE = resolve(fileURLToPath(import.meta.url), '..');

/**
 * Partner-portal integration suite — Testcontainers-backed.
 *
 * Scope:
 *   - test/integration spec files only (see `include` below).
 *   - Reuses @testcontainers/postgresql (already declared at repo root).
 *   - Single-fork because the suite shares one Postgres container and
 *     truncates between tests; parallel workers would collide on
 *     truncate.
 *
 * Why a separate config from vitest.config.ts (which targets `lib/`):
 *   The base config intentionally excludes `app/**` because the Next.js
 *   route handlers historically had no harness. This file IS the
 *   harness for them — it drives route.ts modules directly with a
 *   `NextRequest`, no Next.js runtime needed.
 *
 * Run via:  pnpm vitest --config apps/partner-portal/vitest.integration.config.ts
 */
export default defineConfig({
  test: {
    name: 'partner-portal-integration',
    root: HERE,
    include: ['test/integration/**/*.spec.ts'],
    environment: 'node',
    hookTimeout: 120_000,
    testTimeout: 60_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
  },
});
