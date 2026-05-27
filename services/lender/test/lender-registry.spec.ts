import { describe, expect, it } from 'vitest';
import { LenderRegistry } from '../src/lender-registry.service.js';
import { BuzzPayAdapter } from '../src/adapters/buzzpay.adapter.js';
import { MockPrimeAdapter } from '../src/adapters/mock-prime.adapter.js';

interface FakeProduct {
  id: string;
  enabled: boolean;
  category: string;
  permittedStates: string[];
  minAmountCents: bigint;
  maxAmountCents: bigint;
  minTermMonths: number;
  maxTermMonths: number;
  lenderId: string;
  lender: { enabled: boolean; adapterKey: string; lenderOfRecord: string; priority: number; tier: string };
}

const makeFakePrisma = (rows: FakeProduct[]) => ({
  lenderProduct: {
    async findMany({ where }: { where: { enabled?: boolean; category?: string; lender?: { enabled?: boolean } } }) {
      return rows.filter(
        (r) =>
          (where.enabled === undefined || r.enabled === where.enabled) &&
          (where.category === undefined || r.category === where.category) &&
          (where.lender?.enabled === undefined || r.lender.enabled === where.lender.enabled),
      );
    },
  },
});

const buzzRow: FakeProduct = {
  id: 'p1',
  enabled: true,
  category: 'personal',
  permittedStates: [],
  minAmountCents: 50_000n,
  maxAmountCents: 5_000_000n,
  minTermMonths: 6,
  maxTermMonths: 60,
  lenderId: 'l1',
  lender: {
    enabled: true,
    adapterKey: 'buzzpay',
    lenderOfRecord: 'BuzzPay LoR',
    priority: 50,
    tier: 'internal',
  },
};

const primeRow: FakeProduct = {
  id: 'p2',
  enabled: true,
  category: 'personal',
  permittedStates: ['CA', 'NY'],
  minAmountCents: 100_000n,
  maxAmountCents: 2_500_000n,
  minTermMonths: 12,
  maxTermMonths: 48,
  lenderId: 'l2',
  lender: {
    enabled: true,
    adapterKey: 'mock_prime',
    lenderOfRecord: 'Mock Prime',
    priority: 10,
    tier: 'prime',
  },
};

describe('LenderRegistry.listEnabled — filter semantics', () => {
  const adapters = [new BuzzPayAdapter(), new MockPrimeAdapter()];

  it('returns rows whose adapterKey is wired AND state matches (no permitted = open)', async () => {
    const prisma = makeFakePrisma([buzzRow, primeRow]) as never;
    const reg = new LenderRegistry(prisma, adapters);
    const list = await reg.listEnabled('personal', 'CA');
    expect(list).toHaveLength(2);
    const keys = list.map((r) => r.adapter.adapterKey).sort();
    expect(keys).toEqual(['buzzpay', 'mock_prime']);
  });

  it('filters out rows whose state is not in permittedStates', async () => {
    const prisma = makeFakePrisma([buzzRow, primeRow]) as never;
    const reg = new LenderRegistry(prisma, adapters);
    const list = await reg.listEnabled('personal', 'TX');
    expect(list.map((r) => r.adapter.adapterKey)).toEqual(['buzzpay']);
  });

  it('filters out rows whose adapter is not registered in the module', async () => {
    const rogue: FakeProduct = {
      ...buzzRow,
      id: 'p3',
      lender: { ...buzzRow.lender, adapterKey: 'lender_not_wired' },
    };
    const prisma = makeFakePrisma([rogue, primeRow]) as never;
    const reg = new LenderRegistry(prisma, adapters);
    const list = await reg.listEnabled('personal', 'CA');
    expect(list.map((r) => r.adapter.adapterKey)).toEqual(['mock_prime']);
  });

  it('passes lender.enabled and product.enabled to the prisma where-clause', async () => {
    let captured: unknown = null;
    const prisma = {
      lenderProduct: {
        async findMany(args: unknown) {
          captured = args;
          return [];
        },
      },
    } as never;
    const reg = new LenderRegistry(prisma, adapters);
    await reg.listEnabled('personal', 'CA');
    expect(captured).toMatchObject({
      where: { enabled: true, category: 'personal', lender: { enabled: true } },
      include: { lender: true },
    });
  });

  it('returns the canonical shape used by orchestration (lenderId, lenderProductId, priority, tier)', async () => {
    const prisma = makeFakePrisma([primeRow]) as never;
    const reg = new LenderRegistry(prisma, adapters);
    const [row] = await reg.listEnabled('personal', 'CA');
    expect(row).toMatchObject({
      lenderId: 'l2',
      lenderProductId: 'p2',
      lenderOfRecord: 'Mock Prime',
      priority: 10,
      tier: 'prime',
      minAmountCents: 100_000n,
      maxAmountCents: 2_500_000n,
      minTermMonths: 12,
      maxTermMonths: 48,
      permittedStates: ['CA', 'NY'],
    });
  });
});

describe('LenderRegistry.getAdapter', () => {
  const adapters = [new BuzzPayAdapter(), new MockPrimeAdapter()];
  const prisma = makeFakePrisma([]) as never;
  const reg = new LenderRegistry(prisma, adapters);

  it('returns the registered adapter by key', () => {
    expect(reg.getAdapter('buzzpay').adapterKey).toBe('buzzpay');
  });

  it('throws lender_adapter_not_found for an unknown key', () => {
    expect(() => reg.getAdapter('does_not_exist')).toThrow();
  });
});
