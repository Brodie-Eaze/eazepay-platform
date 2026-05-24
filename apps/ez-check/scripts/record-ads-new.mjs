// One-shot recorder for the freshly rewritten flow-explainer variants.
// Kept around while V11/V12/V13 are being iterated so the canonical
// 13-variant recorder doesn't re-render the working V1-V10.
//
//   node apps/ez-check/scripts/record-ads-new.mjs
//   AD_ONLY=11 node apps/ez-check/scripts/record-ads-new.mjs  # single variant
import { chromium } from '../../../node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs';
import { mkdir, rename, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'ads', 'medpay', 'video');
const RAW_DIR = resolve(__dirname, '.video-raw-new');

const ALL = [
  { n: '11', name: 'two-ways-to-run-your-clinic', ms: 28_000 },
  { n: '12', name: 'same-hours-different-day', ms: 28_000 },
  { n: '13', name: 'same-lead-different-hour', ms: 28_000 },
  { n: '14', name: 'closer-hates-this-call', ms: 28_000 },
  { n: '15', name: 'calendar-only-buyers', ms: 28_000 },
];
const ONLY = (process.env.AD_ONLY || '').split(',').filter(Boolean);
const VARIANTS = ONLY.length ? ALL.filter((v) => ONLY.includes(v.n)) : ALL;

const BASE = process.env.AD_BASE_URL || 'http://localhost:3105';

function transcode(webmPath, mp4Path) {
  return new Promise((res, rej) => {
    const proc = spawn(
      'ffmpeg',
      [
        '-y',
        '-i', webmPath,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '20',
        '-movflags', '+faststart',
        '-vf', 'scale=1080:1920:flags=lanczos',
        '-r', '30',
        mp4Path,
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
    proc.on('exit', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg ${code}`))));
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await rm(RAW_DIR, { recursive: true, force: true });
  await mkdir(RAW_DIR, { recursive: true });

  const browser = await chromium.launch();
  for (const v of VARIANTS) {
    console.log(`→ recording v${v.n} (${v.name}) @ ${v.ms}ms…`);
    const ctx = await browser.newContext({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
      recordVideo: { dir: RAW_DIR, size: { width: 1080, height: 1920 } },
    });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => console.error(`  [pageerror v${v.n}]`, err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error(`  [console v${v.n}]`, msg.text());
    });
    await page.goto(`${BASE}/ads/medpay/video/${v.n}`, { waitUntil: 'load' });
    await page.waitForTimeout(v.ms);
    const videoPath = await page.video().path();
    await page.close();
    await ctx.close();

    const webmOut = resolve(OUT_DIR, `medpay-video-v${v.n}-${v.name}.webm`);
    await rename(videoPath, webmOut);
    const mp4Out = resolve(OUT_DIR, `medpay-video-v${v.n}-${v.name}.mp4`);
    console.log(`  transcoding → ${mp4Out}`);
    await transcode(webmOut, mp4Out);
    console.log(`  done`);
  }
  await browser.close();

  const left = await readdir(RAW_DIR).catch(() => []);
  if (left.length === 0) await rm(RAW_DIR, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
