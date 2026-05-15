import { defineConfig, devices } from '@playwright/test';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Playwright config — partner-portal end-to-end suite
 * ─────────────────────────────────────────────────────────────────────
 *
 * baseURL:
 *   - Default `http://localhost:3001` matches the original brief.
 *   - Real partner-portal dev server runs on :3004 (`next dev -p 3004`
 *     in `apps/partner-portal/package.json`). Override with
 *     `PLAYWRIGHT_BASE_URL=http://localhost:3004 pnpm test:e2e` until
 *     the port lands on a single value.
 *   - Point at a deployed environment via the same env var:
 *     `PLAYWRIGHT_BASE_URL=https://eazepay-platform-production.up.railway.app pnpm test:e2e`
 *
 * Projects:
 *   - chromium-desktop — 1280×800, mainstream sales-team viewport.
 *   - chromium-mobile  — Pixel 5 profile, covers the responsive
 *                        breakpoints the partner-portal landings claim.
 *
 * Tests are colocated under `e2e/`; the directory is intentionally
 * outside any workspace package so it ships with the repo but never
 * loads into `pnpm test` / `vitest`. Run via the root script
 * `pnpm test:e2e` (defined in `package.json`).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Playwright defaults to half-CPU workers locally; cap at 4 so a
  // 16-core M-series doesn't hammer the dev Next.js server.
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  // 60-second test timeout — landings have animation reveals; we don't
  // want flaky early-return on a slow machine.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001',
    // Trace on first-failure retry — cheap to enable, invaluable when
    // a CI failure can't be reproduced locally.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
});
