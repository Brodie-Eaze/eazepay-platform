import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { type Prisma } from '@prisma/client';
import { Conflict, NotFound } from '@eazepay/shared-utils';
import type { LoanId, PaymentMethodId, UserId } from '@eazepay/shared-types';
import { NOTIFY_PORT, type NotifyPort } from '@eazepay/service-notification';
import { WEBHOOK_PUBLISHER, type WebhookPublisher } from '@eazepay/service-webhook';
import { PRISMA } from './internal/tokens.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type ProviderResult,
} from './ports/payment-provider.port.js';
import {
  BANK_ACCOUNT_PROVIDER,
  type BankAccountProvider,
} from './ports/bank-account-provider.port.js';

/**
 * Owns disbursement + repayment scheduling + collection lifecycle.
 *
 * disburseAndSchedule(loanId):
 *  1. Validate loan in funding_pending; transition contracted →
 *     funding on the parent application.
 *  2. Call PaymentProvider.disburse with an idempotency key derived
 *     from loanId so retries don't double-fund.
 *  3. Persist the Transaction row.
 *  4. On succeeded: generate the Repayment schedule, mark the loan
 *     active, transition application funding → active.
 *  5. On failed:    mark application back to contracted (the loan
 *     stays funding_pending so a retry is possible) and log + audit.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(BANK_ACCOUNT_PROVIDER) private readonly bank: BankAccountProvider,
    @Optional() @Inject(NOTIFY_PORT) private readonly notify?: NotifyPort,
    @Optional() @Inject(WEBHOOK_PUBLISHER) private readonly webhooks?: WebhookPublisher,
  ) {}

  private async fireWebhook(input: {
    eventType: string;
    eventId: string;
    subjectType: string;
    subjectId: string;
    merchantId: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    if (!this.webhooks || !input.merchantId) return;
    try {
      await this.webhooks.publish(input);
    } catch (err) {
      this.logger.error({ err, eventType: input.eventType }, 'webhook publish failed');
    }
  }

  private async fireNotify(input: {
    userId: string;
    templateKey: string;
    payload?: Record<string, unknown>;
    subjectType?: string;
    subjectId?: string;
  }): Promise<void> {
    if (!this.notify) return;
    try {
      await this.notify.notify(input);
    } catch (err) {
      this.logger.error({ err, templateKey: input.templateKey }, 'notify failed');
    }
  }

  // ----- payment method CRUD -----

  async addBankAccount(
    userId: UserId,
    input: { publicToken: string; setAsDefault?: boolean },
  ): Promise<{ id: PaymentMethodId; last4: string; bankName: string | null }> {
    const exchanged = await this.bank.exchange({ userId, publicToken: input.publicToken });
    if (exchanged.signal === 'high') {
      throw Conflict({
        code: 'bank_account_high_risk',
        detail: 'provider flagged this account as high NSF risk',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // If this is the first verified method OR caller asked, make it default.
      const existingDefault = await tx.paymentMethod.findFirst({
        where: { userId, isDefault: true, status: 'verified' },
        select: { id: true },
      });
      const shouldDefault = input.setAsDefault === true || !existingDefault;
      if (shouldDefault) {
        await tx.paymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const m = await tx.paymentMethod.create({
        data: {
          userId,
          type: 'bank_account',
          provider: this.bank.name,
          providerToken: exchanged.providerToken,
          last4: exchanged.last4,
          brand: exchanged.bankName,
          isDefault: shouldDefault,
          status: 'verified', // Plaid-shape exchange returns verified-on-success
        },
        select: { id: true, last4: true, brand: true },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'payment.method.added',
          targetType: 'PaymentMethod',
          targetId: m.id,
          after: { type: 'bank_account', last4: m.last4, signal: exchanged.signal },
        },
      });
      return {
        id: m.id as PaymentMethodId,
        last4: m.last4 ?? exchanged.last4,
        bankName: m.brand,
      };
    });
  }

  async listPaymentMethods(userId: UserId): Promise<
    Array<{
      id: string;
      type: string;
      last4: string | null;
      brand: string | null;
      isDefault: boolean;
      status: string;
      createdAt: string;
    }>
  > {
    const methods = await this.prisma.paymentMethod.findMany({
      where: { userId, status: { not: 'removed' } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return methods.map((m) => ({
      id: m.id,
      type: m.type,
      last4: m.last4,
      brand: m.brand,
      isDefault: m.isDefault,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async setDefaultPaymentMethod(userId: UserId, methodId: PaymentMethodId): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const target = await tx.paymentMethod.findFirst({
        where: { id: methodId, userId, status: 'verified' },
      });
      if (!target) throw NotFound({ code: 'payment_method_not_found' });
      await tx.paymentMethod.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
      await tx.paymentMethod.update({
        where: { id: methodId },
        data: { isDefault: true },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'payment.method.set_default',
          targetType: 'PaymentMethod',
          targetId: methodId,
        },
      });
    });
  }

  async removePaymentMethod(userId: UserId, methodId: PaymentMethodId): Promise<void> {
    const target = await this.prisma.paymentMethod.findFirst({
      where: { id: methodId, userId, status: { not: 'removed' } },
    });
    if (!target) throw NotFound({ code: 'payment_method_not_found' });
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentMethod.update({
        where: { id: methodId },
        data: { status: 'removed', isDefault: false },
      });
      // If this was the default, promote the most-recent verified method.
      if (target.isDefault) {
        const next = await tx.paymentMethod.findFirst({
          where: { userId, status: 'verified', id: { not: methodId } },
          orderBy: { createdAt: 'desc' },
        });
        if (next) {
          await tx.paymentMethod.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'payment.method.removed',
          targetType: 'PaymentMethod',
          targetId: methodId,
        },
      });
    });
  }

  async disburseAndSchedule(loanId: string): Promise<void> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { application: true },
    });
    if (!loan) throw NotFound({ code: 'loan_not_found' });
    if (loan.status === 'active' || loan.status === 'paid_off') return; // idempotent
    if (loan.status !== 'funding_pending') {
      throw Conflict({
        code: 'loan_not_fundable',
        detail: `loan status=${loan.status}`,
      });
    }

    // SEC-036 — gate disbursement on a verified default bank account.
    //
    // Threat scenario:
    //   Pre-fix, `disburseAndSchedule` called `provider.disburse` with
    //   `destination: { kind: 'consumer_bank', userId }` and trusted
    //   the provider to resolve the right destination. In production
    //   that resolution depends on a real `PaymentMethod` row with
    //   `isDefault=true, status='verified'`. If no such row exists —
    //   because the consumer skipped the bank-link step, was offered
    //   an instant approval, and finished the contract before linking
    //   a destination — the provider call either fails opaquely
    //   (waste + alarm noise) OR, with a misconfigured provider stub
    //   in non-prod, succeeds against an unverified account that does
    //   NOT belong to the consumer. Either way, money moves (or tries
    //   to) without a regulator-defensible "where did this go and
    //   why?" answer.
    //
    // Fix: hard-fail BEFORE the provider call when no verified default
    // exists, AND attach the verified-account's `providerToken` to the
    // destination so the provider has a fully-resolved instrument.
    // Every reject also emits an audit row so a regulator can see WHY
    // a funded loan stalled.
    const defaultMethod = await this.prisma.paymentMethod.findFirst({
      where: { userId: loan.userId, isDefault: true, status: 'verified' },
      select: { id: true, providerToken: true, last4: true },
    });
    if (!defaultMethod) {
      // Record the block so regulators see the rejection rather than
      // an opaque "loan stuck at funding_pending" gap.
      await this.prisma.auditOutbox.create({
        data: {
          actorType: 'service',
          actorId: null,
          action: 'payment.disbursement.blocked_no_verified_account',
          targetType: 'Loan',
          targetId: loan.id,
          after: {
            applicationId: loan.applicationId,
            userId: loan.userId,
            reason: 'no verified default PaymentMethod present',
          },
        },
      });
      throw Conflict({
        code: 'no_verified_disbursement_account',
        detail: 'consumer must add and verify a default bank account before disbursement',
      });
    }

    // Move application contracted → funding up-front so the state is
    // visible to anyone polling. The transition stays valid even if the
    // disburse call fails; a later retry resumes from this state.
    if (loan.application.status === 'contracted') {
      await this.prisma.$transaction(async (tx) => {
        await tx.application.update({
          where: { id: loan.applicationId },
          data: { status: 'funding' },
        });
        await tx.auditOutbox.create({
          data: {
            actorType: 'service',
            actorId: null,
            action: 'application.funding_started',
            targetType: 'Application',
            targetId: loan.applicationId,
          },
        });
      });
    }

    const result = await this.provider.disburse({
      idempotencyKey: `disburse-${loan.id}`,
      loanId: loan.id,
      amountCents: loan.principalCents,
      destination: {
        // SEC-036 — pass the verified PaymentMethod's providerToken so
        // the provider routes funds to the exact, attested instrument.
        // The userId stays for cross-checks the provider may run.
        kind: 'consumer_bank',
        userId: loan.userId,
        paymentMethodId: defaultMethod.id,
        providerToken: defaultMethod.providerToken,
      },
      metadata: { lenderOfRecord: loan.lenderOfRecord },
    });

    await this.recordDisbursement(loan, result);
  }

  /**
   * Stub for repayment collection. Wired to a daily cron / queue worker
   * in the next round; for MVP it's a manual call so we can exercise
   * the flow end-to-end.
   */
  async collectRepayment(repaymentId: string): Promise<ProviderResult> {
    const r = await this.prisma.repayment.findUnique({
      where: { id: repaymentId },
      include: { loan: { include: { application: { select: { merchantId: true } } } } },
    });
    if (!r) throw NotFound({ code: 'repayment_not_found' });
    if (r.status === 'paid') {
      throw Conflict({ code: 'repayment_already_paid' });
    }

    const method = await this.prisma.paymentMethod.findFirst({
      where: { userId: r.loan.userId, isDefault: true, status: 'verified' },
    });
    if (!method) {
      throw Conflict({
        code: 'no_verified_payment_method',
        detail: 'consumer must add and verify a payment method before collection',
      });
    }

    const remainingDue = r.amountDueCents - r.amountPaidCents;
    if (remainingDue <= 0n) {
      throw Conflict({ code: 'nothing_to_collect' });
    }

    const result = await this.provider.debit({
      idempotencyKey: `collect-${r.id}`,
      loanId: r.loanId,
      paymentMethodId: method.id,
      providerToken: method.providerToken,
      amountCents: remainingDue,
    });

    await this.prisma.$transaction(async (tx) => {
      const txRow = await tx.transaction.create({
        data: {
          loanId: r.loanId,
          paymentMethodId: method.id,
          repaymentId: r.id,
          direction: 'debit',
          amountCents: remainingDue,
          status:
            result.status === 'succeeded'
              ? 'succeeded'
              : result.status === 'pending'
                ? 'pending'
                : 'failed',
          providerRef: result.providerRef,
          settledAt: result.status === 'succeeded' ? new Date(result.settledAt) : null,
          failureReason: result.status === 'failed' ? result.reasonCode : null,
        },
      });

      if (result.status === 'succeeded') {
        await tx.repayment.update({
          where: { id: r.id },
          data: {
            amountPaidCents: r.amountPaidCents + remainingDue,
            status: 'paid',
            paidAt: new Date(),
          },
        });
      }

      await tx.auditOutbox.create({
        data: {
          actorType: 'service',
          actorId: null,
          action:
            result.status === 'succeeded'
              ? 'payment.repayment.collected'
              : 'payment.repayment.failed',
          targetType: 'Repayment',
          targetId: r.id,
          after: {
            transactionId: txRow.id,
            providerRef: result.providerRef,
            status: result.status,
          },
        },
      });
    });

    // Notify the consumer. Reason code surfaces to the user on failure
    // (with neutral language); reg E error-resolution UX deep-links from
    // the message body.
    const merchantId = r.loan.application?.merchantId ?? null;
    if (result.status === 'succeeded') {
      const remaining = await this.prisma.repayment.count({
        where: { loanId: r.loanId, status: { not: 'paid' } },
      });
      await this.fireNotify({
        userId: r.loan.userId,
        templateKey: 'payment.repayment.collected',
        payload: {
          amountCents: remainingDue.toString(),
          remainingPayments: remaining,
        },
        subjectType: 'Repayment',
        subjectId: r.id,
      });
      await this.fireWebhook({
        eventType: 'loan.repayment.collected',
        eventId: `loan.repayment.collected:${r.id}`,
        subjectType: 'Repayment',
        subjectId: r.id,
        merchantId,
        payload: {
          loanId: r.loanId,
          repaymentId: r.id,
          amountCents: remainingDue.toString(),
        },
      });
    } else if (result.status === 'failed') {
      await this.fireNotify({
        userId: r.loan.userId,
        templateKey: 'payment.repayment.failed',
        payload: {
          amountCents: remainingDue.toString(),
          reasonCode: result.reasonCode,
        },
        subjectType: 'Repayment',
        subjectId: r.id,
      });
      await this.fireWebhook({
        eventType: 'loan.repayment.failed',
        eventId: `loan.repayment.failed:${r.id}:${result.providerRef}`,
        subjectType: 'Repayment',
        subjectId: r.id,
        merchantId,
        payload: {
          loanId: r.loanId,
          repaymentId: r.id,
          amountCents: remainingDue.toString(),
          reasonCode: result.reasonCode,
        },
      });
    }

    return result;
  }

  async listRepayments(
    userId: UserId,
    loanId: LoanId,
  ): Promise<
    Array<{
      id: string;
      sequence: number;
      dueDate: string;
      amountDueCents: bigint;
      amountPaidCents: bigint;
      status: string;
      paidAt: string | null;
    }>
  > {
    await this.assertLoanOwner(userId, loanId);
    const repayments = await this.prisma.repayment.findMany({
      where: { loanId },
      orderBy: { sequence: 'asc' },
    });
    return repayments.map((r) => ({
      id: r.id,
      sequence: r.sequence,
      dueDate: r.dueDate.toISOString(),
      amountDueCents: r.amountDueCents,
      amountPaidCents: r.amountPaidCents,
      status: r.status,
      paidAt: r.paidAt?.toISOString() ?? null,
    }));
  }

  async getLoan(
    userId: UserId,
    loanId: LoanId,
  ): Promise<{
    id: string;
    applicationId: string;
    lenderOfRecord: string;
    principalCents: bigint;
    termMonths: number;
    aprBps: number;
    totalRepayableCents: bigint;
    status: string;
    disbursedAt: string | null;
    firstPaymentDate: string | null;
  }> {
    await this.assertLoanOwner(userId, loanId);
    const loan = await this.prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
    return {
      id: loan.id,
      applicationId: loan.applicationId,
      lenderOfRecord: loan.lenderOfRecord,
      principalCents: loan.principalCents,
      termMonths: loan.termMonths,
      aprBps: loan.aprBps,
      totalRepayableCents: loan.totalRepayableCents,
      status: loan.status,
      disbursedAt: loan.disbursedAt?.toISOString() ?? null,
      firstPaymentDate: loan.firstPaymentDate?.toISOString() ?? null,
    };
  }

  // -------------- internals --------------

  private async assertLoanOwner(userId: UserId, loanId: LoanId): Promise<void> {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, userId },
      select: { id: true },
    });
    if (!loan) throw NotFound({ code: 'loan_not_found' });
  }

  private async recordDisbursement(
    loan: {
      id: string;
      applicationId: string;
      userId: string;
      principalCents: bigint;
      totalRepayableCents: bigint;
      termMonths: number;
    },
    result: ProviderResult,
  ): Promise<void> {
    let firstPaymentDateIso: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          loanId: loan.id,
          direction: 'credit',
          amountCents: loan.principalCents,
          status:
            result.status === 'succeeded'
              ? 'succeeded'
              : result.status === 'pending'
                ? 'pending'
                : 'failed',
          providerRef: result.providerRef,
          settledAt: result.status === 'succeeded' ? new Date(result.settledAt) : null,
          failureReason: result.status === 'failed' ? result.reasonCode : null,
        },
      });

      if (result.status === 'succeeded') {
        const firstPaymentDate = this.firstPaymentDateFromNow();
        firstPaymentDateIso = firstPaymentDate.toISOString().slice(0, 10);
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            status: 'active',
            disbursedAt: new Date(result.settledAt),
            firstPaymentDate,
          },
        });
        await tx.application.update({
          where: { id: loan.applicationId },
          data: { status: 'active' },
        });

        await this.scheduleRepaymentsTx(tx, {
          loanId: loan.id,
          totalRepayableCents: loan.totalRepayableCents,
          termMonths: loan.termMonths,
          firstPaymentDate,
        });

        await tx.auditOutbox.create({
          data: {
            actorType: 'service',
            actorId: null,
            action: 'application.funded',
            targetType: 'Application',
            targetId: loan.applicationId,
            after: { providerRef: result.providerRef },
          },
        });
      } else if (result.status === 'failed') {
        // Roll application status back so a retry is possible. The Loan
        // row stays funding_pending (it never moved).
        await tx.application.update({
          where: { id: loan.applicationId },
          data: { status: 'contracted' },
        });
        await tx.auditOutbox.create({
          data: {
            actorType: 'service',
            actorId: null,
            action: 'application.funding_failed',
            targetType: 'Application',
            targetId: loan.applicationId,
            after: { providerRef: result.providerRef, reasonCode: result.reasonCode },
          },
        });
      }
    });

    // Notify post-commit. Failure here doesn't roll back disbursement.
    const appForMerchant = await this.prisma.application.findUnique({
      where: { id: loan.applicationId },
      select: { merchantId: true },
    });
    const merchantId = appForMerchant?.merchantId ?? null;
    if (result.status === 'succeeded') {
      await this.fireNotify({
        userId: loan.userId,
        templateKey: 'application.funded',
        payload: {
          principalCents: loan.principalCents.toString(),
          firstPaymentDate: firstPaymentDateIso,
        },
        subjectType: 'Loan',
        subjectId: loan.id,
      });
      await this.fireWebhook({
        eventType: 'application.funded',
        eventId: `application.funded:${loan.applicationId}`,
        subjectType: 'Application',
        subjectId: loan.applicationId,
        merchantId,
        payload: {
          loanId: loan.id,
          principalCents: loan.principalCents.toString(),
          firstPaymentDate: firstPaymentDateIso,
        },
      });
    } else if (result.status === 'failed') {
      await this.fireNotify({
        userId: loan.userId,
        templateKey: 'application.funding_failed',
        payload: { reasonCode: result.reasonCode },
        subjectType: 'Loan',
        subjectId: loan.id,
      });
      await this.fireWebhook({
        eventType: 'application.funding_failed',
        eventId: `application.funding_failed:${loan.applicationId}:${result.providerRef}`,
        subjectType: 'Application',
        subjectId: loan.applicationId,
        merchantId,
        payload: { reasonCode: result.reasonCode, loanId: loan.id },
      });
    }
  }

  /**
   * Synthetic equal-payment schedule. totalRepayable / termMonths,
   * remainder absorbed into the last installment. Real amortization
   * (per-month P/I split) lands when services/contract renders the
   * Reg Z payment schedule. The amounts here are still correct in
   * aggregate — only the per-period decomposition is approximate.
   */
  private async scheduleRepaymentsTx(
    tx: Prisma.TransactionClient,
    args: {
      loanId: string;
      totalRepayableCents: bigint;
      termMonths: number;
      firstPaymentDate: Date;
    },
  ): Promise<void> {
    const term = BigInt(args.termMonths);
    const baseInstallment = args.totalRepayableCents / term;
    const remainder = args.totalRepayableCents - baseInstallment * term;

    for (let i = 0; i < args.termMonths; i++) {
      const sequence = i + 1;
      const amountDue =
        sequence === args.termMonths ? baseInstallment + remainder : baseInstallment;
      const dueDate = this.addMonthsUtc(args.firstPaymentDate, i);
      await tx.repayment.create({
        data: {
          loanId: args.loanId,
          sequence,
          dueDate,
          amountDueCents: amountDue,
        },
      });
    }
  }

  private firstPaymentDateFromNow(): Date {
    // First payment ~30 days out. Real product uses billing-cycle math
    // and consumer-selected anchor; this is a placeholder.
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 30);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private addMonthsUtc(start: Date, n: number): Date {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d;
  }
}
