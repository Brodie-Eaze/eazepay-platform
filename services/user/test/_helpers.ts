// Test helpers for the user service. We do NOT spin up a real Prisma or
// Postgres — instead we hand-roll an in-memory fake that implements just
// the surface area MerchantService / UserService touch. The fake is
// deliberately strict: methods we don't expect to be called throw, so a
// regression that fans out to a new table fails the test loudly.
import { randomBytes, randomUUID } from 'node:crypto';
import { LocalKeyManager } from '../src/adapters/local-key-manager.adapter.js';
import { PiiVaultService } from '../src/internal/pii-vault.service.js';
import type { PiiV1 } from '../src/pii.types.js';

export const KEK_HEX = randomBytes(32).toString('hex');

export const makeVault = (): PiiVaultService => {
  const km = new LocalKeyManager(KEK_HEX);
  return new PiiVaultService(km);
};

export const samplePii = (overrides: Partial<PiiV1> = {}): PiiV1 => ({
  legalName: { first: 'Alex', last: 'Doe' },
  dateOfBirth: '1990-04-15',
  ssnLast4: '1234',
  address: {
    line1: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
  },
  ...overrides,
});

export interface FakeUser {
  id: string;
  email: string | null;
  phoneE164: string | null;
  status: string;
  isAdmin: boolean;
}

export interface FakeConsumerProfile {
  id: string;
  userId: string;
  piiCiphertext: Buffer;
  piiNonce: Buffer;
  dataKeyCiphertext: Buffer;
  kekId: string;
  piiSchemaVersion: number;
  residentState: string;
  kycStatus: string;
  kycProviderRef: string | null;
  kycLastCheckedAt: Date | null;
  kycCompletedAt: Date | null;
  pepStatus: string;
  sanctionsStatus: string;
  sanctionsCheckedAt: Date | null;
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

/**
 * Tiny Prisma stand-in. Implements only what UserService calls. The
 * shape mirrors the actual Prisma client just enough to satisfy the
 * type assertions used at the @Inject(PRISMA) boundary.
 */
export const makeUserPrisma = (seed?: { users?: FakeUser[]; profiles?: FakeConsumerProfile[] }) => {
  const users: FakeUser[] = [...(seed?.users ?? [])];
  const profiles: FakeConsumerProfile[] = [...(seed?.profiles ?? [])];
  const audit: FakeAuditRow[] = [];

  // Build a tx object that mirrors the parent prisma but writes to the
  // same underlying arrays. We don't simulate rollback — tests assert
  // success or a thrown error.
  const buildClient = () => ({
    user: {
      findUnique: async ({ where, include, select }: any) => {
        const u = users.find((x) => x.id === where.id) ?? null;
        if (!u) return null;
        if (include?.consumerProfile) {
          const p = profiles.find((x) => x.userId === u.id) ?? null;
          return { ...u, consumerProfile: p };
        }
        if (select) {
          const out: any = {};
          for (const k of Object.keys(select)) out[k] = (u as any)[k];
          return out;
        }
        return u;
      },
    },
    consumerProfile: {
      findUnique: async ({ where, select }: any) => {
        const p = profiles.find((x) => x.userId === where.userId) ?? null;
        if (!p) return null;
        if (select) {
          const out: any = {};
          for (const k of Object.keys(select)) out[k] = (p as any)[k];
          return out;
        }
        return p;
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = profiles.find((x) => x.userId === where.userId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row: FakeConsumerProfile = {
          id: randomUUID(),
          userId: where.userId,
          piiCiphertext: create.piiCiphertext,
          piiNonce: create.piiNonce,
          dataKeyCiphertext: create.dataKeyCiphertext,
          kekId: create.kekId,
          piiSchemaVersion: create.piiSchemaVersion,
          residentState: create.residentState,
          kycStatus: 'not_started',
          kycProviderRef: null,
          kycLastCheckedAt: null,
          kycCompletedAt: null,
          pepStatus: 'unknown',
          sanctionsStatus: 'unknown',
          sanctionsCheckedAt: null,
        };
        profiles.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = profiles.find((x) => x.userId === where.userId);
        if (!row) throw new Error('profile not found');
        Object.assign(row, data);
        return row;
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
  return { client, users, profiles, audit };
};
