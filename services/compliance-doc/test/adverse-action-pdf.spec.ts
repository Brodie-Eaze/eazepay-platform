import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildAdverseActionNotice } from '../src/notices/adverse-action-builder.js';
import { renderAdverseActionPdf } from '../src/render/adverse-action-pdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(__dirname, 'golden');

/**
 * Characterisation tests for renderAdverseActionPdf.
 *
 * The renderer hands its output to pdfkit which compresses page-content
 * streams by default — that means visible body text is NOT directly
 * scannable in the byte stream. What we CAN pin without forking the
 * implementation:
 *   - PDF magic header
 *   - Info-dictionary fields (Title / Subject / Author) — these live
 *     in the uncompressed trailer dictionary so they survive as plain
 *     bytes and are exactly what a regulator / archive viewer reads
 *   - Length envelope vs a captured golden baseline, to catch silent
 *     content drift on regeneration
 *
 * Verbatim regulatory text presence is characterised at the builder
 * layer (adverse-action-builder.spec.ts + the static block constants
 * in render/adverse-action-pdf.ts whose values are exercised via the
 * length-baseline golden file).
 */

const FIXED_GENERATED_AT = '2026-05-27T00:00:00.000Z';

const baseInput = {
  recipient: {
    legalName: 'Jane Doe',
    email: 'jane@example.com',
    address: { line1: '1 Test Street', city: 'San Francisco', state: 'CA', zip: '94110' },
  },
  application: {
    id: 'app-deadbeef-1234',
    amountDisplay: '$10,000.00',
    termDisplay: '36 months',
    categoryDisplay: 'Personal',
    decisionDate: '2026-05-27',
  },
  lenderOfRecord: {
    legalName: 'Partner Bank, N.A.',
    addressLine1: '123 Banking Way',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    servicerLine: 'EazePay Inc. — servicer for Partner Bank, N.A.',
  },
  reasonCodes: ['credit_score_below_threshold', 'debt_to_income_too_high'],
  policyVersion: 'reg-b-2026-05-02',
};

async function render(over?: Partial<typeof baseInput>): Promise<Buffer> {
  const content = buildAdverseActionNotice({ ...baseInput, ...over });
  content.generatedAt = FIXED_GENERATED_AT;
  return renderAdverseActionPdf(content);
}

describe('Adverse Action Notice PDF — characterisation', () => {
  it('produces a non-empty PDF starting with the %PDF- header', async () => {
    const buf = await render();
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  });

  it('Info dict Title object = "Adverse Action Notice" (used by archive viewers + screen readers)', async () => {
    // pdfkit emits each Info field as its own indirect object whose
    // value is the parenthesized string. The object appears literally
    // in the PDF byte stream.
    const text = (await render()).toString('latin1');
    expect(text).toContain('(Adverse Action Notice)');
  });

  it('Info dict Subject object names the EazePay application id', async () => {
    const text = (await render()).toString('latin1');
    expect(text).toContain('(EazePay Application app-deadbeef-1234)');
  });

  it('Info dict Author object = lender-of-record legal name', async () => {
    const text = (await render()).toString('latin1');
    expect(text).toContain('(Partner Bank, N.A.)');
  });

  it('renders bigger PDF when a bureau §615(a) block is included', async () => {
    const noBureau = await render();
    const withBureauContent = buildAdverseActionNotice({
      ...baseInput,
      bureau: {
        name: 'Experian',
        addressLine1: '475 Anton Blvd',
        city: 'Costa Mesa',
        state: 'CA',
        zip: '92626',
        phone: '1-888-397-3742',
        score: 640,
        scoreRangeDisplay: '300-850',
        keyFactors: [
          'Length of credit history',
          'High utilisation on revolving accounts',
          'Number of recently opened accounts',
          'Time since most recent delinquency',
        ],
      },
    });
    withBureauContent.generatedAt = FIXED_GENERATED_AT;
    const withBureau = await renderAdverseActionPdf(withBureauContent);
    // FCRA disclosure block + bureau identity + score block + 4 key
    // factors add ≥1KB of content vs the no-bureau path.
    expect(withBureau.length).toBeGreaterThan(noBureau.length + 500);
  });

  it('golden file: PDF body length stays within ±15% of captured baseline (drift detector)', async () => {
    const buf = await render();
    const goldenFile = resolve(GOLDEN_DIR, 'aan-base.length.txt');
    if (!existsSync(GOLDEN_DIR)) mkdirSync(GOLDEN_DIR, { recursive: true });
    if (!existsSync(goldenFile) || process.env['UPDATE_GOLDEN'] === '1') {
      writeFileSync(goldenFile, String(buf.length));
    }
    const baseline = Number(readFileSync(goldenFile, 'utf8'));
    const delta = Math.abs(buf.length - baseline) / baseline;
    expect(delta).toBeLessThan(0.15);
  });

  it('rendered PDF is deterministic in length given identical input + fixed generatedAt', async () => {
    const a = await render();
    const b = await render();
    expect(a.length).toBe(b.length);
  });
});
