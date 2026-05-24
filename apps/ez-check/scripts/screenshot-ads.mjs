// Screenshot the MedPay ad mockups at native 1080×1080.
// Run from the repo root: node apps/ez-check/scripts/screenshot-ads.mjs
//
// Requires the dev server to be running on localhost:3105.
// Resolve playwright from the pnpm-virtual store since this script isn't
// part of any workspace package's dependencies.
import { chromium } from '../../../node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'ads', 'medpay');

const VARIANTS = [
  { n: '1', name: 'cfo-math' },
  { n: '2', name: 'walked-out' },
  { n: '3', name: 'cherry-vs-medpay' },
  { n: '4', name: '10-seconds' },
  { n: '5', name: '38-to-70' },
];

const BASE = process.env.AD_BASE_URL || 'http://localhost:3105';

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 2, // export at 2160×2160 for crisper Meta uploads
  });
  for (const v of VARIANTS) {
    const page = await ctx.newPage();
    const url = `${BASE}/ads/medpay/${v.n}`;
    console.log(`→ ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    // Pause long enough for fonts + animations to settle
    await page.waitForTimeout(800);
    const out = resolve(OUT_DIR, `medpay-v${v.n}-${v.name}-1080.png`);
    await page.screenshot({
      path: out,
      type: 'png',
      clip: { x: 0, y: 0, width: 1080, height: 1080 },
    });
    console.log(`  wrote ${out}`);
    await page.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
