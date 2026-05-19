#!/usr/bin/env tsx
/**
 * Seed the `partners` table from the in-code MASTER_PARTNERS fixture
 * in `lib/master-data.ts`. Run once on initial deploy:
 *
 *     pnpm db:seed
 *
 * Idempotent — every partner upsert uses ON CONFLICT (id) DO UPDATE so
 * a re-run after the fixture is edited refreshes any drifted rows.
 *
 * Future state: the admin onboarding-approval flow writes directly to
 * `partners` and the fixture is retired. This script is the bootstrap
 * bridge between the demo seed and a live partner directory.
 */

import { Pool } from 'pg';
import { MASTER_PARTNERS } from '../lib/master-data';

const BRAND_PRODUCT_TO_BRAND: Record<string, 'medpay' | 'tradepay' | 'coachpay'> = {
  MedPay: 'medpay',
  TradePay: 'tradepay',
  CoachPay: 'coachpay',
  'Multi-brand': 'medpay', // legacy multi-brand partners default to medpay; admin can reassign
};

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    console.error('[seed] DATABASE_URL not set. Aborting.');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
    max: 2,
  });

  try {
    let upserts = 0;
    for (const p of MASTER_PARTNERS) {
      const brand = BRAND_PRODUCT_TO_BRAND[p.product];
      if (!brand) {
        console.warn(`[seed] skipping partner ${p.id}: unknown product "${p.product}"`);
        continue;
      }
      await pool.query(
        `INSERT INTO partners (id, brand, legal_name, product, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (id) DO UPDATE
           SET brand = EXCLUDED.brand,
               legal_name = EXCLUDED.legal_name,
               product = EXCLUDED.product,
               updated_at = now();`,
        [p.id, brand, p.legalName, p.product],
      );
      upserts++;
    }
    console.log(`[seed] upserted ${upserts} partners.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
