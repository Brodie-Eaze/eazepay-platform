// In-memory fakes for MerchantService characterization tests. Same
// philosophy as services/user/test/_helpers.ts — only the surface the
// service actually touches is implemented; new tables would surface as
// "undefined is not a function" rather than silently no-op.
import { randomUUID, randomBytes } from 'node:crypto';
import { PiiVaultService } from '@eazepay/service-user';
// LocalKeyManager isn't part of the public service-user surface; reach into
// the adapter directly for tests (it's the dev-only KEK holder).
import { LocalKeyManager } from '../../user/src/adapters/local-key-manager.adapter.js';
import type { BoPiiV1 } from '../src/bo-pii.types.js';

export const KEK_HEX = randomBytes(32).toString('hex');

export const makeVault = (): PiiVaultService => new PiiVaultService(new LocalKeyManager(KEK_HEX));

export const sampleBoPii = (overrides: Partial<BoPiiV1> = {}): BoPiiV1 => ({
  legalName: { first: 'Sam', last: 'Owner' },
  dateOfBirth: '1985-02-02',
  ssnLast4: '4321',
  address: { line1: '1 Owner Way', city: 'Austin', state: 'TX', zip: '78701' },
  ...overrides,
});

export interface FakeMerchant {
  id: string;
  slug: string;
  legalName: string;
  dba: string | null;
  ein: string | null;
  formationState: string | null;
  naicsCode: string | null;
  mcc: string | null;
  industry: string | null;
  website: string | null;
  status: string;
  kybStatus: string;
  kybProviderRef: string | null;
  kybLastCheckedAt: Date | null;
  kybCompletedAt: Date | null;
  sanctionsStatus: string;
  mdrBps: number;
  createdAt: Date;
}

export interface FakeMerchantUser {
  merchantId: string;
  userId: string;
  role: string;
  permissions: string[];
}

export interface FakeBeneficialOwner {
  id: string;
  merchantId: string;
  piiCiphertext: Buffer;
  piiNonce: Buffer;
  dataKeyCiphertext: Buffer;
  kekId: string;
  piiSchemaVersion: number;
  ownershipPct: number;
  isControlling: boolean;
  sanctionsStatus: string;
}

export interface FakeApplicationLink {
  id: string;
  merchantId: string;
  tokenHash: string;
  category: string | null;
  amountHintCents: bigint | null;
  customerEmail: string | null;
  customerPhone: string | null;
  expiresAt: Date;
  createdByUserId: string;
  revokedAt: Date | null;
  usedAt: Date | null;
  usedByApplicationId: string | null;
}

export interface FakeAuditRow {
  id: string;
  actorType: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  after: unknown;
  createdAt: Date;
}

export const makeMerchantPrisma = (seed?: {
  users?: Array<{ id: string; isAdmin?: boolean; status?: string }>;
}) => {
  const users = (seed?.users ?? [{ id: 'user-1', isAdmin: true, status: 'active' }]).map((u) => ({
    id: u.id,
    isAdmin: u.isAdmin ?? false,
    status: u.status ?? 'active',
  }));
  const merchants: FakeMerchant[] = [];
  const merchantUsers: FakeMerchantUser[] = [];
  const beneficialOwners: FakeBeneficialOwner[] = [];
  const applications: any[] = [];
  const applicationLinks: FakeApplicationLink[] = [];
  const audit: FakeAuditRow[] = [];

  const buildClient = () => ({
    user: {
      findUnique: async ({ where, select }: any) => {
        const u = users.find((x) => x.id === where.id) ?? null;
        if (!u || !select) return u;
        const out: any = {};
        for (const k of Object.keys(select)) out[k] = (u as any)[k];
        return out;
      },
    },
    merchant: {
      create: async ({ data, select }: any) => {
        const row: FakeMerchant = {
          id: randomUUID(),
          slug: data.slug,
          legalName: data.legalName,
          dba: data.dba ?? null,
          ein: data.ein ?? null,
          formationState: data.formationState ?? null,
          naicsCode: data.naicsCode ?? null,
          mcc: data.mcc ?? null,
          industry: data.industry ?? null,
          website: data.website ?? null,
          status: 'kyb_pending',
          kybStatus: 'not_started',
          kybProviderRef: null,
          kybLastCheckedAt: null,
          kybCompletedAt: null,
          sanctionsStatus: 'unknown',
          mdrBps: 0,
          createdAt: new Date(),
        };
        merchants.push(row);
        if (!select) return row;
        const out: any = {};
        for (const k of Object.keys(select)) out[k] = (row as any)[k];
        return out;
      },
      findUnique: async ({ where }: any) => {
        if (where.slug) return merchants.find((m) => m.slug === where.slug) ?? null;
        return merchants.find((m) => m.id === where.id) ?? null;
      },
      findUniqueOrThrow: async ({ where, include }: any) => {
        const m = merchants.find((x) => x.id === where.id);
        if (!m) throw new Error('merchant not found');
        if (include?.beneficialOwners) {
          return { ...m, beneficialOwners: beneficialOwners.filter((b) => b.merchantId === m.id) };
        }
        return m;
      },
      update: async ({ where, data }: any) => {
        const m = merchants.find((x) => x.id === where.id);
        if (!m) throw new Error('merchant not found');
        Object.assign(m, data);
        return m;
      },
    },
    merchantUser: {
      create: async ({ data }: any) => {
        const row: FakeMerchantUser = {
          merchantId: data.merchantId,
          userId: data.userId,
          role: data.role,
          permissions: data.permissions,
        };
        merchantUsers.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        const { merchantId, userId } = where.merchantId_userId;
        return (
          merchantUsers.find((x) => x.merchantId === merchantId && x.userId === userId) ?? null
        );
      },
    },
    beneficialOwner: {
      create: async ({ data, select }: any) => {
        const row: FakeBeneficialOwner = {
          id: data.id ?? randomUUID(),
          merchantId: data.merchantId,
          piiCiphertext: data.piiCiphertext,
          piiNonce: data.piiNonce,
          dataKeyCiphertext: data.dataKeyCiphertext,
          kekId: data.kekId,
          piiSchemaVersion: data.piiSchemaVersion,
          ownershipPct: data.ownershipPct,
          isControlling: data.isControlling,
          sanctionsStatus: 'unknown',
        };
        beneficialOwners.push(row);
        if (!select) return row;
        const out: any = {};
        for (const k of Object.keys(select)) out[k] = (row as any)[k];
        return out;
      },
      updateMany: async ({ where, data }: any) => {
        const matches = beneficialOwners.filter((b) => b.merchantId === where.merchantId);
        for (const b of matches) Object.assign(b, data);
        return { count: matches.length };
      },
    },
    applicationLink: {
      create: async ({ data, select }: any) => {
        const row: FakeApplicationLink = {
          id: randomUUID(),
          merchantId: data.merchantId,
          tokenHash: data.tokenHash,
          category: data.category ?? null,
          amountHintCents: data.amountHintCents ?? null,
          customerEmail: data.customerEmail ?? null,
          customerPhone: data.customerPhone ?? null,
          expiresAt: data.expiresAt,
          createdByUserId: data.createdByUserId,
          revokedAt: null,
          usedAt: null,
          usedByApplicationId: null,
        };
        applicationLinks.push(row);
        if (!select) return row;
        const out: any = {};
        for (const k of Object.keys(select)) out[k] = (row as any)[k];
        return out;
      },
      findUnique: async ({ where, include }: any) => {
        const l = applicationLinks.find((x) => x.tokenHash === where.tokenHash) ?? null;
        if (!l) return null;
        if (include?.merchant) {
          return { ...l, merchant: merchants.find((m) => m.id === l.merchantId)! };
        }
        return l;
      },
      updateMany: async ({ where, data }: any) => {
        const matches = applicationLinks.filter(
          (x) =>
            x.id === where.id &&
            (where.usedAt === null ? x.usedAt === null : true) &&
            (where.revokedAt === null ? x.revokedAt === null : true),
        );
        for (const m of matches) Object.assign(m, data);
        return { count: matches.length };
      },
    },
    application: {
      findMany: async ({ where, take, cursor, skip }: any) => {
        const filtered = applications.filter((a) => a.merchantId === where.merchantId);
        const sorted = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        let idx = 0;
        if (cursor) idx = sorted.findIndex((x) => x.id === cursor.id) + (skip ?? 0);
        return sorted.slice(idx, idx + take);
      },
    },
    auditOutbox: {
      create: async ({ data }: any) => {
        const row: FakeAuditRow = {
          id: randomUUID(),
          actorType: data.actorType,
          actorId: data.actorId,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          after: data.after,
          createdAt: new Date(),
        };
        audit.push(row);
        return row;
      },
    },
  });

  const client: any = buildClient();
  client.$transaction = async (fn: any) => fn(buildClient());
  return {
    client,
    users,
    merchants,
    merchantUsers,
    beneficialOwners,
    applicationLinks,
    applications,
    audit,
  };
};
