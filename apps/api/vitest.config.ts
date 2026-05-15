import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    // Unit-grade tests live alongside the code (src/**/*.spec.ts) and a
    // small inventory under test/. Integration tests live under
    // test/integration/ and are EXCLUDED here so the default
    // `pnpm test` / `nx run-many -t test` flow stays fast and does not
    // require a Postgres / Redis stack.
    //
    // To run the integration suite explicitly:
    //   pnpm test:integration   # uses apps/api/vitest.integration.config.ts
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'test/integration/**'],
    environment: 'node',
    // No unit-grade specs live under apps/api today — everything that
    // actually exists is under test/integration/, which is excluded
    // above and runs via the separate `pnpm test:integration` script.
    // Without this flag `vitest run` exits 1 when the include glob
    // matches nothing, which propagates as a `pnpm test` failure even
    // though the workspace has zero broken tests.
    passWithNoTests: true,
  },
});
