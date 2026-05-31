import { describe, expect, it } from 'vitest';
import {
  BRANDS,
  CONSUMER_TIERS,
  PREQUAL_FIELD_CLASSIFICATION,
  REG_B_REASON_CODES,
  canonicalPrequalSchema,
  decideRequestSchema,
  isIncludedLender,
  isRegBReasonCode,
  type ExcludedLender,
  type IncludedLender,
} from '../src/decision/engine/index.js';

/** A payload identical in shape to what the partner-portal posts today. */
const validRequest = {
  applicationId: 'app_123',
  tier: 'B' as const,
  ficoBand: 720,
  dti: 0.32,
  openTradelines: 6,
  amountCents: 1_000_000,
  annualIncomeCents: 9_600_000,
  state: 'TX',
  brand: 'direct' as const,
};

describe('decideRequestSchema — /v1/decide request boundary', () => {
  it('accepts a well-formed portal payload', () => {
    const parsed = decideRequestSchema.parse(validRequest);
    expect(parsed.applicationId).toBe('app_123');
    expect(parsed.amountCents).toBe(1_000_000);
  });

  it('accepts a thin file (null fico / dti / tradelines)', () => {
    const r = decideRequestSchema.parse({
      ...validRequest,
      ficoBand: null,
      dti: null,
      openTradelines: null,
    });
    expect(r.ficoBand).toBeNull();
  });

  it('rejects an unknown field (strict boundary)', () => {
    expect(() => decideRequestSchema.parse({ ...validRequest, ssn: '000-00-0000' })).toThrow();
  });

  it('rejects a malformed state', () => {
    expect(() => decideRequestSchema.parse({ ...validRequest, state: 'Texas' })).toThrow();
  });

  it('rejects a tier outside A–D', () => {
    expect(() => decideRequestSchema.parse({ ...validRequest, tier: 'E' })).toThrow();
  });

  it('rejects dti outside 0..1', () => {
    expect(() => decideRequestSchema.parse({ ...validRequest, dti: 1.5 })).toThrow();
  });

  it('rejects a non-positive amount', () => {
    expect(() => decideRequestSchema.parse({ ...validRequest, amountCents: 0 })).toThrow();
  });

  it('requires applicationId on top of the prequal', () => {
    const prequalOnly = { ...validRequest } as Record<string, unknown>;
    delete prequalOnly.applicationId;
    expect(canonicalPrequalSchema.safeParse(prequalOnly).success).toBe(true);
    expect(decideRequestSchema.safeParse(prequalOnly).success).toBe(false);
  });
});

describe('RankedLender union', () => {
  it('discriminates included vs excluded on `included`', () => {
    const included: IncludedLender = {
      included: true,
      lenderId: 'l1',
      displayName: 'Lender One',
      propensityScore: 81,
      rank: 1,
      estimatedAprBps: 1499,
      estimatedMaxCents: 2_000_000,
    };
    const excluded: ExcludedLender = {
      included: false,
      lenderId: 'l2',
      displayName: 'Lender Two',
      reasonCode: 'tier_mismatch:D',
      regBReasonCode: 'CREDIT_PROFILE_NEGATIVE',
      principalReasonText: 'Credit profile does not meet program requirements',
    };
    expect(isIncludedLender(included)).toBe(true);
    expect(isIncludedLender(excluded)).toBe(false);
  });
});

describe('Reg B reason codes — closed set', () => {
  it('recognises every canonical code and rejects internal codes', () => {
    for (const code of REG_B_REASON_CODES) expect(isRegBReasonCode(code)).toBe(true);
    expect(isRegBReasonCode('tier_mismatch:C')).toBe(false);
    expect(isRegBReasonCode('GEOGRAPHY')).toBe(true);
  });
});

describe('PII classification', () => {
  it('classifies every prequal field', () => {
    const fields = [
      'tier',
      'ficoBand',
      'dti',
      'openTradelines',
      'amountCents',
      'annualIncomeCents',
      'state',
      'brand',
    ] as const;
    for (const f of fields) expect(PREQUAL_FIELD_CLASSIFICATION[f]).toBeTruthy();
  });
});

describe('canonical enums match the portal', () => {
  it('tiers are A–D and brands match', () => {
    expect([...CONSUMER_TIERS]).toEqual(['A', 'B', 'C', 'D']);
    expect([...BRANDS]).toEqual(['tradepay', 'medpay', 'coachpay', 'direct']);
  });
});
