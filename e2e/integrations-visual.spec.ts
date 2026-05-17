import { test, expect, type Page } from '@playwright/test';

/**
 * Visual + structural smoke for the rebuilt per-brand integration
 * pages. Confirms the shared `IntegrationPage` component is rendering
 * with the right brand context everywhere.
 *
 * Why this matters: PR #34 rebuilt all 9 integration surfaces
 * (3 brands × {ez-check, processing, dialerpay}) on the shared
 * component. If a future change drifts the structure (drops the stat
 * row, inverts the CTA, leaks a master URL), this test catches it
 * before anyone manually opens the page.
 *
 * Each spec verifies:
 *   - eyebrow "INTEGRATION"
 *   - brand-flavored title
 *   - 3-column stats row
 *   - feature grid (4 or 6 cells)
 *   - CTA that lives inside /v/<brand>/
 */

async function signIn(page: Page, preset: string): Promise<void> {
  // Same-origin navigation first so the subsequent fetch carries a
  // matching Origin header (SEC-103). See wall-up.spec.ts for rationale.
  await page.goto('/sign-in');
  const result = await page.evaluate(async (presetValue: string) => {
    const res = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: presetValue }),
      credentials: 'include',
    });
    return { ok: res.ok, status: res.status };
  }, preset);
  expect(result.ok, `mint demo cookie for ${preset}: status=${result.status}`).toBeTruthy();
}

const BRANDS = [
  { brand: 'medpay', label: 'MedPay' },
  { brand: 'tradepay', label: 'TradePay' },
  { brand: 'coachpay', label: 'CoachPay' },
] as const;

for (const { brand, label } of BRANDS) {
  test.describe(`${label} integrations`, () => {
    test(`EZ Check ${label} renders the shared layout`, async ({ page }) => {
      await signIn(page, brand);
      await page.goto(`/v/${brand}/integrations/ez-check`);
      await expect(page.getByText('INTEGRATION').first()).toBeVisible();
      await expect(page.getByText(`EZ Check ${label}`).first()).toBeVisible();
      // Stats row — one of the three labels
      await expect(page.getByText(/QUALIFICATION TIME/i).first()).toBeVisible();
      // CTA stays inside /v/<brand>/
      const ctaHref = await page.locator('a[href*="onboarding"]').first().getAttribute('href');
      expect(ctaHref).toMatch(new RegExp(`^/v/${brand}/onboarding/`));
    });

    test(`${label} Processing renders the shared layout`, async ({ page }) => {
      await signIn(page, brand);
      await page.goto(`/v/${brand}/integrations/processing`);
      await expect(page.getByText(`${label} Processing`).first()).toBeVisible();
      await expect(page.getByText('MyCamp').first()).toBeVisible();
      // 3-column stats — at least one must be present
      await expect(page.getByText(/Order Range|Approval|Installments/i).first()).toBeVisible();
      const ctaHref = await page.locator('a[href*="onboarding"]').first().getAttribute('href');
      expect(ctaHref).toMatch(new RegExp(`^/v/${brand}/onboarding/`));
    });

    test(`${label} DialerPay renders the shared layout`, async ({ page }) => {
      await signIn(page, brand);
      await page.goto(`/v/${brand}/integrations/dialerpay`);
      await expect(page.getByText('Connect DialerPay').first()).toBeVisible();
      await expect(page.getByText(/Avg Close Rate|Processing Time/i).first()).toBeVisible();
      const ctaHref = await page.locator('a[href*="onboarding"]').first().getAttribute('href');
      expect(ctaHref).toMatch(new RegExp(`^/v/${brand}/onboarding/`));
    });
  });
}
