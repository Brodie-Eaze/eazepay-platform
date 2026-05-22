// Record the 3 vertical MedPay ad videos at native 1080×1920, 30fps,
// 16 seconds, then transcode WebM → MP4 (H.264 + AAC-stub) for Meta + Google.
//
// Requires the dev server running on :3105 and ffmpeg on PATH.
//
//   node apps/ez-check/scripts/record-ads.mjs
import { chromium } from '../../../node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs';
import { mkdir, rename, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'ads', 'medpay', 'video');
const RAW_DIR = resolve(__dirname, '.video-raw');

const VARIANTS = [
  { n: '1', name: 'walks-out' },
  { n: '2', name: 'think-about-it' },
  { n: '3', name: '10-seconds-funded' },
];

const BASE = process.env.AD_BASE_URL || 'http://localhost:3105';
const RECORD_MS = 16_000;

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
    console.log(`→ recording v${v.n} (${v.name})…`);
    const ctx = await browser.newContext({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
      recordVideo: { dir: RAW_DIR, size: { width: 1080, height: 1920 } },
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/ads/medpay/video/${v.n}`, { waitUntil: 'load' });
    await page.waitForTimeout(RECORD_MS);
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

  // Clean up the raw video dir
  const left = await readdir(RAW_DIR).catch(() => []);
  if (left.length === 0) await rm(RAW_DIR, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
