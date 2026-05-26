import { defineConfig } from 'vitest/config';

/**
 * libs/ui unit specs.
 *
 * Hermetic node-only. The repo doesn't ship a DOM test runtime (no
 * jsdom / @testing-library/react), so specs target the pure behaviour
 * helpers exported alongside each component (e.g. `flattenOptions`,
 * `nextIndex` in Filter.tsx). Component-render integration tests run
 * upstream via Playwright (`pnpm test:e2e`).
 */
export default defineConfig({
  test: {
    name: 'ui',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    environment: 'node',
  },
});
