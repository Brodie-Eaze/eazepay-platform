import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { Conflict, NotFound } from '@eazepay/shared-utils';
import type { LoanId, UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type ProviderResult,
} from './ports/payment-provider.port.js';

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
  ) {}

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
        // Real destination is the consumer's verified bank account. For
        // the dev mock, anything routes; for production, look up the
        // PaymentMethod row + provider token here.
        kind: 'consumer_bank',
        userId: loan.userId,
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
      include: { loan: true },
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
          status: result.status === 'succeeded' ? 'succeeded' : result.status === 'pending' ? 'pending' : 'failed',
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
          action: result.status === 'succeeded' ? 'payment.repayment.collected' : 'payment.repayment.failed',
          targetType: 'Repayment',
          targetId: r.id,
          after: { transactionId: txRow.id, providerRef: result.providerRef, status: result.status },
        },
      });
    });

    return result;
  }

  async listRepayments(userId: UserId, loanId: LoanId): Promise<Array<{
    id: string;
    sequence: number;
    dueDate: string;
    amountDueCents: bigint;
    amountPaidCents: bigint;
    status: string;
    paidAt: string | null;
  }>> {
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

  async getLoan(userId: UserId, loanId: LoanId): Promise<{
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
    loan: { id: string; applicationId: string; principalCents: bigint; totalRepayableCents: bigint; termMonths: number },
    result: ProviderResult,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          loanId: loan.id,
          direction: 'credit',
          amountCents: loan.principalCents,
          status: result.status === 'succeeded' ? 'succeeded' : result.status === 'pending' ? 'pending' : 'failed',
          providerRef: result.providerRef,
          settledAt: result.status === 'succeeded' ? new Date(result.settledAt) : null,
          failureReason: result.status === 'failed' ? result.reasonCode : null,
        },
      });

      if (result.status === 'succeeded') {
        const firstPaymentDate = this.firstPaymentDateFromNow();
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
