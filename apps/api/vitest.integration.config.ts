import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Resolve the include glob against THIS config file's directory rather
// than the invoker's CWD. The root `pnpm test:integration` script runs
// vitest from the repo root, but the test files live in apps/api/test;
// without this anchor vitest can't find any specs.
const HERE = resolve(fileURLToPath(import.meta.url), '..');

/**
 * Standalone vitest config for the API integration suite. Selected
 * explicitly via the root `pnpm test:integration` script.
 *
 * Why a separate file rather than a `projects:` block on the main
 * config: `pnpm test` shells out via nx → `vitest run` with no flags,
 * which would pick up every project in the config and try to boot
 * Postgres + Redis for the integration project as part of the
 * default test loop. A separate file keeps the unit-test default
 * fast and zero-dependency.
 *
 * Timeouts here are sized for `docker compose up --wait` /
 * testcontainers cold-start.
 */
export default defineConfig({
  test: {
    name: 'api-integration',
    root: HERE,
    include: ['test/integration/**/*.spec.ts'],
    environment: 'node',
    hookTimeout: 120_000,
    testTimeout: 60_000,
    // Integration specs share one Postgres/Redis stack and the
    // wipeDatabase() helper truncates the schema between specs —
    // neither is safe with parallel workers. Force singleFork.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
  },
});
