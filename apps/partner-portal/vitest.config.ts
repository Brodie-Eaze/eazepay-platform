import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/*
 * Partner-portal unit tests.
 *
 * Scope: hermetic, pure-TS specs for `lib/` helpers and `middleware.ts`.
 * The Next.js App Router runtime is not wired into vitest as a runner,
 * but route handlers exported as plain async functions (e.g. `POST`)
 * are directly callable with a `NextRequest` instance in node — so
 * the `app/` spec glob is included for handlers that can be exercised
 * hermetically. The older `route.test.ts` orphans were a different
 * convention and remain excluded; flagged for cleanup in a follow-up.
 *
 * `@/` resolves to the partner-portal root, matching the path alias in
 * `tsconfig.json`. Required so route handlers that use `@/lib/...`
 * imports load under the vitest runner without a tsconfig-paths plugin.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@/': `${fileURLToPath(new URL('.', import.meta.url))}/`,
    },
  },
  test: {
    name: 'partner-portal',
    include: ['lib/**/*.spec.ts', 'middleware.spec.ts', 'app/**/*.spec.ts'],
    environment: 'node',
  },
});
