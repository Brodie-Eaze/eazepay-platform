// PRIV-014 — right-to-erasure / crypto-shred tests.
//
// Proves the three load-bearing properties an auditor will check:
//   1. A shred makes the consumer's PII ciphertext PERMANENTLY
//      unrecoverable — we seal real PII with the real vault, shred, then
//      show vault.open() against the post-shred row fails closed.
//   2. Data under a retention hold (loan-backed subject) is NOT shred —
//      the ConsumerProfile DEK is left intact and the receipt records a
//      retain with the BSA CIP hold id.
//   3. The erasure receipt AND the append-only audit row are produced.
//
// We hand-roll a tiny Prisma fake (mirroring services/user/test/_helpers)
// rather than spin up Postgres. The fake stores the same byte columns the
// real schema does so the crypto round-trip is exercised end to end.
import { randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LocalKeyManager, PiiVaultService, type PiiV1 } from '@eazepay/service-user';
import { ErasureService } from '../src/erasure.service.js';
import { LoanBackedRetentionPolicy } from '../src/internal/loan-backed-retention-policy.js';

const KEK_HEX = randomBytes(32).toString('hex');

const samplePii = (): PiiV1 => ({
  legalName: { first: 'Alex', last: 'Doe' },
  dateOfBirth: '1990-04-15',
  ssnLast4: '1234',
  address: { line1: '123 Main St', city: 'Austin', state: 'TX', zip: '78701' },
});

interface FakeProfile {
  id: string;
  userId: string;
  piiCiphertext: Buffer;
  piiNonce: Buffer;
  dataKeyCiphertext: Buffer;
  kekId: string;
  piiSchemaVersion: number;
  piiErasedAt: Date | null;
  erasureReceiptId: string | null;
}

interface FakeUser {
  id: string;
  email: string | null;
  phoneE164: string | null;
  displayName: string | null;
  totpSecretCiphertext: string | null;
  contactErasedAt: Date | null;
  erasureReceiptId: string | null;
}

interface AuditRow {
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
}

interface ReviewRow {
  kind: string;
  subjectType: string;
  subjectId: string;
  status: string;
  evidence: unknown;
  reasonCodes: string[];
}

/**
 * Build a Prisma stand-in seeded with one user + (optionally) a profile
 * sealed by the real vault, plus a configurable loan count. Exposes the
 * underlying arrays so assertions can inspect post-shred state.
 */
async function makeFixture(opts: {
  loanCount: number;
  openLoanCount?: number;
  applicationCount?: number;
  withProfile?: boolean;
  withContact?: boolean;
}) {
  const vault = new PiiVaultService(new LocalKeyManager(KEK_HEX));
  const userId = randomUUID();

  const users: FakeUser[] = [
    {
      id: userId,
      email: opts.withContact === false ? null : 'alex@example.com',
      phoneE164: opts.withContact === false ? null : '+15125550100',
      displayName: 'Alex',
      totpSecretCiphertext: 'totp-envelope-blob',
      contactErasedAt: null,
      erasureReceiptId: null,
    },
  ];

  const profiles: FakeProfile[] = [];
  if (opts.withProfile !== false) {
    const sealed = await vault.seal(userId as never, samplePii());
    profiles.push({
      id: randomUUID(),
      userId,
      piiCiphertext: sealed.ciphertext,
      piiNonce: sealed.nonce,
      dataKeyCiphertext: sealed.dataKeyCiphertext,
      kekId: sealed.kekId,
      piiSchemaVersion: sealed.schemaVersion,
      piiErasedAt: null,
      erasureReceiptId: null,
    });
  }

  const audit: AuditRow[] = [];
  const reviews: ReviewRow[] = [];

  const build = () => ({
    user: {
      findUnique: async ({ where, select }: any) => {
        const u = users.find((x) => x.id === where.id) ?? null;
        if (!u) return null;
        const out: any = {};
        for (const k of Object.keys(select ?? {})) {
          if (k === 'consumerProfile') {
            const p = profiles.find((x) => x.userId === u.id) ?? null;
            out.consumerProfile = p ? { id: p.id } : null;
          } else {
            out[k] = (u as any)[k];
          }
        }
        return out;
      },
      update: async ({ where, data }: any) => {
        const u = users.find((x) => x.id === where.id);
        if (!u) throw new Error('user not found');
        Object.assign(u, data);
        return u;
      },
    },
    consumerProfile: {
      update: async ({ where, data }: any) => {
        const p = profiles.find((x) => x.userId === where.userId);
        if (!p) throw new Error('profile not found');
        Object.assign(p, data);
        return p;
      },
    },
    loan: {
      count: async ({ where }: any) => {
        if (where?.status?.notIn) return opts.openLoanCount ?? 0;
        return opts.loanCount;
      },
    },
    application: {
      count: async () => opts.applicationCount ?? 0,
    },
    complianceReview: {
      create: async ({ data }: any) => {
        reviews.push({
          kind: data.kind,
          subjectType: data.subjectType,
          subjectId: data.subjectId,
          status: data.status,
          evidence: data.evidence,
          reasonCodes: data.reasonCodes,
        });
        return { id: randomUUID() };
      },
    },
    auditOutbox: {
      create: async ({ data }: any) => {
        audit.push({
          actorType: data.actorType,
          actorId: data.actorId,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          before: data.before,
          after: data.after,
        });
        return { id: randomUUID() };
      },
    },
  });

  const client: any = build();
  client.$transaction = async (fn: any) => fn(build());

  const service = new ErasureService(client, new LoanBackedRetentionPolicy());
  return { service, vault, userId, users, profiles, audit, reviews };
}

describe('ErasureService — crypto-shred (no retention hold)', () => {
  it('makes the consumer PII ciphertext PERMANENTLY unrecoverable', async () => {
    const fx = await makeFixture({ loanCount: 0 });
    const adminId = randomUUID();

    // Sanity: before the shred, the sealed blob opens cleanly.
    const before = fx.profiles[0]!;
    const opened = await fx.vault.open(fx.userId as never, {
      ciphertext: before.piiCiphertext,
      nonce: before.piiNonce,
      dataKeyCiphertext: before.dataKeyCiphertext,
      kekId: before.kekId,
      schemaVersion: before.piiSchemaVersion,
    });
    expect(opened.legalName.first).toBe('Alex');

    const receipt = await fx.service.eraseConsumer(adminId as never, fx.userId, {
      reason: 'verified CCPA delete request #4821',
    });

    // The DEK ciphertext + payload are now tombstones; the post-shred row
    // must NOT decrypt — the data is gone for good.
    const after = fx.profiles[0]!;
    expect(after.piiErasedAt).toBeInstanceOf(Date);
    expect(after.kekId).toBe('erased');
    await expect(
      fx.vault.open(fx.userId as never, {
        ciphertext: after.piiCiphertext,
        nonce: after.piiNonce,
        dataKeyCiphertext: after.dataKeyCiphertext,
        kekId: after.kekId,
        schemaVersion: after.piiSchemaVersion,
      }),
    ).rejects.toThrow();

    // Even if an attacker kept a copy of the ORIGINAL ciphertext, the
    // wrapped DEK that could decrypt it is destroyed — there is no path
    // back to plaintext. (The KEK never changed; only the per-subject
    // DEK envelope was destroyed.)
    const profileItem = receipt.items.find((i) => i.datum === 'consumer_profile_pii');
    expect(profileItem?.outcome).toBe('shredded');

    // Contact PII tombstoned too (no loan => marketing data).
    expect(fx.users[0]!.email).toBeNull();
    expect(fx.users[0]!.phoneE164).toBeNull();
    expect(fx.users[0]!.contactErasedAt).toBeInstanceOf(Date);
  });
});

describe('ErasureService — retention hold (loan-backed subject)', () => {
  it('does NOT shred CIP PII when the subject has a loan; records a retain', async () => {
    const fx = await makeFixture({ loanCount: 2, openLoanCount: 1 });
    const adminId = randomUUID();

    const profileBytesBefore = Buffer.from(fx.profiles[0]!.dataKeyCiphertext);

    const receipt = await fx.service.eraseConsumer(adminId as never, fx.userId, {
      reason: 'verified CCPA delete request for loan-backed consumer',
    });

    // The DEK envelope is UNTOUCHED — the CIP record survives.
    expect(fx.profiles[0]!.piiErasedAt).toBeNull();
    expect(fx.profiles[0]!.kekId).not.toBe('erased');
    expect(fx.profiles[0]!.dataKeyCiphertext.equals(profileBytesBefore)).toBe(true);

    // And it still decrypts — proving we kept exactly what BSA requires.
    const stillOpens = await fx.vault.open(fx.userId as never, {
      ciphertext: fx.profiles[0]!.piiCiphertext,
      nonce: fx.profiles[0]!.piiNonce,
      dataKeyCiphertext: fx.profiles[0]!.dataKeyCiphertext,
      kekId: fx.profiles[0]!.kekId,
      schemaVersion: fx.profiles[0]!.piiSchemaVersion,
    });
    expect(stillOpens.ssnLast4).toBe('1234');

    const profileItem = receipt.items.find((i) => i.datum === 'consumer_profile_pii');
    expect(profileItem).toMatchObject({
      outcome: 'retained',
      hold: LoanBackedRetentionPolicy.HOLD_BSA_CIP,
    });

    // Contact PII is ALSO retained for a loan-backed subject, and flagged
    // for legal review (default-retain "unsure" path).
    const contactItem = receipt.items.find((i) => i.datum === 'user_contact_pii');
    expect(contactItem).toMatchObject({ outcome: 'retained', flaggedForReview: true });
    expect(fx.users[0]!.email).toBe('alex@example.com'); // untouched
    expect(receipt.summary.reviewFlaggedCount).toBeGreaterThan(0);
  });

  it('manual legal hold retains EVERYTHING even with no loans', async () => {
    const fx = await makeFixture({ loanCount: 0 });
    const adminId = randomUUID();
    const receipt = await fx.service.eraseConsumer(adminId as never, fx.userId, {
      reason: 'litigation hold — do not erase pending discovery',
      manualLegalHold: true,
    });
    expect(receipt.summary.shreddedCount).toBe(0);
    expect(fx.profiles[0]!.piiErasedAt).toBeNull();
    expect(fx.users[0]!.email).toBe('alex@example.com');
    expect(
      receipt.items.every(
        (i) => i.outcome === 'retained' && i.hold === LoanBackedRetentionPolicy.HOLD_MANUAL_LEGAL,
      ),
    ).toBe(true);
  });
});

describe('ErasureService — evidence (receipt + audit row)', () => {
  it('produces a receipt and an append-only audit row carrying it', async () => {
    const fx = await makeFixture({ loanCount: 0 });
    const adminId = randomUUID();
    const receipt = await fx.service.eraseConsumer(adminId as never, fx.userId, {
      reason: 'verified CCPA delete request #9001',
    });

    expect(receipt.receiptId).toMatch(/[0-9a-f-]{36}/);
    expect(receipt.subjectUserId).toBe(fx.userId);
    expect(receipt.executedByUserId).toBe(adminId);
    expect(receipt.items.length).toBe(2);

    // Exactly one audit row, with the canonical action + the receipt on
    // `after`. This is the durable, append-only evidence the erasure
    // happened.
    expect(fx.audit).toHaveLength(1);
    const row = fx.audit[0]!;
    expect(row.action).toBe('admin.consumer.erased');
    expect(row.actorType).toBe('admin');
    expect(row.actorId).toBe(adminId);
    expect(row.targetType).toBe('User');
    expect(row.targetId).toBe(fx.userId);
    expect((row.after as { receiptId: string }).receiptId).toBe(receipt.receiptId);

    // A ComplianceReview evidence anchor exists too.
    expect(fx.reviews).toHaveLength(1);
    expect(fx.reviews[0]!.kind).toBe('data_erasure');
    expect(fx.reviews[0]!.subjectId).toBe(fx.userId);
  });

  it('rejects an erasure with no reason narrative', async () => {
    const fx = await makeFixture({ loanCount: 0 });
    await expect(
      fx.service.eraseConsumer(randomUUID() as never, fx.userId, { reason: 'too short' }),
    ).rejects.toThrow();
  });

  it('404s on an unknown subject', async () => {
    const fx = await makeFixture({ loanCount: 0 });
    await expect(
      fx.service.eraseConsumer(randomUUID() as never, randomUUID(), {
        reason: 'verified delete request for nonexistent subject',
      }),
    ).rejects.toThrow();
  });
});
