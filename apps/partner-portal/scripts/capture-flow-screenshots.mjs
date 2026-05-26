/**
 * capture-flow-screenshots.mjs — captures every screen across the
 * full EazePay platform for the /platform/flow engineering walkthrough.
 *
 * Maps to the operator + consumer journey end-to-end and EVERY admin
 * + workspace surface engineers need to understand. ~50 screens.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'flow-screenshots');
const BASE = process.env.BASE_URL ?? 'https://eazepay-platform-production.up.railway.app';

const FLOW = [
  /* ───── PHASE 1 · DISCOVER · per-brand entry ───── */
  { phase: '01', actor: 'operator', label: 'MedPay landing', url: '/landing/medpay' },
  { phase: '01', actor: 'operator', label: 'TradePay landing', url: '/landing/tradepay' },
  { phase: '01', actor: 'operator', label: 'CoachPay landing', url: '/landing/coachpay' },
  { phase: '01', actor: 'operator', label: 'MedPay sales deck', url: '/sales/medpay' },
  { phase: '01', actor: 'operator', label: 'TradePay sales deck', url: '/sales/tradepay' },
  { phase: '01', actor: 'operator', label: 'CoachPay sales deck', url: '/sales/coachpay' },

  /* ───── PHASE 2 · CHECKOUT · plan-aware ───── */
  { phase: '02', actor: 'operator', label: 'Checkout · $5k tier', url: '/medpay/checkout?plan=5k' },
  {
    phase: '02',
    actor: 'operator',
    label: 'Checkout · $10k tier',
    url: '/medpay/checkout?plan=10k',
  },
  {
    phase: '02',
    actor: 'operator',
    label: 'Checkout · $10k + guarantee',
    url: '/medpay/checkout?plan=10k-guarantee',
  },
  { phase: '02', actor: 'operator', label: 'Welcome / success', url: '/welcome/medpay' },

  /* ───── PHASE 3 · ONBOARDING · configure 4 modules ───── */
  { phase: '03', actor: 'operator', label: 'Onboarding hub', url: '/medpay/onboarding' },
  {
    phase: '03',
    actor: 'operator',
    label: 'Partner portal · signup config',
    url: '/medpay/signup',
  },
  {
    phase: '03',
    actor: 'operator',
    label: 'HighSale + Pixie · external',
    url: 'https://highsale.com/',
    kind: 'integration',
  },
  {
    phase: '03',
    actor: 'operator',
    label: 'Lender marketplace setup',
    url: '/medpay/onboarding/lender-marketplace',
  },
  {
    phase: '03',
    actor: 'operator',
    label: 'MyCamp processor · external',
    url: 'https://micamp.com/',
    kind: 'integration',
  },

  /* ───── PHASE 4 · PARTNER PORTAL ───── */
  { phase: '04', actor: 'operator', label: 'Portal · home dashboard', url: '/v/medpay' },
  {
    phase: '04',
    actor: 'operator',
    label: 'Portal · send link to client',
    url: '/v/medpay/send-link',
  },
  { phase: '04', actor: 'operator', label: 'Portal · submit application', url: '/v/medpay/submit' },
  { phase: '04', actor: 'operator', label: 'Portal · team management', url: '/v/medpay/team' },
  { phase: '04', actor: 'operator', label: 'Portal · API keys', url: '/v/medpay/api-keys' },
  { phase: '04', actor: 'operator', label: 'Portal · settings', url: '/v/medpay/settings' },

  /* ───── PHASE 5 · CLIENT INTAKE (Pixie smart form + HighSale API) ─── */
  {
    phase: '05',
    actor: 'consumer',
    label: 'Client intake · Pixie smart form',
    url: '/apply/medpay',
  },

  /* ───── PHASE 6 · DECISION ENGINE + LENDER MARKETPLACE ───── */
  { phase: '06', actor: 'eazepay', label: 'Lenders panel · admin view', url: '/lenders' },
  { phase: '06', actor: 'eazepay', label: 'Marketplaces panel · admin', url: '/marketplaces' },
  {
    phase: '06',
    actor: 'eazepay',
    label: 'Lender marketplace · public dev hub',
    url: '/lender-marketplace',
  },

  /* ───── PHASE 7 · OFFERS LAND · 3 places simultaneously ───── */
  {
    phase: '07',
    actor: 'consumer',
    label: 'Client sees ranked offers',
    url: '/apply/medpay#offers',
  },
  {
    phase: '07',
    actor: 'operator',
    label: 'Portal · applications list',
    url: '/v/medpay/applications',
  },
  {
    phase: '07',
    actor: 'eazepay',
    label: 'Command Centre · all applications',
    url: '/applications',
  },
  {
    phase: '07',
    actor: 'eazepay',
    label: 'Admin · marketplace dashboard',
    url: '/admin/marketplace',
  },

  /* ───── PHASE 8 · UNDERWRITING + OUTCOME (webhook back) ───── */
  {
    phase: '08',
    actor: 'operator',
    label: 'Application detail · live status',
    url: '/v/medpay/applications/demo',
  },
  { phase: '08', actor: 'eazepay', label: 'Webhooks · inbound from lenders', url: '/webhooks' },
  { phase: '08', actor: 'eazepay', label: 'Events log · audit trail', url: '/events' },
  { phase: '08', actor: 'eazepay', label: 'Dead-letter queue', url: '/dead-letter' },

  /* ───── PHASE 9 · MONEY + REPORTING ───── */
  { phase: '09', actor: 'operator', label: 'Portal · billing', url: '/v/medpay/billing' },
  {
    phase: '09',
    actor: 'operator',
    label: 'Portal · settlements (payouts)',
    url: '/v/medpay/settlements',
  },
  {
    phase: '09',
    actor: 'operator',
    label: 'Portal · insights / pipeline',
    url: '/v/medpay/insights',
  },
  { phase: '09', actor: 'eazepay', label: 'Admin · invoices', url: '/invoices' },
  { phase: '09', actor: 'eazepay', label: 'Admin · payouts', url: '/payouts' },
  { phase: '09', actor: 'eazepay', label: 'Admin · settlements', url: '/settlements' },
  { phase: '09', actor: 'eazepay', label: 'Admin · reports', url: '/reports' },

  /* ───── PHASE 10 · OPS / OBSERVABILITY ───── */
  { phase: '10', actor: 'eazepay', label: 'Command Centre · control panel', url: '/control-panel' },
  { phase: '10', actor: 'eazepay', label: 'Partners list', url: '/partners' },
  { phase: '10', actor: 'eazepay', label: 'Approvals queue', url: '/approvals' },
  { phase: '10', actor: 'eazepay', label: 'Activity feed', url: '/activity' },
  { phase: '10', actor: 'eazepay', label: 'Audit log', url: '/audit' },
  { phase: '10', actor: 'eazepay', label: 'Queues · async ops', url: '/queues' },
  { phase: '10', actor: 'eazepay', label: 'Insights · platform-wide', url: '/insights' },
  { phase: '10', actor: 'eazepay', label: 'Security', url: '/security' },
  { phase: '10', actor: 'eazepay', label: 'Sandbox · API playground', url: '/sandbox' },
];

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  process.stdout.write('  bootstrapping master demo cookie ... ');
  const bootstrap = await ctx.request.post(`${BASE}/api/auth/demo`, {
    headers: { origin: BASE, referer: `${BASE}/` },
    data: { preset: 'master' },
  });
  if (!bootstrap.ok()) {
    console.warn(
      `bootstrap returned ${bootstrap.status()}; auth-gated routes will redirect to /sign-in`,
    );
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
      await page.waitForTimeout(1800);
      finalUrl = page.url();
      if (finalUrl.includes('/sign-in')) status = 'redirected-to-signin';
      await page.screenshot({ path: outPath, fullPage: false });
      process.stdout.write(`${status}\n`);
    } catch (err) {
      status = `error: ${err.message.split('\n')[0]}`;
      process.stdout.write(`${status}\n`);
    }

    manifest.push({ ...entry, file: fname, status, finalUrl });
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
