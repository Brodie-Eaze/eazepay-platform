import { describe, expect, it } from 'vitest';
import {
  ENGINE_CONFIG_V1,
  InMemoryCatalogSource,
  REG_B_PRINCIPAL_TEXT,
  buildSnapshot,
  fingerprintCatalog,
  isIncludedLender,
  runDecision,
  runDecisionFromSource,
  type CanonicalPrequal,
  type CatalogProductFingerprint,
  type EngineConfig,
  type ExcludedLender,
  type IncludedLender,
} from '../src/decision/engine/index.js';

/** Baseline applicant: tier B, TX, direct, $10,000. Propensity → 100. */
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

// One product per outcome, each failing exactly one rule (or none).
const included1 = mk({ lenderProductId: 'lp_b1', lenderId: 'l_b1', priority: 10 });
const included2 = mk({ lenderProductId: 'lp_b2', lenderId: 'l_b2', priority: 5 });
const brandMiss = mk({
  lenderProductId: 'lp_brand',
  lenderId: 'l_brand',
  permittedBrands: ['medpay'],
});
const stateMiss = mk({
  lenderProductId: 'lp_state',
  lenderId: 'l_state',
  permittedStates: ['CA', 'NY'],
});
const tierMiss = mk({ lenderProductId: 'lp_tier', lenderId: 'l_tier', tier: 'A' });
const tooLarge = mk({ lenderProductId: 'lp_small', lenderId: 'l_small', maxAmountCents: '500000' });
const tooSmall = mk({
  lenderProductId: 'lp_bigmin',
  lenderId: 'l_bigmin',
  minAmountCents: '2000000',
});
const disabled = mk({ lenderProductId: 'lp_off', lenderId: 'l_off', enabled: false });

const catalog: readonly CatalogProductFingerprint[] = [
  included1,
  included2,
  brandMiss,
  stateMiss,
  tierMiss,
  tooLarge,
  tooSmall,
  disabled,
];

const onlyIncluded = (rs: readonly (IncludedLender | ExcludedLender)[]): IncludedLender[] =>
  rs.filter(isIncludedLender);
const onlyExcluded = (rs: readonly (IncludedLender | ExcludedLender)[]): ExcludedLender[] =>
  rs.filter((r): r is ExcludedLender => !r.included);
const byId = (rs: readonly (IncludedLender | ExcludedLender)[]): string[] =>
  rs.map((r) => r.lenderId);

describe('runDecision — included assembly', () => {
  it('includes the two tier-matched products with score, APR, max, and rank', () => {
    const included = onlyIncluded(runDecision(prequal, catalog).response.rankedLenders);
    expect(included).toHaveLength(2);
    for (const l of included) {
      expect(l.propensityScore).toBe(100); // base 7500 + 4200 − 1600 + 600 = clamp 100
      expect(l.estimatedAprBps).toBe(1499); // B band floor
      expect(l.estimatedMaxCents).toBe(1_000_000); // requested, within max
    }
  });

  it('assigns contiguous 1-based ranks in consumer-best order', () => {
    const included = onlyIncluded(runDecision(prequal, catalog).response.rankedLenders);
    expect(included.map((l) => l.rank)).toEqual([1, 2]);
  });

  it('scores propensity lender-independently — every included lender shares it', () => {
    const included = onlyIncluded(runDecision(prequal, catalog).response.rankedLenders);
    const scores = new Set(included.map((l) => l.propensityScore));
    expect(scores.size).toBe(1);
  });

  it('echoes lenderId as displayName (legacy parity; the fingerprint stays display-free)', () => {
    const included = onlyIncluded(runDecision(prequal, catalog).response.rankedLenders);
    for (const l of included) expect(l.displayName).toBe(l.lenderId);
  });
});

describe('runDecision — consumer-best ordering', () => {
  it('breaks an APR/propensity tie by lower priority ordinal first', () => {
    // included1 priority 10, included2 priority 5 → included2 ranks first.
    const included = onlyIncluded(
      runDecision(prequal, [included1, included2]).response.rankedLenders,
    );
    expect(included.map((l) => l.lenderId)).toEqual(['l_b2', 'l_b1']);
  });

  it('breaks a full tie deterministically by product id', () => {
    const a = mk({ lenderProductId: 'lp_aaa', lenderId: 'l_z', priority: 7 });
    const b = mk({ lenderProductId: 'lp_bbb', lenderId: 'l_a', priority: 7 });
    // Same priority → product id decides; lp_aaa < lp_bbb regardless of input order.
    const fwd = onlyIncluded(runDecision(prequal, [a, b]).response.rankedLenders).map(
      (l) => l.lenderId,
    );
    const rev = onlyIncluded(runDecision(prequal, [b, a]).response.rankedLenders).map(
      (l) => l.lenderId,
    );
    expect(fwd).toEqual(['l_z', 'l_a']);
    expect(rev).toEqual(['l_z', 'l_a']);
  });

  it('places all included lenders before any excluded lender', () => {
    const ranked = runDecision(prequal, catalog).response.rankedLenders;
    const firstExcluded = ranked.findIndex((r) => !r.included);
    const lastIncluded = ranked.map((r) => r.included).lastIndexOf(true);
    expect(lastIncluded).toBeLessThan(firstExcluded);
  });
});

describe('runDecision — excluded mapping + suppression (ADR-0029)', () => {
  it('SUPPRESSES a brand mismatch entirely (no_offer — never surfaced)', () => {
    const ids = byId(runDecision(prequal, catalog).response.rankedLenders);
    expect(ids).not.toContain('l_brand');
  });

  it('surfaces a state knockout as an honest GEOGRAPHY adverse action', () => {
    const e = onlyExcluded(runDecision(prequal, catalog).response.rankedLenders).find(
      (x) => x.lenderId === 'l_state',
    );
    expect(e).toMatchObject({
      reasonCode: 'state_not_permitted',
      regBReasonCode: 'GEOGRAPHY',
      principalReasonText: REG_B_PRINCIPAL_TEXT.GEOGRAPHY,
    });
  });

  it('maps tier and amount knockouts to their Reg B codes + Model Form C-1 text', () => {
    const excluded = onlyExcluded(runDecision(prequal, catalog).response.rankedLenders);
    const find = (id: string) => excluded.find((x) => x.lenderId === id);
    expect(find('l_tier')).toMatchObject({
      reasonCode: 'tier_mismatch',
      regBReasonCode: 'CREDIT_PROFILE_NEGATIVE',
      principalReasonText: REG_B_PRINCIPAL_TEXT.CREDIT_PROFILE_NEGATIVE,
    });
    expect(find('l_small')).toMatchObject({
      reasonCode: 'amount_above_max',
      regBReasonCode: 'LOAN_AMOUNT_TOO_LARGE',
    });
    expect(find('l_bigmin')).toMatchObject({
      reasonCode: 'amount_below_min',
      regBReasonCode: 'LOAN_AMOUNT_TOO_SMALL',
    });
  });

  it('orders the excluded set deterministically by lender then product id', () => {
    const ids = onlyExcluded(runDecision(prequal, catalog).response.rankedLenders).map(
      (x) => x.lenderId,
    );
    expect(ids).toEqual([...ids].sort());
  });
});

describe('runDecision — disabled products', () => {
  it('skips a disabled product in both the output and the fingerprint', () => {
    const result = runDecision(prequal, catalog);
    expect(byId(result.response.rankedLenders)).not.toContain('l_off');
    const enabledOnly = catalog.filter((p) => p.enabled);
    const expected = buildSnapshot({
      catalogFingerprint: fingerprintCatalog(enabledOnly),
      config: ENGINE_CONFIG_V1,
    });
    expect(result.snapshot.snapshotId).toBe(expected.snapshotId);
  });
});

describe('runDecision — program-envelope gate', () => {
  it('surfaces an above-cap amount uniformly across every enabled lender (adverse action)', () => {
    const over = { ...prequal, amountCents: 10_000_001 }; // > $100,000 program cap
    const ranked = runDecision(over, catalog).response.rankedLenders;
    const enabledCount = catalog.filter((p) => p.enabled).length;
    expect(ranked).toHaveLength(enabledCount);
    for (const r of ranked) {
      expect(r.included).toBe(false);
      expect(r).toMatchObject({
        reasonCode: 'amount_above_program_cap',
        regBReasonCode: 'LOAN_AMOUNT_TOO_LARGE',
      });
    }
    expect(byId(ranked)).not.toContain('l_off');
  });

  it('SUPPRESSES every lender when an MLA-covered borrower breaches the 36% cap (no_offer)', () => {
    const overCap: EngineConfig = {
      ...ENGINE_CONFIG_V1,
      tiers: {
        ...ENGINE_CONFIG_V1.tiers,
        B: { ...ENGINE_CONFIG_V1.tiers.B, aprBandBps: { minBps: 3000, maxBps: 3700 } },
      },
    };
    const covered = runDecision(prequal, catalog, { mlaCovered: true, config: overCap });
    expect(covered.response.rankedLenders).toHaveLength(0);
    // Same config, civilian → cap never fires, normal evaluation resumes.
    const civilian = runDecision(prequal, catalog, { mlaCovered: false, config: overCap });
    expect(onlyIncluded(civilian.response.rankedLenders).length).toBeGreaterThan(0);
  });
});

describe('runDecision — snapshot binding + determinism (ADR-0028)', () => {
  it('binds effectiveCatalogSnapshotId to the snapshot id', () => {
    const { snapshot } = runDecision(prequal, catalog);
    expect(snapshot.versions.effectiveCatalogSnapshotId).toBe(snapshot.snapshotId);
  });

  it('is order-independent — shuffling the catalog changes neither id nor output', () => {
    const a = runDecision(prequal, catalog);
    const b = runDecision(prequal, [...catalog].reverse());
    expect(b.snapshot.snapshotId).toBe(a.snapshot.snapshotId);
    expect(b.response).toEqual(a.response);
  });

  it('changes the snapshot id when an eligibility-relevant catalog field changes', () => {
    const a = runDecision(prequal, catalog);
    const bumped = catalog.map((p) =>
      p.lenderProductId === 'lp_b1' ? { ...p, maxAmountCents: '3000000' } : p,
    );
    const b = runDecision(prequal, bumped);
    expect(b.snapshot.snapshotId).not.toBe(a.snapshot.snapshotId);
  });

  it('is deterministic — identical inputs yield a deeply-equal result', () => {
    expect(runDecision(prequal, catalog)).toEqual(runDecision(prequal, catalog));
  });
});

describe('runDecisionFromSource — async catalog seam', () => {
  it('equals the pure decision over the source-supplied enabled catalog', async () => {
    const source = new InMemoryCatalogSource(catalog);
    const fromSource = await runDecisionFromSource(prequal, source);
    expect(fromSource).toEqual(runDecision(prequal, catalog));
  });

  it('returns only enabled products from the source', async () => {
    const source = new InMemoryCatalogSource(catalog);
    const products = await source.listEnabled();
    expect(products.every((p) => p.enabled)).toBe(true);
    expect(products.map((p) => p.lenderId)).not.toContain('l_off');
  });

  it('throws if the abort signal fired during the catalog fetch', async () => {
    const source = new InMemoryCatalogSource(catalog);
    const ac = new AbortController();
    ac.abort();
    await expect(runDecisionFromSource(prequal, source, { signal: ac.signal })).rejects.toThrow();
  });
});
