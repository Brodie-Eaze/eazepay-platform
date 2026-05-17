import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
// Value import (not type-only): NestJS DI resolves constructor params
// via emitted decorator metadata, which requires a runtime reference.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PiiVaultService } from '@eazepay/service-user';
import { ACTIVITY_SOURCE, CONFIRM_TOKEN_TTL_HOURS, PRISMA } from './internal/tokens.js';
import { parseMonthlyPeriod } from './internal/period.js';
import type { ActivitySource } from './ports/activity-source.port.js';

/**
 * BillingService — domain logic for platform-fee invoicing.
 *
 * Every mutation:
 *   1) validates inputs (DTOs at the controller boundary do this first)
 *   2) checks ownership/role at the call site (controller-applied guards)
 *   3) writes the change inside a Prisma transaction
 *   4) writes an InvoiceActivity row in the SAME transaction so we
 *      never have a state change without a matching audit entry
 *
 * Encryption posture:
 *   - BillingConfig.sendToEmail is envelope-encrypted via
 *     PiiVaultService.sealOpaque, AAD =
 *     `{entity:billing_config, field:sendToEmail, merchantId}`.
 *   - Confirm tokens are 32-byte random base64url; the column has a
 *     unique index. Single-use semantic enforced by checking state
 *     before accepting a decision.
 */

const VERTICAL_FEE_BPS: Record<string, number> = {
  MedPay: 350,
  TradePay: 500,
  CoachPay: 600,
  'Multi-brand': 450,
};

const DEFAULT_FEE_BPS = 450;

function effectiveFeeBpsFor(product: string | null | undefined): number {
  if (!product) return DEFAULT_FEE_BPS;
  return VERTICAL_FEE_BPS[product] ?? DEFAULT_FEE_BPS;
}

function buildInvoiceNo(periodId: string, merchantId: string): string {
  return `INV-${periodId}-${merchantId}`;
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly vault: PiiVaultService,
    @Inject(ACTIVITY_SOURCE) private readonly activity: ActivitySource,
    @Inject(CONFIRM_TOKEN_TTL_HOURS) private readonly tokenTtlHours: number,
  ) {}

  /* ─── Billing configs ───────────────────────────────────────── */

  async listConfigs() {
    const configs = await this.prisma.billingConfig.findMany({
      include: { merchant: { select: { id: true, legalName: true, brand: true } } },
    });
    return Promise.all(
      configs.map(async (c) => ({
        merchantId: c.merchantId,
        merchantName: c.merchant.legalName,
        cycle: c.cycle,
        dayOfPeriod: c.dayOfPeriod,
        autoSend: c.autoSend,
        paymentLinkTemplate: c.paymentLinkTemplate ?? null,
        note: c.note ?? null,
        sendToEmail: c.sendToEmailEnc
          ? (
              await this.vault.openOpaque(c.sendToEmailEnc, {
                entity: 'billing_config',
                field: 'sendToEmail',
                merchantId: c.merchantId,
              })
            ).toString('utf8')
          : null,
        updatedAt: c.updatedAt.toISOString(),
      })),
    );
  }

  async patchConfig(
    merchantId: string,
    patch: {
      cycle?: 'monthly' | 'weekly' | 'paused';
      dayOfPeriod?: number;
      sendToEmail?: string; // empty string = clear
      autoSend?: boolean;
      paymentLinkTemplate?: string; // empty string = clear
      note?: string;
    },
    actor: { id: string; label: string },
  ) {
    // Verify merchant exists — guards against typo'd ids from the UI
    // turning into config rows for non-existent merchants.
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundException(`merchant ${merchantId} not found`);

    const update: Record<string, unknown> = {};
    if (patch.cycle !== undefined) update.cycle = patch.cycle;
    if (patch.dayOfPeriod !== undefined) update.dayOfPeriod = patch.dayOfPeriod;
    if (patch.autoSend !== undefined) update.autoSend = patch.autoSend;
    if (patch.note !== undefined) update.note = patch.note || null;
    if (patch.paymentLinkTemplate !== undefined) {
      update.paymentLinkTemplate = patch.paymentLinkTemplate || null;
    }
    if (patch.sendToEmail !== undefined) {
      if (patch.sendToEmail === '') {
        update.sendToEmailEnc = null;
      } else {
        update.sendToEmailEnc = await this.vault.sealOpaque(patch.sendToEmail, {
          entity: 'billing_config',
          field: 'sendToEmail',
          merchantId,
        });
      }
    }
    update.updatedById = actor.id;

    const saved = await this.prisma.billingConfig.upsert({
      where: { merchantId },
      update,
      create: {
        merchantId,
        cycle: patch.cycle ?? 'monthly',
        dayOfPeriod: patch.dayOfPeriod ?? 1,
        autoSend: patch.autoSend ?? false,
        paymentLinkTemplate: patch.paymentLinkTemplate || null,
        note: patch.note || null,
        sendToEmailEnc:
          patch.sendToEmail && patch.sendToEmail !== ''
            ? await this.vault.sealOpaque(patch.sendToEmail, {
                entity: 'billing_config',
                field: 'sendToEmail',
                merchantId,
              })
            : null,
        updatedById: actor.id,
      },
    });
    return { id: saved.id, merchantId: saved.merchantId };
  }

  /* ─── Generate from activity ────────────────────────────────── */

  /** Pure preview — no writes. Returns counts + per-merchant rows. */
  async previewGenerate(periodId: string) {
    const period = parseMonthlyPeriod(periodId);
    const [merchants, existing, configs] = await Promise.all([
      this.prisma.merchant.findMany({ select: { id: true, legalName: true, brand: true } }),
      this.prisma.invoice.findMany({
        where: { periodId },
        select: { merchantId: true },
      }),
      this.prisma.billingConfig.findMany({
        select: { merchantId: true, cycle: true },
      }),
    ]);
    const existingByMerchant = new Set(existing.map((i) => i.merchantId));
    const pausedByMerchant = new Set(
      configs.filter((c) => c.cycle === 'paused').map((c) => c.merchantId),
    );

    const perMerchant: Array<{
      merchantId: string;
      merchant: string;
      grossFundedCents: string;
      feeAmountCents: string;
      alreadyExists: boolean;
      paused: boolean;
    }> = [];

    let toCreate = 0;
    let totalFee = 0n;
    let alreadyExistsCount = 0;
    let pausedCount = 0;

    for (const m of merchants) {
      const gross = await this.activity.grossFundedCentsForPeriod(m.id, period.start, period.end);
      const feeBps = effectiveFeeBpsFor(m.brand);
      const amount = (gross * BigInt(feeBps)) / 10000n;
      const existed = existingByMerchant.has(m.id);
      const paused = pausedByMerchant.has(m.id);
      if (paused) pausedCount++;
      else if (existed) alreadyExistsCount++;
      else {
        toCreate++;
        totalFee += amount;
      }
      perMerchant.push({
        merchantId: m.id,
        merchant: m.legalName,
        grossFundedCents: gross.toString(),
        feeAmountCents: amount.toString(),
        alreadyExists: existed,
        paused,
      });
    }

    return {
      periodId,
      toCreate,
      alreadyExists: alreadyExistsCount,
      paused: pausedCount,
      totalFeeCents: totalFee.toString(),
      perMerchant,
    };
  }

  /** Materialise drafts for non-paused, not-already-invoiced merchants. */
  async runGenerate(periodId: string, actor: { id: string; label: string }) {
    const period = parseMonthlyPeriod(periodId);
    const [merchants, existing, configs] = await Promise.all([
      this.prisma.merchant.findMany({ select: { id: true, brand: true } }),
      this.prisma.invoice.findMany({
        where: { periodId },
        select: { merchantId: true },
      }),
      this.prisma.billingConfig.findMany({
        select: { merchantId: true, cycle: true, autoSend: true },
      }),
    ]);
    const existingByMerchant = new Set(existing.map((i) => i.merchantId));
    const configsByMerchant = new Map(configs.map((c) => [c.merchantId, c]));

    const created: string[] = [];
    let skippedPaused = 0;
    let skippedExisting = 0;

    for (const m of merchants) {
      if (existingByMerchant.has(m.id)) {
        skippedExisting++;
        continue;
      }
      const cfg = configsByMerchant.get(m.id);
      if (cfg?.cycle === 'paused') {
        skippedPaused++;
        continue;
      }
      const gross = await this.activity.grossFundedCentsForPeriod(m.id, period.start, period.end);
      if (gross === 0n) continue;
      const feeBps = effectiveFeeBpsFor(m.brand);
      const amount = (gross * BigInt(feeBps)) / 10000n;
      const invoiceNo = buildInvoiceNo(periodId, m.id);
      const status: 'draft' | 'sent' = cfg?.autoSend ? 'sent' : 'draft';
      await this.prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            invoiceNo,
            merchantId: m.id,
            billingConfigId: cfg ? undefined : undefined,
            periodId,
            periodLabel: period.label,
            periodStart: period.start,
            periodEnd: period.end,
            grossFundedCents: gross,
            feeBps,
            amountCents: amount,
            status,
            dueDate: period.defaultDue,
          },
        });
        await tx.invoiceActivity.create({
          data: {
            invoiceId: inv.id,
            kind: 'generated',
            actorLabel: actor.label,
            actorId: actor.id,
            summary: `Generated from activity for ${period.label} · gross ${gross.toString()} × ${feeBps}bps = ${amount.toString()}`,
          },
        });
        if (status === 'sent') {
          await tx.invoiceActivity.create({
            data: {
              invoiceId: inv.id,
              kind: 'status_change',
              actorLabel: actor.label,
              actorId: actor.id,
              summary: 'Status → sent (auto-send enabled)',
            },
          });
        }
      });
      created.push(invoiceNo);
    }

    return { created, skipped: { paused: skippedPaused, existing: skippedExisting } };
  }

  /* ─── Invoice queries ───────────────────────────────────────── */

  async listInvoices(query: {
    periodId?: string;
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'voided';
    merchantId?: string;
    limit: number;
  }) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        periodId: query.periodId,
        status: query.status,
        merchantId: query.merchantId,
      },
      include: {
        merchant: { select: { id: true, legalName: true, brand: true, slug: true } },
        payments: { orderBy: { recordedAt: 'asc' } },
      },
      orderBy: [{ amountCents: 'desc' }],
      take: query.limit,
    });
    return invoices.map((i) => ({
      id: i.id,
      invoiceNo: i.invoiceNo,
      merchantId: i.merchantId,
      merchant: i.merchant.legalName,
      vertical: i.merchant.brand,
      periodId: i.periodId,
      periodLabel: i.periodLabel,
      grossFundedCents: i.grossFundedCents.toString(),
      feeBps: i.feeBps,
      amountCents: i.amountCents.toString(),
      paidCents: i.payments.reduce((s, p) => s + p.amountCents, 0n).toString(),
      status: i.status,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      voided: !!i.voidedAt,
      voidReason: i.voidReason ?? null,
    }));
  }

  async getInvoice(invoiceNo: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { invoiceNo },
      include: {
        merchant: { select: { id: true, legalName: true, brand: true, slug: true } },
        payments: { orderBy: { recordedAt: 'asc' } },
        activity: { orderBy: { at: 'desc' }, take: 50 },
      },
    });
    if (!inv) throw new NotFoundException(`invoice ${invoiceNo} not found`);
    return inv;
  }

  /* ─── Invoice mutations ─────────────────────────────────────── */

  private async mutateInvoice<T>(
    invoiceNo: string,
    actor: { id: string; label: string },
    kind:
      | 'status_change'
      | 'fee_pct_change'
      | 'fee_amount_change'
      | 'due_date_change'
      | 'voided'
      | 'unvoided'
      | 'email_composed',
    summary: string,
    mutate: (
      tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
      inv: { id: string; invoiceNo: string },
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { invoiceNo },
        select: { id: true, invoiceNo: true, voidedAt: true },
      });
      if (!inv) throw new NotFoundException(`invoice ${invoiceNo} not found`);
      if (inv.voidedAt && kind !== 'unvoided') {
        throw new ConflictException(`invoice ${invoiceNo} is voided`);
      }
      const result = await mutate(tx, inv);
      await tx.invoiceActivity.create({
        data: {
          invoiceId: inv.id,
          kind,
          actorLabel: actor.label,
          actorId: actor.id,
          summary,
        },
      });
      return result;
    });
  }

  async setStatus(
    invoiceNo: string,
    status: 'draft' | 'sent' | 'paid' | 'overdue',
    actor: { id: string; label: string },
  ) {
    return this.mutateInvoice(
      invoiceNo,
      actor,
      'status_change',
      `Status → ${status}`,
      async (tx, inv) => {
        await tx.invoice.update({ where: { id: inv.id }, data: { status } });
        return { invoiceNo, status };
      },
    );
  }

  async setFeePct(invoiceNo: string, feePct: number, actor: { id: string; label: string }) {
    const feeBps = Math.round(feePct * 100);
    return this.mutateInvoice(
      invoiceNo,
      actor,
      'fee_pct_change',
      `Fee → ${feePct.toFixed(2)}%`,
      async (tx, inv) => {
        // Recompute amount from grossFundedCents × new feeBps unless
        // an explicit amount override was already in place. We detect
        // override by checking whether the current amount matches
        // (gross * oldFeeBps / 10000). If not, leave amount untouched.
        const cur = await tx.invoice.findUniqueOrThrow({
          where: { id: inv.id },
          select: { grossFundedCents: true, feeBps: true, amountCents: true },
        });
        const wasComputed =
          cur.amountCents === (cur.grossFundedCents * BigInt(cur.feeBps)) / 10000n;
        const newAmount = wasComputed
          ? (cur.grossFundedCents * BigInt(feeBps)) / 10000n
          : cur.amountCents;
        await tx.invoice.update({
          where: { id: inv.id },
          data: { feeBps, amountCents: newAmount },
        });
        return { invoiceNo, feeBps };
      },
    );
  }

  async setAmount(invoiceNo: string, amountCents: number, actor: { id: string; label: string }) {
    return this.mutateInvoice(
      invoiceNo,
      actor,
      'fee_amount_change',
      `Amount → ${amountCents}`,
      async (tx, inv) => {
        await tx.invoice.update({
          where: { id: inv.id },
          data: { amountCents: BigInt(amountCents) },
        });
        return { invoiceNo, amountCents };
      },
    );
  }

  async setDueDate(invoiceNo: string, dueDate: string, actor: { id: string; label: string }) {
    return this.mutateInvoice(
      invoiceNo,
      actor,
      'due_date_change',
      `Due → ${dueDate}`,
      async (tx, inv) => {
        await tx.invoice.update({
          where: { id: inv.id },
          data: { dueDate: new Date(`${dueDate}T00:00:00.000Z`) },
        });
        return { invoiceNo, dueDate };
      },
    );
  }

  async voidInvoice(invoiceNo: string, reason: string, actor: { id: string; label: string }) {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { invoiceNo },
        select: { id: true, voidedAt: true },
      });
      if (!inv) throw new NotFoundException(`invoice ${invoiceNo} not found`);
      if (inv.voidedAt) throw new ConflictException(`already voided`);
      await tx.invoice.update({
        where: { id: inv.id },
        data: { voidedAt: new Date(), voidReason: reason, status: 'voided' },
      });
      await tx.invoiceActivity.create({
        data: {
          invoiceId: inv.id,
          kind: 'voided',
          actorLabel: actor.label,
          actorId: actor.id,
          summary: `Voided · ${reason}`,
        },
      });
      return { invoiceNo, voided: true };
    });
  }

  async unvoidInvoice(invoiceNo: string, actor: { id: string; label: string }) {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { invoiceNo },
        select: { id: true, voidedAt: true },
      });
      if (!inv) throw new NotFoundException(`invoice ${invoiceNo} not found`);
      if (!inv.voidedAt) throw new ConflictException(`not voided`);
      await tx.invoice.update({
        where: { id: inv.id },
        data: { voidedAt: null, voidReason: null, status: 'draft' },
      });
      await tx.invoiceActivity.create({
        data: {
          invoiceId: inv.id,
          kind: 'unvoided',
          actorLabel: actor.label,
          actorId: actor.id,
          summary: 'Voided state cleared',
        },
      });
      return { invoiceNo, voided: false };
    });
  }

  async recordPayment(
    invoiceNo: string,
    input: {
      amountCents: number;
      paidAt: string;
      method: 'ach' | 'wire' | 'card' | 'check' | 'other'; // InvoicePaymentMethod
      reference?: string;
      note?: string;
      markPaid?: boolean;
    },
    actor: { id: string; label: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { invoiceNo },
        include: { payments: true },
      });
      if (!inv) throw new NotFoundException(`invoice ${invoiceNo} not found`);
      if (inv.voidedAt) throw new ConflictException(`cannot pay voided invoice`);
      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId: inv.id,
          amountCents: BigInt(input.amountCents),
          paidAt: new Date(`${input.paidAt}T00:00:00.000Z`),
          method: input.method,
          reference: input.reference,
          note: input.note,
          recordedById: actor.id,
        },
      });
      const totalPaid =
        inv.payments.reduce((s, p) => s + p.amountCents, 0n) + BigInt(input.amountCents);
      const shouldFlipPaid =
        input.markPaid !== false && totalPaid >= inv.amountCents && inv.status !== 'paid';
      if (shouldFlipPaid) {
        await tx.invoice.update({ where: { id: inv.id }, data: { status: 'paid' } });
        await tx.invoiceActivity.create({
          data: {
            invoiceId: inv.id,
            kind: 'status_change',
            actorLabel: actor.label,
            actorId: actor.id,
            summary: 'Status → paid (payment fully settled invoice)',
          },
        });
      }
      await tx.invoiceActivity.create({
        data: {
          invoiceId: inv.id,
          kind: 'payment_recorded',
          actorLabel: actor.label,
          actorId: actor.id,
          summary: `Recorded ${input.amountCents} via ${input.method}${input.reference ? ` (ref ${input.reference})` : ''}`,
        },
      });
      return { paymentId: payment.id, autoFlippedPaid: shouldFlipPaid };
    });
  }

  /* ─── Confirm tokens ────────────────────────────────────────── */

  /** Mint a one-shot token for an invoice. Returns the URL-safe token. */
  async mintConfirmToken(invoiceNo: string, actor: { id: string; label: string }) {
    const inv = await this.prisma.invoice.findUnique({
      where: { invoiceNo },
      select: { id: true, voidedAt: true },
    });
    if (!inv) throw new NotFoundException(`invoice ${invoiceNo} not found`);
    if (inv.voidedAt) throw new ConflictException(`cannot send voided invoice`);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.tokenTtlHours * 3600 * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.confirmToken.create({
        data: { token, invoiceId: inv.id, expiresAt },
      });
      await tx.invoiceActivity.create({
        data: {
          invoiceId: inv.id,
          kind: 'email_composed',
          actorLabel: actor.label,
          actorId: actor.id,
          summary: `Composed confirm/dispute email · token expires ${expiresAt.toISOString()}`,
        },
      });
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }

  /** Resolve a token → minimal invoice view for the public confirm page. */
  async resolveConfirmToken(token: string) {
    const row = await this.prisma.confirmToken.findUnique({
      where: { token },
      include: {
        invoice: {
          include: {
            merchant: { select: { legalName: true, brand: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('invalid token');
    if (row.expiresAt < new Date()) throw new ForbiddenException('token expired');
    return {
      state: row.state,
      disputeReason: row.disputeReason,
      invoice: {
        invoiceNo: row.invoice.invoiceNo,
        merchant: row.invoice.merchant.legalName,
        vertical: row.invoice.merchant.brand,
        periodLabel: row.invoice.periodLabel,
        grossFundedCents: row.invoice.grossFundedCents.toString(),
        feeBps: row.invoice.feeBps,
        amountCents: row.invoice.amountCents.toString(),
        dueDate: row.invoice.dueDate.toISOString().slice(0, 10),
      },
    };
  }

  /** Apply the recipient's decision exactly once. */
  async applyConfirmDecision(
    token: string,
    decision: 'confirm' | 'dispute',
    forensics: { remoteIp?: string; userAgent?: string; reason?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.confirmToken.findUnique({
        where: { token },
        select: { id: true, invoiceId: true, state: true, expiresAt: true },
      });
      if (!row) throw new NotFoundException('invalid token');
      if (row.expiresAt < new Date()) throw new ForbiddenException('token expired');
      if (row.state !== 'pending') {
        throw new ConflictException(`already ${row.state}`);
      }
      const nextState = decision === 'confirm' ? 'confirmed' : 'disputed';
      await tx.confirmToken.update({
        where: { id: row.id },
        data: {
          state: nextState,
          actedAt: new Date(),
          disputeReason: decision === 'dispute' ? (forensics.reason ?? null) : null,
          remoteIp: forensics.remoteIp ?? null,
          userAgent: forensics.userAgent ?? null,
        },
      });
      await tx.invoiceActivity.create({
        data: {
          invoiceId: row.invoiceId,
          kind: decision === 'confirm' ? 'confirmed' : 'disputed',
          actorLabel: 'recipient',
          summary:
            decision === 'confirm'
              ? 'Recipient confirmed invoice'
              : `Recipient disputed${forensics.reason ? ` · ${forensics.reason}` : ''}`,
          remoteIp: forensics.remoteIp ?? null,
          userAgent: forensics.userAgent ?? null,
        },
      });
      return { state: nextState };
    });
  }
}
