/**
 * Payment service outbox-enqueue specs (fix/payment-outbox-wiring).
 *
 * The Reg E silent-drop fix moves notify + webhook side-effects from
 * fire-and-forget post-commit into transactional enqueues via
 * `enqueueOutboxPrisma(tx, ...)`. These specs pin the resulting
 * invariants:
 *
 *   1. collectRepayment FAILURE path enqueues BOTH `notification.send`
 *      and `webhook.outbound` rows for `payment.repayment.failed` /
 *      `loan.repayment.failed`, INSIDE the prisma.$transaction that
 *      wrote the audit + transaction rows. (THE Reg E gap.)
 *
 *   2. collectRepayment SUCCESS path enqueues the matching
 *      `payment.repayment.collected` + `loan.repayment.collected`
 *      rows, also inside the tx.
 *
 *   3. recordDisbursement SUCCESS enqueues
 *      `application.funded` notify + `application.funded` webhook
 *      inside the tx.
 *
 *   4. Tx rollback property: when ANY in-tx write throws, NO outbox
 *      rows persist — they roll back atomically with the failed
 *      business write. The pre-fix fire-and-forget path violated this
 *      (audit row could roll back while the notify ghost-fired).
 *
 *   5. webhook enqueue is skipped when `merchantId` is null
 *      (publisher would no-op anyway; we don't pad the drain queue).
 *
 * Mocking posture: the spec stands up a minimal in-memory tx that
 * tracks every model.create call. `prisma.$transaction(fn)` accepts a
 * `(tx) => Promise<T>` and we route tx.* to the same recorder so the
 * assertions can read what was written. A tx that throws clears the
 * recorder before re-throw to simulate ROLLBACK.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentService } from '../src/payment.service.js';
import type { PaymentProvider, ProviderResult } from '../src/ports/payment-provider.port.js';
import type { BankAccountProvider } from '../src/ports/bank-account-provider.port.js';

interface TxRecord {
  model: string;
  data: Record<string, unknown>;
}

interface RepaymentRow {
  id: string;
  loanId: string;
  status: 'scheduled' | 'paid';
  amountDueCents: bigint;
  amountPaidCents: bigint;
  loan: {
    userId: string;
    application: { merchantId: string | null } | null;
  };
}

interface LoanRow {
  id: string;
  applicationId: string;
  userId: string;
  principalCents: bigint;
  totalRepayableCents: bigint;
  termMonths: number;
}

/**
 * Build a Prisma stub whose `$transaction(fn)` runs the function with
 * a `tx` that records every `<model>.create` call. Any throw inside
 * the transaction body clears the recorder before re-throwing —
 * mirroring Postgres ROLLBACK semantics so the rollback spec can
 * assert that NO rows persisted.
 *
 * The non-tx surface is also exposed for the read calls
 * collectRepayment / recordDisbursement make BEFORE entering the tx
 * (paymentMethod.findFirst, repayment.findUnique,
 * application.findUnique).
 */
function makePrismaStub(opts: {
  repayment?: RepaymentRow;
  defaultMethod?: { id: string; providerToken: string };
  application?: { merchantId: string | null };
  // Optional: cause the named model's `.create` to throw on the Nth
  // call so we can test ROLLBACK.
  throwOnCreate?: { model: string; nthCall: number };
}) {
  const committed: TxRecord[] = [];

  // Repayment.count is called inside the tx on the success branch
  // for `remainingPayments` rendering. Returns a deterministic 0 so
  // the assertion shape stays stable.
  const repaymentCount = vi.fn(async () => 0);

  function makeTx(uncommitted: TxRecord[]): unknown {
    const counts: Record<string, number> = {};
    const makeCreate = (model: string) =>
      vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        counts[model] = (counts[model] ?? 0) + 1;
        if (
          opts.throwOnCreate &&
          opts.throwOnCreate.model === model &&
          opts.throwOnCreate.nthCall === counts[model]
        ) {
          throw new Error(`forced_${model}_create_failure`);
        }
        uncommitted.push({ model, data });
        const id = `${model}_${counts[model]}_${Math.random().toString(36).slice(2, 8)}`;
        return { id, ...data };
      });

    return {
      transaction: { create: makeCreate('transaction') },
      repayment: {
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          uncommitted.push({ model: 'repayment.update', data });
          return { id: 'r_updated' };
        }),
        count: repaymentCount,
        create: makeCreate('repayment'),
      },
      auditOutbox: { create: makeCreate('auditOutbox') },
      outboxEvent: { create: makeCreate('outboxEvent') },
      loan: {
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          uncommitted.push({ model: 'loan.update', data });
          return { id: 'l_updated' };
        }),
      },
      application: {
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          uncommitted.push({ model: 'application.update', data });
          return { id: 'app_updated' };
        }),
      },
    };
  }

  const prisma = {
    repayment: {
      findUnique: vi.fn(async () => opts.repayment ?? null),
      count: repaymentCount,
    },
    paymentMethod: {
      findFirst: vi.fn(async () =>
        opts.defaultMethod ? { ...opts.defaultMethod, status: 'verified', isDefault: true } : null,
      ),
    },
    application: {
      findUnique: vi.fn(async () => opts.application ?? null),
    },
    $transaction: vi.fn(async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      // Each tx attempt gets its own uncommitted buffer. On COMMIT
      // we flush into the committed log; a throw drops the buffer
      // (ROLLBACK) and propagates so the caller sees the same error
      // shape as a real Prisma tx.
      const uncommitted: TxRecord[] = [];
      const result = await fn(makeTx(uncommitted));
      committed.push(...uncommitted);
      return result;
    }),
  };

  return { prisma, committed };
}

function makeProviderResult(
  status: 'succeeded' | 'failed',
  overrides?: {
    reasonCode?: string;
    providerRef?: string;
  },
): ProviderResult {
  if (status === 'succeeded') {
    return {
      status: 'succeeded',
      providerRef: overrides?.providerRef ?? 'mock-ref-1',
      settledAt: '2026-05-27T00:00:00.000Z',
    };
  }
  return {
    status: 'failed',
    providerRef: overrides?.providerRef ?? 'mock-ref-1',
    reasonCode: overrides?.reasonCode ?? 'NSF',
  };
}

const mockBank: BankAccountProvider = {
  name: 'mock',
  exchange: vi.fn(),
};

describe('PaymentService.collectRepayment — outbox enqueue (Reg E fix)', () => {
  const repayment: RepaymentRow = {
    id: 'r_abc',
    loanId: 'loan_42',
    status: 'scheduled',
    amountDueCents: 12_500n,
    amountPaidCents: 0n,
    loan: {
      userId: 'u_x',
      application: { merchantId: 'merchant_uuid_1' },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FAILURE path enqueues notification.send + webhook.outbound for repayment.failed (THE Reg E gap)', async () => {
    const debit = vi.fn(async () => makeProviderResult('failed', { reasonCode: 'NSF' }));
    const provider: PaymentProvider = {
      disburse: vi.fn(),
      debit,
    };
    const { prisma, committed } = makePrismaStub({
      repayment,
      defaultMethod: { id: 'pm_1', providerToken: 'tok_1' },
    });
    const svc = new PaymentService(prisma as never, provider, mockBank);

    const result = await svc.collectRepayment(repayment.id);
    expect(result.status).toBe('failed');

    // The Reg E invariant: outbox enqueues happen INSIDE the tx that
    // wrote the failure audit row. After commit, all four should
    // appear in `committed` in order.
    const outboxRows = committed.filter((r) => r.model === 'outboxEvent');
    expect(outboxRows).toHaveLength(2);

    const notifyRow = outboxRows.find(
      (r) => (r.data as { kind: string }).kind === 'notification.send',
    );
    expect(notifyRow).toBeDefined();
    expect(notifyRow!.data).toMatchObject({
      kind: 'notification.send',
      payloadJson: {
        kind: 'notification.send',
        userId: 'u_x',
        templateKey: 'payment.repayment.failed',
        payload: { amountCents: '12500', reasonCode: 'NSF' },
        subjectType: 'Repayment',
        subjectId: 'r_abc',
      },
    });

    const webhookRow = outboxRows.find(
      (r) => (r.data as { kind: string }).kind === 'webhook.outbound',
    );
    expect(webhookRow).toBeDefined();
    expect(webhookRow!.data).toMatchObject({
      kind: 'webhook.outbound',
      payloadJson: {
        kind: 'webhook.outbound',
        eventType: 'loan.repayment.failed',
        // eventId must include providerRef so a retry collapses to
        // the same downstream delivery row (eventId is the dedup key).
        eventId: 'loan.repayment.failed:r_abc:mock-ref-1',
        subjectType: 'Repayment',
        subjectId: 'r_abc',
        merchantId: 'merchant_uuid_1',
        payload: {
          loanId: 'loan_42',
          repaymentId: 'r_abc',
          amountCents: '12500',
          reasonCode: 'NSF',
        },
      },
    });

    // Sanity: the audit row was also written inside the same commit.
    const auditRow = committed.find(
      (r) =>
        r.model === 'auditOutbox' &&
        (r.data as { action: string }).action === 'payment.repayment.failed',
    );
    expect(auditRow).toBeDefined();
  });

  it('SUCCESS path enqueues notification.send + webhook.outbound for repayment.collected', async () => {
    const debit = vi.fn(async () => makeProviderResult('succeeded'));
    const provider: PaymentProvider = { disburse: vi.fn(), debit };
    const { prisma, committed } = makePrismaStub({
      repayment,
      defaultMethod: { id: 'pm_1', providerToken: 'tok_1' },
    });

    const svc = new PaymentService(prisma as never, provider, mockBank);
    const result = await svc.collectRepayment(repayment.id);
    expect(result.status).toBe('succeeded');

    const outboxRows = committed.filter((r) => r.model === 'outboxEvent');
    expect(outboxRows).toHaveLength(2);

    const notifyRow = outboxRows.find(
      (r) => (r.data as { kind: string }).kind === 'notification.send',
    );
    expect(notifyRow!.data).toMatchObject({
      payloadJson: { templateKey: 'payment.repayment.collected' },
    });

    const webhookRow = outboxRows.find(
      (r) => (r.data as { kind: string }).kind === 'webhook.outbound',
    );
    expect(webhookRow!.data).toMatchObject({
      payloadJson: { eventType: 'loan.repayment.collected' },
    });
  });

  it('skips the webhook enqueue when merchantId is null (no fan-out target)', async () => {
    const orphanRepayment: RepaymentRow = {
      ...repayment,
      loan: { ...repayment.loan, application: { merchantId: null } },
    };
    const debit = vi.fn(async () => makeProviderResult('failed'));
    const provider: PaymentProvider = { disburse: vi.fn(), debit };
    const { prisma, committed } = makePrismaStub({
      repayment: orphanRepayment,
      defaultMethod: { id: 'pm_1', providerToken: 'tok_1' },
    });

    const svc = new PaymentService(prisma as never, provider, mockBank);
    await svc.collectRepayment(repayment.id);

    const outboxRows = committed.filter((r) => r.model === 'outboxEvent');
    // Notify still fires (consumer still needs to be told); webhook
    // does not (no merchant subscribed).
    expect(outboxRows).toHaveLength(1);
    expect((outboxRows[0]!.data as { kind: string }).kind).toBe('notification.send');
  });

  it('ROLLBACK: a mid-tx failure drops every enqueued outbox row (atomic with business write)', async () => {
    const debit = vi.fn(async () => makeProviderResult('failed'));
    const provider: PaymentProvider = { disburse: vi.fn(), debit };
    // Force `auditOutbox.create` to throw — this runs BEFORE the
    // outbox enqueues in collectRepayment's tx body, so the
    // outbox writes never get a chance to land. The point of the
    // spec is to lock in that when ANYTHING inside the tx throws,
    // the whole bundle (audit + outbox + transaction row + repayment
    // update) rolls back as a unit.
    const { prisma, committed } = makePrismaStub({
      repayment,
      defaultMethod: { id: 'pm_1', providerToken: 'tok_1' },
      throwOnCreate: { model: 'auditOutbox', nthCall: 1 },
    });

    const svc = new PaymentService(prisma as never, provider, mockBank);
    await expect(svc.collectRepayment(repayment.id)).rejects.toThrow(
      /forced_auditOutbox_create_failure/,
    );

    // The committed log MUST be empty — no audit, no transaction, no
    // outbox row, no repayment update. Pre-fix the notify path would
    // have ghost-fired here; the fix is exactly that it cannot,
    // because there is no separate post-commit step.
    expect(committed.filter((r) => r.model === 'outboxEvent')).toHaveLength(0);
    expect(committed).toHaveLength(0);
  });
});

describe('PaymentService.recordDisbursement (via internal exposure) — outbox enqueue', () => {
  // recordDisbursement is private but reachable through
  // disburseAndSchedule. We bypass the upstream provider call by
  // shaping the mock provider's disburse() to return a deterministic
  // result, and stub the loan / paymentMethod reads to hit the
  // recordDisbursement path with the expected loan shape.

  const loan: LoanRow = {
    id: 'loan_42',
    applicationId: 'app_77',
    userId: 'u_x',
    principalCents: 100_000n,
    totalRepayableCents: 110_000n,
    termMonths: 6,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SUCCESS enqueues application.funded notify + webhook inside the same tx', async () => {
    const provider: PaymentProvider = {
      disburse: vi.fn(async () => makeProviderResult('succeeded', { providerRef: 'pay_ref_xyz' })),
      debit: vi.fn(),
    };

    // Compose a prisma stub that also satisfies disburseAndSchedule's
    // pre-tx reads (loan.findUnique, paymentMethod.findFirst,
    // application status, etc.).
    const { prisma, committed } = makePrismaStub({
      defaultMethod: { id: 'pm_1', providerToken: 'tok_1' },
      application: { merchantId: 'merchant_uuid_1' },
    });
    // Extend the base stub with the reads disburseAndSchedule needs
    // before recordDisbursement.
    (prisma as unknown as Record<string, unknown>).loan = {
      findUnique: vi.fn(async () => ({
        ...loan,
        status: 'funding_pending',
        lenderOfRecord: 'lender_x',
        application: { id: loan.applicationId, status: 'funding' },
      })),
    };
    (prisma as unknown as Record<string, unknown>).auditOutbox = {
      create: vi.fn(async () => ({ id: 'audit_pre_tx' })),
    };

    const svc = new PaymentService(prisma as never, provider, mockBank);
    await svc.disburseAndSchedule(loan.id);

    // Two outbox rows from recordDisbursement's success branch:
    // notification.send (application.funded) + webhook.outbound
    // (application.funded). Both committed in the SAME tx as the
    // loan/application updates + audit row.
    const outboxRows = committed.filter((r) => r.model === 'outboxEvent');
    expect(outboxRows).toHaveLength(2);

    const notifyRow = outboxRows.find(
      (r) => (r.data as { kind: string }).kind === 'notification.send',
    );
    expect(notifyRow!.data).toMatchObject({
      payloadJson: {
        kind: 'notification.send',
        userId: 'u_x',
        templateKey: 'application.funded',
        subjectType: 'Loan',
        subjectId: 'loan_42',
      },
    });

    const webhookRow = outboxRows.find(
      (r) => (r.data as { kind: string }).kind === 'webhook.outbound',
    );
    expect(webhookRow!.data).toMatchObject({
      payloadJson: {
        kind: 'webhook.outbound',
        eventType: 'application.funded',
        eventId: 'application.funded:app_77',
        merchantId: 'merchant_uuid_1',
      },
    });
  });

  it('ROLLBACK: a mid-tx loan.update throw drops the outbox row too (notify cannot ghost-fire)', async () => {
    const provider: PaymentProvider = {
      disburse: vi.fn(async () => makeProviderResult('succeeded', { providerRef: 'pay_ref_xyz' })),
      debit: vi.fn(),
    };

    const { prisma, committed } = makePrismaStub({
      defaultMethod: { id: 'pm_1', providerToken: 'tok_1' },
      application: { merchantId: 'merchant_uuid_1' },
    });
    (prisma as unknown as Record<string, unknown>).loan = {
      findUnique: vi.fn(async () => ({
        ...loan,
        status: 'funding_pending',
        lenderOfRecord: 'lender_x',
        application: { id: loan.applicationId, status: 'funding' },
      })),
    };
    (prisma as unknown as Record<string, unknown>).auditOutbox = {
      create: vi.fn(async () => ({ id: 'audit_pre_tx' })),
    };

    // Override the in-tx loan.update to throw — the success branch
    // calls loan.update first; throwing there leaves the
    // outbox enqueues untouched and the tx rolls back. We assert
    // the committed log has NO outbox rows for this loan.
    const origTransaction = prisma.$transaction;
    prisma.$transaction = vi.fn(async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      return origTransaction.call(prisma, async (tx: unknown) => {
        const wrappedTx = tx as Record<string, { update?: unknown }>;
        const realLoanUpdate = (wrappedTx.loan as { update: (args: unknown) => Promise<unknown> })
          .update;
        // First loan.update call throws (the funding-success-branch call).
        let calls = 0;
        (wrappedTx.loan as { update: (args: unknown) => Promise<unknown> }).update = async (
          args: unknown,
        ) => {
          calls += 1;
          if (calls === 1) throw new Error('forced_loan_update_failure');
          return realLoanUpdate.call(wrappedTx.loan, args);
        };
        return fn(tx);
      });
    });

    const svc = new PaymentService(prisma as never, provider, mockBank);
    await expect(svc.disburseAndSchedule(loan.id)).rejects.toThrow(/forced_loan_update_failure/);

    const outboxRows = committed.filter((r) => r.model === 'outboxEvent');
    expect(outboxRows).toHaveLength(0);
  });
});
