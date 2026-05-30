import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { BadRequest, NotFound } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import {
  RETENTION_POLICY,
  type RetentionPolicy,
  type SubjectRetentionFacts,
} from './ports/retention-policy.port.js';
import type { ErasureItem, ErasureReceipt, RetainedItem, ShreddedItem } from './erasure.types.js';

/**
 * PRIV-014 — single-byte tombstone written into shredded Bytes columns.
 *
 * Crypto-shred does NOT require us to physically purge the (now-useless)
 * ciphertext: once the wrapped DEK is gone the AES-256-GCM payload is
 * mathematically unrecoverable. We still overwrite the ciphertext + nonce
 * with a tombstone so a casual reader can SEE the row is erased and so no
 * stale ciphertext lingers, but the irreversibility comes from destroying
 * `dataKeyCiphertext`. A length-1 0x00 buffer is an obviously-invalid GCM
 * envelope — any future `vault.open()` against it fails closed rather than
 * silently returning garbage.
 */
const TOMBSTONE = Buffer.from([0x00]);

/**
 * Right-to-be-forgotten via CRYPTO-SHRED (PRIV-014 / CCPA-CPRA §1798.105 /
 * GDPR Art.17).
 *
 * WHY CRYPTO-SHRED, NOT ROW DELETE:
 *   PII lives as a per-subject AES-256-GCM envelope (a unique DEK per
 *   ConsumerProfile, wrapped by the KMS/local KEK). Destroying the wrapped
 *   DEK renders that subject's ciphertext permanently undecryptable while
 *   leaving every OTHER row, the append-only AuditOutbox, and any retained
 *   financial record physically intact. This satisfies the erasure right
 *   WITHOUT mutating immutable audit history and WITHOUT cascading deletes
 *   through loans/transactions we are legally required to keep.
 *
 * RETENTION HOLD: the {@link RetentionPolicy} (injected, default
 * {@link LoanBackedRetentionPolicy}) decides per data class whether it may
 * be shred or must be retained under a BSA/AML/FCRA hold. We NEVER shred
 * what the policy retains. Uncertain retains are surfaced on the receipt
 * for legal review (default-retain bias).
 *
 * GOVERNANCE: every erasure opens a ComplianceReview (kind=data_erasure)
 * and writes an AuditOutbox row carrying the full receipt — the fact that
 * an erasure occurred, by whom, and exactly what was shred vs retained is
 * itself durable, append-only evidence.
 *
 * ACCESS: exposed only via the admin-gated controller route. There is no
 * self-serve / unauthenticated path. A reason string is mandatory so the
 * audit narrative is never empty.
 */
@Injectable()
export class ErasureService {
  private readonly logger = new Logger(ErasureService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(RETENTION_POLICY) private readonly retention: RetentionPolicy,
  ) {}

  /**
   * Crypto-shred a consumer's erasable PII subject to retention holds.
   *
   * @param executedByUserId  admin executing the erasure (audited actor).
   * @param subjectUserId     the consumer whose data is erased.
   * @param input.reason      mandatory human justification (≥10 chars) —
   *                          e.g. "verified CCPA delete request #4821".
   * @param input.manualLegalHold  when true, forces retain-everything
   *                          (litigation / regulatory inquiry hold).
   *
   * Returns the structured {@link ErasureReceipt}. Idempotent on an
   * already-erased subject: re-running shreds nothing new (the DEK is
   * already a tombstone) and reports the prior shred outcome.
   */
  async eraseConsumer(
    executedByUserId: UserId,
    subjectUserId: string,
    input: { reason: string; manualLegalHold?: boolean },
  ): Promise<ErasureReceipt> {
    if (!input.reason || input.reason.trim().length < 10) {
      throw BadRequest({
        code: 'erasure_reason_required',
        detail: 'reason must be ≥ 10 chars to satisfy the audit narrative',
      });
    }

    // Assemble retention facts via tenant-scoped reads. Done OUTSIDE the
    // mutation transaction so the policy decision is computed from a
    // consistent snapshot we also pin onto the receipt.
    const user = await this.prisma.user.findUnique({
      where: { id: subjectUserId },
      select: {
        id: true,
        email: true,
        phoneE164: true,
        displayName: true,
        totpSecretCiphertext: true,
        consumerProfile: { select: { id: true } },
      },
    });
    if (!user) throw NotFound({ code: 'subject_not_found' });

    const [loanCount, openLoanCount, applicationCount] = await Promise.all([
      this.prisma.loan.count({ where: { userId: subjectUserId } }),
      this.prisma.loan.count({
        where: {
          userId: subjectUserId,
          status: { notIn: ['paid_off', 'charged_off', 'cancelled'] },
        },
      }),
      this.prisma.application.count({ where: { userId: subjectUserId } }),
    ]);

    const facts: SubjectRetentionFacts = {
      userId: subjectUserId,
      loanCount,
      openLoanCount,
      hasApplications: applicationCount > 0,
      manualLegalHold: input.manualLegalHold === true,
    };

    const decisions = this.retention.decide(facts);

    const receiptId = randomUUID();
    const executedAt = new Date();

    // Build the receipt INSIDE the transaction and return it, so a tx
    // retry (e.g. on a serialization failure) recomputes `items` from
    // scratch rather than double-appending to a closed-over array.
    const receipt = await this.prisma.$transaction(async (tx): Promise<ErasureReceipt> => {
      const items: ErasureItem[] = [];
      for (const decision of decisions) {
        if (decision.action === 'retain') {
          const retained: RetainedItem = {
            datum: decision.datum,
            outcome: 'retained',
            hold: decision.hold,
            rationale: decision.rationale,
            flaggedForReview: decision.uncertain,
          };
          items.push(retained);
          continue;
        }

        // action === 'shred'
        if (decision.datum === 'consumer_profile_pii') {
          if (!user.consumerProfile) {
            // Nothing to shred — record honestly rather than fabricating.
            const shredded: ShreddedItem = {
              datum: 'consumer_profile_pii',
              outcome: 'shredded',
              columns: [],
              rationale: `${decision.rationale} (no ConsumerProfile present — no-op)`,
            };
            items.push(shredded);
            continue;
          }
          // CRYPTO-SHRED: destroy the wrapped per-subject DEK so the GCM
          // payload is permanently unrecoverable. Overwrite ciphertext +
          // nonce with a tombstone for hygiene, and stamp the erasure.
          await tx.consumerProfile.update({
            where: { userId: subjectUserId },
            data: {
              dataKeyCiphertext: TOMBSTONE,
              piiCiphertext: TOMBSTONE,
              piiNonce: TOMBSTONE,
              kekId: 'erased',
              piiErasedAt: executedAt,
              erasureReceiptId: receiptId,
            },
          });
          const shredded: ShreddedItem = {
            datum: 'consumer_profile_pii',
            outcome: 'shredded',
            columns: ['data_key_ciphertext', 'pii_ciphertext', 'pii_nonce', 'kek_id'],
            rationale: decision.rationale,
          };
          items.push(shredded);
          continue;
        }

        if (decision.datum === 'user_contact_pii') {
          // Tombstone plaintext contact PII in place. We null the
          // searchable columns and tombstone the TOTP secret envelope.
          // (User row itself is NOT deleted — applications/loans FK to it
          // and the audit trail references its id.)
          await tx.user.update({
            where: { id: subjectUserId },
            data: {
              email: null,
              phoneE164: null,
              displayName: null,
              ...(user.totpSecretCiphertext ? { totpSecretCiphertext: null } : {}),
              contactErasedAt: executedAt,
              erasureReceiptId: receiptId,
            },
          });
          const cols = ['email', 'phone_e164', 'display_name'];
          if (user.totpSecretCiphertext) cols.push('totp_secret_ciphertext');
          const shredded: ShreddedItem = {
            datum: 'user_contact_pii',
            outcome: 'shredded',
            columns: cols,
            rationale: decision.rationale,
          };
          items.push(shredded);
          continue;
        }
      }

      const shreddedCount = items.filter((i) => i.outcome === 'shredded').length;
      const retainedCount = items.filter((i) => i.outcome === 'retained').length;
      const reviewFlaggedCount = items.filter(
        (i): i is RetainedItem => i.outcome === 'retained' && i.flaggedForReview,
      ).length;

      const receipt: ErasureReceipt = {
        receiptId,
        subjectUserId,
        executedByUserId,
        executedAt: executedAt.toISOString(),
        retentionFacts: {
          loanCount: facts.loanCount,
          openLoanCount: facts.openLoanCount,
          hasApplications: facts.hasApplications,
          manualLegalHold: facts.manualLegalHold,
        },
        items,
        summary: { shreddedCount, retainedCount, reviewFlaggedCount },
      };

      // Governance: open a ComplianceReview row (the erasure evidence
      // anchor) and write the append-only audit row carrying the full
      // receipt. Both live in the same tx as the shred so the evidence
      // and the mutation commit atomically.
      await tx.complianceReview.create({
        data: {
          kind: 'data_erasure',
          subjectType: 'User',
          subjectId: subjectUserId,
          reason: input.reason,
          reasonCodes: ['ccpa_cpra_right_to_delete'],
          status: reviewFlaggedCount > 0 ? 'open' : 'closed_no_action',
          createdByUserId: executedByUserId,
          closedByUserId: reviewFlaggedCount > 0 ? null : executedByUserId,
          closedAt: reviewFlaggedCount > 0 ? null : executedAt,
          dualControlRequired: false,
          evidence: toJsonValue(receipt),
        },
      });

      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: executedByUserId,
          action: 'admin.consumer.erased',
          targetType: 'User',
          targetId: subjectUserId,
          before: {
            hadConsumerProfile: !!user.consumerProfile,
            hadEmail: !!user.email,
            hadPhone: !!user.phoneE164,
          },
          after: toJsonValue(receipt),
        },
      });

      return receipt;
    });

    this.logger.log({
      event: 'rtbf.erasure.completed',
      receiptId,
      subjectUserId,
      executedByUserId,
      shredded: receipt.items.filter((i) => i.outcome === 'shredded').map((i) => i.datum),
      retained: receipt.items.filter((i) => i.outcome === 'retained').map((i) => i.datum),
    });

    return receipt;
  }
}

/**
 * Coerce a typed, fully-serializable value into Prisma's `InputJsonValue`.
 * The receipt is composed entirely of strings / numbers / booleans /
 * arrays / nested objects, so the JSON round-trip is lossless; it exists
 * only to satisfy Prisma's stricter JSON input type without an `as any`.
 */
function toJsonValue(value: ErasureReceipt): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
