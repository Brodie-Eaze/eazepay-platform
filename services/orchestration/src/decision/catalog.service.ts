import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { PRISMA } from '../internal/tokens.js';
import { CATALOG_SOURCE_PORT, type CatalogSourcePort } from './engine/catalog-source.port.js';
import type { CatalogProductFingerprint } from './engine/snapshot.js';
import type { Brand } from './engine/financials.js';

/**
 * DB-backed CatalogSourcePort (P7b).
 *
 * Queries `lender_products JOIN lenders` to build the catalog the engine's
 * eligibility pipeline consumes. World A (catalog-only prequal) calls this
 * once per `/v1/decide` request; result is NOT cached in the service — the
 * handler is responsible for caching if needed (the snapshot fingerprint
 * makes it safe to cache per request).
 *
 * Tier mapping: the DB uses LenderTier (internal|prime|near_prime|bnpl|
 * subprime); the engine uses ConsumerTier (A|B|C|D). Mapped code-side so the
 * engine's eligibility knockout stays a pure string comparison.
 *
 * Brand handling: LenderProduct.brand is a single ProductBrand value in the
 * DB, not an array. The engine's permittedBrands is `Brand[]` where `[]`
 * means "any brand permitted" and a non-empty array is an allowlist. We map:
 *   - brand = 'direct'   → permittedBrands = []     (no restriction)
 *   - brand = 'medpay'   → permittedBrands = ['medpay']
 *   - brand = 'tradepay' → permittedBrands = ['tradepay']
 *
 * Exported token re-export: callers importing the port symbol use
 * CATALOG_SOURCE_PORT from catalog-source.port.ts; re-exported here so the
 * module wiring file has a single import site.
 */
export { CATALOG_SOURCE_PORT };

/** DB→engine tier mapping. */
const LENDER_TIER_TO_CONSUMER_TIER: Record<string, string> = {
  internal: 'A',
  prime: 'A',
  near_prime: 'B',
  bnpl: 'C',
  subprime: 'D',
};

@Injectable()
export class LenderCatalogService implements CatalogSourcePort {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async listEnabled(opts?: {
    signal?: AbortSignal;
  }): Promise<readonly CatalogProductFingerprint[]> {
    // AbortSignal is not natively supported by Prisma raw queries; we check
    // the signal before the query and throw early if already aborted.
    if (opts?.signal?.aborted) {
      throw new Error('listEnabled aborted');
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        lender_product_id: string;
        lender_id: string;
        lender_tier: string;
        min_amount_cents: bigint;
        max_amount_cents: bigint;
        min_term_months: number;
        max_term_months: number;
        permitted_states: string[];
        brand: string;
        enabled: boolean;
        priority: number;
      }>
    >(Prisma.sql`
      SELECT
        lp.id            AS lender_product_id,
        l.id             AS lender_id,
        l.tier           AS lender_tier,
        lp.min_amount_cents,
        lp.max_amount_cents,
        lp.min_term_months,
        lp.max_term_months,
        lp.permitted_states,
        lp.brand,
        lp.enabled,
        l.priority
      FROM lender_products lp
      JOIN lenders         l  ON l.id  = lp.lender_id
      WHERE lp.enabled = true
        AND l.enabled  = true
      ORDER BY l.priority ASC, lp.id ASC
    `);

    return rows.map(
      (row): CatalogProductFingerprint => ({
        lenderProductId: row.lender_product_id,
        lenderId: row.lender_id,
        tier: LENDER_TIER_TO_CONSUMER_TIER[row.lender_tier] ?? 'D',
        // BigInt → string for the schema (avoids float precision loss)
        minAmountCents: row.min_amount_cents.toString(),
        maxAmountCents: row.max_amount_cents.toString(),
        minTermMonths: row.min_term_months,
        maxTermMonths: row.max_term_months,
        permittedStates: row.permitted_states,
        permittedBrands: brandToPermitted(row.brand),
        enabled: row.enabled,
        priority: row.priority,
      }),
    );
  }
}

/**
 * Map a single ProductBrand DB value to the engine's permittedBrands array.
 * `[]` signals "no restriction" (any brand). A non-empty array is an allowlist
 * that the knockout's brand check must match.
 */
function brandToPermitted(brand: string): Brand[] {
  if (brand === 'direct') return [];
  return [brand as Brand];
}
