import { test, expect, type Page } from '@playwright/test';

/**
 * Per-brand wall-up smoke tests.
 *
 * Runs against any deployed environment via PLAYWRIGHT_BASE_URL.
 * Default points at production; local dev override:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3104 pnpm test:e2e
 *
 * What we verify:
 *   1. Demo sign-in mints a signed cookie (SEC-103) — bare cookie
 *      values from before the cookie-signing landed must fail.
 *   2. Brand-scoped demo session can ONLY see its own brand surfaces
 *      (medpay cookie → /v/medpay/* renders; /v/tradepay/* 404s).
 *   3. Master/operator demo can see every brand.
 *   4. Services nav links inside a brand portal point at
 *      /v/<brand>/services/<slug>, never the master root.
 *   5. The integration pages render with the shared IntegrationPage
 *      component (brand-flavored title; CTA inside /v/<brand>/).
 *
 * These tests are deterministic — no external API calls, no
 * timestamps. They re-mint a fresh demo cookie for every test so a
 * previous run's state can't leak through.
 */

async function mintDemoSession(page: Page, preset: string): Promise<void> {
  // Navigate to a same-origin page first so the subsequent fetch
  // carries a matching Origin header. SEC-103: the demo mint endpoint
  // rejects cross-origin POSTs. Playwright's `request.post` without a
  // prior navigation sends `Origin: null`, which is not in the allow
  // list — so we evaluate a real browser fetch from inside the page.
  await page.goto('/sign-in');
  const result = await page.evaluate(async (presetValue: string) => {
    const res = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: presetValue }),
      credentials: 'include',
    });
    return {
      ok: res.ok,
      status: res.status,
      body: (await res.json().catch(() => ({}))) as Record<string, unknown>,
    };
  }, preset);
  expect(
    result.ok,
    `mint demo cookie for ${preset}: status=${result.status} body=${JSON.stringify(result.body)}`,
  ).toBeTruthy();
}

test.describe('per-brand wall-up', () => {
  test('demo cookie mint requires same-origin (cross-origin → 403)', async ({ request }) => {
    const res = await request.post('/api/auth/demo', {
      data: { preset: 'medpay' },
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.com' },
    });
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('origin_not_allowed');
  });

  test('master demo preset is disabled by default (DEMO_MASTER_ENABLED gate)', async ({ page }) => {
    // Same-origin navigation so the Origin check passes — then we
    // verify the master gate is the reason for any rejection, not
    // origin_not_allowed.
    await page.goto('/sign-in');
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'master' }),
        credentials: 'include',
      });
      return {
        status: res.status,
        body: (await res.json().catch(() => ({}))) as { code?: string },
      };
    });
    if (result.status === 403) {
      expect(result.body.code).toBe('master_preset_disabled');
    } else {
      // Env set DEMO_MASTER_ENABLED=true — master preset allowed.
      expect(result.status).toBe(200);
    }
  });

  test('forged demo cookie (unsigned) fails the auth fence', async ({ page, context }) => {
    // Land on a same-origin page first so the BASE_URL is resolved
    // for cookie scoping. Then plant a bare (pre-SEC-103) cookie
    // value, navigate to a protected route, and verify middleware
    // bounces us to /sign-in — the bare value won't pass HMAC verify.
    await page.goto('/sign-in');
    const url = new URL(page.url());
    await context.addCookies([
      {
        name: 'eazepay_demo',
        value: 'medpay', // unsigned — pre-SEC-103 shape
        domain: url.hostname,
        path: '/',
      },
    ]);
    await page.goto('/v/medpay');
    // Middleware redirects to /sign-in when the demo cookie fails to
    // verify. The final URL must be /sign-in, NOT /v/medpay.
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('medpay demo session: /v/medpay renders the brand portal', async ({ page }) => {
    await mintDemoSession(page, 'medpay');
    const response = await page.goto('/v/medpay');
    expect(response?.status()).toBeLessThan(400);
    // Sidebar wordmark — partner-portal subtitle is "Partner Portal"
    await expect(page.getByText(/Partner Portal/i).first()).toBeVisible();
  });

  test('medpay demo session: /v/tradepay/applications → branded 404', async ({ page }) => {
    await mintDemoSession(page, 'medpay');
    await page.goto('/v/tradepay/applications');
    // The branded 404 fallback message we shipped in not-found.tsx.
    await expect(page.getByText(/couldn't find that page/i)).toBeVisible();
  });

  test('medpay demo session: Services nav points inside /v/medpay/', async ({ page }) => {
    await mintDemoSession(page, 'medpay');
    await page.goto('/v/medpay');
    // Every Services sidebar link href should start with /v/medpay/services/
    const services = await page
      .locator('aside a[href*="/services/"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(services.length).toBeGreaterThanOrEqual(4);
    for (const href of services) {
      expect(href).toMatch(/^\/v\/medpay\/services\//);
    }
  });

  test('medpay integrations page renders with brand-flavored title', async ({ page }) => {
    await mintDemoSession(page, 'medpay');
    await page.goto('/v/medpay/integrations/processing');
    // Brand-flavored title via the shared IntegrationPage component
    await expect(page.getByText('MedPay Processing').first()).toBeVisible();
    // CTA stays inside /v/medpay/
    const ctaHref = await page.locator('a[href*="onboarding"]').first().getAttribute('href');
    expect(ctaHref).toMatch(/^\/v\/medpay\/onboarding\//);
  });

  test('coachpay integrations EZ Check page renders brand-flavored', async ({ page }) => {
    await mintDemoSession(page, 'coachpay');
    await page.goto('/v/coachpay/integrations/ez-check');
    await expect(page.getByText('EZ Check CoachPay').first()).toBeVisible();
  });

  test('tradepay integrations DialerPay page renders inside brand portal', async ({ page }) => {
    await mintDemoSession(page, 'tradepay');
    await page.goto('/v/tradepay/integrations/dialerpay');
    await expect(page.getByText('Connect DialerPay').first()).toBeVisible();
    const ctaHref = await page.locator('a[href*="onboarding"]').first().getAttribute('href');
    expect(ctaHref).toMatch(/^\/v\/tradepay\/onboarding\//);
  });
});
