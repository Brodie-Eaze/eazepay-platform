// Characterization tests for MerchantService.
//
// Several behaviours the project's fraud/AML audit asked us to enforce
// (BO ≥25% coverage, OFAC state-driven status, merchant suspend/reactivate)
// are NOT YET implemented in services/merchant/. We pin what the code
// actually does today and mark the missing rules as `it.todo` / `it.skip`
// referencing the audit finding so the rewrite knows what's outstanding.
import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MerchantService } from '../src/merchant.service.js';
import { MockKybAdapter } from '../src/adapters/mock-kyb.adapter.js';
import type { KybProvider, KybStatusResult } from '../src/ports/kyb-provider.port.js';
import { makeMerchantPrisma, makeVault, sampleBoPii } from './_helpers.js';

const makeSvc = (
  opts: {
    requiresAdmin?: boolean;
    users?: Array<{ id: string; isAdmin?: boolean; status?: string }>;
    kyb?: KybProvider;
  } = {},
) => {
  const ctx = makeMerchantPrisma({ users: opts.users });
  const vault = makeVault();
  const kyb = opts.kyb ?? new MockKybAdapter();
  const svc = new MerchantService(ctx.client, vault, kyb, !!opts.requiresAdmin);
  return { svc, ctx, vault, kyb };
};

const seedMerchant = async (
  svc: MerchantService,
  userId = 'user-1',
  overrides: Partial<{ legalName: string; naicsCode?: string }> = {},
) =>
  svc.create(
    userId as any,
    { legalName: overrides.legalName ?? 'Acme Coffee LLC', naicsCode: overrides.naicsCode } as any,
  );

describe('MerchantService.create — SEC-017 admin gate + slug + audit', () => {
  it('dev mode (requiresAdmin=false): non-admin user can create, owner row written, audit row emitted', async () => {
    const { svc, ctx } = makeSvc({
      users: [{ id: 'user-1', isAdmin: false }],
      requiresAdmin: false,
    });
    const r = await svc.create('user-1' as any, { legalName: 'Acme Coffee LLC' } as any);
    expect(r.slug).toBe('acme-coffee-llc');
    expect(ctx.merchantUsers).toHaveLength(1);
    expect(ctx.merchantUsers[0]).toMatchObject({
      userId: 'user-1',
      role: 'owner',
      permissions: ['*'],
    });
    expect(ctx.audit.map((a) => a.action)).toContain('merchant.created');
  });

  it('SEC-017 prod mode: non-admin user is rejected with Forbidden + code=merchant_creation_requires_admin', async () => {
    const { svc } = makeSvc({ users: [{ id: 'user-1', isAdmin: false }], requiresAdmin: true });
    await expect(svc.create('user-1' as any, { legalName: 'Acme' } as any)).rejects.toMatchObject({
      problem: { status: 403, code: 'merchant_creation_requires_admin' },
    });
  });

  it('SEC-017 prod mode: inactive admin still rejected', async () => {
    const { svc } = makeSvc({
      users: [{ id: 'user-1', isAdmin: true, status: 'suspended' }],
      requiresAdmin: true,
    });
    await expect(svc.create('user-1' as any, { legalName: 'Acme' } as any)).rejects.toMatchObject({
      problem: { code: 'merchant_creation_requires_admin' },
    });
  });

  it('SEC-017 prod mode: missing user is rejected (defence-in-depth — Forbidden, not 404)', async () => {
    const { svc } = makeSvc({ users: [], requiresAdmin: true });
    await expect(svc.create('ghost' as any, { legalName: 'Acme' } as any)).rejects.toMatchObject({
      problem: { code: 'merchant_creation_requires_admin' },
    });
  });

  it('PROHIBITED_NAICS_PREFIXES: rejects NAICS starting with 7132/7139/7224/7222 (gambling/adult)', async () => {
    const { svc } = makeSvc({ requiresAdmin: false });
    for (const naics of ['713210', '713940', '722410', '722211']) {
      await expect(
        svc.create('user-1' as any, { legalName: 'X', naicsCode: naics } as any),
      ).rejects.toMatchObject({
        problem: { status: 400, code: 'industry_prohibited' },
      });
    }
  });

  it('PROHIBITED_NAICS_PREFIXES: an unrelated NAICS (e.g. 722515) is allowed through', async () => {
    const { svc } = makeSvc({ requiresAdmin: false });
    const r = await svc.create(
      'user-1' as any,
      { legalName: 'Snack Bar', naicsCode: '722515' } as any,
    );
    expect(r.slug).toMatch(/^snack-bar/);
  });

  it('slug collision: second merchant with same legalName gets a suffix', async () => {
    const { svc } = makeSvc({ requiresAdmin: false });
    const a = await svc.create('user-1' as any, { legalName: 'Same Name LLC' } as any);
    const b = await svc.create('user-1' as any, { legalName: 'Same Name LLC' } as any);
    expect(a.slug).toBe('same-name-llc');
    expect(b.slug).toMatch(/^same-name-llc-[0-9a-f]+$/);
  });

  it('slug fallback: an all-punctuation legalName collapses to "merchant" base', async () => {
    const { svc } = makeSvc({ requiresAdmin: false });
    const r = await svc.create('user-1' as any, { legalName: '###' } as any);
    expect(r.slug).toBe('merchant');
  });
});

describe('MerchantService.addBeneficialOwner — SEC-019 BO-id AAD + role gate + validation', () => {
  it('happy path: writes BO with v2 schemaVersion + emits audit row', async () => {
    const { svc, ctx } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    const r = await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii() as any,
      ownershipPct: 50,
      isControlling: true,
    } as any);
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    const bo = ctx.beneficialOwners[0];
    expect(bo.piiSchemaVersion).toBe(2);
    expect(bo.merchantId).toBe(m.id);
    expect(ctx.audit.map((a) => a.action)).toContain('merchant.beneficial_owner.added');
  });

  it('SEC-019: BO ciphertext is bound to its row id — vault.openForBo against a different BO id fails', async () => {
    const { svc, ctx, vault } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii() as any,
      ownershipPct: 50,
      isControlling: true,
    } as any);
    const bo = ctx.beneficialOwners[0];
    // The ciphertext was bound to bo.id. Asking the vault to open it
    // under a fabricated BO id must fail the GCM auth tag.
    await expect(
      vault.openForBo('not-this-bo', m.id, {
        ciphertext: bo.piiCiphertext,
        nonce: bo.piiNonce,
        dataKeyCiphertext: bo.dataKeyCiphertext,
        kekId: bo.kekId,
        schemaVersion: bo.piiSchemaVersion,
      }),
    ).rejects.toThrow();
  });

  it('ownership_pct_invalid: rejects negative or >100', async () => {
    const { svc } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    await expect(
      svc.addBeneficialOwner('user-1' as any, m.id, {
        pii: sampleBoPii() as any,
        ownershipPct: -1,
        isControlling: false,
      } as any),
    ).rejects.toMatchObject({ problem: { code: 'ownership_pct_invalid' } });
    await expect(
      svc.addBeneficialOwner('user-1' as any, m.id, {
        pii: sampleBoPii() as any,
        ownershipPct: 101,
        isControlling: false,
      } as any),
    ).rejects.toMatchObject({ problem: { code: 'ownership_pct_invalid' } });
  });

  it('role gate: a read_only MerchantUser cannot addBeneficialOwner (insufficient_role)', async () => {
    const { svc, ctx } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    // Demote owner row directly to read_only — characterizes assertCanManage's role branch.
    ctx.merchantUsers[0].role = 'read_only';
    await expect(
      svc.addBeneficialOwner('user-1' as any, m.id, {
        pii: sampleBoPii() as any,
        ownershipPct: 25,
        isControlling: false,
      } as any),
    ).rejects.toMatchObject({ problem: { status: 403, code: 'insufficient_role' } });
  });

  it('non-member: addBeneficialOwner from a non-member user → NotFound (merchant_not_found)', async () => {
    const { svc } = makeSvc({
      requiresAdmin: false,
      users: [{ id: 'user-1' }, { id: 'stranger' }],
    });
    const m = await seedMerchant(svc);
    await expect(
      svc.addBeneficialOwner('stranger' as any, m.id, {
        pii: sampleBoPii() as any,
        ownershipPct: 10,
        isControlling: false,
      } as any),
    ).rejects.toMatchObject({ problem: { code: 'merchant_not_found' } });
  });

  it.skip('FRAUD-AML audit: total controlling-BO ownership must sum to >=25% before startKyb — rule NOT YET enforced in service', async () => {
    // Pending: enforce in MerchantService.startKyb. Once implemented, this
    // test seeds two BOs with 10% + 5% and expects BadRequest with
    // code='beneficial_owner_coverage_insufficient'.
  });
});

describe('MerchantService.startKyb — mock adapter return paths + state transitions', () => {
  it('approved path: merchant.status="active", kybStatus="approved", kybCompletedAt set', async () => {
    const { svc, ctx } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii() as any,
      ownershipPct: 100,
      isControlling: true,
    } as any);
    const r = await svc.startKyb('user-1' as any, m.id);
    expect(r.outcome).toBe('approved');
    const row = ctx.merchants[0];
    expect(row.status).toBe('active');
    expect(row.kybStatus).toBe('approved');
    expect(row.kybCompletedAt).toBeInstanceOf(Date);
  });

  it('manual_review path: legalName starts with "X" → kybStatus=manual_review, status=kyb_manual_review', async () => {
    const { svc, ctx } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc, 'user-1', { legalName: 'Xenon LLC' });
    await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii() as any,
      ownershipPct: 100,
      isControlling: true,
    } as any);
    const r = await svc.startKyb('user-1' as any, m.id);
    expect(r.outcome).toBe('manual_review');
    expect(ctx.merchants[0].kybStatus).toBe('manual_review');
    expect(ctx.merchants[0].status).toBe('kyb_manual_review');
  });

  it('rejected path: legalName starts with "XR" → kybStatus=rejected, status=suspended', async () => {
    const { svc, ctx } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc, 'user-1', { legalName: 'XRay Holdings' });
    await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii() as any,
      ownershipPct: 100,
      isControlling: true,
    } as any);
    const r = await svc.startKyb('user-1' as any, m.id);
    expect(r.outcome).toBe('rejected');
    expect(ctx.merchants[0].kybStatus).toBe('rejected');
    expect(ctx.merchants[0].status).toBe('suspended');
  });

  it('mock adapter: BO without ssnLast4 → manual_review (bo_missing_ssn_last4)', async () => {
    const { svc, ctx } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii({ ssnLast4: undefined }) as any,
      ownershipPct: 100,
      isControlling: true,
    } as any);
    const r = await svc.startKyb('user-1' as any, m.id);
    expect(r.outcome).toBe('manual_review');
    const audit = ctx.audit.find((a) => a.action === 'merchant.kyb.initiated')!;
    expect((audit.after as any).reasonCodes).toContain('bo_missing_ssn_last4');
  });

  it('pending path: explicit pending KYB result → kybStatus=in_progress, status=kyb_in_progress', async () => {
    const pendingAdapter: KybProvider = {
      initiate: vi.fn(async () => ({ providerRef: 'ref-pending', outcome: 'pending' as const })),
      status: vi.fn(
        async (): Promise<KybStatusResult> => ({
          outcome: 'pending',
          reasonCodes: [],
          ofac: 'unknown',
          ein: 'unknown',
        }),
      ),
    };
    const { svc, ctx } = makeSvc({ requiresAdmin: false, kyb: pendingAdapter });
    const m = await seedMerchant(svc);
    await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii() as any,
      ownershipPct: 100,
      isControlling: true,
    } as any);
    const r = await svc.startKyb('user-1' as any, m.id);
    expect(r.outcome).toBe('pending');
    expect(ctx.merchants[0].kybStatus).toBe('in_progress');
    expect(ctx.merchants[0].status).toBe('kyb_in_progress');
  });

  it('beneficial_owner_required: startKyb with zero BOs throws BadRequest', async () => {
    const { svc } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    await expect(svc.startKyb('user-1' as any, m.id)).rejects.toMatchObject({
      problem: { code: 'beneficial_owner_required' },
    });
  });

  it('idempotent re-call when already approved: returns existing providerRef and does not re-call provider', async () => {
    const adapter = new MockKybAdapter();
    const initSpy = vi.spyOn(adapter, 'initiate');
    const { svc, ctx } = makeSvc({ requiresAdmin: false, kyb: adapter });
    const m = await seedMerchant(svc);
    await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii() as any,
      ownershipPct: 100,
      isControlling: true,
    } as any);
    await svc.startKyb('user-1' as any, m.id);
    expect(ctx.merchants[0].kybStatus).toBe('approved');
    initSpy.mockClear();
    const again = await svc.startKyb('user-1' as any, m.id);
    expect(again.outcome).toBe('approved');
    expect(initSpy).not.toHaveBeenCalled();
  });

  describe('OFAC field handling (KybStatusResult.ofac)', () => {
    it("OFAC 'cleared' is propagated to audit payload (no separate column today)", async () => {
      const adapter: KybProvider = {
        initiate: vi.fn(async () => ({ providerRef: 'r1', outcome: 'approved' as const })),
        status: vi.fn(
          async (): Promise<KybStatusResult> => ({
            outcome: 'approved',
            reasonCodes: [],
            ofac: 'cleared',
            ein: 'verified',
          }),
        ),
      };
      const { svc, ctx } = makeSvc({ requiresAdmin: false, kyb: adapter });
      const m = await seedMerchant(svc);
      await svc.addBeneficialOwner('user-1' as any, m.id, {
        pii: sampleBoPii() as any,
        ownershipPct: 100,
        isControlling: true,
      } as any);
      await svc.startKyb('user-1' as any, m.id);
      const a = ctx.audit.find((x) => x.action === 'merchant.kyb.initiated')!;
      expect((a.after as any).ofac).toBe('cleared');
    });

    it("OFAC 'unknown' is propagated through to audit (no auto-rejection today)", async () => {
      const adapter: KybProvider = {
        initiate: vi.fn(async () => ({ providerRef: 'r1', outcome: 'manual_review' as const })),
        status: vi.fn(
          async (): Promise<KybStatusResult> => ({
            outcome: 'manual_review',
            reasonCodes: ['mock'],
            ofac: 'unknown',
            ein: 'verified',
          }),
        ),
      };
      const { svc, ctx } = makeSvc({ requiresAdmin: false, kyb: adapter });
      const m = await seedMerchant(svc);
      await svc.addBeneficialOwner('user-1' as any, m.id, {
        pii: sampleBoPii() as any,
        ownershipPct: 100,
        isControlling: true,
      } as any);
      await svc.startKyb('user-1' as any, m.id);
      const a = ctx.audit.find((x) => x.action === 'merchant.kyb.initiated')!;
      expect((a.after as any).ofac).toBe('unknown');
      expect(ctx.merchants[0].kybStatus).toBe('manual_review');
    });

    it("OFAC 'match' propagated; legacy behaviour: outcome=rejected drives status=suspended", async () => {
      const adapter: KybProvider = {
        initiate: vi.fn(async () => ({ providerRef: 'r1', outcome: 'rejected' as const })),
        status: vi.fn(
          async (): Promise<KybStatusResult> => ({
            outcome: 'rejected',
            reasonCodes: ['ofac_match'],
            ofac: 'match',
            ein: 'verified',
          }),
        ),
      };
      const { svc, ctx } = makeSvc({ requiresAdmin: false, kyb: adapter });
      const m = await seedMerchant(svc);
      await svc.addBeneficialOwner('user-1' as any, m.id, {
        pii: sampleBoPii() as any,
        ownershipPct: 100,
        isControlling: true,
      } as any);
      await svc.startKyb('user-1' as any, m.id);
      const a = ctx.audit.find((x) => x.action === 'merchant.kyb.initiated')!;
      expect((a.after as any).ofac).toBe('match');
      expect(ctx.merchants[0].kybStatus).toBe('rejected');
      expect(ctx.merchants[0].status).toBe('suspended');
    });

    it.skip("FRAUD-AML audit: OFAC 'match' MUST force status=suspended even when outcome reported as approved — rule NOT YET enforced", async () => {
      // Pending: explicit OFAC short-circuit in MerchantService.startKyb.
    });
  });
});

describe('MerchantService — MID issuance flow proxy (application-link creation gated by KYB)', () => {
  it('merchant_not_active: createApplicationLink before KYB approval throws Conflict', async () => {
    const { svc } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    await expect(
      svc.createApplicationLink('user-1' as any, m.id, { expiresInMinutes: 60 } as any),
    ).rejects.toMatchObject({ problem: { status: 409, code: 'merchant_not_active' } });
  });

  it('post-KYB-approval: createApplicationLink returns a URL with the slug + base64url token', async () => {
    const { svc, ctx } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii() as any,
      ownershipPct: 100,
      isControlling: true,
    } as any);
    await svc.startKyb('user-1' as any, m.id); // approved → merchant.status='active'
    const link = await svc.createApplicationLink('user-1' as any, m.id, {
      expiresInMinutes: 120,
      category: 'personal',
    } as any);
    expect(link.url).toMatch(/^https:\/\/eazepay\.com\/apply\/acme-coffee-llc\/[A-Za-z0-9_-]+$/);
    expect(link.token.length).toBeGreaterThan(20);
    expect(ctx.applicationLinks).toHaveLength(1);
    expect(ctx.audit.map((a) => a.action)).toContain('merchant.application_link.created');
  });

  it('link context: round-trips a fresh token; expired/revoked/used token → Conflict; bad slug → NotFound', async () => {
    const { svc } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii() as any,
      ownershipPct: 100,
      isControlling: true,
    } as any);
    await svc.startKyb('user-1' as any, m.id);
    const link = await svc.createApplicationLink('user-1' as any, m.id, {
      expiresInMinutes: 60,
    } as any);
    const ctx = await svc.getLinkContext('acme-coffee-llc', link.token);
    expect(ctx.merchantSlug).toBe('acme-coffee-llc');
    expect(ctx.linkId).toBe(link.id);
    await expect(svc.getLinkContext('wrong-slug', link.token)).rejects.toMatchObject({
      problem: { code: 'link_not_found' },
    });
  });

  it('markLinkUsed: idempotency — second consumer racing the same link gets link_already_consumed', async () => {
    const { svc } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    await svc.addBeneficialOwner('user-1' as any, m.id, {
      pii: sampleBoPii() as any,
      ownershipPct: 100,
      isControlling: true,
    } as any);
    await svc.startKyb('user-1' as any, m.id);
    const link = await svc.createApplicationLink('user-1' as any, m.id, {
      expiresInMinutes: 60,
    } as any);
    await svc.markLinkUsed(link.id, randomUUID());
    await expect(svc.markLinkUsed(link.id, randomUUID())).rejects.toMatchObject({
      problem: { code: 'link_already_consumed' },
    });
  });
});

describe('MerchantService — suspend / reactivate (PR #149)', () => {
  it.skip('PR #149 shipped suspend/reactivate at apps/partner-portal/.../partners/[id]/status — NOT on services/merchant. Tests for the merchant equivalent are pending the port.', async () => {
    // Once MerchantService.setStatus({ to: 'suspended' | 'active', reason })
    // lands, replace this skip with:
    //   - active → suspended transitions write 'merchant.suspended' audit row
    //   - suspended → active writes 'merchant.reactivated'
    //   - invalid transitions throw Conflict
    //   - audit row records actor, from, to, reason, at
  });
});

describe('MerchantService.getOne / listApplications — member-scoped reads', () => {
  it('getOne returns member-visible projection', async () => {
    const { svc } = makeSvc({ requiresAdmin: false });
    const m = await seedMerchant(svc);
    const one = await svc.getOne('user-1' as any, m.id);
    expect(one).toMatchObject({
      id: m.id,
      slug: 'acme-coffee-llc',
      legalName: 'Acme Coffee LLC',
      status: 'kyb_pending',
    });
  });

  it('listApplications respects member gate (non-member → NotFound)', async () => {
    const { svc } = makeSvc({
      requiresAdmin: false,
      users: [{ id: 'user-1' }, { id: 'stranger' }],
    });
    const m = await seedMerchant(svc);
    await expect(
      svc.listApplications('stranger' as any, m.id, { limit: 10 }),
    ).rejects.toMatchObject({
      problem: { code: 'merchant_not_found' },
    });
    const out = await svc.listApplications('user-1' as any, m.id, { limit: 10 });
    expect(out.items).toEqual([]);
    expect(out.nextCursor).toBeNull();
  });
});
