import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { NotFound } from '@eazepay/shared-utils';
import { PRISMA } from './internal/tokens.js';
import { LENDER_ADAPTERS, type LenderAdapter } from './ports/lender-adapter.port.js';

interface SeedProduct {
  productKey: string;
  name: string;
  category: 'auto' | 'home_improvement' | 'medical' | 'retail' | 'personal' | 'consolidation';
  minAmountCents: bigint;
  maxAmountCents: bigint;
  minTermMonths: number;
  maxTermMonths: number;
  permittedStates: string[];
}

interface Seed {
  adapterKey: string;
  legalName: string;
  lenderOfRecord: string;
  tier: 'internal' | 'prime' | 'near_prime' | 'bnpl' | 'subprime';
  priority: number;
  products: SeedProduct[];
}

const SEEDS: Seed[] = [
  {
    adapterKey: 'buzzpay',
    legalName: 'BuzzPay (TrueTopia)',
    lenderOfRecord: 'BuzzPay (issued via partner bank — see ADR-0008)',
    tier: 'internal',
    priority: 50,
    products: [
      {
        productKey: 'buzzpay_personal',
        name: 'BuzzPay Personal',
        category: 'personal',
        minAmountCents: 50_000n,
        maxAmountCents: 5_000_000n,
        minTermMonths: 6,
        maxTermMonths: 60,
        permittedStates: [],
      },
    ],
  },
  {
    adapterKey: 'mock_prime',
    legalName: 'Mock Prime Bank, N.A.',
    lenderOfRecord: 'Mock Prime Bank, N.A.',
    tier: 'prime',
    priority: 10,
    products: [
      {
        productKey: 'mock_prime_personal',
        name: 'Mock Prime Personal',
        category: 'personal',
        minAmountCents: 100_000n,
        maxAmountCents: 2_500_000n,
        minTermMonths: 12,
        maxTermMonths: 48,
        permittedStates: [],
      },
    ],
  },
];

@Injectable()
export class LenderRegistry implements OnModuleInit {
  private readonly logger = new Logger(LenderRegistry.name);
  private readonly byKey = new Map<string, LenderAdapter>();

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(LENDER_ADAPTERS) private readonly adapters: LenderAdapter[],
  ) {
    for (const a of adapters) this.byKey.set(a.adapterKey, a);
  }

  async onModuleInit(): Promise<void> {
    // Seed Lender + LenderProduct rows so orchestration can resolve every
    // adapter to a DB id at evaluation time. Idempotent: re-running doesn't
    // disturb prod data.
    for (const seed of SEEDS) {
      if (!this.byKey.has(seed.adapterKey)) continue; // skip seeds whose adapter isn't wired
      const lender = await this.prisma.lender.upsert({
        where: { adapterKey: seed.adapterKey },
        create: {
          adapterKey: seed.adapterKey,
          legalName: seed.legalName,
          lenderOfRecord: seed.lenderOfRecord,
          tier: seed.tier,
          priority: seed.priority,
        },
        update: {
          legalName: seed.legalName,
          lenderOfRecord: seed.lenderOfRecord,
          tier: seed.tier,
          priority: seed.priority,
        },
      });
      for (const p of seed.products) {
        await this.prisma.lenderProduct.upsert({
          where: { productKey: p.productKey },
          create: {
            lenderId: lender.id,
            productKey: p.productKey,
            name: p.name,
            category: p.category,
            minAmountCents: p.minAmountCents,
            maxAmountCents: p.maxAmountCents,
            minTermMonths: p.minTermMonths,
            maxTermMonths: p.maxTermMonths,
            permittedStates: p.permittedStates,
          },
          update: {
            name: p.name,
            category: p.category,
            minAmountCents: p.minAmountCents,
            maxAmountCents: p.maxAmountCents,
            minTermMonths: p.minTermMonths,
            maxTermMonths: p.maxTermMonths,
            permittedStates: p.permittedStates,
          },
        });
      }
    }
    this.logger.log(`Lender registry ready (${this.byKey.size} adapter(s))`);
  }

  getAdapter(adapterKey: string): LenderAdapter {
    const a = this.byKey.get(adapterKey);
    if (!a) throw NotFound({ code: 'lender_adapter_not_found', detail: adapterKey });
    return a;
  }

  /** Returns DB rows for all enabled adapters whose DB Lender row is enabled. */
  async listEnabled(category: string, residentState: string | null): Promise<
    Array<{
      adapter: LenderAdapter;
      lenderId: string;
      lenderProductId: string;
      lenderOfRecord: string;
      priority: number;
      tier: 'internal' | 'prime' | 'near_prime' | 'bnpl' | 'subprime';
      minAmountCents: bigint;
      maxAmountCents: bigint;
      minTermMonths: number;
      maxTermMonths: number;
      permittedStates: string[];
    }>
  > {
    const products = await this.prisma.lenderProduct.findMany({
      where: { enabled: true, category: category as never, lender: { enabled: true } },
      include: { lender: true },
    });
    return products
      .filter((p) => this.byKey.has(p.lender.adapterKey))
      .filter((p) =>
        p.permittedStates.length === 0 || (residentState != null && p.permittedStates.includes(residentState)),
      )
      .map((p) => ({
        adapter: this.byKey.get(p.lender.adapterKey)!,
        lenderId: p.lenderId,
        lenderProductId: p.id,
        lenderOfRecord: p.lender.lenderOfRecord,
        priority: p.lender.priority,
        tier: p.lender.tier,
        minAmountCents: p.minAmountCents,
        maxAmountCents: p.maxAmountCents,
        minTermMonths: p.minTermMonths,
        maxTermMonths: p.maxTermMonths,
        permittedStates: p.permittedStates,
      }));
  }
}
