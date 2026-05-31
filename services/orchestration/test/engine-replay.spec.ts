import { describe, expect, it } from 'vitest';
import {
  aggregateDecision,
  buildDurableBasis,
  projectAggregated,
  replayDecision,
  runDecision,
  ENGINE_CONFIG_V1,
  type CanonicalPrequal,
  type CatalogProductFingerprint,
  type DecideRequest,
  type DurableBasis,
  type EngineConfig,
} from '../src/decision/engine/index.js';

/**
 * P7a — reproducible-replay harness (ADR-0028). DB-free: builds a DurableBasis
 * the same way persistDecision does, then proves replayDecision reconstructs
 * it byte-identically and surfaces every kind of drift (catalog, config,
 * tamper, and a dropped mlaCovered) as a mismatch.
 */

const prequal: CanonicalPrequal = {
  tier: 'B',
  ficoBand: 720,
  dti: 0.32,
  openTradelines: 6,
  amountCents: 1_000_000,
  annualIncomeCents: 9_600_000,
  state: 'TX',
  brand: 'direct',
};
const request: DecideRequest = { applicationId: 'app_replay', ...prequal };

const baseProduct: CatalogProductFingerprint = {
  lenderProductId: 'lp_base',
  lenderId: 'l_base',
  tier: 'B',
  minAmountCents: '50000',
  maxAmountCents: '2000000',
  minTermMonths: 3,
  maxTermMonths: 60,
  permittedStates: ['TX', 'CA'],
  permittedBrands: [],
  enabled: true,
  priority: 10,
};
const mk = (o: Partial<CatalogProductFingerprint>): CatalogProductFingerprint => ({
  ...baseProduct,
  ...o,
});

const included1 = mk({ lenderProductId: 'lp_b1', lenderId: 'l_b1', priority: 10 });
const included2 = mk({ lenderProductId: 'lp_b2', lenderId: 'l_b2', priority: 5 });
const stateMiss = mk({ lenderProductId: 'lp_st', lenderId: 'l_st', permittedStates: ['CA', 'NY'] });

const FIXED_NOW = '2026-06-01T00:00:00.000Z';

/** v1 caps every tier at ≤3599 bps, so the MLA path needs a tier over 3600. */
const mlaConfig: EngineConfig = {
  ...ENGINE_CONFIG_V1,
  tiers: {
    ...ENGINE_CONFIG_V1.tiers,
    B: { ...ENGINE_CONFIG_V1.tiers.B, aprBandBps: { minBps: 1499, maxBps: 3700 } },
  },
};

function toPrequal(req: DecideRequest): CanonicalPrequal {
  return {
    tier: req.tier,
    ficoBand: req.ficoBand,
    dti: req.dti,
    openTradelines: req.openTradelines,
    amountCents: req.amountCents,
    annualIncomeCents: req.annualIncomeCents,
    state: req.state,
    brand: req.brand,
  };
}

/** Mint a DurableBasis exactly as persistDecision would — the replay subject. */
function makeBasis(
  req: DecideRequest,
  products: readonly CatalogProductFingerprint[],
  opts: { mlaCovered?: boolean; config?: EngineConfig } = {},
): DurableBasis {
  const mlaCovered = opts.mlaCovered ?? false;
  const pq = toPrequal(req);
  const runResult = runDecision(pq, products, { mlaCovered, config: opts.config });
  const aggregated = aggregateDecision(pq, runResult);
  const projected = projectAggregated(aggregated);
  return buildDurableBasis({
    request: req,
    runResult,
    projected,
    mlaCovered,
    decidedAtIso: FIXED_NOW,
  }).basis;
}

describe('replayDecision — reproduction', () => {
  it('reproduces an OFFERS decision byte-identically', () => {
    const basis = makeBasis(request, [included1, included2]);
    const result = replayDecision({ basis, products: [included1, included2] });

    expect(result.matches).toBe(true);
    expect(result.mismatches).toEqual([]);
    expect(result.expectedFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(result.actualFingerprint).toBe(result.expectedFingerprint);
  });

  it('reproduces an ADVERSE_ACTION decision byte-identically', () => {
    const basis = makeBasis(request, [stateMiss]);
    expect(basis.disposition).toBe('ADVERSE_ACTION');
    expect(basis.reasonCodes).toEqual(['GEOGRAPHY']);

    const result = replayDecision({ basis, products: [stateMiss] });
    expect(result.matches).toBe(true);
    expect(result.mismatches).toEqual([]);
  });
});

describe('replayDecision — drift detection', () => {
  it('flags a catalog change as a mismatch without claiming a match', () => {
    const basis = makeBasis(request, [included1, included2]);
    // Replay against a smaller catalog — one offered lender has vanished.
    const result = replayDecision({ basis, products: [included1] });

    expect(result.matches).toBe(false);
    expect(result.expectedFingerprint).not.toBe(result.actualFingerprint);
    expect(result.mismatches.some((m) => m.startsWith('catalogFingerprint:'))).toBe(true);
    // The PII-derived offer list reports a divergence WITHOUT echoing values.
    expect(result.mismatches).toContain('offers: differs (values redacted — PII)');
  });

  it('flags a config change via configDigest', () => {
    const basis = makeBasis(request, [included1, included2]);
    // Decision was made under v1; replay under a different config blob.
    const result = replayDecision({ basis, products: [included1, included2], config: mlaConfig });

    expect(result.matches).toBe(false);
    expect(result.mismatches.some((m) => m.startsWith('configDigest:'))).toBe(true);
  });

  it('flags a tampered disposition and never leaks PII in the message', () => {
    const basis = makeBasis(request, [included1, included2]);
    const tampered: DurableBasis = { ...basis, disposition: 'NO_OFFER', offers: [] };

    const result = replayDecision({ basis: tampered, products: [included1, included2] });

    expect(result.matches).toBe(false);
    expect(result.mismatches.some((m) => m.startsWith('disposition:'))).toBe(true);
    // No banned PII field name appears anywhere in the diagnostic output.
    expect(result.mismatches.join(' ')).not.toMatch(/annualIncomeCents|ficoBand/);
  });
});

describe('replayDecision — mlaCovered is replay-load-bearing', () => {
  it('reproduces an MLA-cap NO_OFFER only because mlaCovered is stored', () => {
    const coveredBasis = makeBasis(request, [included1, included2], {
      mlaCovered: true,
      config: mlaConfig,
    });
    const civilianBasis = makeBasis(request, [included1, included2], {
      mlaCovered: false,
      config: mlaConfig,
    });

    // Same input + catalog + config — the ONLY difference is MLA coverage.
    expect(coveredBasis.disposition).toBe('NO_OFFER');
    expect(civilianBasis.disposition).toBe('OFFERS');

    expect(
      replayDecision({ basis: coveredBasis, products: [included1, included2], config: mlaConfig })
        .matches,
    ).toBe(true);
    expect(
      replayDecision({ basis: civilianBasis, products: [included1, included2], config: mlaConfig })
        .matches,
    ).toBe(true);
  });

  it('cannot reproduce a NO_OFFER basis that lost its mlaCovered flag', () => {
    const coveredBasis = makeBasis(request, [included1, included2], {
      mlaCovered: true,
      config: mlaConfig,
    });
    // Simulate the pre-fix world: the NO_OFFER is recorded but mlaCovered=false.
    const forged: DurableBasis = { ...coveredBasis, mlaCovered: false };

    const result = replayDecision({
      basis: forged,
      products: [included1, included2],
      config: mlaConfig,
    });

    // Replay re-runs as a civilian → OFFERS → cannot match the stored NO_OFFER.
    expect(result.matches).toBe(false);
    expect(result.mismatches.some((m) => m.startsWith('disposition:'))).toBe(true);
  });
});
