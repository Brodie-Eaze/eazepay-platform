import { defineConfig } from 'vitest/config';

/**
 * Partner-portal unit tests.
 *
 * Scope: hermetic, pure-TS specs for `lib/` helpers and `middleware.ts`.
 * The Next.js App Router runtime is not wired into vitest, so we
 * intentionally exclude the `app/**` route handler tests — those need
 * the next test-helpers package and a different runner. The existing
 * `app/api/.../route.test.ts` files are orphans by design (engineer
 * was capturing intent, but the harness isn't built yet); flagged for
 * a future task.
 */
export default defineConfig({
  test: {
    name: 'partner-portal',
    include: ['lib/**/*.spec.ts', 'middleware.spec.ts'],
    environment: 'node',
  },
});
