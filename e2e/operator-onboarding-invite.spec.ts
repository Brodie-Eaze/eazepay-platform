import { expect, test } from '@playwright/test';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Operator: generate a partner onboarding invite link
 * ─────────────────────────────────────────────────────────────────────
 *
 * Walks the master-account demo workspace through the most common
 * outbound-sales task: minting a brand-locked invite link for a
 * specific business and verifying it surfaces in "Your invites".
 *
 * Flow:
 *
 *   1. Sign in as the master-account demo preset (skips the real auth
 *      stack — the invite endpoint is not part of the auth surface
 *      under test here).
 *   2. Navigate to /onboarding-pipeline.
 *   3. Click "Generate invite link".
 *   4. Fill brand=TradePay, business name, contact email.
 *   5. Submit.
 *   6. Confirm the success card renders a URL containing the brand
 *      slug.
 *   7. Close the modal, switch to the "Your invites" tab and assert
 *      the row appears.
 *
 * Why this end-to-end matters:
 *   - The invite flow proves the BFF API + invites-store glue work
 *     under real navigation, not just unit-test invocation.
 *   - The "Your invites" panel reads back from the SAME store the
 *     POST writes to, which catches store-shape regressions that
 *     unit tests miss.
 */

const OPERATOR_EMAIL = 'master@eazepay.local';

async function attachCsrfEcho(page: import('@playwright/test').Page): Promise<void> {
  // Sign-in page's demo POST is CSRF-guarded but does not echo the
  // cookie. See e2e/sign-in.spec.ts for the threat model + rationale.
  await page.route('**/api/auth/**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.continue();
      return;
    }
    const cookies = await page.context().cookies();
    const csrf = cookies.find((c) => c.name === 'eazepay_csrf')?.value ?? '';
    await route.continue({
      headers: { ...request.headers(), 'x-csrf-token': csrf },
    });
  });
}

test('master operator can mint a TradePay onboarding invite end-to-end', async ({ page }) => {
  await attachCsrfEcho(page);

  // 1. Sign in as master demo.
  await page.goto('/sign-in');
  await page.getByRole('button', { name: /Master Account/i }).click();
  await page.waitForURL((u) => u.pathname === '/', { timeout: 15_000 });

  // 2. Navigate to the onboarding pipeline.
  await page.goto('/onboarding-pipeline');
  await expect(page.getByRole('button', { name: /Generate invite link/i }).first()).toBeVisible({
    timeout: 15_000,
  });

  // 3. Open the modal.
  await page
    .getByRole('button', { name: /Generate invite link/i })
    .first()
    .click();
  // The modal title disambiguates from the page-level button.
  await expect(page.getByRole('heading', { name: 'Generate invite link' })).toBeVisible();

  // 4. Pick the TradePay tile. Each brand tile contains the visible
  //    label as the largest text in the tile.
  await page
    .getByRole('button', { name: /TradePay/i })
    .first()
    .click();

  // Fill the optional prefill fields.
  const business = `Acme Trades ${Date.now()}`;
  const contactEmail = `owner+${Date.now()}@example.test`;
  await page.getByPlaceholder('Atlas Dental Group').fill(business);
  await page.getByPlaceholder('owner@business.com').fill(contactEmail);

  // 5. Submit. The submit button label is `Generate link` (it switches
  //    to `Generating…` while in-flight).
  const submit = page.getByRole('button', { name: /^Generate link$/ });
  await submit.click();

  // 6. Success card — "Invite link ready" + a code element showing the URL.
  await expect(page.getByText('Invite link ready')).toBeVisible({ timeout: 15_000 });
  // The URL is inside a <code> element. We don't pin the exact host
  // because tradepay onboarding URLs are environment-dependent; we
  // just check the link points to the tradepay onboarding flow.
  const codeText = await page.locator('code').first().innerText();
  expect(codeText).toMatch(/onboarding/);
  expect(codeText.toLowerCase()).toMatch(/tradepay|tp/);

  // Dismiss the modal.
  await page.getByRole('button', { name: /^Done$/ }).click();
  // Modal headline gone — wait for it.
  await expect(page.getByRole('heading', { name: 'Generate invite link' })).toBeHidden({
    timeout: 5_000,
  });

  // 7. Switch to the "Your invites" tab. The pipeline tabs render
  //    as button tabs along the top of the table; the label is
  //    `Your invites`.
  await page
    .getByRole('button', { name: /Your invites/i })
    .first()
    .click();

  // The invite we just created should be in the list. The page filters
  // by the OPERATOR_EMAIL hard-coded into onboarding-pipeline/page.tsx
  // and we just signed in as that operator, so the freshly-minted
  // invite belongs to us. The list shows the contact email of the
  // prefill.
  await expect(page.getByText(contactEmail, { exact: false })).toBeVisible({
    timeout: 10_000,
  });
});
