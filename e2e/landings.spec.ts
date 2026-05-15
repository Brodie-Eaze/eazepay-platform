import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Marketing landing pages — health check
 * ─────────────────────────────────────────────────────────────────────
 *
 * For each of /landing/medpay, /landing/tradepay, /landing/coachpay we
 * assert:
 *
 *   1. The page returns a 200 (no 5xx, no redirect to /sign-in).
 *   2. The DOM root carries the brand-specific class (`medpay-root`,
 *      `tp-root`, `cp-root`) so the inline CSS scopes apply.
 *   3. The brand's primary CSS variable resolves to a colour close to
 *      the brand palette spec. This catches a CSS-deleted regression
 *      where the page renders unstyled.
 *   4. The primary CTA button is visible and points at a path that
 *      starts with /welcome or /apply (the conversion surface).
 *   5. No console errors fired during page render. We ALLOW warnings
 *      (Next.js dev mode emits a fair few) and ignore third-party
 *      analytics noise that the production build strips out.
 *   6. No network request failed with a 4xx/5xx (e.g. a 404 on a
 *      hero image, or a 500 on a server-rendered fragment).
 *
 * These are the "deploy gate" tests — a landing page that fails any
 * of these in CI is broken in a user-visible way.
 *
 * BaseURL is `http://localhost:3001` by default (override with
 * PLAYWRIGHT_BASE_URL).
 */

interface LandingFixture {
  path: string;
  rootClass: string;
  titleRegex: RegExp;
  /** A hex/rgb fragment that must appear somewhere in the rendered CSS. */
  brandColorHexFragments: readonly string[];
  /**
   * The primary CTA leads to `/welcome` for every brand today. Allowed
   * targets are listed here so future per-brand divergence is easy.
   */
  ctaPathStartsWith: readonly string[];
}

const FIXTURES: readonly LandingFixture[] = [
  {
    path: '/landing/medpay',
    rootClass: 'medpay-root',
    titleRegex: /medpay/i,
    // Clinical teal — `--mp-teal: #0E7C66`. Some browsers report it
    // lowercase; we match case-insensitively below.
    brandColorHexFragments: ['#0E7C66', '#22B8A0'],
    ctaPathStartsWith: ['/welcome', '/apply'],
  },
  {
    path: '/landing/tradepay',
    rootClass: 'tp-root',
    titleRegex: /tradepay/i,
    // Orange — `--tp-orange: #F97316`.
    brandColorHexFragments: ['#F97316', '#FB923C', '#EA580C'],
    ctaPathStartsWith: ['/welcome', '/apply'],
  },
  {
    path: '/landing/coachpay',
    rootClass: 'cp-root',
    titleRegex: /coachpay/i,
    // Purple — `#8B5CF6` per the file header palette comment.
    brandColorHexFragments: ['#8B5CF6', '#a855f7'],
    ctaPathStartsWith: ['/welcome', '/apply'],
  },
];

/**
 * Capture network failures + console errors over the duration of a
 * page load. Returns a tiny accessor so the test can assert on the
 * collected state after navigation completes.
 *
 * Ignore-list reasoning:
 *  - Common analytics calls (analytics, segment, plausible, gtag,
 *    posthog, hotjar) may legitimately fail in dev with no env keys —
 *    they're decorative and don't affect rendering correctness.
 *  - Service-worker / sourcemap 404s are dev-only.
 */
function trackErrors(page: Page) {
  const consoleErrors: ConsoleMessage[] = [];
  const failedRequests: Array<{ url: string; status: number }> = [];

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m);
  });
  page.on('response', (resp) => {
    const status = resp.status();
    const url = resp.url();
    if (status < 400) return;
    // Allowlist of dev-only / non-load-bearing failures.
    if (
      /analytics|segment|plausible|gtag|googletagmanager|posthog|hotjar|sentry|datadog/i.test(url)
    )
      return;
    if (/\.map($|\?)/.test(url)) return;
    if (/__nextjs|_next\/static\/.+\.hot-update/.test(url)) return;
    failedRequests.push({ url, status });
  });

  return {
    failuresExcludingAllowlist(): typeof failedRequests {
      return failedRequests;
    },
    errorMessages(): string[] {
      return (
        consoleErrors
          .map((m) => m.text())
          // Filter common dev-mode noise.
          .filter(
            (t) =>
              !/Warning:.*useLayoutEffect/i.test(t) &&
              !/hydration/i.test(t) &&
              !/Download the React DevTools/i.test(t) &&
              !/Fast Refresh/i.test(t),
          )
      );
    },
  };
}

for (const fixture of FIXTURES) {
  test.describe(`landing page ${fixture.path}`, () => {
    test('renders cleanly with brand styling, CTA, and no errors', async ({ page }) => {
      const tracked = trackErrors(page);

      const response = await page.goto(fixture.path);
      expect(response, 'navigation returned no response').not.toBeNull();
      expect(response!.status(), `${fixture.path} returned ${response!.status()}`).toBeLessThan(
        400,
      );

      // 1. Brand root element present.
      const rootEl = page.locator(`.${fixture.rootClass}`).first();
      await expect(rootEl).toBeVisible({ timeout: 15_000 });

      // 2. Title check. Next.js sets it via `<title>` in metadata or
      //    on the page; we just look for the brand name somewhere.
      const title = await page.title();
      expect(title).toMatch(fixture.titleRegex);

      // 3. Brand colour assertion. Each landing inlines a `<style>`
      //    block that defines the brand CSS variables. We pull the
      //    full rendered HTML once and check at least one of the
      //    expected hex fragments shows up. This is intentionally
      //    forgiving — exact CSS-variable assertion would couple the
      //    test to specific class names that the design team
      //    iterates on.
      const html = await page.content();
      const htmlLc = html.toLowerCase();
      const matched = fixture.brandColorHexFragments.some((c) => htmlLc.includes(c.toLowerCase()));
      expect(
        matched,
        `expected one of ${fixture.brandColorHexFragments.join(', ')} in rendered CSS`,
      ).toBe(true);

      // 4. Primary CTA — first anchor in the page whose href starts
      //    with /welcome or /apply.
      const primaryCta = page
        .locator(fixture.ctaPathStartsWith.map((p) => `a[href^="${p}"]`).join(', '))
        .first();
      await expect(primaryCta).toBeVisible({ timeout: 10_000 });

      // Give in-flight client-side hydration a moment to settle so
      // late-bound listeners have a chance to throw if they're going
      // to. `networkidle` is heavy-handed but reliable for this kind
      // of static-marketing test.
      await page.waitForLoadState('networkidle', { timeout: 20_000 });

      // 5. No (non-allowlisted) console errors.
      const errors = tracked.errorMessages();
      expect(errors, `console errors on ${fixture.path}: ${errors.join('\n')}`).toEqual([]);

      // 6. No (non-allowlisted) failed network requests.
      const failed = tracked.failuresExcludingAllowlist();
      expect(
        failed,
        `failed requests on ${fixture.path}: ${failed
          .map((f) => `${f.status} ${f.url}`)
          .join('\n')}`,
      ).toEqual([]);
    });
  });
}
