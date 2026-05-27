/**
 * Perf regression test for BillingService.previewGenerate / runGenerate.
 *
 * Before this commit, both methods called
 *   activity.grossFundedCentsForPeriod(merchantId, start, end)
 * once per merchant — a classic N+1. With 500 merchants that was 500
 * sequential round-trips against the activity source.
 *
 * After this commit, both methods call
 *   activity.grossFundedCentsForPeriodBulk(start, end)
 * exactly ONCE per invocation. The assertions below pin that contract
 * so the N+1 cannot silently reappear.
 *
 * These tests use a hand-rolled fake for the Prisma client and the
 * ActivitySource port — pure unit, no DB. Vitest only.
 */
import { describe, expect, it, vi } from 'vitest';
import { BillingService } from '../src/billing.service.js';
import type { ActivitySource } from '../src/ports/activity-source.port.js';

type Merchant = { id: string; legalName: string; brand: string | null };

function makeMerchants(n: number): Merchant[] {
  const verticals = ['MedPay', 'TradePay', 'CoachPay', 'Multi-brand', null];
  const out: Merchant[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `m_${i.toString().padStart(5, '0')}`,
      legalName: `Merchant ${i}`,
      brand: verticals[i % verticals.length] as string | null,
    });
  }
  return out;
}

/** Minimal Prisma stub — only the calls previewGenerate/runGenerate use. */
function makePrismaStub(merchants: Merchant[]) {
  return {
    merchant: {
      findMany: vi.fn(async () => merchants),
    },
    invoice: {
      findMany: vi.fn(async () => [] as Array<{ merchantId: string }>),
    },
    billingConfig: {
      findMany: vi.fn(
        async () => [] as Array<{ merchantId: string; cycle: string; autoSend?: boolean }>,
      ),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  };
}

/** ActivitySource that counts singular vs bulk calls. */
function makeActivitySpy(): ActivitySource & {
  singularCalls: number;
  bulkCalls: number;
} {
  const spy = {
    singularCalls: 0,
    bulkCalls: 0,
    async grossFundedCentsForPeriod(merchantId: string) {
      this.singularCalls++;
      let h = 0;
      for (const c of merchantId) h = (h * 31 + c.charCodeAt(0)) | 0;
      return BigInt(10_000_00 + (Math.abs(h) % 990_000_00));
    },
    async grossFundedCentsForPeriodBulk() {
      this.bulkCalls++;
      // Return empty Map — preview tolerates absent ids (treats as 0).
      // The test only cares about *call shape*, not totals.
      return new Map<string, bigint>();
    },
  };
  return spy as ActivitySource & { singularCalls: number; bulkCalls: number };
}

describe('BillingService perf — N+1 elimination', () => {
  it('previewGenerate makes exactly ONE bulk activity call for 500 merchants (was 500)', async () => {
    const merchants = makeMerchants(500);
    const prisma = makePrismaStub(merchants);
    const activity = makeActivitySpy();

    const svc = new BillingService(
      prisma as never,
      { sealOpaque: vi.fn(), openOpaque: vi.fn() } as never,
      activity,
      24,
      undefined,
    );

    const t0 = performance.now();
    const res = await svc.previewGenerate('2026-05');
    const elapsedMs = performance.now() - t0;

    // The shape contract — what protects us from regression:
    expect(activity.bulkCalls).toBe(1);
    expect(activity.singularCalls).toBe(0);

    // And the perf envelope — generous to keep this reliable on CI.
    // Sequential 500-call shape would be at minimum 500 microtask hops
    // and in practice >>50ms; bulk shape is sub-millisecond in-memory.
    expect(elapsedMs).toBeLessThan(250);

    // Output sanity
    expect(res.periodId).toBe('2026-05');
    expect(res.perMerchant).toHaveLength(500);
  });

  it('runGenerate also collapses to ONE bulk activity call regardless of merchant count', async () => {
    const merchants = makeMerchants(500);
    const prisma = makePrismaStub(merchants);
    const activity = makeActivitySpy();

    const svc = new BillingService(
      prisma as never,
      { sealOpaque: vi.fn(), openOpaque: vi.fn() } as never,
      activity,
      24,
      undefined,
    );

    await svc.runGenerate('2026-05', { id: 'u_test', label: 'tester' });

    expect(activity.bulkCalls).toBe(1);
    expect(activity.singularCalls).toBe(0);
  });
});
