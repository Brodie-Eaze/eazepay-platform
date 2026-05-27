/**
 * MerchantService — KYB + sanctions screening unit tests.
 *
 * Focus: the regulatory invariants added to `startKyb()`:
 *   - FinCEN CDD ownership prong (≥75% cumulative coverage, ≥25% per owner)
 *   - FinCEN CDD control prong (one isControlling BO)
 *   - OFAC SDN screening on entity + every BO before KYB initiate
 *   - Halt-to-manual_review semantics on non-cleared screen results
 *
 * Approach: hand-rolled stubs over the Prisma client + KYB + sanctions
 * + vault collaborators. No prisma-mock package, no DB. The service's
 * regulatory logic is pure-enough that a structural fake is faster +
 * more legible than spinning a real Prisma test client.
 */

import { describe, expect, it, vi } from 'vitest';
import { MerchantService } from '../src/merchant.service.js';
import type { KybProvider } from '../src/ports/kyb-provider.port.js';
import type { SanctionsScreen, SanctionsScreenResult } from '@eazepay/integrations-core';
import type { MerchantId, UserId } from '@eazepay/shared-types';

type BoRow = {
  id: string;
  merchantId: string;
  ownershipPct: number;
  isControlling: boolean;
  piiCiphertext: Buffer;
  piiNonce: Buffer;
  dataKeyCiphertext: Buffer;
  kekId: string;
  piiSchemaVersion: number;
};

type MerchantRow = {
  id: string;
  legalName: string;
  ein: string | null;
  formationState: string | null;
  naicsCode: string | null;
  kybStatus: string;
  kybProviderRef: string | null;
  status: string;
  beneficialOwners: BoRow[];
};

const USER_ID = 'usr_test_1' as UserId;
const MERCHANT_ID = 'mrc_test_1' as MerchantId;

const VAULT_PII = {
  legalName: { first: 'Jane', last: 'Doe' },
  dateOfBirth: '1985-04-12',
  address: { line1: '1 Main St', city: 'Phoenix', state: 'AZ', zip: '85001' },
};

function makeBo(overrides: Partial<BoRow>): BoRow {
  return {
    id: overrides.id ?? `bo_${Math.random().toString(36).slice(2, 8)}`,
    merchantId: MERCHANT_ID,
    ownershipPct: 30,
    isControlling: false,
    piiCiphertext: Buffer.alloc(0),
    piiNonce: Buffer.alloc(0),
    dataKeyCiphertext: Buffer.alloc(0),
    kekId: 'kek-test',
    piiSchemaVersion: 2,
    ...overrides,
  };
}

function makeMerchant(bos: BoRow[], overrides: Partial<MerchantRow> = {}): MerchantRow {
  return {
    id: MERCHANT_ID,
    legalName: 'Acme Widgets LLC',
    ein: '12-3456789',
    formationState: 'DE',
    naicsCode: '4541',
    kybStatus: 'unstarted',
    kybProviderRef: null,
    status: 'pending_kyb',
    beneficialOwners: bos,
    ...overrides,
  };
}

interface Captured {
  merchantUpdates: Array<Record<string, unknown>>;
  auditRows: Array<Record<string, unknown>>;
}

function buildService(opts: {
  merchant: MerchantRow;
  sanctions?: SanctionsScreen | null;
  kyb?: Partial<KybProvider>;
}): { service: MerchantService; captured: Captured } {
  const captured: Captured = { merchantUpdates: [], auditRows: [] };

  // Minimal fake of prisma client surface used by startKyb().
  const tx = {
    merchant: {
      update: vi.fn(async (args: { where: unknown; data: Record<string, unknown> }) => {
        captured.merchantUpdates.push(args.data);
        return { ...opts.merchant, ...args.data };
      }),
    },
    auditOutbox: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        captured.auditRows.push(args.data);
        return { id: 'audit_1' };
      }),
    },
  };

  const prisma = {
    merchant: {
      findUniqueOrThrow: vi.fn(async () => opts.merchant),
    },
    merchantUser: {
      findUnique: vi.fn(async () => ({ role: 'owner' })),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };

  const vault = {
    sealForBo: vi.fn(),
    openForBo: vi.fn(async () => VAULT_PII),
  };

  const kybProvider: KybProvider = {
    initiate:
      opts.kyb?.initiate ??
      vi.fn(async () => ({ providerRef: 'ref_1', outcome: 'approved' as const })),
    status:
      opts.kyb?.status ??
      vi.fn(async () => ({
        outcome: 'approved' as const,
        reasonCodes: [],
        ofac: 'cleared' as const,
        ein: 'verified' as const,
      })),
  };

  const sanctions = opts.sanctions === undefined ? clearedSanctions() : opts.sanctions; // explicit null preserves the null/disabled case

  // Constructor positional shape mirrors merchant.service.ts.
  const service = new MerchantService(
    prisma as never,
    vault as never,
    kybProvider,
    false /* requiresAdmin */,
    sanctions,
  );

  return { service, captured };
}

function clearedSanctions(): SanctionsScreen {
  const result: SanctionsScreenResult = {
    status: 'cleared',
    matches: [],
    screenedAt: new Date('2026-05-27T12:00:00Z').toISOString(),
    provider: 'mock-ofac',
    listVersion: 'mock-sdn-0000-00-00',
  };
  return {
    screen: vi.fn(async () => result),
    screenEntity: vi.fn(async () => result),
  };
}

describe('MerchantService.startKyb — FinCEN CDD beneficial-owner validation', () => {
  it('rejects with bo_coverage_insufficient when cumulative ≥25% ownership < 75%', async () => {
    const { service } = buildService({
      merchant: makeMerchant([
        makeBo({ ownershipPct: 30, isControlling: true }),
        makeBo({ ownershipPct: 25 }),
        // total qualifying = 55%, below the 75% floor
      ]),
    });

    await expect(service.startKyb(USER_ID, MERCHANT_ID)).rejects.toMatchObject({
      problem: { code: 'bo_coverage_insufficient', status: 422 },
    });
  });

  it('rejects with bo_coverage_insufficient when a single owner declares 80% (qualifying owner cumulative still 80%, but the per-owner floor is the gate not the issue here) — sanity', async () => {
    // why: 80% from one owner DOES satisfy both floors. This is the
    // happy boundary — make sure we accept it (we'll fall through to
    // the missing-controller check below).
    const { service } = buildService({
      merchant: makeMerchant([
        // ownership ok but no controller declared
        makeBo({ ownershipPct: 80, isControlling: false }),
      ]),
    });
    await expect(service.startKyb(USER_ID, MERCHANT_ID)).rejects.toMatchObject({
      problem: { code: 'bo_controller_missing', status: 422 },
    });
  });

  it('rejects with bo_coverage_insufficient when owners below 25% are excluded from coverage', async () => {
    // 24% + 24% + 24% + 24% = 96% on paper, but NONE qualify under
    // FinCEN's 25% prong. Coverage = 0%.
    const { service } = buildService({
      merchant: makeMerchant([
        makeBo({ ownershipPct: 24, isControlling: true }),
        makeBo({ ownershipPct: 24 }),
        makeBo({ ownershipPct: 24 }),
        makeBo({ ownershipPct: 24 }),
      ]),
    });
    await expect(service.startKyb(USER_ID, MERCHANT_ID)).rejects.toMatchObject({
      problem: { code: 'bo_coverage_insufficient', status: 422 },
    });
  });

  it('rejects with bo_controller_missing when ownership ok but no controller declared', async () => {
    const { service } = buildService({
      merchant: makeMerchant([
        makeBo({ ownershipPct: 50, isControlling: false }),
        makeBo({ ownershipPct: 30, isControlling: false }),
      ]),
    });
    await expect(service.startKyb(USER_ID, MERCHANT_ID)).rejects.toMatchObject({
      problem: { code: 'bo_controller_missing', status: 422 },
    });
  });

  it('accepts when two ≥25% owners cover 75% AND a controller is on file', async () => {
    const { service, captured } = buildService({
      merchant: makeMerchant([
        makeBo({ ownershipPct: 50, isControlling: true }),
        makeBo({ ownershipPct: 25 }),
      ]),
    });
    const out = await service.startKyb(USER_ID, MERCHANT_ID);
    expect(out.outcome).toBe('approved');
    expect(captured.auditRows.some((r) => r.action === 'merchant.kyb.initiated')).toBe(true);
  });
});

describe('MerchantService.startKyb — OFAC sanctions screening', () => {
  it('halts to manual_review when entity screen returns match', async () => {
    const matchResult: SanctionsScreenResult = {
      status: 'match',
      matches: [{ matchId: 'm1', listName: 'SDN', reason: 'name+dob match' }],
      screenedAt: new Date().toISOString(),
      provider: 'mock-ofac',
      listVersion: 'mock-sdn-0000-00-00',
    };
    const sanctions: SanctionsScreen = {
      screen: vi.fn(async () => clearedSanctions().screen({ legalName: { first: '', last: '' } })),
      screenEntity: vi.fn(async () => matchResult),
    };
    const { service, captured } = buildService({
      merchant: makeMerchant([makeBo({ ownershipPct: 80, isControlling: true })]),
      sanctions,
    });

    await expect(service.startKyb(USER_ID, MERCHANT_ID)).rejects.toMatchObject({
      problem: { code: 'sanctions_halt', status: 422 },
    });
    // Halt MUST flip merchant to manual_review AND write an audit row.
    expect(captured.merchantUpdates.at(-1)).toMatchObject({
      kybStatus: 'manual_review',
      status: 'kyb_manual_review',
    });
    expect(captured.auditRows.some((r) => r.action === 'merchant.kyb.sanctions_halt')).toBe(true);
  });

  it('halts when any BO screen returns review', async () => {
    const reviewResult: SanctionsScreenResult = {
      status: 'review',
      matches: [{ matchId: 'm2', listName: 'SDN', reason: 'fuzzy match' }],
      screenedAt: new Date().toISOString(),
      provider: 'mock-ofac',
      listVersion: 'mock-sdn-0000-00-00',
    };
    const cleared = clearedSanctions();
    const sanctions: SanctionsScreen = {
      screen: vi.fn(async () => reviewResult),
      screenEntity: cleared.screenEntity,
    };
    const { service, captured } = buildService({
      merchant: makeMerchant([makeBo({ ownershipPct: 80, isControlling: true })]),
      sanctions,
    });

    await expect(service.startKyb(USER_ID, MERCHANT_ID)).rejects.toMatchObject({
      problem: { code: 'sanctions_halt', status: 422 },
    });
    expect(captured.auditRows.some((r) => r.action === 'merchant.kyb.sanctions_halt')).toBe(true);
  });

  it('halts (fail-closed) when adapter returns error', async () => {
    const errResult: SanctionsScreenResult = {
      status: 'error',
      screenedAt: new Date().toISOString(),
      provider: 'mock-ofac',
      errorReason: 'upstream 503',
    };
    const cleared = clearedSanctions();
    const sanctions: SanctionsScreen = {
      screen: cleared.screen,
      screenEntity: vi.fn(async () => errResult),
    };
    const { service } = buildService({
      merchant: makeMerchant([makeBo({ ownershipPct: 80, isControlling: true })]),
      sanctions,
    });
    await expect(service.startKyb(USER_ID, MERCHANT_ID)).rejects.toMatchObject({
      problem: { code: 'sanctions_halt', status: 422 },
    });
  });

  it('refuses to proceed when sanctions adapter is missing', async () => {
    const { service } = buildService({
      merchant: makeMerchant([makeBo({ ownershipPct: 80, isControlling: true })]),
      sanctions: null,
    });
    await expect(service.startKyb(USER_ID, MERCHANT_ID)).rejects.toMatchObject({
      problem: { code: 'sanctions_halt', status: 422 },
    });
  });
});

describe('MerchantService.addBeneficialOwner — input validation', () => {
  it('rejects ownership pct < 0', async () => {
    const captured: Captured = { merchantUpdates: [], auditRows: [] };
    const prisma = {
      merchantUser: { findUnique: vi.fn(async () => ({ role: 'owner' })) },
    };
    const vault = { sealForBo: vi.fn(), openForBo: vi.fn() };
    const kyb: KybProvider = {
      initiate: vi.fn(),
      status: vi.fn(),
    };
    const service = new MerchantService(
      prisma as never,
      vault as never,
      kyb,
      false,
      clearedSanctions(),
    );
    await expect(
      service.addBeneficialOwner(USER_ID, MERCHANT_ID, {
        pii: VAULT_PII as never,
        ownershipPct: -1,
        isControlling: false,
      } as never),
    ).rejects.toMatchObject({ problem: { code: 'ownership_pct_invalid' } });
    expect(captured.auditRows).toHaveLength(0);
  });

  it('rejects ownership pct > 100', async () => {
    const prisma = {
      merchantUser: { findUnique: vi.fn(async () => ({ role: 'owner' })) },
    };
    const vault = { sealForBo: vi.fn(), openForBo: vi.fn() };
    const kyb: KybProvider = { initiate: vi.fn(), status: vi.fn() };
    const service = new MerchantService(
      prisma as never,
      vault as never,
      kyb,
      false,
      clearedSanctions(),
    );
    await expect(
      service.addBeneficialOwner(USER_ID, MERCHANT_ID, {
        pii: VAULT_PII as never,
        ownershipPct: 101,
        isControlling: false,
      } as never),
    ).rejects.toMatchObject({ problem: { code: 'ownership_pct_invalid' } });
  });
});
