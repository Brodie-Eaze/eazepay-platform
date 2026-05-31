import { REG_B_PRINCIPAL_TEXT, type RegBReasonCode } from './reason-codes.js';
import type { CanonicalPrequal } from './financials.js';
import { ENGINE_CONFIG_V1, type EngineConfig } from './config.js';
import {
  buildSnapshot,
  fingerprintCatalog,
  type CatalogProductFingerprint,
  type EngineConfigSnapshot,
} from './snapshot.js';
import {
  KNOCKOUT_META,
  evaluateLenderKnockouts,
  evaluateProgramEnvelope,
  type InternalReasonCode,
} from './knockouts.js';
import { scorePropensity } from './scorer.js';
import type { DecideResponse, ExcludedLender, IncludedLender } from './wire.js';
import type { CatalogSourcePort } from './catalog-source.port.js';

/**
 * Catalog-only prequal decision (P4, ADR-0031). A pure, synchronous
 * projection over the ENABLED catalog: program gate → per-lender knockouts
 * → propensity → consumer-best ranking → wire response + the snapshot it was
 * computed under. NO live LenderAdapter calls — real quotes and true
 * total-cost ranking (ADR-0013) live in the async orchestration service
 * (World B), not here.
 *
 * Determinism: identical (prequal, products, opts) always yields a
 * deeply-equal result, so a decision replays byte-identically (ADR-0028).
 * The only IO is the catalog fetch in runDecisionFromSource; runDecision
 * itself touches no clock, network, or randomness.
 */

export interface RunDecisionResult {
  response: DecideResponse;
  /** The snapshot the decision was computed under — binds config AND catalog. */
  snapshot: EngineConfigSnapshot;
}

export interface RunDecisionOpts {
  /**
   * Whether the borrower is MLA-covered (from the credit pull, ADR-0030).
   * Defaults false so the 36% cap never over-blocks a civilian at prequal.
   */
  mlaCovered?: boolean;
  /** Config to pin the decision under; defaults to ENGINE_CONFIG_V1. */
  config?: EngineConfig;
}

/** Total, deterministic catalog order — lender, then product. */
function byCatalogOrder(a: CatalogProductFingerprint, b: CatalogProductFingerprint): number {
  return a.lenderId !== b.lenderId
    ? a.lenderId.localeCompare(b.lenderId)
    : a.lenderProductId.localeCompare(b.lenderProductId);
}

/**
 * Best-case APR for the consumer's tier — the floor of the tier's APR band.
 * This is an ESTIMATE, never a quote; the true rate comes from a real quote
 * (World B, ADR-0031). The program gate separately checks the band MAX
 * against the MLA cap, so display-floor and safety-ceiling stay coherent.
 */
function estimatedAprBps(prequal: CanonicalPrequal, config: EngineConfig): number {
  return config.tiers[prequal.tier].aprBandBps.minBps;
}

/**
 * Estimated max approval, in cents. An included product has cleared
 * amount_above_max, so the requested amount is within [min, max] and this is
 * the requested amount; the min() (via BigInt, never float) is defensive.
 */
function estimatedMaxCents(prequal: CanonicalPrequal, product: CatalogProductFingerprint): number {
  const requested = BigInt(prequal.amountCents);
  const max = BigInt(product.maxAmountCents);
  return Number(requested < max ? requested : max);
}

/**
 * Map a knockout reason to a wire ExcludedLender, or null when it must be
 * SUPPRESSED. no_offer dispositions (brand_mismatch, MLA cap) are a fact
 * about the lender, never the consumer's creditworthiness — the lender is
 * omitted entirely and never reaches an adverse-action notice (ADR-0029).
 * The regBReasonCode===null guard also narrows the type to non-null below.
 */
function toExcluded(
  product: CatalogProductFingerprint,
  reasonCode: InternalReasonCode,
): ExcludedLender | null {
  const meta = KNOCKOUT_META[reasonCode];
  if (meta.disposition === 'no_offer' || meta.regBReasonCode === null) return null;
  const regBReasonCode: RegBReasonCode = meta.regBReasonCode;
  return {
    included: false,
    lenderId: product.lenderId,
    displayName: product.lenderId,
    reasonCode,
    regBReasonCode,
    principalReasonText: REG_B_PRINCIPAL_TEXT[regBReasonCode],
  };
}

interface RankCandidate {
  product: CatalogProductFingerprint;
  lender: IncludedLender;
}

/**
 * Consumer-cost proxy ranking (ADR-0013 spirit; true total-cost ranking
 * needs a real quote — World B). Lowest estimated APR → highest propensity →
 * catalog priority ordinal → product id. `priority` is an operational
 * waterfall ordinal (lower = preferred), explicitly NOT a revenue signal,
 * and only a tie-break beneath the consumer-cost keys. At v1, included
 * lenders are all tier-matched, so APR and propensity are identical across
 * them and priority/product-id are the effective order (ADR-0031).
 */
function compareConsumerBest(a: RankCandidate, b: RankCandidate): number {
  if (a.lender.estimatedAprBps !== b.lender.estimatedAprBps) {
    return a.lender.estimatedAprBps - b.lender.estimatedAprBps;
  }
  if (a.lender.propensityScore !== b.lender.propensityScore) {
    return b.lender.propensityScore - a.lender.propensityScore;
  }
  if (a.product.priority !== b.product.priority) {
    return a.product.priority - b.product.priority;
  }
  return a.product.lenderProductId.localeCompare(b.product.lenderProductId);
}

/**
 * Pure, synchronous catalog-only decision. Evaluates exactly the ENABLED
 * subset of `products` and fingerprints exactly that subset, so the snapshot
 * binds precisely what produced the decision (ADR-0028); a disabled product
 * has zero influence and appears in neither.
 *
 * An empty rankedLenders is a valid mechanical result (e.g. every lender
 * suppressed as brand_mismatch, or a no_offer program gate). What "no offer"
 * MEANS for the consumer — adverse action vs INCOMPLETE vs thin-file routing
 * — is the aggregation layer's job (P5), not this function's.
 */
export function runDecision(
  prequal: CanonicalPrequal,
  products: readonly CatalogProductFingerprint[],
  opts: RunDecisionOpts = {},
): RunDecisionResult {
  const config = opts.config ?? ENGINE_CONFIG_V1;

  const enabled = products.filter((p) => p.enabled);
  const snapshot = buildSnapshot({ catalogFingerprint: fingerprintCatalog(enabled), config });

  // Program-wide hard gate, once. On failure no lender is offered: an
  // adverse_action program reason is surfaced uniformly across every enabled
  // lender; a no_offer reason (MLA) suppresses all of them (empty list).
  const program = evaluateProgramEnvelope(prequal, config, { mlaCovered: opts.mlaCovered });
  if (!program.eligible) {
    const rankedLenders = enabled
      .map((product) => ({ product, lender: toExcluded(product, program.reasonCode) }))
      .filter(
        (x): x is { product: CatalogProductFingerprint; lender: ExcludedLender } =>
          x.lender !== null,
      )
      .sort((a, b) => byCatalogOrder(a.product, b.product))
      .map((x) => x.lender);
    return { response: { rankedLenders }, snapshot };
  }

  // Propensity is lender-independent (ADR-0031): compute once. Included
  // lenders are within their envelope (P2), so the scorer's amount-over
  // penalty is 0 and no per-product productMaxAmountCents is passed.
  const propensityScore = scorePropensity(prequal, config).propensityScore;
  const aprBps = estimatedAprBps(prequal, config);

  const candidates: RankCandidate[] = [];
  const excludedRaw: { product: CatalogProductFingerprint; lender: ExcludedLender }[] = [];

  for (const product of enabled) {
    const knockout = evaluateLenderKnockouts(prequal, product);
    if (knockout.eligible) {
      candidates.push({
        product,
        lender: {
          included: true,
          lenderId: product.lenderId,
          displayName: product.lenderId,
          propensityScore,
          rank: 0,
          estimatedAprBps: aprBps,
          estimatedMaxCents: estimatedMaxCents(prequal, product),
        },
      });
    } else {
      const lender = toExcluded(product, knockout.reasonCode);
      if (lender !== null) excludedRaw.push({ product, lender });
    }
  }

  const included: IncludedLender[] = candidates
    .sort(compareConsumerBest)
    .map((c, i) => ({ ...c.lender, rank: i + 1 }));
  const excluded: ExcludedLender[] = excludedRaw
    .sort((a, b) => byCatalogOrder(a.product, b.product))
    .map((x) => x.lender);

  return { response: { rankedLenders: [...included, ...excluded] }, snapshot };
}

/**
 * Async composer: fetch the enabled catalog from a source, then run the pure
 * decision. The AbortSignal guards only the catalog fetch (ADR-0031 — no
 * network fan-out to time out); an abort that lands during the fetch throws
 * before any pure work begins.
 */
export async function runDecisionFromSource(
  prequal: CanonicalPrequal,
  source: CatalogSourcePort,
  opts: RunDecisionOpts & { signal?: AbortSignal } = {},
): Promise<RunDecisionResult> {
  const { signal, ...runOpts } = opts;
  const products = await source.listEnabled({ signal });
  signal?.throwIfAborted();
  return runDecision(prequal, products, runOpts);
}
