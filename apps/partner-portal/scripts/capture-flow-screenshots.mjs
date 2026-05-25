/**
 * capture-flow-screenshots.mjs — captures every screen across the
 * end-to-end EazePay customer journey for the /platform/flow gallery.
 *
 * Maps 1:1 to the journey the operator + consumer take:
 *   1. Landing (per brand)
 *   2. Sales deck (per brand)
 *   3. Checkout (per brand)
 *   4. Welcome
 *   5. Onboarding hub
 *   6. Configure HighSale + Pixie (smart form / routing)
 *   7. Configure Lender Marketplace
 *   8. Configure MyCamp processor
 *   9. Partner Portal home
 *  10. Send Link (operator sends app to client)
 *  11. Client intake form
 *  12. Real-time offers landing page
 *  13. Applications list (operator view)
 *  14. Application detail (live status + outcomes)
 *  15. Command Centre (EazePay admin / marketplace)
 *
 * Auth-gated routes are still captured — they redirect to /sign-in and
 * the gallery labels them as "logged-in view (sign-in shown)" so the
 * journey is visible end-to-end even before the first real auth.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'flow-screenshots');
const BASE = process.env.BASE_URL ?? 'https://eazepay-platform-production.up.railway.app';

/**
 * The full operator + consumer journey, in the order the gallery
 * should display. Phase numbers match the user's spec. Tags:
 *  - actor: 'operator' | 'consumer' | 'eazepay'
 *  - kind: 'page' | 'integration' (integration = external SaaS we
 *    only link to, no screenshot)
 */
const FLOW = [
  /* ───── PHASE 1 · OPERATOR DISCOVERS BRAND ───── */
  { phase: '01 · Landing', actor: 'operator', label: 'MedPay · landing page', url: '/landing/medpay' },
  { phase: '01 · Landing', actor: 'operator', label: 'TradePay · landing page', url: '/landing/tradepay' },
  { phase: '01 · Landing', actor: 'operator', label: 'CoachPay · landing page', url: '/landing/coachpay' },
  { phase: '01 · Landing', actor: 'operator', label: 'MedPay · sales deck', url: '/sales/medpay' },

  /* ───── PHASE 2 · OPERATOR CHECKS OUT ───── */
  { phase: '02 · Checkout', actor: 'operator', label: 'Checkout · MedPay', url: '/medpay/checkout?plan=10k' },
  { phase: '02 · Checkout', actor: 'operator', label: 'Welcome', url: '/welcome/medpay' },

  /* ───── PHASE 3 · ONBOARDING (CONFIGURE THE 4 MODULES) ───── */
  { phase: '03 · Onboarding', actor: 'operator', label: 'Onboarding hub', url: '/medpay/onboarding' },
  { phase: '03 · Onboarding', actor: 'operator', label: 'HighSale + Pixie · smart form + routing', url: 'https://highsale.com/', kind: 'integration' },
  { phase: '03 · Onboarding', actor: 'operator', label: 'Lender marketplace · setup', url: '/medpay/onboarding/lender-marketplace' },
  { phase: '03 · Onboarding', actor: 'operator', label: 'MyCamp · payment processor', url: 'https://micamp.com/', kind: 'integration' },

  /* ───── PHASE 4 · OPERATOR IN PARTNER PORTAL ───── */
  { phase: '04 · Partner Portal', actor: 'operator', label: 'Portal home', url: '/v/medpay' },
  { phase: '04 · Partner Portal', actor: 'operator', label: 'Send link · application to client', url: '/v/medpay/send-link' },

  /* ───── PHASE 5 · CONSUMER APPLIES ───── */
  { phase: '05 · Consumer applies', actor: 'consumer', label: 'Branded apply / intake form', url: '/apply/medpay' },

  /* ───── PHASE 6 · OFFERS LAND (real-time) ───── */
  { phase: '06 · Offers · real-time', actor: 'consumer', label: 'Client sees ranked offers', url: '/apply/medpay#offers' },
  { phase: '06 · Offers · real-time', actor: 'operator', label: 'Applications list · operator view', url: '/v/medpay/applications' },
  { phase: '06 · Offers · real-time', actor: 'eazepay', label: 'Command Centre · applications', url: '/admin/marketplace' },

  /* ───── PHASE 7 · OUTCOME (approved / settled / declined) ───── */
  { phase: '07 · Outcome', actor: 'operator', label: 'Application detail · live status', url: '/v/medpay/applications/demo' },
  { phase: '07 · Outcome', actor: 'operator', label: 'Settlements · payouts to operator bank', url: '/v/medpay/settlements' },
  { phase: '07 · Outcome', actor: 'operator', label: 'Insights · pipeline + funded $', url: '/v/medpay/insights' },
  { phase: '07 · Outcome', actor: 'eazepay', label: 'Command Centre · control panel', url: '/control-panel' },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  /* ── master demo bootstrap ─────────────────────────────────────────
   * Hit /api/auth/demo with preset=master so the auth-gated workspace
   * + admin pages render their real UI instead of redirecting to
   * /sign-in. Requires DEMO_MASTER_ENABLED=true in the env, which is
   * already set on production. */
  process.stdout.write('  bootstrapping master demo cookie ... ');
  const bootstrap = await ctx.request.post(`${BASE}/api/auth/demo`, {
    headers: { origin: BASE, referer: `${BASE}/` },
    data: { preset: 'master' },
  });
  if (!bootstrap.ok()) {
    console.warn(`bootstrap returned ${bootstrap.status()}; auth-gated routes will redirect to /sign-in`);
  } else {
    process.stdout.write('ok\n');
  }

  const manifest = [];

  for (const entry of FLOW) {
    const isExternal = entry.kind === 'integration';
    const fullUrl = isExternal ? entry.url : `${BASE}${entry.url}`;
    const fname = `${String(manifest.length + 1).padStart(2, '0')}-${slug(entry.label)}.png`;
    const outPath = resolve(OUT_DIR, fname);

    process.stdout.write(`  capturing ${entry.url} ... `);
    let status = 'ok';
    let finalUrl = fullUrl;

    try {
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      // give animations a beat to settle
      await page.waitForTimeout(1800);
      finalUrl = page.url();
      if (finalUrl.includes('/sign-in')) status = 'redirected-to-signin';
      await page.screenshot({ path: outPath, fullPage: false });
      process.stdout.write(`${status}\n`);
    } catch (err) {
      status = `error: ${err.message.split('\n')[0]}`;
      process.stdout.write(`${status}\n`);
    }

    manifest.push({
      ...entry,
      file: fname,
      status,
      finalUrl,
    });
  }

  await writeFile(
    resolve(OUT_DIR, 'manifest.json'),
    JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), shots: manifest }, null, 2),
  );

  await browser.close();
  console.log(`\nDone. ${manifest.length} shots → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
